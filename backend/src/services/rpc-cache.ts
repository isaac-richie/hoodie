/**
 * 3-Tier RPC Cache — the backbone of Hood Terminal's cost optimization.
 *
 * Every on-chain read goes through `cachedRpc` instead of hitting the RPC directly.
 * This saves 80-95% of Alchemy CU costs on repeated scans.
 *
 * Cache tiers (checked in order):
 *   1. In-memory LRU — sub-millisecond, per-process, lost on restart
 *   2. Redis          — milliseconds, shared across restarts, survives deploys
 *   3. RPC call       — 50-200ms, costs Alchemy CUs
 *
 * Request coalescing: if 5 modules request getCode() for the same address
 * simultaneously, only 1 RPC call goes out. All 5 share the same promise.
 *
 * TTL strategy by data type:
 *   - Immutable (bytecode, deploy info, historical logs): cached forever
 *   - Slow-changing (name, symbol, decimals): 1 hour
 *   - Fast-changing (block number): 3 seconds
 *   - State-dependent (simulateContract): never cached
 *
 * Stats: call getRpcStats() to see call count, hit rate, calls/sec.
 * Exposed via GET /v1/stats/rpc for monitoring.
 */
import { createPublicClient, http, type PublicClient, type Address, type Hex } from "viem";
import { redis } from "../config/redis.js";
import { robinhoodChain } from "../config/chain.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// ─── Redis: best-effort cache access ──────────────────────────────────────────
// The cache must never be a hard dependency of a scan. If Redis is down or slow,
// reads degrade to a cache miss (→ direct RPC) and writes are dropped, rather
// than throwing and failing the whole scan. In-memory LRU still absorbs load.
let redisDegradedLoggedAt = 0;
function noteRedisDown(err: unknown) {
  const now = Date.now();
  if (now - redisDegradedLoggedAt > 30_000) {
    redisDegradedLoggedAt = now;
    logger.warn({ err: (err as Error)?.message }, "Redis unavailable — serving from RPC/LRU without cache");
  }
}

async function redisGetSafe(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    noteRedisDown(err);
    return null;
  }
}

async function redisSetSafe(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) await redis.setex(key, ttlSeconds, value);
    else await redis.set(key, value);
  } catch (err) {
    noteRedisDown(err);
  }
}

// ─── In-Memory LRU Cache ──────────────────────────────────────────────────────

class LRUCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  private maxSize: number;

  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires > 0 && Date.now() > entry.expires) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs = 0): void {
    if (this.map.size >= this.maxSize) {
      // Evict oldest (first entry)
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
    this.map.set(key, {
      value,
      expires: ttlMs > 0 ? Date.now() + ttlMs : 0, // 0 = never expires
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ─── Request Coalescing ───────────────────────────────────────────────────────
// If multiple callers request the same RPC call at the same time,
// only one actual request goes out. All callers share the same promise.

const inflight = new Map<string, Promise<unknown>>();

async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    logger.debug({ key }, "rpc coalesced — sharing in-flight request");
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

// ─── Cache Tiers ──────────────────────────────────────────────────────────────

// Immutable data — never changes once written
const bytecodeCache = new LRUCache<Hex>(2000); // contract code never changes
const deployInfoCache = new LRUCache<DeployInfo>(5000);
const blockCache = new LRUCache<unknown>(500); // confirmed blocks are immutable

// Short-lived data
const balanceCache = new LRUCache<bigint>(10000); // 30s TTL
const storageCache = new LRUCache<Hex>(5000); // 60s TTL
const blockNumberCache = new LRUCache<bigint>(1); // 3s TTL

// ─── RPC Call Counter ─────────────────────────────────────────────────────────

let rpcCallCount = 0;
let rpcCacheHits = 0;
let lastResetTime = Date.now();

export function getRpcStats() {
  const elapsed = (Date.now() - lastResetTime) / 1000;
  return {
    calls: rpcCallCount,
    cacheHits: rpcCacheHits,
    hitRate: rpcCallCount + rpcCacheHits > 0
      ? Math.round((rpcCacheHits / (rpcCallCount + rpcCacheHits)) * 100)
      : 0,
    callsPerSecond: elapsed > 0 ? Math.round(rpcCallCount / elapsed * 100) / 100 : 0,
    uptimeSeconds: Math.round(elapsed),
  };
}

export function resetRpcStats() {
  rpcCallCount = 0;
  rpcCacheHits = 0;
  lastResetTime = Date.now();
}

// ─── Cached RPC Client ────────────────────────────────────────────────────────

// Raw viem client — never use this directly outside this file.
// batch.wait: 16ms — viem collects all RPC calls within a 16ms window
// and sends them as a single JSON-RPC batch request. Cuts HTTP overhead.
const rawClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(env.rpcUrl, {
    batch: { wait: 16 },
    retryCount: 3,
    retryDelay: 1000,
  }),
});

interface DeployInfo {
  deployer: Address;
  block: number;
  tx: string;
}

export const cachedRpc = {
  /**
   * Get contract bytecode — IMMUTABLE, cached forever in memory
   */
  async getCode(address: Address): Promise<Hex | undefined> {
    const key = `code:${address.toLowerCase()}`;

    // Memory cache (immutable — never expires)
    const memCached = bytecodeCache.get(key);
    if (memCached !== undefined) {
      rpcCacheHits++;
      return memCached;
    }

    // Redis cache
    const redisCached = await redisGetSafe(key);
    if (redisCached) {
      rpcCacheHits++;
      bytecodeCache.set(key, redisCached as Hex); // warm memory
      return redisCached as Hex;
    }

    // RPC call (coalesced)
    const code = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.getCode({ address });
    });

    if (code) {
      bytecodeCache.set(key, code);
      // Store in Redis forever — bytecode is immutable
      await redisSetSafe(key, code);
    }

    return code;
  },

  /**
   * Get current block number — very short TTL (3s)
   */
  async getBlockNumber(): Promise<bigint> {
    const key = "blockNumber";

    const cached = blockNumberCache.get(key);
    if (cached !== undefined) {
      rpcCacheHits++;
      return cached;
    }

    rpcCallCount++;
    const block = await rawClient.getBlockNumber();
    blockNumberCache.set(key, block, 3000); // 3s TTL
    return block;
  },

  /**
   * Read storage slot — short TTL (60s) unless we know it's immutable
   */
  async getStorageAt(address: Address, slot: Hex, immutable = false): Promise<Hex | undefined> {
    const key = `storage:${address.toLowerCase()}:${slot}`;

    const cached = storageCache.get(key);
    if (cached !== undefined) {
      rpcCacheHits++;
      return cached;
    }

    const redisCached = await redisGetSafe(key);
    if (redisCached) {
      rpcCacheHits++;
      storageCache.set(key, redisCached as Hex, immutable ? 0 : 60_000);
      return redisCached as Hex;
    }

    const value = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.getStorageAt({ address, slot });
    });

    if (value) {
      storageCache.set(key, value, immutable ? 0 : 60_000);
      await redisSetSafe(key, value, immutable ? 86400 * 30 : 120);
    }

    return value;
  },

  /**
   * Call a contract (eth_call) — short TTL based on context
   */
  async call(params: { to: Address; data: Hex; account?: Address }): Promise<{ data?: Hex }> {
    const key = `call:${params.to.toLowerCase()}:${params.data}:${params.account ?? ""}`;

    // Check memory (30s TTL for calls)
    const cached = storageCache.get(key);
    if (cached !== undefined) {
      rpcCacheHits++;
      return { data: cached };
    }

    const result = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.call({
        to: params.to,
        data: params.data,
        account: params.account,
      });
    });

    if (result.data) {
      storageCache.set(key, result.data, 30_000); // 30s cache
    }

    return result;
  },

  /**
   * Read a contract function — cached by TTL
   */
  async readContract(params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    ttlMs?: number;
    // Live quote reads can bypass stale cache entries while still warming the
    // cache with the latest value for normal scanner traffic.
    bypassCache?: boolean;
  }): Promise<unknown> {
    // bigIntReplacer: plain JSON.stringify throws on BigInt args (e.g. NFT
    // tokenIds), which silently killed every read that used them.
    const argsKey = params.args ? JSON.stringify(params.args, bigIntReplacer) : "";
    const key = `read:${params.address.toLowerCase()}:${params.functionName}:${argsKey}`;
    const ttl = params.ttlMs ?? 30_000;

    if (!params.bypassCache) {
      // Memory cache
      const memCached = storageCache.get(key);
      if (memCached !== undefined) {
        rpcCacheHits++;
        return memCached;
      }

      // Redis cache
      const redisCached = await redisGetSafe(key);
      if (redisCached) {
        rpcCacheHits++;
        const parsed = JSON.parse(redisCached, bigIntReviver);
        storageCache.set(key, parsed, ttl);
        return parsed;
      }
    }

    const result = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.readContract({
        address: params.address,
        abi: params.abi as any,
        functionName: params.functionName as any,
        args: params.args as any,
      });
    });

    storageCache.set(key, result as any, ttl);
    await redisSetSafe(key, JSON.stringify(result, bigIntReplacer), Math.ceil(ttl / 1000));

    return result;
  },

  /**
   * Simulate a contract call — never cached (state-dependent)
   */
  async simulateContract(params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    account?: Address;
  }) {
    rpcCallCount++;
    return rawClient.simulateContract({
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName as any,
      args: params.args as any,
      account: params.account,
    });
  },

  /**
   * Get logs — IMMUTABLE for confirmed blocks, cached forever
   * For ranges ending at 'latest', use short TTL
   */
  async getLogs(params: {
    address: Address;
    event: unknown;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint | "latest";
  }): Promise<any[]> {
    const isHistorical = params.toBlock !== "latest";
    const toBlockStr = params.toBlock === "latest" ? "latest" : params.toBlock.toString();
    const eventKey = JSON.stringify(params.event);
    const argsKey = params.args ? JSON.stringify(params.args, bigIntReplacer) : "";
    const key = `logs:${params.address.toLowerCase()}:${params.fromBlock}:${toBlockStr}:${eventKey}:${argsKey}`;

    // For historical (both blocks confirmed), check Redis
    if (isHistorical) {
      const redisCached = await redisGetSafe(key);
      if (redisCached) {
        rpcCacheHits++;
        return JSON.parse(redisCached, bigIntReviver);
      }
    }

    const logs = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.getLogs({
        address: params.address,
        event: params.event as any,
        args: params.args as any,
        fromBlock: params.fromBlock,
        toBlock: params.toBlock === "latest" ? undefined : params.toBlock,
      });
    });

    // Cache historical logs forever in Redis (they can't change)
    if (isHistorical && (logs as any[]).length > 0) {
      await redisSetSafe(key, JSON.stringify(logs, bigIntReplacer));
    } else if (!isHistorical) {
      // Cache "latest" logs for 30s
      await redisSetSafe(key, JSON.stringify(logs, bigIntReplacer), 30);
    }

    return logs as any[];
  },

  /**
   * Get logs across a wide block range, chunked to stay under the RPC
   * provider's per-call block-range limit (Alchemy caps eth_getLogs at
   * 10,000 blocks — a single unchunked query from a token's deploy block
   * to "latest" hard-fails for any token more than ~10K blocks old).
   *
   * Each chunk reuses getLogs()'s own caching, so repeat scans only pay
   * for the newest chunk (the "latest"-bounded tail) — older chunks are
   * cached forever once fetched.
   */
  /**
   * Cheap density probe for infrastructure-grade tokens (WETH, stablecoins)
   * whose full log history is unfetchable — a single 2k-block WETH chunk
   * already exceeds the HTTP response size limit and takes ~15s to fail.
   *
   * Two tiny 100-block probes: one at head, one ~500k blocks back. Only
   * SUSTAINED density at both points marks the token dense — a young trending
   * token is busy now but has no history half a million blocks ago, and its
   * holder forensics are exactly what users want.
   */
  async isDenseLogSource(address: Address, event: unknown): Promise<boolean> {
    const head = await this.getBlockNumber();
    const probe = async (fromBlock: bigint): Promise<boolean> => {
      try {
        const logs = await this.getLogs({
          address,
          event,
          fromBlock: fromBlock > 0n ? fromBlock : 0n,
          toBlock: fromBlock + 99n,
        });
        return logs.length >= 300; // 3+ events per block, sustained
      } catch {
        return true; // even 100 blocks over-limit — extreme density
      }
    };

    if (!(await probe(head - 100n))) return false;
    return probe(head - 500_000n);
  },

  async getLogsChunked(params: {
    address: Address;
    event: unknown;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint | "latest";
    maxRangeBlocks?: number;
    concurrency?: number;
    maxChunks?: number;
    // Stop fetching once this many logs have accumulated. High-volume tokens
    // (WETH sees transfers in every block) can return megabytes per chunk —
    // callers doing statistical analysis don't need an exhaustive set.
    maxLogs?: number;
    // Skip chunks that fail instead of rejecting the whole scan. Dense tokens
    // can exceed the provider's per-response log limit for a single chunk;
    // statistical callers prefer a partial sample over an error. Throws only
    // if every chunk failed (an empty "success" would mislead scoring).
    bestEffort?: boolean;
    // Wall-clock budget: stop issuing new batches once elapsed. Failing chunks
    // burn seconds each in transport retries — a chunk cap alone doesn't bound
    // time when chunks are slow rather than numerous.
    deadlineMs?: number;
  }): Promise<any[]> {
    const maxRange = BigInt(params.maxRangeBlocks ?? 9_000);
    const concurrency = params.concurrency ?? 5;
    // Safety valve: an unbounded from-genesis scan over millions of blocks would
    // fan out to hundreds of RPC calls and hang a request (a DoS vector). Cap the
    // number of chunks; when the requested range exceeds it, scan the MOST RECENT
    // window (newest blocks are where a recently-launched token's events live).
    const maxChunks = params.maxChunks ?? 400;

    const toBlock = params.toBlock === "latest"
      ? await this.getBlockNumber()
      : params.toBlock;

    if (params.fromBlock > toBlock) return [];

    let effectiveFrom = params.fromBlock;
    const totalChunks = Number((toBlock - effectiveFrom) / maxRange) + 1;
    if (totalChunks > maxChunks) {
      const window = maxRange * BigInt(maxChunks);
      effectiveFrom = toBlock - window + 1n;
      if (effectiveFrom < params.fromBlock) effectiveFrom = params.fromBlock;
      logger.warn(
        { requestedChunks: totalChunks, maxChunks, scannedFrom: effectiveFrom.toString(), toBlock: toBlock.toString() },
        "getLogsChunked: range too large, scanning most recent window only"
      );
    }

    const ranges: { from: bigint; to: bigint }[] = [];
    for (let from = effectiveFrom; from <= toBlock; from += maxRange) {
      const to = from + maxRange - 1n > toBlock ? toBlock : from + maxRange - 1n;
      ranges.push({ from, to });
    }

    const allLogs: any[] = [];
    let failedChunks = 0;
    const startedAt = Date.now();
    for (let i = 0; i < ranges.length; i += concurrency) {
      if (params.deadlineMs !== undefined && Date.now() - startedAt > params.deadlineMs) {
        logger.warn(
          { elapsedMs: Date.now() - startedAt, deadlineMs: params.deadlineMs, chunksFetched: i, totalChunks: ranges.length, collected: allLogs.length },
          "getLogsChunked: deadline reached, returning partial results"
        );
        break;
      }
      const batch = ranges.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((range) => {
          const chunkPromise = this.getLogs({
            address: params.address,
            event: params.event,
            args: params.args,
            fromBlock: range.from,
            toBlock: range.to,
          });
          return params.bestEffort
            ? chunkPromise.catch(() => {
                failedChunks++;
                return [] as any[];
              })
            : chunkPromise;
        })
      );
      for (const chunk of results) allLogs.push(...chunk);

      if (params.maxLogs !== undefined && allLogs.length >= params.maxLogs) {
        logger.warn(
          { collected: allLogs.length, maxLogs: params.maxLogs, chunksFetched: i + batch.length, totalChunks: ranges.length },
          "getLogsChunked: log cap reached, stopping early"
        );
        break;
      }
    }

    if (failedChunks > 0) {
      logger.warn(
        { failedChunks, totalChunks: ranges.length, collected: allLogs.length },
        "getLogsChunked: some chunks failed (best-effort mode)"
      );
      if (allLogs.length === 0) {
        throw new Error(`log scan failed: all ${failedChunks} attempted chunks errored`);
      }
    }

    return allLogs;
  },

  /**
   * Get transaction count (nonce) — short cache
   */
  async getTransactionCount(address: Address): Promise<number> {
    const key = `nonce:${address.toLowerCase()}`;

    const cached = balanceCache.get(key);
    if (cached !== undefined) {
      rpcCacheHits++;
      return Number(cached);
    }

    const nonce = await coalesce(key, async () => {
      rpcCallCount++;
      return rawClient.getTransactionCount({ address });
    });

    balanceCache.set(key, BigInt(nonce), 60_000); // 60s cache
    return nonce;
  },

  /**
   * Get the raw client for one-off calls that don't need caching
   */
  get raw(): PublicClient {
    return rawClient as PublicClient;
  },
};

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `__bigint:${value.toString()}`;
  return value;
}

function bigIntReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("__bigint:")) {
    return BigInt(value.slice("__bigint:".length));
  }
  return value;
}
