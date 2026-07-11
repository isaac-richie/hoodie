/**
 * LP Lock Check (weight: 12) — is the liquidity locked or can it be pulled?
 *
 * An unlocked LP means the deployer can remove all liquidity in one transaction
 * (a "rug pull"). Checks: burned LP tokens (safest), locked via known lockers
 * (team.finance, unicrypt), lock duration, and whether LP owner == deployer.
 *
 * Score: 0 = burned, 10 = locked >30d, 80 = unlocked, +15 if owner is deployer.
 * Locker balances are checked from configured LP_LOCKER_ADDRESSES. Expiry
 * needs locker-specific ABIs once Robinhood Chain lockers are known.
 */
import { cachedRpc } from "../../services/rpc-cache.js";
import { contractConfig } from "../../config/contracts.js";
import { erc20Abi } from "../../utils/abis.js";
import type { ScanModule, ScanContext, ModuleResult } from "../types.js";
import { friendlyError } from "../../utils/friendly-error.js";

export const lpLockModule: ScanModule = {
  name: "lp_lock",
  weight: 12,
  category: "liquidity",

  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();

    try {
      if (ctx.lpPoolKind === "launchpad_curve" || ctx.lpPoolKind === "launchpad_v3_locked") {
        return launchpadLiquidityResult(ctx, start);
      }

      if (ctx.lpPoolKind === "dex_v3") {
        return {
          module: "lp_lock",
          status: "warn",
          score: 40,
          weight: 12,
          label: "Uniswap V3 pool — NFT position lock check not yet supported",
          detail: `V3 pool at ${ctx.lpPool}. V3 liquidity is managed via NFT positions; ERC20 LP burn/lock checks do not apply. Manual review recommended.`,
          evidence: { pool: ctx.lpPool, dex: ctx.lpDex, kind: "dex_v3" },
          durationMs: Date.now() - start,
        };
      }

      if (!ctx.lpPool) {
        return {
          module: "lp_lock",
          status: "warn",
          score: 60,
          weight: 12,
          label: "no LP pool found",
          detail: "Could not locate a liquidity pool for this token.",
          evidence: {},
          durationMs: Date.now() - start,
        };
      }

      const lpStatus = await checkLpStatus(ctx);

      let score: number;
      let status: "pass" | "warn" | "fail";
      let label: string;

      if (lpStatus.burned) {
        score = 0;
        status = "pass";
        label = "LP burned — cannot be pulled";
      } else if (lpStatus.locked && lpStatus.lockDays > 30) {
        score = 10;
        status = "pass";
        label = `locked ${lpStatus.lockDays}d via ${lpStatus.locker}`;
      } else if (lpStatus.locked && lpStatus.lockDays > 7) {
        score = 30;
        status = "warn";
        label = `locked ${lpStatus.lockDays}d — short lock`;
      } else if (lpStatus.locked) {
        score = lpStatus.lockDays > 0 ? 50 : 35;
        status = "warn";
        label = lpStatus.lockDays > 0
          ? `locked ${lpStatus.lockDays}d — very short lock, treat as unlocked`
          : `LP held by configured locker ${lpStatus.locker} · expiry unknown`;
      } else {
        score = 80;
        status = "fail";
        label = "LP unlocked — one signature rug possible";
      }

      // Additional risk: is LP owner the deployer?
      if (lpStatus.owner === ctx.deployerAddress && !lpStatus.burned) {
        score = Math.min(100, score + 15);
        label += " · owner is deployer";
      }

      return {
        module: "lp_lock",
        status,
        score,
        weight: 12,
        label,
        detail: `Pool: ${ctx.lpPool}. Liquidity: $${lpStatus.liquidity?.toLocaleString() ?? "unknown"}. ${lpStatus.burned ? "Burned." : lpStatus.locked ? `Locked until ${lpStatus.unlockDate}.` : "Unlocked."}`,
        evidence: lpStatus,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        module: "lp_lock",
        status: "error",
        score: 50,
        weight: 12,
        label: "liquidity-lock check unavailable",
        detail: friendlyError(err, "liquidity lock"),
        evidence: {},
        durationMs: Date.now() - start,
      };
    }
  },
};

