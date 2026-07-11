/**
 * Launchpad resolver — identifies launchpad lifecycle state for tokens.
 *
 * Launchpad tokens do not always start with a transferable AMM LP token. For
 * bonding-curve launches, liquidity can sit inside the launchpad contract until
 * the token graduates to a DEX. This resolver keeps LP checks from treating
 * those pre-graduation tokens as ordinary unlocked LP pools.
 */
import type { Address } from "viem";
import { contractConfig, type LaunchpadConfig } from "../config/contracts.js";
import { cachedRpc } from "./rpc-cache.js";

export type LaunchpadLifecycle = "created" | "trading" | "launched" | "unknown";

export interface LaunchpadInfo {
  name: string;
  address: Address;
  type: LaunchpadConfig["type"];
  lifecycle: LaunchpadLifecycle;
  lockModel?: "bonding_curve" | "uniswap_v3_nft_locked";
  pool?: Address;
  pairToken?: Address;
  deployer?: Address;
  dexFactory?: Address;
  positionId?: string;
  restrictionsEndBlock?: string;
  locker?: Address;
  nftManager?: Address;
  createdBlock?: number;
  launchedBlock?: number;
  buyCount: number;
  sellCount: number;
  latestEventBlock?: number;
}

const ARROWPAD_ADDRESS = "0x5d2391cf88cd48bb6b9ec12b38bc8119562f9012";
const NOXA_FACTORY_ADDRESS = "0xd9ec2db5f3d1b236843925949fe5bd8a3836fccb";
const NOXA_LOCKER = "0x7F03effbd7ceB22A3f80Dd468f67eF27826acD85" as Address;
const NOXA_NFT_MANAGER = "0x73991a25c818bf1f1128deaab1492d45638de0d3" as Address;

const tokenCreatedEvent = {
  type: "event" as const,
  name: "TokenCreated",
  inputs: [
    { type: "address", indexed: false, name: "token" },
    { type: "uint256", indexed: false, name: "tokenPrice" },
    { type: "uint256", indexed: false, name: "ethPriceUSD" },
    { type: "uint32", indexed: false, name: "sig" },
    { type: "uint256", indexed: false, name: "date" },
  ],
};

const tokenLaunchedEvent = {
  type: "event" as const,
  name: "TokenLaunched",
  inputs: [
    { type: "address", indexed: false, name: "token" },
    { type: "uint256", indexed: false, name: "date" },
  ],
};

const buyTokensEvent = {
  type: "event" as const,
  name: "BuyTokens",
  inputs: [
    { type: "address", indexed: false, name: "user" },
    { type: "address", indexed: false, name: "token" },
    { type: "uint256", indexed: false, name: "ethAmount" },
    { type: "uint256", indexed: false, name: "tokenAmount" },
    { type: "uint256", indexed: false, name: "tokenPrice" },
    { type: "uint256", indexed: false, name: "ethPriceUSD" },
    { type: "uint256", indexed: false, name: "marketCap" },
    { type: "uint256", indexed: false, name: "date" },
  ],
};

const sellTokensEvent = {
  type: "event" as const,
  name: "SellTokens",
  inputs: [
    { type: "address", indexed: false, name: "user" },
    { type: "address", indexed: false, name: "token" },
    { type: "uint256", indexed: false, name: "ethAmount" },
    { type: "uint256", indexed: false, name: "tokenAmount" },
    { type: "uint256", indexed: false, name: "tokenPrice" },
    { type: "uint256", indexed: false, name: "ethPriceUSD" },
    { type: "uint256", indexed: false, name: "marketCap" },
    { type: "uint256", indexed: false, name: "date" },
  ],
};

const noxaTokenLaunchedEvent = {
  type: "event" as const,
  name: "TokenLaunched",
  inputs: [
    { type: "address", indexed: true, name: "token" },
    { type: "address", indexed: true, name: "deployer" },
    { type: "address", indexed: true, name: "dexFactory" },
    { type: "address", indexed: false, name: "pairToken" },
    { type: "address", indexed: false, name: "pool" },
    { type: "uint256", indexed: false, name: "dexId" },
    { type: "uint256", indexed: false, name: "launchConfigId" },
    { type: "uint256", indexed: false, name: "positionId" },
    { type: "uint256", indexed: false, name: "restrictionsEndBlock" },
    { type: "uint256", indexed: false, name: "initialBuyAmount" },
  ],
};

export async function resolveLaunchpadInfo(tokenAddress: Address, deployBlock?: number): Promise<LaunchpadInfo | null> {
  for (const launchpad of contractConfig.launchpads) {
    if (launchpad.address.toLowerCase() === ARROWPAD_ADDRESS) {
      const info = await resolveArrowPadToken(launchpad, tokenAddress, deployBlock);
      if (info) return info;
    }

    if (launchpad.address.toLowerCase() === NOXA_FACTORY_ADDRESS) {
      const info = await resolveNoxaToken(launchpad, tokenAddress, deployBlock);
      if (info) return info;
    }
  }

  return null;
}

