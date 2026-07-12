/**
 * Market Data — spot price, market cap, and liquidity for a scanned token.
 *
 * Everything except the ETH/USD rate comes straight from the chain:
 *   - V2 pools: price = wethReserve / tokenReserve (from getReserves)
 *   - V3 pools: price from slot0.sqrtPriceX96
 *   - Liquidity: WETH sitting in the pool × 2 (standard both-sides estimate)
 *   - Market cap: price × totalSupply (fully-diluted — no vesting data on-chain)
 *
 * ETH/USD comes from CoinGecko, cached 5 min in Redis. If CoinGecko is down
 * we still return ETH-denominated liquidity so the UI can degrade gracefully
 * instead of showing nothing.
 *
 * All failures return nulls — market data is decoration, never a scan blocker.
 */
import type { Address } from "viem";
import { cachedRpc } from "./rpc-cache.js";
import { redis } from "../config/redis.js";
import { contractConfig } from "../config/contracts.js";
import { erc20Abi } from "../utils/abis.js";
import { logger } from "../utils/logger.js";
import type { LpPoolInfo } from "./lp-resolver.js";

export interface MarketData {
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  liquidityEth: number | null;
}

const EMPTY: MarketData = { priceUsd: null, marketCapUsd: null, liquidityUsd: null, liquidityEth: null };

const ETH_USD_CACHE_KEY = "price:eth-usd";
const ETH_USD_TTL_S = 300;

const V2_PAIR_ABI = [
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

const V3_SLOT0_ABI = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
      { type: "uint16", name: "observationIndex" },
      { type: "uint16", name: "observationCardinality" },
      { type: "uint16", name: "observationCardinalityNext" },
      { type: "uint8", name: "feeProtocol" },
      { type: "bool", name: "unlocked" },
    ],
  },
] as const;

export async function resolveMarketData(params: {
  tokenAddress: Address;
  lpInfo?: LpPoolInfo | null;
  totalSupply?: bigint;
  decimals?: number;
  fresh?: boolean;
}): Promise<MarketData> {
  const { tokenAddress, lpInfo, totalSupply, decimals, fresh = false } = params;

  try {
    if (!lpInfo?.poolAddress) return EMPTY;

    // We can only price against WETH — if the pool pairs with some other
    // token we have no reference price for it.
    const weth = contractConfig.quoteTokens[0];
    if (!weth || lpInfo.pairedWith.toLowerCase() !== weth.toLowerCase()) return EMPTY;

    const tokenDecimals = decimals ?? 18;
    let priceEth: number | null = null;

    if (lpInfo.kind === "dex_v2") {
      priceEth = await v2PriceEth(lpInfo, tokenAddress, tokenDecimals, fresh);
    } else if (lpInfo.kind === "dex_v3" || lpInfo.kind === "launchpad_v3_locked") {
      priceEth = await v3PriceEth(lpInfo, tokenAddress, tokenDecimals, fresh);
    }
    // launchpad_curve: no AMM pool to read a spot price from — stay null.

    // Liquidity: WETH actually held by the pool, doubled to approximate both
    // sides. Works uniformly for V2 and V3 (for V3 it slightly overstates the
    // in-range depth, which is fine for a scan overview).
    const wethBalance = await cachedRpc.readContract({
      address: weth,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [lpInfo.poolAddress],
      ttlMs: 30_000,
      bypassCache: fresh,
    }) as bigint;
    const liquidityEth = (Number(wethBalance) / 1e18) * 2;

    const ethUsd = await getEthUsdPrice();

    const priceUsd = priceEth !== null && ethUsd !== null ? priceEth * ethUsd : null;
    const supply = totalSupply !== undefined ? Number(totalSupply) / 10 ** tokenDecimals : null;

    return {
      priceUsd,
      marketCapUsd: priceUsd !== null && supply !== null ? priceUsd * supply : null,
      liquidityUsd: ethUsd !== null ? liquidityEth * ethUsd : null,
      liquidityEth,
    };
  } catch (err) {
    logger.warn({ err: (err as Error)?.message, token: tokenAddress }, "market data unavailable");
    return EMPTY;
  }
}

async function v2PriceEth(
  lpInfo: LpPoolInfo,
  tokenAddress: Address,
  tokenDecimals: number,
  fresh: boolean
): Promise<number | null> {
  const reserves = await cachedRpc.readContract({
    address: lpInfo.poolAddress,
    abi: V2_PAIR_ABI,
    functionName: "getReserves",
    ttlMs: 30_000,
    bypassCache: fresh,
  }) as [bigint, bigint, number];

  const tokenIsToken0 = lpInfo.token0.toLowerCase() === tokenAddress.toLowerCase();
  const tokenReserve = tokenIsToken0 ? reserves[0] : reserves[1];
  const wethReserve = tokenIsToken0 ? reserves[1] : reserves[0];
  if (tokenReserve === 0n) return null;

  return (Number(wethReserve) / 1e18) / (Number(tokenReserve) / 10 ** tokenDecimals);
}

async function v3PriceEth(
  lpInfo: LpPoolInfo,
  tokenAddress: Address,
  tokenDecimals: number,
  fresh: boolean
): Promise<number | null> {
  const slot0 = await cachedRpc.readContract({
    address: lpInfo.poolAddress,
    abi: V3_SLOT0_ABI,
    functionName: "slot0",
    ttlMs: 30_000,
    bypassCache: fresh,
  }) as readonly [bigint, number, number, number, number, number, boolean];

  const sqrtPriceX96 = Number(slot0[0]);
  if (!sqrtPriceX96) return null;

  // sqrtPriceX96 encodes sqrt(token1_raw / token0_raw) << 96.
  const rawPrice = (sqrtPriceX96 / 2 ** 96) ** 2; // token1 raw units per token0 raw unit

  const tokenIsToken0 = lpInfo.token0.toLowerCase() === tokenAddress.toLowerCase();
  const wethDecimals = 18;

  // Convert raw ratio to a human price of 1 token in WETH.
  return tokenIsToken0
    ? rawPrice * 10 ** (tokenDecimals - wethDecimals)
    : (1 / rawPrice) * 10 ** (tokenDecimals - wethDecimals);
}

async function getEthUsdPrice(): Promise<number | null> {
  try {
    const cached = await redis.get(ETH_USD_CACHE_KEY);
    if (cached) return Number(cached);
  } catch {
    // Redis down — fall through to a direct fetch.
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return null;
    const body = await res.json() as { ethereum?: { usd?: number } };
    const price = body.ethereum?.usd;
    if (typeof price !== "number" || price <= 0) return null;

    try {
      await redis.setex(ETH_USD_CACHE_KEY, ETH_USD_TTL_S, String(price));
    } catch {
      // cache write is best-effort
    }
    return price;
  } catch {
    return null;
  }
}
