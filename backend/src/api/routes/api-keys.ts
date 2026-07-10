import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { isAddress } from "viem";
import { z } from "zod";
import { redis } from "../../config/redis.js";
import { db } from "../../db/client.js";
import { apiKeys, users } from "../../db/schema.js";
import { createApiKey } from "../middleware/auth.js";
import { sendApiError } from "../errors.js";
import { assertUserAccess, getRequestUserId } from "../guards.js";
import { capTier, getRequestTier, requireScope, scopesForTier } from "../product-rules.js";

const createKeySchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(80).optional().default("Default key"),
  tier: z.string().min(1).optional().default("free"),
  scopes: z.array(z.string().min(1)).optional().default(["scan:read"]),
});

const upsertUserSchema = z.object({
  id: z.string().min(1).optional(),
  walletAddress: z.string().refine((value) => isAddress(value), "Invalid wallet address").optional(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(80).optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  app.post("/v1/users", async (req, reply) => {
    const body = upsertUserSchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid user request", body.error.issues);
    }

    if (!requireScope(req, reply, "user:write")) return;

    const id = body.data.id ?? body.data.walletAddress?.toLowerCase() ?? randomUUID();
    if (!assertUserAccess(req, reply, id)) return;
    const [user] = await db
      .insert(users)
      .values({
        id,
        walletAddress: body.data.walletAddress?.toLowerCase(),
        email: body.data.email,
        displayName: body.data.displayName,
        tier: "free",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          walletAddress: body.data.walletAddress?.toLowerCase(),
          email: body.data.email,
          displayName: body.data.displayName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return reply.status(201).send({ user });
  });

  app.get<{ Params: { userId: string } }>("/v1/users/:userId", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;

    const [user] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!user) return sendApiError(reply, 404, "NOT_FOUND", "user not found");
    return reply.send({ user });
  });

  app.post("/v1/api-keys", async (req, reply) => {
    const body = createKeySchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid api key request", body.error.issues);
    }
    if (!assertUserAccess(req, reply, body.data.userId)) return;
    if (!requireScope(req, reply, "user:write")) return;

    const effectiveTier = (req as any).userId ? capTier(body.data.tier, getRequestTier(req)) : body.data.tier;
    const effectiveScopes = body.data.scopes.filter((scope) => scopesForTier(effectiveTier).includes(scope) || scope === "scan:read");
    const created = await createApiKey({
      userId: body.data.userId,
      name: body.data.name,
      tier: effectiveTier,
      scopes: effectiveScopes.length > 0 ? effectiveScopes : scopesForTier(effectiveTier),
    });

    return reply.status(201).send({
      id: created.id,
      key: created.key,
      keyPrefix: created.keyPrefix,
      userId: body.data.userId,
      name: body.data.name,
      tier: effectiveTier,
      scopes: effectiveScopes.length > 0 ? effectiveScopes : scopesForTier(effectiveTier),
      createdAt: Date.now(),
    });
  });

  app.get<{ Querystring: { userId?: string } }>("/v1/api-keys", async (req, reply) => {
    if (!req.query.userId) {
      return sendApiError(reply, 422, "BAD_REQUEST", "userId query parameter is required");
    }
    if (!assertUserAccess(req, reply, req.query.userId)) return;

    const keys = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        tier: apiKeys.tier,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, req.query.userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));

    return reply.send({ keys });
  });

  app.delete<{ Params: { id: string } }>("/v1/api-keys/:id", async (req, reply) => {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, req.params.id)).limit(1);
    if (!key || key.revokedAt) {
      return sendApiError(reply, 404, "NOT_FOUND", "api key not found");
    }
    const authenticatedUserId = getRequestUserId(req);
    if (authenticatedUserId && authenticatedUserId.toLowerCase() !== key.userId.toLowerCase()) {
      return sendApiError(reply, 403, "FORBIDDEN", "user does not own this api key");
    }

    await db
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, req.params.id));
    await redis.del(`apikey-hash:${key.keyHash}`);

    return reply.send({ revoked: true, id: req.params.id });
  });
}
