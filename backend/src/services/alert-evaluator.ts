import { eq, and } from "drizzle-orm";
import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { alerts } from "../db/schema.js";
import type { ScanResult } from "../engine/types.js";

export const ALERT_DELIVERY_QUEUE = "alert-delivery";

export interface AlertDeliveryJobData {
  alertId: string;
  userId: string;
  targetAddress: string;
  channel: string;
  webhookUrl?: string;
  payload: Record<string, unknown>;
}

const alertDeliveryQueue = new Queue<AlertDeliveryJobData>(ALERT_DELIVERY_QUEUE, {
  connection: { url: env.redisUrl },
});

export async function evaluateAlertsForScan(result: ScanResult): Promise<void> {
  const targetAddress = result.tokenAddress.toLowerCase();
  const rules = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.targetAddress, targetAddress), eq(alerts.isActive, true)));

  for (const rule of rules) {
    if (!shouldFire(rule.triggerType, rule.threshold, result)) continue;

    const payload = {
      alertId: rule.id,
      userId: rule.userId,
      targetAddress,
      triggerType: rule.triggerType,
      threshold: rule.threshold,
      score: result.score,
      band: result.band,
      confidence: result.confidence,
      summary: result.summary,
      timestamp: result.timestamp,
    };

    const channels = rule.deliveryChannels?.length ? rule.deliveryChannels : ["in_app"];
    for (const channel of channels) {
      await alertDeliveryQueue.add(
        `${rule.id}:${channel}:${result.timestamp}`,
        {
          alertId: rule.id,
          userId: rule.userId,
          targetAddress,
          channel,
          webhookUrl: rule.webhookUrl ?? undefined,
          payload,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        }
      );
    }

    await db
      .update(alerts)
      .set({ lastFiredAt: new Date(), updatedAt: new Date() })
      .where(eq(alerts.id, rule.id));
  }
}

function shouldFire(triggerType: string, threshold: number | null, result: ScanResult): boolean {
  switch (triggerType) {
    case "score_above":
      return result.score >= (threshold ?? 75);
    case "score_below":
      return result.score <= (threshold ?? 25);
    case "band_high":
      return result.band === "high" || result.band === "extreme";
    case "band_extreme":
      return result.band === "extreme";
    case "scan_complete":
      return true;
    default:
      return false;
  }
}
