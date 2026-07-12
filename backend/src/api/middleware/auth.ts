/**
 * API Key Authentication Middleware
 *
 * Keys are stored as SHA-256 hashes in Postgres and cached briefly in Redis.
 * To create a key: call createApiKey({ userId, tier }) — returns "ht_live_...".
 *
 * Behavior:
 *   - /health, /ready, and wallet-auth bootstrap routes are public
 *   - Product routes require either a signed wallet session or x-api-key
 *   - Development can opt out with REQUIRE_AUTH=false, but production cannot
 *
 * The middleware attaches userId, tier, apiKeyId, and scopes to the request
 * object for downstream use (e.g., tier-based rate limiting, audit logging).
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { env } from "../../config/env.js";
import { redis } from "../../config/redis.js";
import { db } from "../../db/client.js";
import { apiKeys, users } from "../../db/schema.js";
import { sendApiError } from "../errors.js";
import { readSession } from "../session.js";

const API_KEY_HEADER = "x-api-key";
const API_KEY_CACHE_PREFIX = "apikey-hash:";
const PUBLIC_ROUTES = new Set([
  "/health",
  "/ready",
  "/v1/auth/wallet/nonce",
  "/v1/auth/wallet/verify",
  "/v1/auth/session",
  "/v1/auth/logout",
]);

// Scan reads are open to guests even when REQUIRE_AUTH is on: the guest tier
// exists precisely for unauthenticated users (metered per-IP by product-rules
// quotas). Without this, production — where REQUIRE_AUTH is mandatory — would
// 401 every visitor before they could run a single scan. Everything else
// (alerts, API keys, watchlist) still requires a session or API key.
const GUEST_ALLOWED_PREFIXES = [
  "/v1/scan/", "/v1/score/", "/v1/analyze", "/v1/stats",
  // Discovery surfaces are public read-only: the bonding board, the pulse list,
  // and token/deployer lookups power pages guests browse before connecting.
  "/v1/bonding/", "/v1/pulse", "/v1/token/", "/v1/market/", "/v1/deployer", "/v1/source/",
];

function isGuestAllowed(path: string): boolean {
  return GUEST_ALLOWED_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health checks and wallet login/session bootstrap routes. The
  // route handlers still return 401 where appropriate (for example no session).
  if (PUBLIC_ROUTES.has(request.url.split("?")[0])) return;

  const session = readSession(request);
  if (session) {
    (request as any).userId = session.userId;
    (request as any).tier = session.tier;
    (request as any).walletAddress = session.walletAddress;
    (request as any).scopes = session.scopes;
    (request as any).authType = "session";
    return;
  }

  // Local-only escape hatch. The checked-in/test env now enables auth so the
  // product behaves like production by default.
  if (env.nodeEnv === "development" && !env.requireAuth) return;

  const apiKey = request.headers[API_KEY_HEADER] as string | undefined;

  if (!apiKey) {
    // No session, no key — allow through as a metered guest for scan reads only.
    if (isGuestAllowed(request.url.split("?")[0])) {
      (request as any).tier = "guest";
      (request as any).scopes = ["scan:read"];
      (request as any).authType = "guest";
      return;
    }
    return sendApiError(reply, 401, "UNAUTHORIZED", "missing api key", {
      header: API_KEY_HEADER,
    });
  }

  const keyHash = hashApiKey(apiKey);
  let keyData = await redis.get(`${API_KEY_CACHE_PREFIX}${keyHash}`);

  if (!keyData) {
    const [record] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (record) {
      keyData = JSON.stringify({
        apiKeyId: record.id,
        userId: record.userId,
        tier: record.tier ?? "free",
        scopes: record.scopes ?? [],
      });
      await redis.setex(`${API_KEY_CACHE_PREFIX}${keyHash}`, 300, keyData);
      db.update(apiKeys)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.id, record.id))
        .catch(() => undefined);
    }
  }

  if (!keyData) {
    return sendApiError(reply, 401, "UNAUTHORIZED", "invalid api key");
  }

  const parsed = JSON.parse(keyData) as {
    apiKeyId?: string;
    userId: string;
    tier: string;
    scopes?: string[];
    rateLimit?: number;
  };

  // Attach user context for downstream use
  (request as any).userId = parsed.userId;
  (request as any).tier = parsed.tier;
  (request as any).apiKeyId = parsed.apiKeyId;
  (request as any).scopes = parsed.scopes ?? [];
  (request as any).authType = "api_key";
}

export async function createApiKey(params: {
  userId: string;
  tier?: string;
  name?: string;
  scopes?: string[];
}): Promise<{ id: string; key: string; keyPrefix: string }> {
  const key = `ht_live_${generateKey(40)}`;
  const keyPrefix = key.slice(0, 14);
  const id = randomUUID();
  const keyHash = hashApiKey(key);

  await db
    .insert(users)
    .values({
      id: params.userId,
      tier: params.tier ?? "free",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        tier: params.tier ?? "free",
        updatedAt: new Date(),
      },
    });

  await db.insert(apiKeys).values({
    id,
    userId: params.userId,
    name: params.name ?? "Default key",
    keyHash,
    keyPrefix,
    scopes: params.scopes ?? ["scan:read"],
    tier: params.tier ?? "free",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await redis.setex(
    `${API_KEY_CACHE_PREFIX}${keyHash}`,
    300,
    JSON.stringify({ apiKeyId: id, userId: params.userId, tier: params.tier ?? "free", scopes: params.scopes ?? ["scan:read"] })
  );

  return { id, key, keyPrefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateKey(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const bytes = randomBytes(length);
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}
