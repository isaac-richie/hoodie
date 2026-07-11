/**
 * Token Metadata Resolver — aggregates all context about a token.
 *
 * This is the first thing the scanner calls. It resolves in parallel:
 *   - ERC20 basics (name, symbol, decimals, totalSupply)
 *   - Deployer info (who deployed it, in which block/tx)
 *   - LP pool info (which DEX, paired asset, liquidity depth)
 *
 * The result is passed into every scan module via ScanContext.
 * Cached 1 hour in Redis — token metadata rarely changes.
 *
 * Uses Promise.allSettled so a failure in one resolver (e.g., deployer)
 * doesn't block the others. Partial metadata is better than none.
 */
import type { Address } from "viem";
import { cachedRpc } from "./rpc-cache.js";
import { erc20Abi } from "../utils/abis.js";
import { redis, CACHE_KEYS } from "../config/redis.js";
import { env } from "../config/env.js";
import { resolveDeployer } from "./deployer-resolver.js";
import { findLpPool, type LpPoolInfo } from "./lp-resolver.js";
import { resolveLaunchpadInfo, type LaunchpadInfo } from "./launchpad-resolver.js";
import { logger } from "../utils/logger.js";

export interface TokenMeta {
  address: Address;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: bigint;
  deployer?: Address;
  deployBlock?: number;
  deployTx?: string;
  lpPool?: Address;
  lpInfo?: LpPoolInfo;
  launchpad?: LaunchpadInfo;
}

export async function resolveTokenMeta(address: Address): Promise<TokenMeta> {
  const cached = await redis.get(CACHE_KEYS.tokenMeta(address));
  if (cached) return JSON.parse(cached, bigIntReviver);

  const meta: TokenMeta = { address };

  // Wall-clock budget for the whole resolution phase. Every resolver races this
  // one shared deadline — a resolver that misses it yields null and the scan
  // proceeds with partial metadata instead of stalling the user for minutes.
  const deadlineAt = Date.now() + env.metaTimeoutMs;
  let timedOut = false;
  const bounded = async <T>(promise: Promise<T>): Promise<T | null> => {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      timedOut = true;
      return null;
    }
    const result = await Promise.race([
      promise.then((value) => ({ value, hit: false })).catch(() => ({ value: null as T | null, hit: false })),
      new Promise<{ value: null; hit: true }>((resolve) => {
        const timer = setTimeout(() => resolve({ value: null, hit: true }), remaining);
        timer.unref?.();
      }),
    ]);
    if (result.hit) timedOut = true;
    return result.value;
  };

  // Fetch ERC20 info + deployer + LP in parallel.
  const [name, symbol, decimals, totalSupply, deployInfo, lpInfo] = await Promise.all([
    bounded(cachedRpc.readContract({ address, abi: erc20Abi, functionName: "name", ttlMs: 3600_000 })),
    bounded(cachedRpc.readContract({ address, abi: erc20Abi, functionName: "symbol", ttlMs: 3600_000 })),
    bounded(cachedRpc.readContract({ address, abi: erc20Abi, functionName: "decimals", ttlMs: 3600_000 })),
    bounded(cachedRpc.readContract({ address, abi: erc20Abi, functionName: "totalSupply", ttlMs: 60_000 })),
    bounded(resolveDeployer(address)),
    bounded(findLpPool(address)),
  ]);

  if (name != null) meta.name = name as string;
  if (symbol != null) meta.symbol = symbol as string;
  if (decimals != null) meta.decimals = Number(decimals);
  if (totalSupply != null) meta.totalSupply = totalSupply as bigint;

  if (deployInfo) {
    meta.deployer = deployInfo.deployer;
    meta.deployBlock = deployInfo.deployBlock;
    meta.deployTx = deployInfo.deployTx;
  }

  if (lpInfo) {
    meta.lpPool = lpInfo.poolAddress;
    meta.lpInfo = lpInfo;
    meta.launchpad = lpInfo.launchpad;
  }

  // On-chain launchpad deployer fallback: when the block explorer creator lookup
  // fails (flaky Blockscout) we can still recover the true deployer from the
  // launchpad's TokenLaunched event — but only bounded by a known deploy block,
  // since an unbounded from-genesis event scan is far too slow to run per request.
  if (!meta.deployer && meta.deployBlock) {
    const launchpadInfo = await bounded(resolveLaunchpadInfo(address, meta.deployBlock));
    if (launchpadInfo?.deployer) {
      meta.deployer = launchpadInfo.deployer;
      if (!meta.launchpad) meta.launchpad = launchpadInfo;
    }
  }

  // A deadline miss means the metadata is incomplete — cache it briefly so the
  // next scan retries (the chunk caches it warmed make the retry much faster),
  // instead of pinning a degraded result for a full hour.
  if (timedOut) {
    logger.warn({ token: address, budgetMs: env.metaTimeoutMs }, "token meta resolution hit wall-clock cap — proceeding with partial metadata");
  }
  await redis.setex(CACHE_KEYS.tokenMeta(address), timedOut ? 300 : 3600, JSON.stringify(meta, bigIntReplacer));

  return meta;
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `__bigint:${value.toString()}`;
  return value;
}

function bigIntReviver(key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("__bigint:")) {
    return BigInt(value.slice("__bigint:".length));
  }

  // Backward-compatible read for older cache entries written as plain strings.
  if (key === "totalSupply" && typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  return value;
}