function launchpadLiquidityResult(ctx: ScanContext, start: number): ModuleResult {
  const launchpad = ctx.launchpad;
  const lifecycle = launchpad?.lifecycle ?? "unknown";

  if (ctx.lpPoolKind === "launchpad_v3_locked") {
    return {
      module: "lp_lock",
      status: "pass",
      score: 8,
      weight: 12,
      label: `${launchpad?.name ?? "launchpad"} Uniswap V3 LP locked`,
      detail: "This token launched through a known launchpad whose Uniswap V3 NFT position is held by its launch locker. Generic ERC20 LP locker checks do not apply to this V3 NFT lock model.",
      evidence: { launchpad, pool: ctx.lpPool },
      durationMs: Date.now() - start,
    };
  }

  if (lifecycle === "launched") {
    return {
      module: "lp_lock",
      status: "fail",
      score: 70,
      weight: 12,
      label: "launchpad graduated but DEX LP was not resolved",
      detail: "This token has a launchpad graduation event, so a DEX pool should now be checked for burned or locked liquidity.",
      evidence: { launchpad, pool: ctx.lpPool },
      durationMs: Date.now() - start,
    };
  }

  return {
    module: "lp_lock",
    status: "warn",
    score: lifecycle === "unknown" ? 35 : 20,
    weight: 12,
    label: `${launchpad?.name ?? "launchpad"} bonding-curve custody`,
    detail: "No generic LP locker is expected before graduation; liquidity is held by the launchpad curve. Re-check LP lock status after the token graduates to a DEX.",
    evidence: { launchpad, pool: ctx.lpPool },
    durationMs: Date.now() - start,
  };
}

interface LpStatus {
  burned: boolean;
  locked: boolean;
  lockDays: number;
  unlockDate?: string;
  locker?: string;
  owner?: string;
  liquidity?: number;
  poolCount: number;
  burnedPct?: number;
  lockedPct?: number;
}

async function checkLpStatus(ctx: ScanContext): Promise<LpStatus> {
  if (!ctx.lpPool) {
    return {
      burned: false,
      locked: false,
      lockDays: 0,
      poolCount: 0,
    };
  }

  const burnAddresses = [
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dEaD",
  ] as const;

  const totalSupply = await cachedRpc.readContract({
    address: ctx.lpPool,
    abi: erc20Abi,
    functionName: "totalSupply",
    ttlMs: 30_000,
  }) as bigint;

  let burnedBalance = 0n;
  for (const address of burnAddresses) {
    try {
      burnedBalance += await cachedRpc.readContract({
        address: ctx.lpPool,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
        ttlMs: 30_000,
      }) as bigint;
    } catch {
      continue;
    }
  }

  const lockerBalances = await Promise.all(
    contractConfig.lpLockers.map(async (locker) => {
      try {
        const balance = await cachedRpc.readContract({
          address: ctx.lpPool!,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [locker.address],
          ttlMs: 30_000,
        }) as bigint;

        return { ...locker, balance };
      } catch {
        return { ...locker, balance: 0n };
      }
    })
  );

  const topLocker = lockerBalances.sort((a, b) => Number(b.balance - a.balance))[0];
  const burnedPct = totalSupply > 0n ? Number((burnedBalance * 10000n) / totalSupply) / 100 : 0;
  const lockedPct = topLocker && totalSupply > 0n
    ? Number((topLocker.balance * 10000n) / totalSupply) / 100
    : 0;

  return {
    burned: burnedPct >= 95,
    locked: lockedPct >= 50,
    lockDays: 0,
    locker: lockedPct >= 50 ? topLocker?.name : undefined,
    owner: topLocker?.address,
    poolCount: 1,
    liquidity: ctx.lpPool ? undefined : 0,
    burnedPct,
    lockedPct,
  };
}
