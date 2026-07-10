/**
 * Scan Persistence — saves scan results and token records to PostgreSQL.
 *
 * Called fire-and-forget after each scan completes (doesn't block the API response).
 * On every scan:
 *   - Upserts the token record (creates on first scan, updates score on re-scan)
 *   - Inserts a new scan_results row (full audit trail of every scan)
 *   - Upserts the deployer record (tracks launch history for reputation scoring)
 *
 * The deployer_reputation module reads from the deployers table to score
 * serial ruggers. As more tokens get scanned, the reputation data improves.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { tokens, scanResults, deployers } from "../db/schema.js";
import type { ScanResult } from "./types.js";
import type { TokenMeta } from "../services/token-meta.js";
import { evaluateAlertsForScan } from "../services/alert-evaluator.js";

export async function persistScanResult(result: ScanResult, meta: TokenMeta): Promise<void> {
  const tokenAddress = result.tokenAddress.toLowerCase();
  const deployerAddress = meta.deployer?.toLowerCase();
  const scanId = `${tokenAddress}:${result.timestamp}`;

  // Upsert token record
  await db
    .insert(tokens)
    .values({
      id: tokenAddress,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      deployer: deployerAddress,
      deployBlock: meta.deployBlock,
      deployTx: meta.deployTx,
      totalScans: 1,
      firstScanScore: result.score,
      latestScore: result.score,
      latestBand: result.band,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tokens.id,
      set: {
        latestScore: result.score,
        latestBand: result.band,
        totalScans: sql`${tokens.totalScans} + 1`,
        updatedAt: new Date(),
      },
    });

  // Insert scan result
  await db.insert(scanResults).values({
    id: scanId,
    tokenAddress,
    score: result.score,
    band: result.band,
    confidence: result.confidence,
    modulesRan: result.modulesRan,
    modulesTotal: result.modulesTotal,
    moduleResults: result.moduleResults,
    summary: result.summary,
    scanDurationMs: result.durationMs,
    createdAt: new Date(),
  });

  // Upsert deployer if known
  if (deployerAddress) {
    const [stats] = await db
      .select({
        totalLaunches: sql<number>`count(*)::int`,
        confirmedRugs: sql<number>`count(*) filter (where ${tokens.status} in ('rugged', 'honeypot') or ${tokens.latestBand} = 'extreme')::int`,
        deadLaunches: sql<number>`count(*) filter (where ${tokens.status} in ('dead', 'rugged', 'honeypot'))::int`,
      })
      .from(tokens)
      .where(eq(tokens.deployer, deployerAddress));

    const totalLaunches = stats?.totalLaunches ?? 1;
    const confirmedRugs = stats?.confirmedRugs ?? 0;
    const deadLaunches = stats?.deadLaunches ?? 0;
    const survivalRate30d = totalLaunches > 0
      ? Math.round(((totalLaunches - deadLaunches) / totalLaunches) * 1000) / 10
      : 100;

    await db
      .insert(deployers)
      .values({
        address: deployerAddress,
        totalLaunches,
        confirmedRugs,
        survivalRate30d,
        isSerialRug: confirmedRugs >= 2,
        firstSeen: new Date(),
        lastLaunch: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: deployers.address,
        set: {
          totalLaunches,
          confirmedRugs,
          survivalRate30d,
          isSerialRug: confirmedRugs >= 2,
          lastLaunch: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  await evaluateAlertsForScan(result);
}
