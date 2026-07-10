/**
 * Fastify HTTP Server — API layer for Hood Terminal.
 *
 * Route groups:
 *   /health             — liveness probe (no auth)
 *   /v1/analyze         — POST full scan (send { token: "0x..." })
 *   /v1/scan/:address   — GET full scan
 *   /v1/score/:address  — GET lightweight score + band only
 *   /v1/token/:address  — GET token metadata
 *   /v1/deployer/:address — GET deployer reputation (WIP)
 *   /v1/wallet/:address — GET wallet rap sheet (WIP)
 *   /v1/stats/rpc       — GET RPC usage stats
 *
 * Auth: x-api-key header validated against Redis. Skipped in dev unless REQUIRE_AUTH=true.
 * Rate limit: 100 requests/minute per IP.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { authMiddleware } from "./middleware/auth.js";
import { scanRoutes } from "./routes/scan.js";
import { tokenRoutes } from "./routes/token.js";
import { statsRoutes } from "./routes/stats.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { alertRoutes } from "./routes/alerts.js";
import { walletAuthRoutes } from "./routes/wallet-auth.js";
import { sendApiError } from "./errors.js";

export async function createServer() {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "hold the line. too many arrows at once.",
      retryAfter: 60,
    }),
  });

  // Auth middleware (skips /health, skips dev without REQUIRE_AUTH)
  app.addHook("onRequest", authMiddleware);

  app.get("/health", async () => ({
    status: "alive",
    version: "0.1.0",
    chain: "robinhood",
    timestamp: Date.now(),
  }));

  await app.register(scanRoutes);
  await app.register(tokenRoutes);
  await app.register(statsRoutes);
  await app.register(walletAuthRoutes);
  await app.register(apiKeyRoutes);
  await app.register(watchlistRoutes);
  await app.register(alertRoutes);

  app.setNotFoundHandler(async (req, reply) => {
    return sendApiError(reply, 404, "NOT_FOUND", "no such trail", { path: req.url });
  });

  return app;
}
