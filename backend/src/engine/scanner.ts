/**
 * Scan Orchestrator — the main entry point for token risk analysis.
 *
 * Flow: cache check → resolve token metadata → run all 14 modules in parallel
 *       → compute weighted score → cache result → persist to DB (async)
 *
 * Each module returns a score (0-100) and a weight. The final score is:
 *   sum(module.score * module.weight) / sum(module.weight)
 * This gives higher-weight modules (honeypot=15, deployer=14) more influence.
 *
 * Modules that timeout get score=0 and are excluded from the weight calculation.
 * The "confidence" field tells the frontend how complete the scan was.
 *
 * DB persistence is fire-and-forget — we don't block the API response waiting
 * for Postgres. If it fails, the result is still in Redis cache.
 */
import type { Address } from "viem";
import { cachedRpc } from "../services/rpc-cache.js";
import { redis, CACHE_KEYS } from "../config/redis.js";
import { env } from "../config/env.js";
import { scoreToband, computeConfidence } from "./scoring/score.js";
import { registry } from "./modules/registry.js";
import type { ScanContext, ScanResult, ModuleResult } from "./types.js";
import { resolveTokenMeta } from "../services/token-meta.js";
import { resolveMarketData } from "../services/market-data.js";
import { persistScanResult } from "./persist.js";
import { logger } from "../utils/logger.js";

export async function scanToken(
  tokenAddress: Address,
  opts: { fresh?: boolean } = {}
): Promise<ScanResult> {
  const start = Date.now();
  const addr = tokenAddress.toLowerCase() as Address;

  // Check cache first — unless the caller explicitly asked for a fresh scan
  // (the Rescan button). Without this bypass, rescanning inside the cache TTL
  // silently returned the identical cached result and looked like a no-op.
  if (!opts.fresh) {
    const cached = await redis.get(CACHE_KEYS.scanResult(addr));
    if (cached) {
      logger.info({ tokenAddress: addr }, "scan cache hit");
      return JSON.parse(cached);
    }
  } else {
    // Also drop the cached token metadata so deployer/LP/launchpad get another
    // attempt — a rescan exists precisely to fill in what the last pass missed.
    await redis.del(CACHE_KEYS.scanResult(addr), CACHE_KEYS.tokenMeta(addr));
    logger.info({ tokenAddress: addr }, "fresh scan requested — cache bypassed");
  }

  // Build scan context
  const currentBlock = Number(await cachedRpc.getBlockNumber());
  const meta = await resolveTokenMeta(addr);

  const ctx: ScanContext = {
    tokenAddress: addr,
    deployerAddress: meta.deployer,
    deployBlock: meta.deployBlock,
    deployTx: meta.deployTx,
    currentBlock,
    lpPool: meta.lpPool,
    lpPoolKind: meta.lpInfo?.kind,
    lpDex: meta.lpInfo?.dex,
    lpLiquidity: meta.lpInfo?.liquidity,
    launchpad: meta.launchpad,
    totalSupply: meta.totalSupply,
    decimals: meta.decimals,
    symbol: meta.symbol,
    name: meta.name,
  };

  // Market data (price/MC/liquidity) runs alongside the modules — it's
  // decoration for the report header, never a scan blocker.
  const marketDataPromise = resolveMarketData({
    tokenAddress: addr,
    lpInfo: meta.lpInfo,
    totalSupply: meta.totalSupply,
    decimals: meta.decimals,
  });

  // Run all modules in parallel with timeout
  const modules = registry.getAll();
  const results = await Promise.allSettled(
    modules.map((mod) => runModuleWithTimeout(mod, ctx))
  );
  const marketData = await marketDataPromise;

  const moduleResults: ModuleResult[] = [];
  let timedOut = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      moduleResults.push({ ...result.value, category: modules[i].category });
    } else {
      timedOut++;
      moduleResults.push({
        module: modules[i].name,
        category: modules[i].category,
        status: "timeout",
        score: 0,
        weight: modules[i].weight,
        label: "timed out",
        detail: `Module timed out after ${env.scanTimeoutMs}ms`,
        evidence: {},
        durationMs: env.scanTimeoutMs,
      });
    }
  }

  // Compute final score
  const totalWeight = moduleResults
    .filter((r) => r.status !== "timeout")
    .reduce((sum, r) => sum + r.weight, 0);

  const weightedScore = moduleResults
    .filter((r) => r.status !== "timeout")
    .reduce((sum, r) => sum + r.score * r.weight, 0);

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const band = scoreToband(score);
  const confidence = computeConfidence(moduleResults.length - timedOut, modules.length);
  const durationMs = Date.now() - start;

  const summary = generateSummary(moduleResults, score, band);

  const scanResult: ScanResult = {
    tokenAddress: addr,
    tokenName: meta.name,
    tokenSymbol: meta.symbol,
    priceUsd: marketData.priceUsd,
    marketCapUsd: marketData.marketCapUsd,
    liquidityUsd: marketData.liquidityUsd,
    liquidityEth: marketData.liquidityEth,
    score,
    band,
    confidence,
    modulesRan: moduleResults.length - timedOut,
    modulesTotal: modules.length,
    moduleResults,
    summary,
    durationMs,
    timestamp: Date.now(),
  };

  // Cache result
  await redis.setex(
    CACHE_KEYS.scanResult(addr),
    env.cacheScanTtlS,
    JSON.stringify(scanResult)
  );

  // Persist to DB (fire-and-forget — don't block the response)
  persistScanResult(scanResult, meta).catch((err) => {
    logger.error({ err, tokenAddress: addr }, "failed to persist scan result");
  });

  logger.info(
    { tokenAddress: addr, score, band, durationMs, timedOut },
    "scan complete"
  );

  return scanResult;
}

async function runModuleWithTimeout(
  mod: { name: string; weight: number; run: (ctx: ScanContext) => Promise<ModuleResult> },
  ctx: ScanContext
): Promise<ModuleResult> {
  return Promise.race([
    mod.run(ctx),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), env.scanTimeoutMs)
    ),
  ]);
}

function generateSummary(
  results: ModuleResult[],
  score: number,
  band: string
): string {
  const fails = results
    .filter((r) => r.status === "fail")
    .sort((a, b) => b.score - a.score);

  if (fails.length === 0) return "No critical flags detected.";

  const top = fails.slice(0, 3).map((f) => f.label);
  return top.join(". ") + ".";
}
