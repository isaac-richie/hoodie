/**
 * Hood Terminal — Entry Point
 *
 * Single-process architecture: API server + background workers run together.
 * The discovery worker watches new blocks for token deploys, the scan processor
 * picks jobs off a BullMQ queue in Redis. If you ever need to scale, you can
 * run workers on a separate instance with zero code changes — they share the
 * same Redis queue.
 *
 * Boot order: Redis → HTTP server → discovery worker → scan processor.
 * Shutdown is graceful: stop workers first, then server, then Redis.
 */
import { createServer } from "./api/server.js";
import { env } from "./config/env.js";
import { redis } from "./config/redis.js";
import { startDiscoveryWorker } from "./workers/discovery.js";
import { startScanProcessor } from "./workers/scan-processor.js";
import { startAlertDeliveryWorker } from "./workers/alert-delivery.js";
import { logger } from "./utils/logger.js";

async function main() {
  logger.info("Hood Terminal engine starting…");

  await redis.connect();
  logger.info("Redis connected");

  const app = await createServer();
  await app.listen({ port: env.port, host: env.host });
  logger.info(`API live on ${env.host}:${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
  logger.info(`RPC: ${env.rpcUrl.replace(/\/[^/]+$/, "/***")}`);

  const stopDiscovery = await startDiscoveryWorker();
  const scanWorker = startScanProcessor();
  const alertDeliveryWorker = startAlertDeliveryWorker();
  logger.info("workers started: discovery + scan processor + alert delivery");

  const shutdown = async () => {
    logger.info("Shutting down…");
    stopDiscovery();
    await scanWorker.close();
    await alertDeliveryWorker.close();
    await app.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal(err, "Failed to start");
  process.exit(1);
});
