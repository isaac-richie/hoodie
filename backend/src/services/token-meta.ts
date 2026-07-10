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
import { resolveDeployer } from "./deployer-resolver.js";
import { findLpPool, type LpPoolInfo } from "./lp-resolver.js";
import type { LaunchpadInfo } from "./launchpad-resolver.js";

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

  // Fetch ERC20 info + deployer + LP in parallel
  const [name, symbol, decimals, totalSupply, deployInfo, lpInfo] = await Promise.allSettled([
    cachedRpc.readContract({ address, abi: erc20Abi, functionName: "name", ttlMs: 3600_000 }),
    cachedRpc.readContract({ address, abi: erc20Abi, functionName: "symbol", ttlMs: 3600_000 }),
    cachedRpc.readContract({ address, abi: erc20Abi, functionName: "decimals", ttlMs: 3600_000 }),
    cachedRpc.readContract({ address, abi: erc20Abi, functionName: "totalSupply", ttlMs: 60_000 }),
    resolveDeployer(address),
    findLpPool(address),
  ]);

  if (name.status === "fulfilled") meta.name = name.value as string;
  if (symbol.status === "fulfilled") meta.symbol = symbol.value as string;
  if (decimals.status === "fulfilled") meta.decimals = Number(decimals.value);
  if (totalSupply.status === "fulfilled") meta.totalSupply = totalSupply.value as bigint;

  if (deployInfo.status === "fulfilled" && deployInfo.value) {
    meta.deployer = deployInfo.value.deployer;
    meta.deployBlock = deployInfo.value.deployBlock;
    meta.deployTx = deployInfo.value.deployTx;
  }

  if (lpInfo.status === "fulfilled" && lpInfo.value) {
    meta.lpPool = lpInfo.value.poolAddress;
    meta.lpInfo = lpInfo.value;
    meta.launchpad = lpInfo.value.launchpad;
  }

  await redis.setex(CACHE_KEYS.tokenMeta(address), 3600, JSON.stringify(meta, bigIntReplacer));

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
