/**
 * API Key Authentication Middleware
 *
 * Keys are stored as SHA-256 hashes in Postgres and cached briefly in Redis.
 * To create a key: call createApiKey({ userId, tier }) — returns "ht_live_...".
 *
 * Behavior:
 *   - /health is always unauthenticated (for load balancer probes)
 *   - In development: auth is skipped unless REQUIRE_AUTH=true in .env
 *   - In production: all routes require a valid x-api-key header
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
const LEGACY_API_KEY_PREFIX = "apikey:";
const API_KEY_CACHE_PREFIX = "apikey-hash:";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health check and wallet login bootstrap routes.
  if (
    request.url === "/health" ||
    request.url === "/v1/auth/wallet/nonce" ||
    request.url === "/v1/auth/wallet/verify"
  ) return;

  const session = readSession(request);
  if (session) {
    (request as any).userId = session.userId;
    (request as any).tier = session.tier;
    (request as any).walletAddress = session.walletAddress;
    (request as any).scopes = session.scopes;
    (request as any).authType = "session";
    return;
  }

  // Skip auth in development if no keys are configured
  if (env.nodeEnv === "development" && !env.requireAuth) return;

  const apiKey = request.headers[API_KEY_HEADER] as string | undefined;

  if (!apiKey) {
    if (request.url === "/v1/auth/session" || request.url === "/v1/auth/logout") return;

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

  // Legacy Redis keys are supported so old local keys do not break immediately.
  if (!keyData) {
    keyData = await redis.get(`${LEGACY_API_KEY_PREFIX}${apiKey}`);
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
