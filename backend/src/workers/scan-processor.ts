/**
 * Scan Processor — BullMQ worker that processes token scan jobs.
 *
 * Consumes jobs from the "token-scan" queue (produced by discovery.ts or the API).
 * Each job runs the full 14-module scan engine against a token address.
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

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, "scan job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "scan worker error");
  });

  logger.info("scan processor started");
  return worker;
}
