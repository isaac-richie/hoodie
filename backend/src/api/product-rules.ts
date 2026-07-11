import type { FastifyReply, FastifyRequest } from "fastify";
import type { ScanResult } from "../engine/types.js";
import { redis, CACHE_KEYS } from "../config/redis.js";
import { sendApiError } from "./errors.js";

export type ProductTier = "guest" | "free" | "pro" | "team";

interface TierPolicy {
  dailyScans: number;
  rpm: number;
  modules: "core" | "all";
  scopes: string[];
}

const CORE_MODULES = new Set([
  "honeypot_sim",
  "lp_lock",
  "ownership",
  "hidden_mint",
  "mutable_tax",
  "blacklist",
  "trading_pause",
  "proxy_check",
  "deployer_reputation",
]);

const POLICIES: Record<ProductTier, TierPolicy> = {
  guest: { dailyScans: 100, rpm: 30, modules: "all", scopes: ["scan:read"] },
  free: { dailyScans: 10, rpm: 30, modules: "core", scopes: ["scan:read", "user:write"] },
  pro: { dailyScans: 1000, rpm: 120, modules: "all", scopes: ["scan:read", "user:write", "alerts:write"] },
  team: { dailyScans: 5000, rpm: 300, modules: "all", scopes: ["scan:read", "user:write", "alerts:write", "team:write"] },
};

export function getRequestTier(request: FastifyRequest): ProductTier {
  return normalizeTier((request as any).tier);
}

export function getRequestScopes(request: FastifyRequest): string[] {
  return Array.isArray((request as any).scopes) ? (request as any).scopes : [];
}

export function requireScope(request: FastifyRequest, reply: FastifyReply, scope: string): boolean {
  const scopes = getRequestScopes(request);
  if (scopes.length === 0 && !scope.includes(":write")) return true;
  if (scopes.includes(scope) || scopes.includes("*")) return true;

  sendApiError(reply, 403, "SCOPE_REQUIRED", `missing required scope: ${scope}`);
  return false;
}

export async function enforceScanQuota(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const tier = getRequestTier(request);
  const policy = POLICIES[tier];
  const identity = getIdentity(request);
  const day = new Date().toISOString().slice(0, 10);
  const minute = Math.floor(Date.now() / 60_000);
  const dailyKey = CACHE_KEYS.rateLimit(`scan:${tier}:${identity}:${day}`);
  const minuteKey = CACHE_KEYS.rateLimit(`scan-rpm:${tier}:${identity}:${minute}`);

  const [daily, rpm] = await Promise.all([increment(dailyKey, 86400), increment(minuteKey, 120)]);
  if (daily > policy.dailyScans) {
    sendApiError(reply, 429, "SCAN_QUOTA_EXCEEDED", `${tier} tier scan quota exceeded`, {
      tier,
      limit: policy.dailyScans,
      window: "day",
    });
    return false;
  }

  if (rpm > policy.rpm) {
    sendApiError(reply, 429, "RATE_LIMITED", `${tier} tier scan rate exceeded`, {
      tier,
      limit: policy.rpm,
      window: "minute",
    });
    return false;
  }

  return true;
}

export function applyModuleGate(result: ScanResult, request: FastifyRequest): ScanResult {
  const tier = getRequestTier(request);
  const policy = POLICIES[tier];
  if (policy.modules === "all") return result;

  const moduleResults = result.moduleResults.filter((moduleResult) => CORE_MODULES.has(moduleResult.module));
  return {
    ...result,
    moduleResults,
    modulesRan: moduleResults.filter((moduleResult) => moduleResult.status !== "timeout").length,
    modulesTotal: moduleResults.length,
    summary: `${result.summary} Advanced launch/funding modules require Pro.`,
  };
}

export function tierPolicySnapshot() {
  return POLICIES;
}

export function normalizeTier(value: unknown): ProductTier {
  const tier = String(value ?? "guest").toLowerCase();
  return tier === "team" || tier === "pro" || tier === "free" ? tier : "guest";
}

export function scopesForTier(tierInput: unknown): string[] {
  return POLICIES[normalizeTier(tierInput)].scopes;
}

export function capTier(requestedInput: unknown, maxInput: unknown): ProductTier {
  const requested = normalizeTier(requestedInput);
  const max = normalizeTier(maxInput);
  return rank(requested) <= rank(max) ? requested : max === "guest" ? "free" : max;
}

function rank(tier: ProductTier): number {
  if (tier === "team") return 3;
  if (tier === "pro") return 2;
  if (tier === "free") return 1;
  return 0;
}

function getIdentity(request: FastifyRequest): string {
  const userId = (request as any).userId as string | undefined;
  const apiKeyId = (request as any).apiKeyId as string | undefined;
  // Use request.ip, which Fastify derives from X-Forwarded-For ONLY when
  // trustProxy is enabled (i.e. behind a known proxy). Reading the raw XFF
  // header here let any client spoof it and mint a fresh quota per request.
  return userId ?? apiKeyId ?? request.ip ?? "unknown";
}

async function increment(key: string, ttlSeconds: number): Promise<number> {
  const value = await redis.incr(key);
  if (value === 1) await redis.expire(key, ttlSeconds);
  return value;
}
