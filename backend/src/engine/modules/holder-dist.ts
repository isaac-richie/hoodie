/**
 * Holder Distribution (weight: 12) — how concentrated is token ownership?
 *
 * Reconstructs all holder balances from Transfer event logs (no external API needed).
 * Calculates: top 1 holder %, top 10 holders %, fresh wallet %, sybil-adjusted %.
 *
 * High concentration = one wallet can dump the entire supply.
 * "Sybil adjusted" accounts for multiple wallets sharing the same funding source
 * when Alchemy transfer tracing is available.
 *
 * This is the heaviest RPC module — pulls ALL Transfer events since deploy.
 * Historical logs are cached forever (immutable), so re-scans are cheap.
 *
 * Score: 10 = healthy distribution, 55 = concentrated, 85 = sybil-adjusted >60%.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";
import { traceFundingOrigins } from "../../services/funding-tracer.js";
import type { Address } from "viem";

export const holderDistModule: ScanModule = {
  name: "holder_distribution",
  weight: 12,
  category: "holders",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (!ctx.deployBlock) {
        return {
          module: "holder_distribution",
          status: "warn",
          score: 40,
          weight: 12,
          label: "holder breakdown pending",
          detail: "We couldn't pin down exactly when this token launched, so the full holder breakdown isn't ready yet. Hit \"run again\" in a moment — this usually resolves on a second scan.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      // Infrastructure-grade tokens (WETH, stablecoins) transfer in nearly
      // every block — reconstructing holders from logs is hopeless and the
      // failed attempts starve the RPC for every other module. Skip honestly.
      if (await cachedRpc.isDenseLogSource(ctx.tokenAddress, TRANSFER_EVENT)) {
        return {
          module: "holder_distribution",
          status: "pass",
          score: 10,
          weight: 12,
          label: "holder scan skipped — extremely high transfer volume",
          detail: "This token transfers in nearly every block (typical for WETH, stablecoins, and other infrastructure tokens). Reconstructing individual holder balances isn't feasible at this volume, and tokens this heavily used aren't stealth-rug candidates.",
          evidence: { highVolume: true },
          durationMs: Date.now() - start,
        };
      }

      const dist = await analyzeDistribution(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (dist.top10SybilAdjusted > 60) {
        score = 85;
        status = "fail";
        label = `top10 ${dist.top10Pct}% · sybil adjusted ${dist.top10SybilAdjusted}%`;
      } else if (dist.top10SybilAdjusted > 40) {
        score = 55;
        status = "warn";
        label = `top10 ${dist.top10Pct}% · sybil adjusted ${dist.top10SybilAdjusted}%`;
      } else if (dist.top10Pct > 30) {
        score = 35;
        status = "warn";
        label = `top10 ${dist.top10Pct}% · sybil adjusted ${dist.top10SybilAdjusted}%`;
      } else {
        score = 10;
        status = "pass";
        label = `top10 ${dist.top10Pct}% · distribution healthy`;
      }

      return {
        module: "holder_distribution",
        status,
        score,
        weight: 12,
        label,
        detail: `${dist.holderCount} holders. Top 1: ${dist.top1Pct}%. Top 10: ${dist.top10Pct}%. Sybil adjusted top 10: ${dist.top10SybilAdjusted}%. Fresh wallets: ${dist.freshWalletPct}%.`,
        evidence: dist,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "holder_distribution",
        status: "error",
        score: 40,
        weight: 12,
        label: "holder distribution check unavailable",
        detail: friendlyError(err, "holder distribution"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

const TRANSFER_EVENT = {
  type: "event" as const,
  name: "Transfer",
  inputs: [
    { type: "address", indexed: true, name: "from" },
    { type: "address", indexed: true, name: "to" },
    { type: "uint256", indexed: false, name: "value" },
  ],
};

interface Distribution {
  holderCount: number;
  top1Pct: number;
  top10Pct: number;
  top10SybilAdjusted: number;
  freshWalletPct: number;
  sybilBands: number;
  commonFunders: string[];
  fundingTraceAvailable: boolean;
}

async function analyzeDistribution(ctx: ScanContext): Promise<Distribution> {
  // Get Transfer events to reconstruct holder balances
  // This is the heavy-lift module — uses getLogs to pull all transfers

  const logs = await cachedRpc.getLogsChunked({
    address: ctx.tokenAddress,
    event: TRANSFER_EVENT,
    fromBlock: BigInt(ctx.deployBlock ?? 0),
    toBlock: "latest",
    // 120 chunks ≈ 1.08M blocks. Older tokens get the most recent window —
    // slightly approximate for wallets that only moved early, but it keeps
    // this module inside its timeout instead of scanning millions of blocks.
    // Small chunks keep per-response payloads sane: a 9k-block chunk of a
    // busy token can be 10k logs (~5MB JSON) and 10 of those in flight seize
    // the event loop, starving every other module. 2k-block chunks keep the
    // deadline check responsive and Redis entries small.
    maxRangeBlocks: 2_000,
    maxChunks: 60,
    maxLogs: 40_000,
    bestEffort: true,
    deadlineMs: 8_000,
    // Modest concurrency: two of these modules run at once, and flooding the
    // provider with hundreds of parallel getLogs triggers rate-limit storms
    // that starve every other module's simple reads.
    concurrency: 4,
  });

  // Reconstruct balances from transfer events
  const balances = new Map<string, bigint>();
  const walletFirstSeen = new Map<string, number>();

  for (const log of logs) {
    const from = (log.args.from as string).toLowerCase();
    const to = (log.args.to as string).toLowerCase();
    const value = log.args.value as bigint;

    // Track first seen block for "fresh wallet" detection
    if (!walletFirstSeen.has(to)) {
      walletFirstSeen.set(to, Number(log.blockNumber));
    }

    // Update balances
    const fromBal = balances.get(from) ?? 0n;
    const toBal = balances.get(to) ?? 0n;
    balances.set(from, fromBal - value);
    balances.set(to, toBal + value);
  }

  // Remove zero/negative balances and burn addresses
  const burnAddresses = new Set([
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
  ]);

  const holders = Array.from(balances.entries())
    .filter(([addr, bal]) => bal > 0n && !burnAddresses.has(addr))
    .sort((a, b) => (b[1] > a[1] ? 1 : -1));

  const totalSupply = ctx.totalSupply ?? holders.reduce((s, [, b]) => s + b, 0n);
  const holderCount = holders.length;

  if (holderCount === 0 || totalSupply === 0n) {
    return {
      holderCount: 0,
      top1Pct: 0,
      top10Pct: 0,
      top10SybilAdjusted: 0,
      freshWalletPct: 0,
      sybilBands: 0,
      commonFunders: [],
      fundingTraceAvailable: false,
    };
  }

  const pct = (bal: bigint) => Number((bal * 10000n) / totalSupply) / 100;

  const top1Pct = pct(holders[0]?.[1] ?? 0n);
  const top10Pct = holders.slice(0, 10).reduce((s, [, b]) => s + pct(b), 0);

  // Fresh wallet detection: wallets created within 7 days of token deploy
  const freshThreshold = (ctx.deployBlock ?? 0) + 50400; // ~7 days at 12s blocks
  const freshWallets = holders.filter(
    ([addr]) => (walletFirstSeen.get(addr) ?? 0) > freshThreshold
  );
  const freshWalletPct = (freshWallets.length / holderCount) * 100;

  const topHolders = holders.slice(0, 20);
  const fundingOrigins = await traceFundingOrigins(
    topHolders.map(([addr]) => addr as Address),
    ctx.deployBlock
  );
  const funderGroups = new Map<string, { wallets: string[]; balance: bigint }>();

  for (const origin of fundingOrigins) {
    if (!origin.funder) continue;
    const wallet = origin.wallet.toLowerCase();
    const balance = balances.get(wallet) ?? 0n;
    const funder = origin.funder.toLowerCase();
    const group = funderGroups.get(funder) ?? { wallets: [], balance: 0n };
    group.wallets.push(wallet);
    group.balance += balance;
    funderGroups.set(funder, group);
  }

  const commonFunderGroups = Array.from(funderGroups.entries())
    .filter(([, group]) => group.wallets.length > 1)
    .sort((a, b) => (b[1].balance > a[1].balance ? 1 : -1));
  const largestFunderGroupPct = commonFunderGroups.length > 0
    ? pct(commonFunderGroups[0]?.[1].balance ?? 0n)
    : 0;
  const sybilBands = commonFunderGroups.length;
  const top10SybilAdjusted = Math.max(top10Pct, largestFunderGroupPct);

  return {
    holderCount,
    top1Pct: Math.round(top1Pct * 10) / 10,
    top10Pct: Math.round(top10Pct * 10) / 10,
    top10SybilAdjusted: Math.round(top10SybilAdjusted * 10) / 10,
    freshWalletPct: Math.round(freshWalletPct * 10) / 10,
    sybilBands,
    commonFunders: commonFunderGroups.map(([funder]) => funder).slice(0, 10),
    fundingTraceAvailable: fundingOrigins.some((origin) => origin.source !== "unavailable"),
  };
}
