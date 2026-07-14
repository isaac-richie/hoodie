/**
 * Stats Routes — monitoring and observability endpoints.
 *
 * GET  /v1/stats/rpc       — RPC call count, cache hit rate, calls/sec
 * GET  /v1/stats/scans     — lifetime scan totals (public, read-only)
 * POST /v1/stats/rpc/reset — reset counters (useful after deploys)
 *
 * Use these to monitor RPC costs. A healthy cache hit rate is >80%.
 * If it drops below 50%, check if Redis is down or if cache TTLs are too short.
 */
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { contractConfig } from "../../config/contracts.js";
import { cachedRpc } from "../../services/rpc-cache.js";
import { getRpcStats, resetRpcStats } from "../../services/rpc-cache.js";
import { tierPolicySnapshot } from "../product-rules.js";
import { db } from "../../db/client.js";
import { scanResults } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";

export async function statsRoutes(app: FastifyInstance) {
  // GET /v1/stats/rpc — see RPC usage and cache hit rate
  app.get("/v1/stats/rpc", async () => {
    return getRpcStats();
  });

  // GET /v1/stats/scans — lifetime scan totals straight from the DB this
  // backend writes to. Read-only and public (already under the guest-allowed
  // /v1/stats prefix) so the true production count is visible off the live API.
  app.get("/v1/stats/scans", async () => {
    try {
      const [row] = await db
        .select({
          totalScans: sql<number>`count(*)::int`,
          uniqueTokens: sql<number>`count(distinct ${scanResults.tokenAddress})::int`,
          scans24h: sql<number>`count(*) filter (where ${scanResults.createdAt} >= now() - interval '24 hours')::int`,
          first: sql<string | null>`min(${scanResults.createdAt})`,
          latest: sql<string | null>`max(${scanResults.createdAt})`,
        })
        .from(scanResults);
      return {
        totalScans: row?.totalScans ?? 0,
        uniqueTokens: row?.uniqueTokens ?? 0,
        scans24h: row?.scans24h ?? 0,
        first: row?.first ?? null,
        latest: row?.latest ?? null,
      };
    } catch (err) {
      logger.warn({ err: (err as Error)?.message }, "scan stats query failed");
      return { totalScans: null, uniqueTokens: null, scans24h: null, first: null, latest: null, error: "stats unavailable" };
    }
  });

  app.get("/v1/stats/chain", async () => {
    let rpcChainId: number | null = null;
    let rpcReachable = false;
    let error: string | undefined;

    try {
      rpcChainId = await cachedRpc.raw.getChainId();
      rpcReachable = true;
    } catch (err) {
      error = (err as Error).message;
    }

    return {
      configuredChainId: env.chainId,
      rpcChainId,
      rpcReachable,
      matchesConfigured: rpcChainId === null ? false : rpcChainId === env.chainId,
      dexFactoriesConfigured: contractConfig.dexFactories.length,
      quoteTokensConfigured: contractConfig.quoteTokens.length,
      lpLockersConfigured: contractConfig.lpLockers.length,
      launchpadsConfigured: contractConfig.launchpads.length,
      error,
    };
  });

  app.get("/v1/stats/product-rules", async () => {
    return tierPolicySnapshot();
  });

  // POST /v1/stats/rpc/reset — reset counters
  app.post("/v1/stats/rpc/reset", async () => {
    resetRpcStats();
    return { message: "counters reset" };
  });
}
