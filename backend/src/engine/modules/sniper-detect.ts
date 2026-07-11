/**
 * Sniper Detection (weight: 8) — were there automated buys at launch?
 *
 * Counts wallets that bought tokens in the first 2 blocks after deployment.
 * These are typically MEV bots or insider wallets with advance knowledge of
 * the launch. High sniper count suggests the token was pre-announced in
 * sniper channels (often coordinated pump-and-dump groups).
 *
 * Different from bundle detection: snipers buy independently (each paying gas),
 * while bundles are coordinated by one entity across many wallets.
 *
 * Score: 0 = no snipers, 25 = 2-5 snipers, 50 = >5 snipers.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import { traceFundingOrigins } from "../../services/funding-tracer.js";
import { erc20Abi } from "../../utils/abis.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";

export const sniperDetectModule: ScanModule = {
  name: "sniper_detect",
  weight: 8,
  category: "launch",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (!ctx.deployBlock) {
        return {
          module: "sniper_detect",
          status: "warn",
          score: 15,
          weight: 8,
          label: "sniper check pending",
          detail: "We couldn't pin down exactly when this token launched, so the launch-sniping check isn't ready yet. Hit \"run again\" in a moment — this usually resolves on a second scan.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      const snipers = await detectSnipers(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (snipers.count > 5) {
        score = 50;
        status = "warn";
        label = `${snipers.count} snipers · ${snipers.soldAll} sold all`;
      } else if (snipers.count > 2) {
        score = 25;
        status = "warn";
        label = `${snipers.count} snipers detected in blocks 0-2`;
      } else {
        score = 0;
        status = "pass";
        label = snipers.count > 0
          ? `${snipers.count} sniper · low concern`
          : "no snipers detected";
      }

      return {
        module: "sniper_detect",
        status,
        score,
        weight: 8,
        label,
        detail: `${snipers.count} wallets bought in blocks 0-2. ${snipers.soldAll} have already sold all.`,
        evidence: snipers,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "sniper_detect",
        status: "error",
        score: 15,
        weight: 8,
        label: "launch sniping check unavailable",
        detail: friendlyError(err, "launch sniping"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface SniperInfo {
  count: number;
  soldAll: number;
  wallets: string[];
  commonFunders: string[];
  fundingTraceAvailable: boolean;
}

async function detectSnipers(ctx: ScanContext): Promise<SniperInfo> {
  const deployBlock = BigInt(ctx.deployBlock!);

  // Get buys in first 2 blocks
  const logs = await cachedRpc.getLogs({
    address: ctx.tokenAddress,
    event: {
      type: "event",
      name: "Transfer",
      inputs: [
        { type: "address", indexed: true, name: "from" },
        { type: "address", indexed: true, name: "to" },
        { type: "uint256", indexed: false, name: "value" },
      ],
    },
    fromBlock: deployBlock,
    toBlock: deployBlock + 2n,
  });

  const buyers = new Set<string>();
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const poolAddr = ctx.lpPool?.toLowerCase();

  for (const log of logs) {
    const from = (log.args.from as string).toLowerCase();
    const to = (log.args.to as string).toLowerCase();
    // Exclude the LP pool itself — the initial liquidity-funding transfer
    // isn't a sniper buy, it's the deployer seeding the pool.
    if (from !== zeroAddr && to !== zeroAddr && to !== ctx.tokenAddress.toLowerCase() && to !== poolAddr) {
      buyers.add(to);
    }
  }

  const walletList = Array.from(buyers) as `0x${string}`[];
  const balances = await Promise.all(
    walletList.map(async (wallet) => {
      try {
        const balance = await cachedRpc.readContract({
          address: ctx.tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
          ttlMs: 30_000,
        }) as bigint;
        return { wallet, balance };
      } catch {
        return { wallet, balance: 1n };
      }
    })
  );
  const fundingOrigins = await traceFundingOrigins(walletList, ctx.deployBlock);
  const funderCounts = new Map<string, number>();
  for (const origin of fundingOrigins) {
    if (!origin.funder) continue;
    const funder = origin.funder.toLowerCase();
    funderCounts.set(funder, (funderCounts.get(funder) ?? 0) + 1);
  }

  return {
    count: buyers.size,
    soldAll: balances.filter((entry) => entry.balance === 0n).length,
    wallets: walletList.slice(0, 10),
    commonFunders: Array.from(funderCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([funder]) => funder),
    fundingTraceAvailable: fundingOrigins.some((origin) => origin.source !== "unavailable"),
  };
}
