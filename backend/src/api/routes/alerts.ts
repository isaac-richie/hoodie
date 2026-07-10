import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { isAddress } from "viem";
import { z } from "zod";
import { db } from "../../db/client.js";
import { alertEvents, alerts } from "../../db/schema.js";
import { sendApiError } from "../errors.js";
import { assertUserAccess, getRequestUserId } from "../guards.js";
import { requireScope } from "../product-rules.js";

const alertBodySchema = z.object({
  targetAddress: z.string().refine((value) => isAddress(value), "Invalid target address"),
  triggerType: z.string().min(1),
  threshold: z.number().int().min(0).max(100).optional(),
  deliveryChannels: z.array(z.string().min(1)).optional().default(["in_app"]),
  webhookUrl: z.string().url().optional(),
  isActive: z.boolean().optional().default(true),
});

const alertPatchSchema = alertBodySchema.partial();

export async function alertRoutes(app: FastifyInstance) {
  app.get<{ Params: { userId: string } }>("/v1/users/:userId/alerts", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;

    const rows = await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, req.params.userId))
      .orderBy(desc(alerts.createdAt));

    return { alerts: rows };
  });

  app.get<{ Params: { userId: string } }>("/v1/users/:userId/alert-events", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;

    const rows = await db
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.userId, req.params.userId))
      .orderBy(desc(alertEvents.createdAt))
      .limit(100);

    return { events: rows };
  });

  app.post<{ Params: { userId: string } }>("/v1/users/:userId/alerts", async (req, reply) => {
    if (!assertUserAccess(req, reply, req.params.userId)) return;
    if (!requireScope(req, reply, "alerts:write")) return;

    const body = alertBodySchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid alert request", body.error.issues);
    }

    const [alert] = await db
      .insert(alerts)
      .values({
        id: randomUUID(),
        userId: req.params.userId,
        targetAddress: body.data.targetAddress.toLowerCase(),
        triggerType: body.data.triggerType,
        threshold: body.data.threshold,
        deliveryChannels: body.data.deliveryChannels,
        webhookUrl: body.data.webhookUrl,
        isActive: body.data.isActive,
        updatedAt: new Date(),
      })
      .returning();

    return reply.status(201).send({ alert });
  });

  app.patch<{ Params: { alertId: string } }>("/v1/alerts/:alertId", async (req, reply) => {
    const body = alertPatchSchema.safeParse(req.body);
    if (!body.success) {
      return sendApiError(reply, 422, "BAD_REQUEST", "invalid alert update", body.error.issues);
    }

    const authenticatedUserId = getRequestUserId(req);
    if (!requireScope(req, reply, "alerts:write")) return;
    const [existing] = await db.select().from(alerts).where(eq(alerts.id, req.params.alertId)).limit(1);
    if (!existing) return sendApiError(reply, 404, "NOT_FOUND", "alert not found");
    if (authenticatedUserId && authenticatedUserId.toLowerCase() !== existing.userId.toLowerCase()) {
      return sendApiError(reply, 403, "FORBIDDEN", "user does not own this alert");
    }

    const [alert] = await db
      .update(alerts)
      .set({
        ...body.data,
        targetAddress: body.data.targetAddress?.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, req.params.alertId))
      .returning();

    return reply.send({ alert });
  });

  app.delete<{ Params: { alertId: string } }>("/v1/alerts/:alertId", async (req, reply) => {
    const authenticatedUserId = getRequestUserId(req);
    if (!requireScope(req, reply, "alerts:write")) return;
    const [existing] = await db.select().from(alerts).where(eq(alerts.id, req.params.alertId)).limit(1);
    if (!existing) return sendApiError(reply, 404, "NOT_FOUND", "alert not found");
    if (authenticatedUserId && authenticatedUserId.toLowerCase() !== existing.userId.toLowerCase()) {
      return sendApiError(reply, 403, "FORBIDDEN", "user does not own this alert");
    }

    await db.delete(alerts).where(eq(alerts.id, req.params.alertId));
    return reply.send({ deleted: true });
  });
}
