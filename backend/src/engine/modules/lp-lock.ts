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
import type { Address } from "viem";
import { cachedRpc } from "../../services/rpc-cache.js";
import { redis } from "../../config/redis.js";
import { contractConfig } from "../../config/contracts.js";
import { erc20Abi } from "../../utils/abis.js";
import { NOXA_LOCKER, V3_POSITION_MANAGER } from "../../services/launchpad-resolver.js";
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
        return await v3LockResult(ctx, start);
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

// ── Uniswap V3: NFT-position lock check ─────────────────────────────────────
// V3 liquidity is held as NFT positions minted by the NonfungiblePositionManager.
// The lock question becomes: who owns those NFTs *right now*?
//   burn address        → liquidity permanently locked (can never be withdrawn)
//   known locker        → locked (NOXA launch locker, configured LP_LOCKER_ADDRESSES)
//   EOA / other wallet  → withdrawable any time — rug-capable
// We find the position tokenIds from the pool's Mint transactions, then check
// each NFT's current owner and remaining liquidity.

const V3_POOL_MINT_EVENT = {
  type: "event" as const,
  name: "Mint",
  inputs: [
    { type: "address", indexed: false, name: "sender" },
    { type: "address", indexed: true, name: "owner" },
    { type: "int24", indexed: true, name: "tickLower" },
    { type: "int24", indexed: true, name: "tickUpper" },
    { type: "uint128", indexed: false, name: "amount" },
    { type: "uint256", indexed: false, name: "amount0" },
    { type: "uint256", indexed: false, name: "amount1" },
  ],
};

const POSITION_MANAGER_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [
      { type: "uint96", name: "nonce" },
      { type: "address", name: "operator" },
      { type: "address", name: "token0" },
      { type: "address", name: "token1" },
      { type: "uint24", name: "fee" },
      { type: "int24", name: "tickLower" },
      { type: "int24", name: "tickUpper" },
      { type: "uint128", name: "liquidity" },
      { type: "uint256", name: "feeGrowthInside0LastX128" },
      { type: "uint256", name: "feeGrowthInside1LastX128" },
      { type: "uint128", name: "tokensOwed0" },
      { type: "uint128", name: "tokensOwed1" },
    ],
  },
] as const;

// keccak256("Transfer(address,address,uint256)") — ERC721 mint logs on the
// position manager (from = 0x0) carry the new position's tokenId in topic 3.
const ERC721_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";

const BURN_OWNERS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

