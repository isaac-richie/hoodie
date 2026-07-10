/**
 * LP Pool Resolver — finds the primary liquidity pool for a token.
 *
 * Used by the scan engine to: check LP lock status, estimate liquidity depth,
 * simulate buy/sell in the honeypot module, and identify the paired asset.
 *
 * Strategy waterfall:
 *   1. Query DEX factory contracts (getPair) — fastest, needs factory address in .env
 *   2. Search PairCreated events              — works without config, slower
 *   3. Detect launchpad custody/curves        — launchpad lifecycle-aware fallback
 *
 * If multiple pools exist, returns the one with deepest liquidity.
 * Results cached 10 min in Redis (pools are stable but liquidity changes).
 *
 * DEX addresses are read from .env (DEX_FACTORY_ADDRESS, WETH_ADDRESS).
 * If not set, strategies 1 and 2 are skipped gracefully.
 */
import type { Address } from "viem";
import { cachedRpc } from "./rpc-cache.js";
import { redis } from "../config/redis.js";
import { contractConfig } from "../config/contracts.js";
import { logger } from "../utils/logger.js";
import { erc20Abi } from "../utils/abis.js";
import { resolveLaunchpadInfo, type LaunchpadInfo } from "./launchpad-resolver.js";

export interface LpPoolInfo {
  poolAddress: Address;
  dex: string;
  kind: "dex_v2" | "launchpad_curve" | "launchpad_v3_locked";
  token0: Address;
  token1: Address;
  pairedWith: Address;
  liquidity: number;
  createdBlock?: number;
  launchpad?: LaunchpadInfo;
}

const CACHE_PREFIX = "lp:";

const UNISWAP_V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "tokenA" },
      { type: "address", name: "tokenB" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const UNISWAP_V2_PAIR_ABI = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint112", name: "reserve0" },
      { type: "uint112", name: "reserve1" },
      { type: "uint32", name: "blockTimestampLast" },
    ],
  },
] as const;

export async function findLpPool(tokenAddress: Address): Promise<LpPoolInfo | null> {
  const addr = tokenAddress.toLowerCase() as Address;

  // Check Redis cache (pool address is stable, cache 10 min)
  const cached = await redis.get(`${CACHE_PREFIX}${addr}`);
  if (cached) return JSON.parse(cached);

  // Strategy 1: Query known DEX factories
  let bestPool: LpPoolInfo | null = null;
  let bestLiquidity = 0;

  for (const dex of contractConfig.dexFactories) {
    for (const quoteToken of contractConfig.quoteTokens) {
      const pool = await queryV2Factory(dex, addr, quoteToken);
      if (pool && pool.liquidity > bestLiquidity) {
        bestPool = pool;
        bestLiquidity = pool.liquidity;
      }
    }
  }

  // Strategy 2: Search for PairCreated events referencing this token
  if (!bestPool) {
    bestPool = await searchPairCreatedEvents(addr);
  }

  // Strategy 3: Check common launchpad pool patterns
  if (!bestPool) {
    bestPool = await checkLaunchpadPools(addr);
  }

  if (bestPool) {
    await redis.setex(`${CACHE_PREFIX}${addr}`, 600, JSON.stringify(bestPool));
    logger.info({ token: addr, pool: bestPool.poolAddress, dex: bestPool.dex, liquidity: bestPool.liquidity }, "LP pool found");
  }

  return bestPool;
}

async function queryV2Factory(
  dex: { name: string; address: Address; type: string },
  tokenAddress: Address,
  quoteToken: Address
): Promise<LpPoolInfo | null> {
  try {
    const pairAddress = await cachedRpc.readContract({
      address: dex.address,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [tokenAddress, quoteToken],
      ttlMs: 300_000, // 5 min cache
    }) as Address;

    if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    // Get pair details
    const [token0, token1, reserves] = await Promise.all([
      cachedRpc.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "token0",
        ttlMs: 3600_000,
      }) as Promise<Address>,
      cachedRpc.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "token1",
        ttlMs: 3600_000,
      }) as Promise<Address>,
      cachedRpc.readContract({
        address: pairAddress,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: "getReserves",
        ttlMs: 30_000,
      }) as Promise<[bigint, bigint, number]>,
    ]);

    const pairedWith = token0.toLowerCase() === tokenAddress.toLowerCase() ? token1 : token0;

    // Estimate liquidity in USD (rough: assume paired token ≈ quote value)
    const quoteReserve = token0.toLowerCase() === tokenAddress.toLowerCase()
      ? reserves[1]
      : reserves[0];

    // Very rough estimate — multiply quote reserve by 2 for total liquidity
    // This will be improved with actual price feeds
    const liquidityEstimate = Number(quoteReserve) / 1e18 * 2;

    return {
      poolAddress: pairAddress,
      dex: dex.name,
      kind: "dex_v2",
      token0,
      token1,
      pairedWith,
      liquidity: liquidityEstimate,
    };
  } catch {
    return null;
  }
}

