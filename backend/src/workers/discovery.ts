/**
 * Discovery Worker — watches new blocks for freshly deployed ERC20 tokens.
 *
 * Two modes (auto-selected based on .env):
 *   - WebSocket (RPC_WSS set): real-time block notifications, lowest latency
 *   - Polling (fallback): checks for new blocks every 3 seconds
 *
 * For each new block:
 *   1. Fetch all transactions, find contract creations (tx.to === null)
 *   2. Quick ERC20 check: does the bytecode contain name/symbol/totalSupply/transfer selectors?
 *   3. If yes, queue a full scan via BullMQ (deduped with a 5-min Redis key)
 *
 * The polling watcher persists its last-processed block in Redis so it
 * resumes where it left off after restarts (no re-scanning old blocks).
 *
 * Jobs are processed by scan-processor.ts which runs in the same process.
 */
import { createPublicClient, webSocket, http, type Address, type Hash, type Log } from "viem";
import { Queue } from "bullmq";
import { robinhoodChain } from "../config/chain.js";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import { cachedRpc } from "../services/rpc-cache.js";
import { logger } from "../utils/logger.js";

const SCAN_QUEUE = "token-scan";
const LAST_BLOCK_KEY = "discovery:lastBlock";

const scanQueue = new Queue(SCAN_QUEUE, {
  connection: { url: env.redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 500,
  },
});

export async function startDiscoveryWorker(): Promise<() => void> {
  logger.info("starting discovery worker");

  // Try WebSocket first (real-time), fall back to polling
  if (env.rpcWss) {
    return startWsWatcher();
  }
  return startPollingWatcher();
}

function startWsWatcher(): () => void {
  const wsClient = createPublicClient({
    chain: robinhoodChain,
    transport: webSocket(env.rpcWss),
  });

  const unwatch = wsClient.watchBlocks({
    onBlock: async (block) => {
      try {
        await processBlock(Number(block.number), block.transactions as Hash[]);
      } catch (err) {
        logger.error({ err, block: Number(block.number) }, "block processing failed");
      }
    },
    includeTransactions: false,
  });

  logger.info("discovery: websocket watcher active");
  return unwatch;
}

function startPollingWatcher(): () => void {
  let running = true;
  const POLL_INTERVAL = 3000;

  const poll = async () => {
    // Resume from last processed block
    const lastStr = await redis.get(LAST_BLOCK_KEY);
    let lastBlock = lastStr ? parseInt(lastStr) : 0;

    while (running) {
      try {
        const currentBlock = Number(await cachedRpc.getBlockNumber());

        if (lastBlock === 0) {
          lastBlock = currentBlock - 1;
        }

        for (let blockNum = lastBlock + 1; blockNum <= currentBlock; blockNum++) {
          await processBlockByNumber(blockNum);
          await redis.set(LAST_BLOCK_KEY, blockNum.toString());
          lastBlock = blockNum;
        }
      } catch (err) {
        logger.error({ err }, "discovery poll error");
      }

      await sleep(POLL_INTERVAL);
    }
  };

  poll();
  logger.info("discovery: polling watcher active");

  return () => { running = false; };
}

async function processBlockByNumber(blockNumber: number): Promise<void> {
  const block = await cachedRpc.raw.getBlock({
    blockNumber: BigInt(blockNumber),
    includeTransactions: true,
  });

  const newContracts: Address[] = [];

  for (const tx of block.transactions) {
    if (typeof tx === "string") continue;

    // Direct contract creation: to is null
    if (tx.to === null) {
      try {
        const receipt = await cachedRpc.raw.getTransactionReceipt({ hash: tx.hash });
        if (receipt.contractAddress) {
          newContracts.push(receipt.contractAddress);
        }
      } catch {
        // skip failed receipts
      }
    }
  }

  if (newContracts.length > 0) {
    await enqueueNewContracts(newContracts, blockNumber);
  }
}

async function processBlock(blockNumber: number, txHashes: Hash[]): Promise<void> {
  // For WS mode we get tx hashes, need to fetch the block with txs
  await processBlockByNumber(blockNumber);
}

async function enqueueNewContracts(contracts: Address[], blockNumber: number): Promise<void> {
  for (const addr of contracts) {
    // Quick check: is this an ERC20? (has name + symbol selectors)
    const isToken = await quickErc20Check(addr);
    if (!isToken) continue;

    // Dedup: don't re-scan if we already queued this token recently
    const dedupKey = `discovery:queued:${addr.toLowerCase()}`;
    const alreadyQueued = await redis.get(dedupKey);
    if (alreadyQueued) continue;

    await redis.setex(dedupKey, 300, "1");

    await scanQueue.add(
      "scan",
      { tokenAddress: addr, discoveryBlock: blockNumber },
      { jobId: `scan:${addr.toLowerCase()}` }
    );

    logger.info({ token: addr, block: blockNumber }, "new token discovered, queued for scan");
  }
}

async function quickErc20Check(address: Address): Promise<boolean> {
  try {
    const code = await cachedRpc.getCode(address);
    if (!code || code === "0x" || code.length < 100) return false;

    // Check for ERC20 function selectors in bytecode
    // name(): 0x06fdde03, symbol(): 0x95d89b41, totalSupply(): 0x18160ddd, transfer(): 0xa9059cbb
    const selectors = ["06fdde03", "95d89b41", "18160ddd", "a9059cbb"];
    const codeHex = code.toLowerCase();

    const matches = selectors.filter((s) => codeHex.includes(s));
    return matches.length >= 3; // at least 3 of 4 selectors present
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
