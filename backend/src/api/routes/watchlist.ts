import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { isAddress } from "viem";
import { z } from "zod";
import { db } from "../../db/client.js";
import { watchlistItems } from "../../db/schema.js";
import { sendApiError } from "../errors.js";
import { assertUserAccess } from "../guards.js";
import { requireScope } from "../product-rules.js";

const watchlistBodySchema = z.object({
  tokenAddress: z.string().refine((value) => isAddress(value), "Invalid token address"),
  note: z.string().max(240).optional(),
});

export async function watchlistRoutes(app: FastifyInstance) {
  app.get<{ Params: { userId: string } }>("/v1/users/:userId/watchlist", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;

    const items = await db
      .select()
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, req.params.userId))
      .orderBy(desc(watchlistItems.createdAt));

    return { items };
  });

  app.post<{ Params: { userId: string } }>("/v1/users/:userId/watchlist", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;
    if (!requireScope(req, reply, "user:write")) return;

    const body = watchlistBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid watchlist request", body.error.issues);
    }

    const [item] = await db
      .insert(watchlistItems)
      .values({
        id: randomUUID(),
        userId: req.params.userId,
        tokenAddress: body.data.tokenAddress.toLowerCase(),
        note: body.data.note,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [watchlistItems.userId, watchlistItems.tokenAddress],
        set: {
          note: body.data.note,
          updatedAt: new Date(),
        },
      })
      .returning();

    return reply.status(201).send({ item });
  });

  app.delete<{ Params: { userId: string; tokenAddress: string } }>(
    "/v1/users/:userId/watchlist/:tokenAddress",
    async (req, reply) => {
      if (!assertUserAccess(req, reply, req.params.userId)) return;
      if (!requireScope(req, reply, "user:write")) return;

      if (!isAddress(req.params.tokenAddress)) {
        return sendApiError(reply, 422, "INVALID_ADDRESS", "invalid address");
      }

      const deleted = await db
        .delete(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userId, req.params.userId),
            eq(watchlistItems.tokenAddress, req.params.tokenAddress.toLowerCase())
          )
        )
        .returning();

      if (deleted.length === 0) return sendApiError(reply, 404, "NOT_FOUND", "watchlist item not found");
      return reply.send({ removed: true });
    }
  );
}