async function searchPairCreatedEvents(tokenAddress: Address): Promise<LpPoolInfo | null> {
  // Search for PairCreated events from known factories that include this token
  const pairCreatedEvent = {
    type: "event" as const,
    name: "PairCreated",
    inputs: [
      { type: "address", indexed: true, name: "token0" },
      { type: "address", indexed: true, name: "token1" },
      { type: "address", indexed: false, name: "pair" },
      { type: "uint256", indexed: false, name: "" },
    ],
  };

  for (const dex of contractConfig.dexFactories) {
    try {
      // Search with token as token0
      const logs0 = await cachedRpc.getLogs({
        address: dex.address,
        event: pairCreatedEvent,
        fromBlock: 0n,
        toBlock: "latest",
      });

      for (const log of logs0) {
        const t0 = (log.args?.token0 as string)?.toLowerCase();
        const t1 = (log.args?.token1 as string)?.toLowerCase();

        if (t0 === tokenAddress.toLowerCase() || t1 === tokenAddress.toLowerCase()) {
          const pairAddress = log.args?.pair as Address;
          if (!pairAddress) continue;

          const pairedWith = (t0 === tokenAddress.toLowerCase() ? t1 : t0) as Address;

          // Get current reserves for liquidity estimate
          try {
            const reserves = await cachedRpc.readContract({
              address: pairAddress,
              abi: UNISWAP_V2_PAIR_ABI,
              functionName: "getReserves",
              ttlMs: 30_000,
            }) as [bigint, bigint, number];

            const quoteReserve = t0 === tokenAddress.toLowerCase()
              ? reserves[1]
              : reserves[0];

            return {
              poolAddress: pairAddress,
              dex: dex.name,
              kind: "dex_v2",
              token0: t0 as Address,
              token1: t1 as Address,
              pairedWith,
              liquidity: Number(quoteReserve) / 1e18 * 2,
              createdBlock: Number(log.blockNumber),
            };
          } catch {
            return {
              poolAddress: pairAddress,
              dex: dex.name,
              kind: "dex_v2",
              token0: t0 as Address,
              token1: t1 as Address,
              pairedWith,
              liquidity: 0,
              createdBlock: Number(log.blockNumber),
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function checkLaunchpadPools(tokenAddress: Address): Promise<LpPoolInfo | null> {
  const launchpadInfo = await resolveLaunchpadInfo(tokenAddress);
  if (launchpadInfo) {
    const pairedWith = launchpadInfo.pairToken ?? contractConfig.quoteTokens[0] ?? contractConfig.zeroAddress as Address;
    return {
      poolAddress: launchpadInfo.pool ?? launchpadInfo.address,
      dex: launchpadInfo.name,
      kind: launchpadInfo.lockModel === "uniswap_v3_nft_locked"
        ? "launchpad_v3_locked"
        : "launchpad_curve",
      token0: tokenAddress,
      token1: pairedWith,
      pairedWith,
      liquidity: 0,
      createdBlock: launchpadInfo.createdBlock,
      launchpad: launchpadInfo,
    };
  }

  for (const launchpad of contractConfig.launchpads) {
    if (launchpad.type !== "bonding_curve") continue;

    try {
      const tokenBalance = await cachedRpc.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [launchpad.address],
        ttlMs: 30_000,
      }) as bigint;

      if (tokenBalance > 0n) {
        const pairedWith = contractConfig.quoteTokens[0] ?? contractConfig.zeroAddress as Address;
        return {
          poolAddress: launchpad.address,
          dex: launchpad.name,
          kind: "launchpad_curve",
          token0: tokenAddress,
          token1: pairedWith,
          pairedWith,
          liquidity: 0,
          launchpad: {
            name: launchpad.name,
            address: launchpad.address,
            type: launchpad.type,
            lifecycle: "unknown",
            buyCount: 0,
            sellCount: 0,
          },
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}
