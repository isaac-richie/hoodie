/**
 * Deployer Resolver — finds who deployed a given contract.
 *
 * This is critical context for risk scoring: a deployer with 5 past rugs
 * is a massive red flag. Uses a 3-strategy waterfall:
 *
 *   1. alchemy_getContractCreator — Alchemy-specific API, fastest (1 RPC call)
 *   2. Block explorer API          — Etherscan-style endpoint, needs EXPLORER_API_URL
 *   3. Binary search + traces      — Universal fallback, ~20 RPC calls (log2 of block height)
 *
 * Results are cached forever in Redis — a contract's deployer never changes.
 * Also handles factory deploys (CREATE2) via trace_block in strategy 3.
 */
import type { Address, Hex } from "viem";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import { cachedRpc } from "./rpc-cache.js";
import { logger } from "../utils/logger.js";

export interface DeployInfo {
  // deployer can be missing while deployBlock is known: factory/CREATE2 deploys
  // where trace APIs are unavailable. A known deployBlock still unlocks the
  // launchpad TokenLaunched-event fallback in token-meta.
  deployer?: Address;
  deployBlock?: number;
  deployTx?: string;
}

const CACHE_PREFIX = "deploy:";
const MISS_TTL_S = 300; // partial/failed lookups retry after 5 min

export async function resolveDeployer(contractAddress: Address): Promise<DeployInfo | null> {
  const addr = contractAddress.toLowerCase();

  // Check Redis cache (immutable — deployer never changes)
  const cached = await redis.get(`${CACHE_PREFIX}${addr}`);
  if (cached) {
    const parsed = JSON.parse(cached);
    return parsed === null ? null : parsed;
  }

  // Strategy 1: Alchemy's alchemy_getContractCreator (fastest when supported)
  let result = await tryAlchemyCreator(addr as Address);

  // Strategies 2 + 3 in PARALLEL — the explorer is flaky and the creation-block
  // search is many roundtrips; running them sequentially used to burn 15s+.
  // First strategy to produce a deployer wins; a deployBlock-only partial is
  // kept as a consolation result.
  if (!result?.deployer) {
    result = await new Promise<DeployInfo | null>((resolve) => {
      let pending = 2;
      let partial: DeployInfo | null = result ?? null;
      const settle = (r: DeployInfo | null) => {
        if (r?.deployer) return resolve(r);
        if (r?.deployBlock && !partial?.deployBlock) partial = { ...partial, ...r };
        if (--pending === 0) resolve(partial);
      };
      tryExplorerApi(addr as Address).then(settle, () => settle(null));
      tryCreationBlockSearch(addr as Address).then(settle, () => settle(null));
    });
  }

  if (result?.deployer) {
    // Complete answer — cache forever, deploy info is immutable.
    await redis.set(`${CACHE_PREFIX}${addr}`, JSON.stringify(result));
    logger.info({ contractAddress: addr, deployer: result.deployer, block: result.deployBlock }, "deployer resolved");
  } else {
    // Miss or partial — cache briefly so back-to-back scans don't repeat the
    // whole waterfall, but a later scan can still fill in the deployer.
    await redis.setex(`${CACHE_PREFIX}${addr}`, MISS_TTL_S, JSON.stringify(result ?? null));
    logger.warn({ contractAddress: addr, deployBlock: result?.deployBlock }, "could not fully resolve deployer");
  }

  return result;
}

async function tryAlchemyCreator(address: Address): Promise<DeployInfo | null> {
  try {
    const response = await fetch(env.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getContractCreator",
        params: [address],
      }),
      signal: AbortSignal.timeout(2_500),
    });

    const data = await response.json() as {
      result?: { contractCreator?: string; blockNumber?: string; hash?: string }[];
    };

    if (data.result?.[0]?.contractCreator) {
      const r = data.result[0];
      return {
        deployer: r.contractCreator as Address,
        deployBlock: parseInt(r.blockNumber ?? "0", 16),
        deployTx: r.hash ?? "",
      };
    }
  } catch (err) {
    logger.debug({ err }, "alchemy_getContractCreator failed, trying fallback");
  }
  return null;
}