async function resolveArrowPadToken(
  launchpad: LaunchpadConfig,
  tokenAddress: Address,
  deployBlock?: number
): Promise<LaunchpadInfo | null> {
  const fromBlock = getSearchStartBlock(launchpad, deployBlock);
  const [createdLogs, launchedLogs, buyLogs, sellLogs] = await Promise.all([
    getTokenLogs(launchpad.address, tokenCreatedEvent, tokenAddress, fromBlock),
    getTokenLogs(launchpad.address, tokenLaunchedEvent, tokenAddress, fromBlock),
    getTokenLogs(launchpad.address, buyTokensEvent, tokenAddress, fromBlock),
    getTokenLogs(launchpad.address, sellTokensEvent, tokenAddress, fromBlock),
  ]);

  if (createdLogs.length === 0 && launchedLogs.length === 0 && buyLogs.length === 0 && sellLogs.length === 0) {
    return null;
  }

  const latestEventBlock = maxBlock([...createdLogs, ...launchedLogs, ...buyLogs, ...sellLogs]);
  const createdBlock = minBlock(createdLogs);
  const launchedBlock = minBlock(launchedLogs);
  const lifecycle: LaunchpadLifecycle = launchedLogs.length > 0
    ? "launched"
    : buyLogs.length > 0 || sellLogs.length > 0
      ? "trading"
      : createdLogs.length > 0
        ? "created"
        : "unknown";

  return {
    name: launchpad.name,
    address: launchpad.address,
    type: launchpad.type,
    lifecycle,
    lockModel: "bonding_curve",
    createdBlock,
    launchedBlock,
    buyCount: buyLogs.length,
    sellCount: sellLogs.length,
    latestEventBlock,
  };
}

async function resolveNoxaToken(
  launchpad: LaunchpadConfig,
  tokenAddress: Address,
  deployBlock?: number
): Promise<LaunchpadInfo | null> {
  const fromBlock = getSearchStartBlock(launchpad, deployBlock);
  const logs = await getTokenLogs(launchpad.address, noxaTokenLaunchedEvent, tokenAddress, fromBlock, true);
  const launch = logs[0];
  if (!launch) return null;

  return {
    name: launchpad.name,
    address: launchpad.address,
    type: launchpad.type,
    lifecycle: "launched",
    lockModel: "uniswap_v3_nft_locked",
    pool: launch.args?.pool as Address | undefined,
    pairToken: launch.args?.pairToken as Address | undefined,
    deployer: launch.args?.deployer as Address | undefined,
    dexFactory: launch.args?.dexFactory as Address | undefined,
    positionId: stringifyBigInt(launch.args?.positionId),
    restrictionsEndBlock: stringifyBigInt(launch.args?.restrictionsEndBlock),
    locker: NOXA_LOCKER,
    nftManager: NOXA_NFT_MANAGER,
    launchedBlock: Number(launch.blockNumber),
    buyCount: 0,
    sellCount: 0,
    latestEventBlock: Number(launch.blockNumber),
  };
}

async function getTokenLogs(
  address: Address,
  event: object,
  tokenAddress: Address,
  fromBlock: bigint,
  indexedToken = false
): Promise<any[]> {
  // Wide fromBlock→latest ranges exceed the RPC provider's per-call block-range
  // limit (Alchemy caps eth_getLogs at 10,000 blocks) — getLogsChunked splits
  // the query into safe windows. Retry once on top of that for transient blips.
  let logs: any[] = [];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      logs = await cachedRpc.getLogsChunked({
        address,
        event,
        args: indexedToken ? { token: tokenAddress } : undefined,
        fromBlock,
        toBlock: "latest",
      });
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  if (lastErr) throw lastErr;

  const token = tokenAddress.toLowerCase();
  return logs.filter((log) => String(log.args?.token ?? "").toLowerCase() === token);
}

function getSearchStartBlock(launchpad: LaunchpadConfig, deployBlock?: number): bigint {
  if (deployBlock && deployBlock > 0) {
    return BigInt(Math.max(deployBlock - 25, launchpad.startBlock ?? 0, 0));
  }

  return BigInt(Math.max(launchpad.startBlock ?? 0, 0));
}

function minBlock(logs: any[]): number | undefined {
  if (logs.length === 0) return undefined;
  return Math.min(...logs.map((log) => Number(log.blockNumber)));
}

function maxBlock(logs: any[]): number | undefined {
  if (logs.length === 0) return undefined;
  return Math.max(...logs.map((log) => Number(log.blockNumber)));
}

function stringifyBigInt(value: unknown): string | undefined {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "string") return String(value);
  return undefined;
}
