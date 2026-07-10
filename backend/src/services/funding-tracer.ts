import type { Address } from "viem";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";

export interface FundingOrigin {
  wallet: Address;
  funder?: Address;
  txHash?: string;
  blockNumber?: number;
  valueEth?: number;
  source: "alchemy_getAssetTransfers" | "unavailable";
}

const CACHE_PREFIX = "funding:";

export async function traceFundingOrigin(wallet: Address, beforeBlock?: number): Promise<FundingOrigin> {
  const normalized = wallet.toLowerCase() as Address;
  const key = `${CACHE_PREFIX}${normalized}:${beforeBlock ?? "latest"}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const origin = await tryAlchemyTransfers(normalized, beforeBlock);
  await redis.setex(key, 3600, JSON.stringify(origin));
  return origin;
}

export async function traceFundingOrigins(wallets: Address[], beforeBlock?: number): Promise<FundingOrigin[]> {
  return Promise.all(wallets.map((wallet) => traceFundingOrigin(wallet, beforeBlock)));
}

async function tryAlchemyTransfers(wallet: Address, beforeBlock?: number): Promise<FundingOrigin> {
  try {
    const response = await fetch(env.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            ...(beforeBlock ? { toBlock: `0x${beforeBlock.toString(16)}` } : {}),
            toAddress: wallet,
            category: ["external"],
            order: "desc",
            maxCount: "0x1",
            withMetadata: false,
            excludeZeroValue: true,
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      result?: {
        transfers?: {
          from?: string;
          hash?: string;
          blockNum?: string;
          value?: number;
        }[];
      };
    };

    const transfer = data.result?.transfers?.[0];
    if (!transfer?.from) {
      return { wallet, source: "unavailable" };
    }

    return {
      wallet,
      funder: transfer.from as Address,
      txHash: transfer.hash,
      blockNumber: transfer.blockNum ? Number.parseInt(transfer.blockNum, 16) : undefined,
      valueEth: transfer.value,
      source: "alchemy_getAssetTransfers",
    };
  } catch {
    return { wallet, source: "unavailable" };
  }
}