// K-ary search for the block where a contract's code first appears. ~8 rounds
// of 6 parallel getCode probes for a 7M-block chain; the answer is immutable
// so it's cached forever in Redis.
async function findCreationBlock(address: Address, head: bigint): Promise<bigint | null> {
  const cacheKey = `created:${address.toLowerCase()}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return BigInt(cached);
  } catch {
    // cache miss path below still works without Redis
  }

  const code = await cachedRpc.getCode(address);
  if (!code || code === "0x") return null;

  const PROBES = 6n;
  let low = 0n;
  let high = head;

  while (high - low > 1n) {
    const span = high - low;
    const count = span < PROBES ? span : PROBES;
    const points: bigint[] = [];
    for (let i = 1n; i <= count; i++) {
      const p = low + (span * i) / (count + 1n);
      if (p > low && p < high && !points.includes(p)) points.push(p);
    }
    if (points.length === 0) break;

    const results = await Promise.all(
      points.map(async (blockNum) => {
        try {
          const codeAt = await cachedRpc.raw.getCode({ address, blockNumber: blockNum });
          return Boolean(codeAt && codeAt !== "0x");
        } catch {
          return false;
        }
      })
    );

    let newLow = low;
    let newHigh = high;
    for (let i = 0; i < points.length; i++) {
      if (results[i]) {
        newHigh = points[i];
        break;
      }
      newLow = points[i];
    }
    if (newLow === low && newHigh === high) break;
    low = newLow;
    high = newHigh;
  }

  try {
    await redis.set(cacheKey, high.toString());
  } catch {
    // best-effort cache
  }
  return high;
}

async function v3LockResult(ctx: ScanContext, start: number): Promise<ModuleResult> {
  const pool = ctx.lpPool!;
  const knownLockers = new Map<string, string>([[NOXA_LOCKER.toLowerCase(), "NOXA locker"]]);
  for (const locker of contractConfig.lpLockers) {
    knownLockers.set(locker.address.toLowerCase(), locker.name);
  }

  // 1. Position-creating transactions: the pool's Mint events. Anchor on the
  //    POOL's creation block, not the token's deploy block — a V3 pool for an
  //    old token can be created millions of blocks after the token itself,
  //    and the initial LP mint (the position that matters) lands right after
  //    pool creation. Also sweep the recent past for later liquidity adds.
  const head = BigInt(ctx.currentBlock);
  const poolCreated = await findCreationBlock(pool, head);
  const anchorFrom = poolCreated ?? BigInt(ctx.deployBlock ?? 0);
  // 539,999 blocks inclusive = exactly 60 chunks of 9k. One block more tips
  // the range to 61 chunks, and the maxChunks cap then shifts the window
  // forward — silently dropping the pool-creation block, which is precisely
  // where the initial LP mint lives.
  const launchWindowEnd = anchorFrom + 539_999n > head ? head : anchorFrom + 539_999n;
  const recentFrom = head > 90_000n ? head - 90_000n : 0n;

  const [launchMints, recentMints] = await Promise.all([
    cachedRpc.getLogsChunked({
      address: pool,
      event: V3_POOL_MINT_EVENT,
      fromBlock: anchorFrom,
      toBlock: launchWindowEnd,
      maxChunks: 60,
      deadlineMs: 6_000,
      bestEffort: true,
    }),
    recentFrom > launchWindowEnd
      ? cachedRpc.getLogsChunked({
          address: pool,
          event: V3_POOL_MINT_EVENT,
          fromBlock: recentFrom,
          toBlock: "latest",
          maxChunks: 10,
          deadlineMs: 4_000,
          bestEffort: true,
        })
      : Promise.resolve([]),
  ]);
  const mintLogs = [...launchMints, ...recentMints];

  if (mintLogs.length === 0) {
    return {
      module: "lp_lock",
      status: "warn",
      score: 45,
      weight: 12,
      label: "V3 pool — no liquidity positions found in scanned window",
      detail: `V3 pool at ${pool}. No position mints were found in the scanned block window, so lock status can't be judged yet. Rescan later or review the pool manually.`,
      evidence: { pool, dex: ctx.lpDex, kind: "dex_v3" },
      durationMs: Date.now() - start,
    };
  }

  // 2. Extract position NFT tokenIds from the mint transactions (cap the
  //    receipt lookups — pools rarely have more than a few LP providers early).
  const txHashes = [...new Set(mintLogs.map((log) => log.transactionHash as string))].slice(0, 8);
  const tokenIds = new Set<bigint>();
  await Promise.all(
    txHashes.map(async (hash) => {
      try {
        const receipt = await cachedRpc.raw.getTransactionReceipt({ hash: hash as `0x${string}` });
        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() === V3_POSITION_MANAGER.toLowerCase() &&
            log.topics[0] === ERC721_TRANSFER_TOPIC &&
            log.topics.length === 4 &&
            log.topics[1] === ZERO_TOPIC
          ) {
            tokenIds.add(BigInt(log.topics[3]!));
          }
        }
      } catch {
        // skip unreadable receipts
      }
    })
  );

  if (tokenIds.size === 0) {
    // Liquidity was minted directly against the pool (no NFT manager). The
    // in-pool owner from the Mint event is then the withdrawal authority.
    const owners = [...new Set(mintLogs.map((log) => String(log.args?.owner ?? "").toLowerCase()))].filter(Boolean);
    const allLocked = owners.every((owner) => BURN_OWNERS.has(owner) || knownLockers.has(owner));
    return {
      module: "lp_lock",
      status: allLocked ? "pass" : "warn",
      score: allLocked ? 10 : 50,
      weight: 12,
      label: allLocked
        ? "V3 liquidity held by locker — withdrawal blocked"
        : "V3 liquidity minted directly — holder can withdraw",
      detail: `V3 pool at ${pool}. Liquidity was created without the standard NFT position manager; the in-pool owner${owners.length === 1 ? "" : "s"} (${owners.slice(0, 3).join(", ")}) control${owners.length === 1 ? "s" : ""} withdrawal.`,
      evidence: { pool, dex: ctx.lpDex, kind: "dex_v3", owners },
      durationMs: Date.now() - start,
    };
  }

  // 3. Who owns each position NFT now, and how much liquidity is left in it?
  let lockedLiquidity = 0n;
  let unlockedLiquidity = 0n;
  let burnedCount = 0;
  let lockedCount = 0;
  let unlockedCount = 0;
  const unlockedOwners = new Set<string>();
  let lockerName: string | undefined;

  await Promise.all(
    [...tokenIds].slice(0, 10).map(async (tokenId) => {
      let liquidity = 0n;
      try {
        const position = await cachedRpc.readContract({
          address: V3_POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: "positions",
          args: [tokenId],
          ttlMs: 30_000,
        }) as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];
        liquidity = position[7];
      } catch {
        return; // burned NFTs can revert here — ownerOf below settles it
      }
      if (liquidity === 0n) return; // position already emptied — irrelevant

      let owner: string;
      try {
        owner = (await cachedRpc.readContract({
          address: V3_POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: "ownerOf",
          args: [tokenId],
          ttlMs: 30_000,
        }) as Address).toLowerCase();
      } catch {
        // ownerOf reverts for burned NFTs — burned position = locked forever
        burnedCount++;
        lockedLiquidity += liquidity;
        return;
      }

      if (BURN_OWNERS.has(owner)) {
        burnedCount++;
        lockedLiquidity += liquidity;
      } else if (knownLockers.has(owner)) {
        lockedCount++;
        lockedLiquidity += liquidity;
        lockerName = knownLockers.get(owner);
      } else {
        unlockedCount++;
        unlockedLiquidity += liquidity;
        unlockedOwners.add(owner);
      }
    })
  );

  const totalLiquidity = lockedLiquidity + unlockedLiquidity;
  const lockedPct = totalLiquidity > 0n
    ? Number((lockedLiquidity * 10000n) / totalLiquidity) / 100
    : 0;

  const evidence = {
    pool,
    dex: ctx.lpDex,
    kind: "dex_v3",
    positionsChecked: burnedCount + lockedCount + unlockedCount,
    burnedPositions: burnedCount,
    lockedPositions: lockedCount,
    unlockedPositions: unlockedCount,
    lockedPct,
    locker: lockerName,
    unlockedOwners: [...unlockedOwners].slice(0, 5),
  };

  if (totalLiquidity === 0n) {
    return {
      module: "lp_lock",
      status: "warn",
      score: 55,
      weight: 12,
      label: "V3 positions found but all liquidity already withdrawn",
      detail: `V3 pool at ${pool}. Every position we checked has zero remaining liquidity — the pool may already be drained.`,
      evidence,
      durationMs: Date.now() - start,
    };
  }

  if (lockedPct >= 90) {
    const how = burnedCount > 0 && lockedCount === 0 ? "burned" : lockerName ? `locked via ${lockerName}` : "locked";
    return {
      module: "lp_lock",
      status: "pass",
      score: 10,
      weight: 12,
      label: `V3 LP ${how} — ${lockedPct}% of position liquidity secured`,
      detail: `V3 pool at ${pool}. The NFT position${burnedCount + lockedCount === 1 ? "" : "s"} holding this pool's liquidity ${burnedCount > 0 && lockedCount === 0 ? (burnedCount === 1 ? "is burned (withdrawal is impossible)" : "are burned (withdrawal is impossible)") : (lockedCount === 1 ? "sits with a known locker contract" : "sit with a known locker contract")}.`,
      evidence,
      durationMs: Date.now() - start,
    };
  }

  if (lockedPct >= 50) {
    return {
      module: "lp_lock",
      status: "warn",
      score: 35,
      weight: 12,
      label: `V3 LP partially secured — ${lockedPct}% locked/burned`,
      detail: `V3 pool at ${pool}. ${lockedPct}% of position liquidity is locked or burned; the remainder is held by ${[...unlockedOwners].slice(0, 2).join(", ") || "other wallets"} and can be withdrawn.`,
      evidence,
      durationMs: Date.now() - start,
    };
  }

  return {
    module: "lp_lock",
    status: "fail",
    score: 75,
    weight: 12,
    label: "V3 LP unlocked — position holder can pull liquidity",
    detail: `V3 pool at ${pool}. The NFT position${unlockedCount === 1 ? "" : "s"} controlling this pool's liquidity ${unlockedCount === 1 ? "is" : "are"} held by a regular wallet (${[...unlockedOwners].slice(0, 2).join(", ")}) — liquidity can be withdrawn in one transaction.`,
    evidence,
    durationMs: Date.now() - start,
  };
}

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
