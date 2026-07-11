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
  deployer: Address;
  deployBlock: number;
  deployTx: string;
}

const CACHE_PREFIX = "deploy:";

export async function resolveDeployer(contractAddress: Address): Promise<DeployInfo | null> {
  const addr = contractAddress.toLowerCase();

  // Check Redis cache (immutable — deployer never changes)
  const cached = await redis.get(`${CACHE_PREFIX}${addr}`);
  if (cached) return JSON.parse(cached);

  // Strategy 1: Alchemy's alchemy_getContractCreator (fastest)
  let result = await tryAlchemyCreator(addr as Address);

  // Strategy 2: Etherscan-style API if available
  if (!result) {
    result = await tryExplorerApi(addr as Address);
  }

  // Strategy 3: Binary search for creation block + trace
  if (!result) {
    result = await tryBinarySearchCreation(addr as Address);
  }

  if (result) {
    // Cache forever — deploy info is immutable
    await redis.set(`${CACHE_PREFIX}${addr}`, JSON.stringify(result));
    logger.info({ contractAddress: addr, deployer: result.deployer, block: result.deployBlock }, "deployer resolved");
  } else {
    logger.warn({ contractAddress: addr }, "could not resolve deployer");
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

    if (round < rounds - 1) {
      await sleep(500);
    }
  }

  return null;
}

async function fetchCreator(url: string): Promise<{ contractCreator: string; txHash: string } | null> {
  try {
    const response = await fetch(url);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryBinarySearchCreation(address: Address): Promise<DeployInfo | null> {
  try {
    const currentBlock = Number(await cachedRpc.getBlockNumber());

    // Binary search: find the first block where the contract has code
    let low = 0;
    let high = currentBlock;
    let creationBlock = -1;

    // Quick check: does code exist now?
    const code = await cachedRpc.getCode(address);
    if (!code || code === "0x") return null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);

      try {
        const codeAtMid = await cachedRpc.raw.getCode({
          address,
          blockNumber: BigInt(mid),
        });

        if (codeAtMid && codeAtMid !== "0x") {
          creationBlock = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      } catch {
        // Block might not exist or RPC error — skip
        low = mid + 1;
      }
    }

    if (creationBlock < 0) return null;

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

    return null;
  } catch (err) {
    logger.debug({ err }, "binary search creation failed");
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
