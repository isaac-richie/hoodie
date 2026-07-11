/**
 * Deployer Reputation (weight: 14) — has this wallet deployed scams before?
 *
 * Queries the deployers table for past launch history. A deployer with confirmed
 * rugs is the strongest signal of a scam — serial ruggers reuse wallets because
 * creating fresh ones requires bridging ETH (which leaves a trace).
 *
 * Scores based on: confirmed rug count, 30-day token survival rate, total launches.
 * Currently uses on-chain nonce as a proxy until the DB populates with scan data.
 * The persist.ts layer upserts deployer records on every scan, so reputation
 * improves automatically over time.
 *
 * Score: 5 = clean record, 55 = low survival, 70 = 1 rug, 95 = serial rugger.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";
import { logger } from "../../utils/logger.js";
import { db } from "../../db/client.js";
import { deployers, tokens } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";

export const deployerRepModule: ScanModule = {
  name: "deployer_reputation",
  weight: 14,
  category: "creator",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (!ctx.deployerAddress) {
        return {
          module: "deployer_reputation",
          status: "warn",
          score: 20,
          weight: 14,
          label: "creator wallet not identified yet",
          detail: "We couldn't confirm which wallet created this token on this pass, so there's no creator track record to show yet. Hit \"run again\" in a moment — this usually resolves on a second scan.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      const rep = await getDeployerReputation(ctx.deployerAddress);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (rep.confirmedRugs >= 2) {
        score = 95;
        status = "fail";
        label = `${rep.confirmedRugs} confirmed rugs · serial rug · ${rep.survivalRate}% survival`;
      } else if (rep.confirmedRugs === 1) {
        score = 70;
        status = "fail";
        label = `1 confirmed rug · ${rep.survivalRate}% survival`;
      } else if (rep.survivalRate < 30 && rep.totalLaunches > 3) {
        score = 55;
        status = "warn";
        label = `${rep.survivalRate}% survival across ${rep.totalLaunches} launches`;
      } else if (rep.totalLaunches === 1) {
        score = 15;
        status = "pass";
        label = "first launch from this deployer";
      } else {
        score = 5;
        status = "pass";
        label = `${rep.totalLaunches} launches · ${rep.survivalRate}% survival · clean record`;
      }

      return {
        module: "deployer_reputation",
        status,
        score,
        weight: 14,
        label,
        detail: `Deployer ${ctx.deployerAddress}: ${rep.totalLaunches} total launches, ${rep.confirmedRugs} confirmed rugs, ${rep.survivalRate}% 30d survival, median life ${rep.medianLifeHours}h.`,
        evidence: rep,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "deployer_reputation",
        status: "error",
        score: 30,
        weight: 14,
        label: "creator history check unavailable",
        detail: friendlyError(err, "creator history"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

interface DeployerRep {
  address: string;
  totalLaunches: number;
  confirmedRugs: number;
  survivalRate: number;
  medianLifeHours: number;
  isSerialRug: boolean;
  pastTokens: { address: string; symbol: string; status: string; launchDate: string }[];
}

async function getDeployerReputation(deployerAddress: string): Promise<DeployerRep> {
  const address = deployerAddress.toLowerCase();

  try {
    const [[deployerRow], tokenRows] = await Promise.all([
      db.select().from(deployers).where(eq(deployers.address, address)).limit(1),
      db
        .select({
          address: tokens.id,
          symbol: tokens.symbol,
          status: tokens.status,
          latestBand: tokens.latestBand,
          deployBlock: tokens.deployBlock,
          deathBlock: tokens.deathBlock,
          createdAt: tokens.createdAt,
        })
        .from(tokens)
        .where(eq(tokens.deployer, address))
        .orderBy(desc(tokens.updatedAt))
        .limit(50),
    ]);

    if (deployerRow || tokenRows.length > 0) {
      const ruggedRows = tokenRows.filter(
        (token) =>
          token.status === "rugged" ||
          token.status === "honeypot" ||
          token.latestBand === "extreme"
      );
      const deadRows = tokenRows.filter(
        (token) => token.status === "dead" || token.status === "rugged" || token.status === "honeypot"
      );
      const totalLaunches = Math.max(
        tokenRows.length,
        deployerRow?.totalLaunches ?? 0,
        1
      );
      const confirmedRugs = Math.max(
        ruggedRows.length,
        deployerRow?.confirmedRugs ?? 0
      );
      const survivalRate = deployerRow?.survivalRate30d ?? Math.round(
        ((totalLaunches - deadRows.length) / totalLaunches) * 100
      );
      const medianLifeHours = deployerRow?.medianTokenLife ?? median(
        tokenRows
          .map((token) => {
            if (!token.deployBlock || !token.deathBlock) return null;
            return ((token.deathBlock - token.deployBlock) * 12) / 3600;
          })
          .filter((hours): hours is number => typeof hours === "number")
      );

      return {
        address,
        totalLaunches,
        confirmedRugs,
        survivalRate: Math.round(survivalRate),
        medianLifeHours: Math.round(medianLifeHours * 10) / 10,
        isSerialRug: deployerRow?.isSerialRug ?? confirmedRugs >= 2,
        pastTokens: tokenRows.slice(0, 20).map((token) => ({
          address: token.address,
          symbol: token.symbol ?? "UNKNOWN",
          status: token.status ?? "live",
          launchDate: token.createdAt?.toISOString() ?? "",
        })),
      };
    }
  } catch (err) {
    logger.warn({ err, deployerAddress: address }, "deployer reputation DB lookup failed");
  }

  const nonce = await cachedRpc.getTransactionCount(deployerAddress as `0x${string}`);

  return {
    address,
    totalLaunches: nonce > 0 ? 1 : 0,
    confirmedRugs: 0,
    survivalRate: 100,
    medianLifeHours: 0,
    isSerialRug: false,
    pastTokens: [],
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 0;
}
