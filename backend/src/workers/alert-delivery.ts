import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { alertEvents } from "../db/schema.js";
import { ALERT_DELIVERY_QUEUE, type AlertDeliveryJobData } from "../services/alert-evaluator.js";
import { logger } from "../utils/logger.js";
import { assertSafeWebhookTarget } from "../utils/safe-url.js";

export function startAlertDeliveryWorker(): Worker {
  const worker = new Worker<AlertDeliveryJobData>(
    ALERT_DELIVERY_QUEUE,
    async (job: Job<AlertDeliveryJobData>) => {
      const data = job.data;

      if (data.channel === "webhook") {
        if (!data.webhookUrl) {
          throw new Error("webhook channel missing webhookUrl");
        }

        // Re-validate at send time (defeats DNS rebinding since creation) and
        // resolve the host to confirm it isn't a private/metadata address.
        const safeUrl = await assertSafeWebhookTarget(data.webhookUrl);

        // Bound the request so a slow/hanging endpoint can't tie up a worker.
        const response = await fetch(safeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.payload),
          redirect: "error", // don't follow redirects into blocked ranges
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          throw new Error(`webhook returned ${response.status}`);
        }
      }

      await db.insert(alertEvents).values({
        id: randomUUID(),
        alertId: data.alertId,
        userId: data.userId,
        targetAddress: data.targetAddress,
        channel: data.channel,
        status: "delivered",
        payload: data.payload,
        createdAt: new Date(),
      });

      return { delivered: true };
    },
    {
      connection: { url: env.redisUrl },
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000,
      },
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    logger.warn({ jobId: job.id, err: err.message }, "alert delivery job failed");

    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    await db.insert(alertEvents).values({
      id: randomUUID(),
      alertId: job.data.alertId,
      userId: job.data.userId,
      targetAddress: job.data.targetAddress,
      channel: job.data.channel,
      status: "failed",
      payload: job.data.payload,
      error: err.message,
      createdAt: new Date(),
    });
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "alert delivery worker error");
  });

  logger.info("alert delivery worker started");
  return worker;
}