async function tryExplorerApi(address: Address): Promise<DeployInfo | null> {
  // Robinhood Chain's Blockscout instance intermittently 500s ("Something went
  // wrong.") on roughly half of requests even though the data is there, and
  // outages can last a couple seconds at a stretch — so sequential retries with
  // small backoff can still lose. Fire a few requests concurrently per round
  // instead: if the explorer is up at all, at least one of N parallel calls in
  // a round tends to land. This is the only creator-resolution strategy that
  // actually works on this chain (Alchemy's alchemy_getContractCreator returns
  // "network not recognized" and trace_block is disabled for this app).
  const explorerUrl = env.explorerApiUrl;
  if (!explorerUrl) return null;

  const url = `${explorerUrl}/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
  const roundSize = 3;
  const rounds = 2;

  for (let round = 0; round < rounds; round++) {
    const attempts = await Promise.all(
      Array.from({ length: roundSize }, () => fetchCreator(url))
    );
    const hit = attempts.find((r): r is NonNullable<typeof r> => r !== null);
    if (hit) {
      const tx = await cachedRpc.raw.getTransaction({ hash: hit.txHash as Hex });
      return {
        deployer: hit.contractCreator as Address,
        deployBlock: Number(tx.blockNumber ?? 0),
        deployTx: hit.txHash ?? "",
      };
    }
    // No sleep between rounds — the parallel creation-block search is already
    // racing us, so retry immediately while we still have budget.
  }

  return null;
}

async function fetchCreator(url: string): Promise<{ contractCreator: string; txHash: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_500) });
    const data = await response.json() as {
      status?: string;
      result?: { contractCreator?: string; txHash?: string }[];
    };

    if (data.status === "1" && data.result?.[0]?.contractCreator && data.result[0].txHash) {
      return {
        contractCreator: data.result[0].contractCreator,
        txHash: data.result[0].txHash,
      };
    }
  } catch {
    // network error — treated as a miss for this attempt
  }
  return null;
}

async function tryCreationBlockSearch(address: Address): Promise<DeployInfo | null> {
  try {
    const currentBlock = Number(await cachedRpc.getBlockNumber());

    // Quick check: does code exist now?
    const code = await cachedRpc.getCode(address);
    if (!code || code === "0x") return null;

    // K-ary search for the first block where the contract has code. Probing
    // PROBES points per round in parallel needs ~log_{PROBES+1}(N) roundtrips
    // instead of log2(N) — for a 6.7M-block chain that's ~8 rounds instead
    // of ~23, and each round is one parallel batch.
    const PROBES = 6;
    let low = 0;
    let high = currentBlock;

    while (high - low > 0) {
      const span = high - low;
      const points = Array.from(
        { length: Math.min(PROBES, span) },
        (_, i) => low + Math.max(1, Math.floor((span * (i + 1)) / (Math.min(PROBES, span) + 1)))
      );

      const results = await Promise.all(
        points.map(async (blockNum) => {
          try {
            const codeAt = await cachedRpc.raw.getCode({ address, blockNumber: BigInt(blockNum) });
            return Boolean(codeAt && codeAt !== "0x");
          } catch {
            return false;
          }
        })
      );

      // Narrow to the segment between the last "no code" point and the first
      // "has code" point.
      let newLow = low;
      let newHigh = high;
      for (let i = 0; i < points.length; i++) {
        if (results[i]) {
          newHigh = points[i];
          break;
        }
        newLow = points[i];
      }
      if (newLow === low && newHigh === high) break; // no progress — bail
      low = newLow;
      high = newHigh;
    }

    const creationBlock = high;
    if (creationBlock <= 0) return null;

    // Get the block and find the creation tx
    const block = await cachedRpc.raw.getBlock({
      blockNumber: BigInt(creationBlock),
      includeTransactions: true,
    });

    // Find the tx that created this contract
    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;

      // Contract creation: to is null
      if (tx.to === null) {
        // Verify this tx created our contract by checking the receipt
        const receipt = await cachedRpc.raw.getTransactionReceipt({ hash: tx.hash });
        if (receipt.contractAddress?.toLowerCase() === address.toLowerCase()) {
          return {
            deployer: tx.from as Address,
            deployBlock: creationBlock,
            deployTx: tx.hash,
          };
        }
      }
    }

    // Could be a factory deploy (CREATE2) — check internal txs
    // For factory deploys, trace the block for the contract creation
    try {
      const traces = await fetchTraces(creationBlock, address);
      if (traces) return traces;
    } catch {
      // Trace API not available
    }

    // Factory deploy with no trace API: we can't name the deployer, but the
    // creation block alone unlocks the launchpad-event fallback upstream.
    return { deployBlock: creationBlock };
  } catch (err) {
    logger.debug({ err }, "creation block search failed");
    return null;
  }
}

async function fetchTraces(blockNumber: number, contractAddress: Address): Promise<DeployInfo | null> {
  try {
    const response = await fetch(env.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "trace_block",
        params: [`0x${blockNumber.toString(16)}`],
      }),
      signal: AbortSignal.timeout(2_500),
    });

    const data = await response.json() as {
      result?: {
        type: string;
        action: { from: string; init?: string };
        result?: { address?: string };
        transactionHash: string;
      }[];
    };

    if (!data.result) return null;

    for (const trace of data.result) {
      if (
        trace.type === "create" &&
        trace.result?.address?.toLowerCase() === contractAddress.toLowerCase()
      ) {
        return {
          deployer: trace.action.from as Address,
          deployBlock: blockNumber,
          deployTx: trace.transactionHash,
        };
      }
    }
  } catch {
    // trace_block not supported
  }
  return null;
}
