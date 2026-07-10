/**
 * Stats Routes — monitoring and observability endpoints.
 *
 * GET  /v1/stats/rpc       — RPC call count, cache hit rate, calls/sec
 * POST /v1/stats/rpc/reset — reset counters (useful after deploys)
 *
 * Use these to monitor RPC costs. A healthy cache hit rate is >80%.
 * If it drops below 50%, check if Redis is down or if cache TTLs are too short.
 */
import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { contractConfig } from "../../config/contracts.js";
import { cachedRpc } from "../../services/rpc-cache.js";
import { getRpcStats, resetRpcStats } from "../../services/rpc-cache.js";
import { tierPolicySnapshot } from "../product-rules.js";

export async function statsRoutes(app: FastifyInstance) {
  // GET /v1/stats/rpc — see RPC usage and cache hit rate
  app.get("/v1/stats/rpc", async () => {
    return getRpcStats();
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
