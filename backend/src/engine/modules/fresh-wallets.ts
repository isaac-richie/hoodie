/**
 * Fresh Wallet Analysis (weight: 6) — are holders real users or disposable wallets?
 *
 * Samples up to 30 token holders and checks their on-chain nonce (transaction count).
 * A wallet with <=10 transactions is "fresh" — likely created just for this token.
 * A wallet with <=1 transaction is "single-tx" — almost certainly a sybil.
 *
 * High fresh wallet % suggests artificial holder count inflation or wash trading.
 * Capped at 30 holders per scan to stay within RPC budget (~30 getTransactionCount calls).
 *
 * Score: 0 = organic, 20 = 25-50% fresh, 45 = 50-80% fresh, 75 = >80% fresh.
 * Funding origins are traced through Alchemy when available to detect shared funders.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import { traceFundingOrigins } from "../../services/funding-tracer.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import type { Address } from "viem";

export const freshWalletModule: ScanModule = {
  name: "fresh_wallets",
  weight: 6,
  category: "holders",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      const analysis = await analyzeFreshWallets(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (analysis.freshHolderPct > 80) {
        score = 75;
        status = "fail";
        label = `${analysis.freshHolderPct}% holders are fresh wallets`;
      } else if (analysis.freshHolderPct > 50) {
        score = 45;
        status = "warn";
        label = `${analysis.freshHolderPct}% fresh wallets · ${analysis.singleTxPct}% single-tx wallets`;
      } else if (analysis.freshHolderPct > 25) {
        score = 20;
        status = "warn";
        label = `${analysis.freshHolderPct}% fresh wallets · moderate`;
      } else {
        score = 0;
        status = "pass";
        label = `${analysis.freshHolderPct}% fresh wallets · organic distribution`;
      }

      return {
        module: "fresh_wallets",
        status,
        score,
        weight: 6,
        label,
        detail: `${analysis.totalChecked} holders checked. ${analysis.freshCount} fresh (<10 tx). ${analysis.singleTxCount} single-tx wallets. ${analysis.commonFunderCount} share a common funder.`,
        evidence: analysis,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "fresh_wallets",
        status: "error",
        score: 15,
        weight: 6,
        label: "fresh wallet analysis failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface FreshWalletAnalysis {
  totalChecked: number;
  freshCount: number;
  freshHolderPct: number;
  singleTxCount: number;
  singleTxPct: number;
  commonFunderCount: number;
  commonFunders: string[];
  fundingTraceAvailable: boolean;
}

async function analyzeFreshWallets(ctx: ScanContext): Promise<FreshWalletAnalysis> {
  // Get Transfer events to find holder addresses
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
    fromBlock: BigInt(ctx.deployBlock ?? 0),
    toBlock: "latest",
  });

  // Collect unique recipient addresses (exclude burn/zero)
  const burnAddresses = new Set([
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
  ]);

  const recipients = new Set<string>();
  for (const log of logs) {
    const to = (log.args?.to as string)?.toLowerCase();
    if (to && !burnAddresses.has(to)) {
      recipients.add(to);
    }
  }

  // Sample up to 30 holders for nonce check (RPC budget)
  const holderList = Array.from(recipients);
  const sampleSize = Math.min(holderList.length, 30);
  const sampled = holderList.slice(0, sampleSize);

  let freshCount = 0;
  let singleTxCount = 0;

  // Check nonce (tx count) for each sampled wallet
  const nonceResults = await Promise.allSettled(
    sampled.map((addr) => cachedRpc.getTransactionCount(addr as Address))
  );

  for (const result of nonceResults) {
    if (result.status !== "fulfilled") continue;
    const nonce = result.value;

    if (nonce <= 10) freshCount++;
    if (nonce <= 1) singleTxCount++;
  }

  const freshHolderPct = sampleSize > 0 ? Math.round((freshCount / sampleSize) * 100) : 0;
  const singleTxPct = sampleSize > 0 ? Math.round((singleTxCount / sampleSize) * 100) : 0;
  const fundingOrigins = await traceFundingOrigins(sampled as Address[], ctx.deployBlock);
  const funderCounts = new Map<string, number>();
  for (const origin of fundingOrigins) {
    if (!origin.funder) continue;
    const funder = origin.funder.toLowerCase();
    funderCounts.set(funder, (funderCounts.get(funder) ?? 0) + 1);
  }

  const commonFunders = Array.from(funderCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  const commonFunderCount = commonFunders.reduce((sum, [, count]) => sum + count, 0);

  return {
    totalChecked: sampleSize,
    freshCount,
    freshHolderPct,
    singleTxCount,
    singleTxPct,
    commonFunderCount,
    commonFunders: commonFunders.map(([funder]) => funder).slice(0, 10),
    fundingTraceAvailable: fundingOrigins.some((origin) => origin.source !== "unavailable"),
  };
}
