/**
 * Bundle Detection (weight: 13) — were tokens distributed to coordinated wallets at launch?
 *
 * Analyzes Transfer events in blocks 0-2 after deployment. "Bundling" is when
 * a deployer buys tokens across many wallets in the same block as the launch,
 * giving them hidden control over a large portion of supply. These wallets then
 * dump in unison after the price pumps.
 *
 * Heuristic: any wallet receiving >0.5% of supply in the first 2 blocks is flagged.
 * Funding origins are traced through Alchemy when the configured RPC supports it.
 *
 * Score: 0 = no bundles, 35 = 5-15% bundled, 90 = >25% bundled.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import { traceFundingOrigins } from "../../services/funding-tracer.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";

export const bundleDetectModule: ScanModule = {
  name: "bundle_detect",
  weight: 13,
  category: "launch",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (!ctx.deployBlock) {
        return {
          module: "bundle_detect",
          status: "warn",
          score: 30,
          weight: 13,
          label: "deploy block unknown — cannot check bundles",
          detail: "Could not determine deploy block for bundle analysis.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      const bundles = await detectBundles(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (bundles.bundlePct > 25) {
        score = 90;
        status = "fail";
        label = `${bundles.bundlePct}% of supply · ${bundles.walletCount} wallets · ${bundles.funderCount} funder(s) · block 0`;
      } else if (bundles.bundlePct > 15) {
        score = 65;
        status = "fail";
        label = `${bundles.bundlePct}% of supply · ${bundles.walletCount} wallets · ${bundles.funderCount} funder(s)`;
      } else if (bundles.bundlePct > 5) {
        score = 35;
        status = "warn";
        label = `${bundles.bundlePct}% of supply bundled · moderate concentration`;
      } else {
        score = 0;
        status = "pass";
        label = "no significant bundles detected";
      }

      return {
        module: "bundle_detect",
        status,
        score,
        weight: 13,
        label,
        detail: `Analyzed blocks ${ctx.deployBlock} to ${ctx.deployBlock + 2}. Found ${bundles.walletCount} bundled wallets holding ${bundles.bundlePct}% from ${bundles.funderCount} funder(s).`,
        evidence: bundles,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "bundle_detect",
        status: "error",
        score: 40,
        weight: 13,
        label: "bundle detection failed",
        detail: (err as Error).message,
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface BundleInfo {
  bundlePct: number;
  walletCount: number;
  funderCount: number;
  funders: string[];
  bundleBlock: number;
  wallets: string[];
  fundingTraceAvailable: boolean;
}

async function detectBundles(ctx: ScanContext): Promise<BundleInfo> {
  const deployBlock = BigInt(ctx.deployBlock!);

  // Get all transfers in blocks 0-2 after deploy (where bundles happen)
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

  // Identify wallets that bought in block 0-2
  const earlyBuyers = new Map<string, bigint>();
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const poolAddr = ctx.lpPool?.toLowerCase();

  for (const log of logs) {
    const from = (log.args.from as string).toLowerCase();
    const to = (log.args.to as string).toLowerCase();
    const value = log.args.value as bigint;

    if (from === zeroAddr) continue; // skip mints
    // The initial LP-funding transfer sends a large chunk of supply to the
    // pool itself — that's liquidity provisioning, not a bundled wallet.
    if (to === poolAddr) continue;

    // Track buys (from pool or router)
    const current = earlyBuyers.get(to) ?? 0n;
    earlyBuyers.set(to, current + value);
  }

  const totalSupply = ctx.totalSupply ?? 1n;
  const bundleWallets: string[] = [];

  for (const [wallet, amount] of earlyBuyers) {
    const pct = Number((amount * 10000n) / totalSupply) / 100;
    if (pct > 0.5) {
      bundleWallets.push(wallet);
    }
  }

  const fundingOrigins = await traceFundingOrigins(bundleWallets as `0x${string}`[], ctx.deployBlock);
  const funders = new Set(
    fundingOrigins
      .map((origin) => origin.funder?.toLowerCase())
      .filter((funder): funder is string => Boolean(funder))
  );

  const bundlePct = bundleWallets.reduce((sum, w) => {
    const bal = earlyBuyers.get(w) ?? 0n;
    return sum + Number((bal * 10000n) / totalSupply) / 100;
  }, 0);

  return {
    bundlePct: Math.round(bundlePct * 10) / 10,
    walletCount: bundleWallets.length,
    funderCount: Math.max(funders.size, bundleWallets.length > 0 ? 1 : 0),
    funders: Array.from(funders),
    bundleBlock: ctx.deployBlock!,
    wallets: bundleWallets.slice(0, 25),
    fundingTraceAvailable: fundingOrigins.some((origin) => origin.source !== "unavailable"),
  };
}
