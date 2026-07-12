/**
 * Scan Processor — BullMQ worker that processes token scan jobs.
 *
 * Consumes jobs from the "token-scan" queue (produced by discovery.ts or the API).
 * Each job runs the full scan engine against a token address.
 *
 * Rate limited to 10 jobs/second to avoid hammering the RPC.
 * Failed jobs retry 3 times with exponential backoff (5s, 10s, 20s).
 *
 * This runs in the same Node process as the API server. If you need to scale
 * scan throughput independently, you can run this file on a separate instance —
 * it just needs access to the same Redis and RPC endpoint.
 */
import { Worker, type Job } from "bullmq";
import type { Address } from "viem";
import { env } from "../config/env.js";
import { scanToken } from "../engine/scanner.js";
import { logger } from "../utils/logger.js";

interface ScanJobData {
  tokenAddress: Address;
  discoveryBlock?: number;
}

const SCAN_QUEUE = "token-scan";

export function startScanProcessor(): Worker {
  const worker = new Worker<ScanJobData>(
    SCAN_QUEUE,
    async (job: Job<ScanJobData>) => {
      const { tokenAddress, discoveryBlock } = job.data;
      logger.info({ tokenAddress, discoveryBlock, jobId: job.id }, "processing scan job");

      const result = await scanToken(tokenAddress);

      logger.info(
        { tokenAddress, score: result.score, band: result.band, durationMs: result.durationMs },
        "scan job complete"
      );

      return { score: result.score, band: result.band };
    },
    {
      connection: { url: env.redisUrl },
      concurrency: env.scanConcurrency,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  // Dead-letter handling: a job that has exhausted its retry budget is silently
  // dropped by BullMQ. That's fine for one bad token, but a spike (RPC outage,
  // upstream schema change) can drain the queue invisibly. Track exhausted
  // failures per minute in Redis and fatal-log when the rate crosses a floor
  // — the process manager / monitoring can page from there.
  const DEAD_LETTER_KEY = "scan:deadletter";
  const DEAD_LETTER_ALERT_THRESHOLD = 5; // exhausted failures per rolling minute

  worker.on("failed", async (job, err) => {
    const exhausted = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!exhausted) {
      // Still retrying — warn, don't page.
      logger.warn({ jobId: job?.id, attempt: job?.attemptsMade, err: err.message }, "scan job attempt failed, will retry");
      return;
    }
    logger.error(
      { jobId: job?.id, tokenAddress: job?.data.tokenAddress, attempts: job?.attemptsMade, err: err.message },
      "scan job DEAD-LETTERED — retries exhausted"
    );
    try {
      // Rolling window: increment a minute-bucketed counter with a 90s expiry
      // so the count naturally decays. A 5+ count in one minute is a systemic
      // issue that deserves loud attention.
      const bucket = Math.floor(Date.now() / 60_000);
      const key = `${DEAD_LETTER_KEY}:${bucket}`;
      const { redis } = await import("../config/redis.js");
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 90);
      if (count >= DEAD_LETTER_ALERT_THRESHOLD) {
        logger.fatal(
          { count, windowMinuteBucket: bucket },
          `SCAN DEAD-LETTER FLOOD: ${count} scans exhausted retries within this minute — investigate RPC / upstream health`
        );
      }
    } catch (bookkeepingErr) {
      logger.error({ err: (bookkeepingErr as Error).message }, "dead-letter bookkeeping failed");
    }
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "scan worker error");
  });

  logger.info("scan processor started");
  return worker;
}
