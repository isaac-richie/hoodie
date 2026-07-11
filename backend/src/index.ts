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

// Global safety nets so one stray rejection/exception doesn't silently kill the
// shared API+worker process. An unhandled rejection is logged and swallowed (the
// process keeps serving); an uncaught exception leaves the process in an unknown
// state, so we log it fatally and let the process manager restart us cleanly.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection (kept process alive)");
});
process.on("uncaughtException", (err) => {
  logger.fatal(err, "uncaughtException — exiting for a clean restart");
  process.exit(1);
});

async function main() {
  const role = env.role;
  logger.info(`Hood Terminal engine starting… (role: ${role})`);

  await redis.connect();
  logger.info("Redis connected");

  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  let stopDiscovery: (() => void) | undefined;
  let scanWorker: ReturnType<typeof startScanProcessor> | undefined;
  let alertDeliveryWorker: ReturnType<typeof startAlertDeliveryWorker> | undefined;

  if (role === "all" || role === "api") {
    app = await createServer();
    await app.listen({ port: env.port, host: env.host });
    logger.info(`API live on ${env.host}:${env.port}`);
    logger.info(`Environment: ${env.nodeEnv}`);
    logger.info(`RPC: ${env.rpcUrl.replace(/\/[^/]+$/, "/***")}`);
  }

  if (role === "all" || role === "worker") {
    stopDiscovery = await startDiscoveryWorker();
    scanWorker = startScanProcessor();
    alertDeliveryWorker = startAlertDeliveryWorker();
    logger.info("workers started: discovery + scan processor + alert delivery");
  }

  const shutdown = async () => {
    logger.info("Shutting down…");
    stopDiscovery?.();
    await scanWorker?.close();
    await alertDeliveryWorker?.close();
    await app?.close();
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
