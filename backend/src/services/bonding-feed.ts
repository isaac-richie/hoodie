/**
 * Launchpad Feed — early lifecycle tokens across Robinhood Chain launchpads.
 *
 * Aggregates the earliest useful state from three launchpads:
 *
 *   - NOXA Fun  — memecoins launched directly into a locked Uniswap V3
 *                 position. These are already live and scannable; NOXA does
 *                 not expose a bonding-curve graduation phase to track.
 *   - Virtuals  — AI agents. Pre-graduation agents with status UNDERGRAD are
 *                 kept scan-locked until their token and liquidity exist.
 *   - Pons      — a pump.fun-style monolithic factory + bonding curve. Its API
 *                 is Cloudflare-gated and its contract is unverified with a
 *                 custom event, so we read launches straight from chain: we
 *                 tail the launchpad's trade event over a recent window and
 *                 rank tokens by live volume. No fabricated graduation % — the
 *                 exact ceiling isn't decodable from the unverified contract,
 *                 so pons rows carry progressPct = null (UI shows "climbing").
 *
 * The two HTTP upstreams are undocumented public APIs and pons is read on-chain;
 * every path is cached in Redis (short TTL) and the whole feed degrades
 * gracefully: if one source errors we still return the others, and if all fail
 * we return an empty list with a note rather than throwing. We never hammer the
 * upstreams from the browser — the frontend only ever talks to us.
 */
import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { cachedRpc } from "./rpc-cache.js";
import { erc20Abi } from "../utils/abis.js";
import type { Address } from "viem";

const NOXA_BASE = "https://awk00kk00gskkw0o8kc488kg.notoriouslywrong.com";
const VIRTUALS_BASE = "https://api.virtuals.io/api/virtuals";
const CACHE_TTL_S = 45;
const LAST_GOOD_SOURCE_TTL_S = 10 * 60;
// Virtuals returns rich project metadata for each row; allow it enough time to
// respond while the local discovery worker is busy, without ever serving stale
// rows from a previous launch window.
const UPSTREAM_TIMEOUT_MS = 15_000;
// This is a launch-discovery board, not a historical token directory. Keep a
// full week of recent launches available without silently backfilling the old
// bonded archive when a launchpad is quiet for a few hours.
const NEW_LAUNCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Pons (on-chain) ──────────────────────────────────────────────────────
// Monolithic factory + bonding-curve contract; every pons token approves it to
// trade and it emits one custom event per trade. Derived by tracing a known
// pons token ($RIPSTIK) on-chain — see the launchpad decode notes.
const PONS_LAUNCHPAD = "0x4e69084f83A635d6270E8f959864f94207031889" as Address;
// keccak of the (unpublished) pons trade event. Not in any signature DB, so we
// filter by this topic0 and decode the data words positionally.
const PONS_TRADE_TOPIC = "0x2d720abb2e4bf42730e89955397ce0f5b08db0caff9be7e08ca184a8b1b2db2f";
// Robinhood Chain WETH — the quote asset on the pons curve.
const PONS_WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
// Robinhood Chain runs ~0.1s blocks (~862k/day), so a full-day log scan is
// infeasible per request. We tail a recent window: ~90k blocks ≈ 2.5h, which
// captures the full life of virtually every active pons token (they bond fast —
// observed tokens raise ~4 ETH in under an hour).
const PONS_WINDOW_BLOCKS = 90_000n;
const PONS_CHUNK_BLOCKS = 9_000n;      // stay under Alchemy's 10k getLogs cap
const PONS_MAX_TOKENS = 40;            // cap metadata reads per refresh
// Graduation target in WETH. Calibrated from on-chain net-raised: active tokens
// cluster just under this and the sister Robinhood launchpad (NOXA) graduates at
// exactly 4.2 WETH. The EXACT ceiling isn't published, but progress is monotonic
// in net-raised, so the "almost bonded" ranking is correct regardless — only the
// absolute % label carries this constant's uncertainty. Tune if pons confirms.
const PONS_GRADUATION_ETH = 4.2;
// Only trust a computed % when we captured the token's first trade inside the
// window (otherwise the net-raised sum silently undercounts). If a token's
// earliest in-window event sits within this margin of the window start, it may
// predate our scan — we fall back to the honest indeterminate "climbing" state.
const PONS_BIRTH_MARGIN_BLOCKS = 2_000n;

export type BondingSource = "noxa" | "virtuals" | "pons";

export interface BondingToken {
  source: BondingSource;
  address: string;
  name: string;
  symbol: string;
  deployer: string | null;      // the wallet that launched it
  logo: string | null;
  progressPct: number | null;   // 0-100, null when the source has no exact target
  graduated: boolean;
  marketCapUsd: number | null;
  mcapInVirtual?: number | null; // Virtuals-native funding metric ($VIRTUAL)
  volume24hUsd: number | null;
  priceChange24hPct: number | null;
  holderCount: number | null;
  createdAt: string | null;
  socials: { twitter?: string; telegram?: string; website?: string };
  launchpadUrl: string;         // where to go ape
  scanAddress: string | null;   // address to run a Hood scan on (null pre-graduation for Virtuals)
}

type SourceStatus = "ok" | "stale" | "error";

export interface BondingFeed {
  tokens: BondingToken[];
  sources: { noxa: SourceStatus; virtuals: SourceStatus; pons: SourceStatus };
  cachedAt: number;
}

async function fetchJson(url: string, opts: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": "HoodTerminal/1.0", ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

function ipfsToHttp(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  return uri;
}

function isNewLaunch(createdAt: unknown): createdAt is string {
  if (typeof createdAt !== "string") return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  const ageMs = Date.now() - createdMs;
  return ageMs >= 0 && ageMs <= NEW_LAUNCH_WINDOW_MS;
}

// NOXA tokens graduate once they accumulate 4.2 WETH in net buys on the bonding curve.
const NOXA_GRADUATION_ETH = 4.2;

async function fetchNoxa(ethUsd: number | null): Promise<BondingToken[]> {
  // netBuyAmountEth / athNetBuyAmountEth give us real graduation progress against the
  // 4.2 WETH target confirmed for Robinhood Chain. Tokens are sorted closest-to-grad first.
  const data = await fetchJson(`${NOXA_BASE}/v1/robinhood/tokens/newest?limit=100`) as { tokens?: any[] };
  const rows = Array.isArray(data.tokens) ? data.tokens : [];

  return rows
    .map((t): BondingToken | null => {
      const address = String(t.address ?? "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(address)) return null;
      const mcapEth = Number(t.marketCapEth ?? 0);
      const volEth = Number(t.volume24hEth ?? 0);
      const netBuy = Number(t.netBuyAmountEth ?? t.athNetBuyAmountEth ?? 0);
      const progressPct = netBuy > 0
        ? Math.min(100, Math.max(0, Math.round((netBuy / NOXA_GRADUATION_ETH) * 100)))
        : null;
      return {
        source: "noxa",
        address,
        name: t.name ?? "",
        symbol: t.symbol ?? "",
        deployer: typeof t.creator === "string" ? t.creator.toLowerCase() : null,
        logo: ipfsToHttp(t.logo),
        progressPct,
        graduated: false,
        marketCapUsd: ethUsd ? mcapEth * ethUsd : null,
        mcapInVirtual: null,
        volume24hUsd: ethUsd ? volEth * ethUsd : null,
        priceChange24hPct: t.priceChange6hPct != null ? Number(t.priceChange6hPct) : null,
        holderCount: null,
        createdAt: t.createdAtTime ?? null,
        socials: { twitter: t.twitter || undefined, telegram: t.telegram || undefined, website: t.website || undefined },
        launchpadUrl: `https://fun.noxa.fi/rh/token/${address}`,
        scanAddress: address,
      };
    })
    .filter((t): t is BondingToken => t !== null && isNewLaunch(t.createdAt))
    .sort((a, b) => (b.progressPct ?? -1) - (a.progressPct ?? -1));
}

async function fetchVirtuals(): Promise<BondingToken[]> {
  // The public Virtuals endpoint currently accepts filter parameters but can
  // still return AVAILABLE (already-launched) agents. Fetch recent Robinhood
  // rows, then enforce lifecycle status ourselves before ranking by funding.
  // A single newest-first page covers the seven-day window and avoids timing out
  // under the worker's normal RPC load. Lifecycle is enforced locally because
  // this public endpoint can include AVAILABLE records despite filter params.
  const params = new URLSearchParams({
    "filters[chain]": "ROBINHOOD",
    "pagination[page]": "1",
    "pagination[pageSize]": "100",
    "sort[0]": "createdAt:desc",
  });
  const data = await fetchJson(`${VIRTUALS_BASE}?${params.toString()}`) as { data?: any[] };
  const rows = (Array.isArray(data.data) ? data.data : [])
    .filter((token) => token?.chain === "ROBINHOOD" && token?.status === "UNDERGRAD")
    .filter((token) => isNewLaunch(token.createdAt))
    .sort((a, b) => Number(b.mcapInVirtual ?? 0) - Number(a.mcapInVirtual ?? 0));

  // Derive a relative progress % from funding rank: highest mcapInVirtual = closest
  // to graduation. No published graduation ceiling exists, so rank-based is honest.
  const total = rows.length;
  return rows
    .map((t, idx): BondingToken | null => {
      const pre = typeof t.preToken === "string" ? t.preToken : null;
      if (!pre) return null;
      const socials = t.socials ?? {};
      const progressPct = total > 1 ? Math.round(((total - 1 - idx) / (total - 1)) * 100) : 50;
      return {
        source: "virtuals",
        address: pre.toLowerCase(),
        name: t.name ?? "",
        symbol: t.symbol ?? "",
        deployer: typeof t.creator === "object" && t.creator?.walletAddress
          ? String(t.creator.walletAddress).toLowerCase()
          : (typeof t.walletAddress === "string" ? t.walletAddress.toLowerCase() : null),
        logo: ipfsToHttp(t.image?.url ?? t.image),
        progressPct,
        graduated: false,
        marketCapUsd: null,
        mcapInVirtual: t.mcapInVirtual != null ? Number(t.mcapInVirtual) : null,
        volume24hUsd: null,
        priceChange24hPct: t.priceChangePercent24h != null ? Number(t.priceChangePercent24h) : null,
        holderCount: t.holderCount != null ? Number(t.holderCount) : null,
        createdAt: t.createdAt ?? null,
        socials: {
          twitter: socials.VERIFIED_LINKS?.TWITTER || socials.twitter || undefined,
          website: socials.USER_LINKS?.WEBSITE || undefined,
        },
        launchpadUrl: `https://app.virtuals.io/prototypes/${pre}`,
        // preToken is a real ERC-20 on chain 4663, tradable against $VIRTUAL
        scanAddress: pre.toLowerCase(),
      };
    })
    .filter((t): t is BondingToken => t !== null);
}

/**
 * Pons — read launches straight from the chain.
 *
 * The pons launchpad (a monolithic factory + bonding curve) emits one custom
 * trade event per interaction. We tail that event over a recent window and
 * decode each log's data words positionally (the contract is unverified, so
 * there is no ABI):
 *
 *   word[0], word[1] = amountIn / amountOut   word[2] = fee (≈1% of eth side)
 *   word[3] = token address
 *
 * Direction comes from the amounts themselves, not a flag (word5 is noisy across
 * tokens): token amounts (millions × 1e18 ≈ 1e24) always dwarf eth amounts
 * (~1e16), so the eth side is min(word0,word1). A BUY sends eth in first, so
 * word0 < word1; a SELL sends tokens in first, so word0 > word1. That gives us
 * both the eth/token split and buy-vs-sell from one comparison.
 *
 * Per token we track:
 *   - volume: gross WETH traded (buys + sells) — the "heat" ranking
 *   - netRaisedEth: Σ(buy eth) − Σ(sell eth) — WETH accumulated on the curve,
 *     which maps monotonically to graduation progress (÷ PONS_GRADUATION_ETH)
 *   - firstBlock: to gate the % — we only trust progress when we captured the
 *     token's first trade in-window (else the net-raised sum undercounts)
 *   - lastPriceEth: for market cap
 */
interface PonsAgg {
  volumeWei: bigint;
  netRaisedWei: bigint;
  trades: number;
  firstBlock: bigint;
  lastPriceEth: number | null;
  lastBlock: bigint;
}

async function fetchPons(ethUsd: number | null): Promise<BondingToken[]> {
  const head = await cachedRpc.getBlockNumber();
  const from = head > PONS_WINDOW_BLOCKS ? head - PONS_WINDOW_BLOCKS : 0n;

  // Raw eth_getLogs by topic0 (no typed ABI available), chunked under the
  // provider's 10k-block cap. Best-effort: a failed chunk shouldn't sink pons.
  const logs: any[] = [];
  for (let start = from; start <= head; start += PONS_CHUNK_BLOCKS + 1n) {
    const end = start + PONS_CHUNK_BLOCKS > head ? head : start + PONS_CHUNK_BLOCKS;
    try {
      const chunk = (await cachedRpc.raw.request({
        method: "eth_getLogs",
        params: [{
          address: PONS_LAUNCHPAD,
          topics: [PONS_TRADE_TOPIC],
          fromBlock: `0x${start.toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
        }],
      } as any)) as any[];
      if (Array.isArray(chunk)) logs.push(...chunk);
    } catch (err) {
      logger.warn({ err: (err as Error)?.message, start: start.toString() }, "pons: getLogs chunk failed");
    }
  }

  const agg = new Map<string, PonsAgg>();
  for (const log of logs) {
    const data: string = log.data?.startsWith("0x") ? log.data.slice(2) : log.data;
    if (!data || data.length < 4 * 64) continue;
    const word = (i: number) => data.slice(i * 64, (i + 1) * 64);
    const token = ("0x" + word(3).slice(24)).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(token) || token === "0x" + "0".repeat(40)) continue;

    const w0 = BigInt("0x" + word(0));
    const w1 = BigInt("0x" + word(1));
    const fee = BigInt("0x" + word(2));
    // eth side = the smaller amount (token amounts dwarf eth amounts); a BUY
    // sends eth in first (word0 < word1), a SELL sends tokens in first.
    const isBuy = w0 < w1;
    const ethWei = isBuy ? w0 : w1;
    const tokWei = isBuy ? w1 : w0;
    if (ethWei === 0n || tokWei === 0n) continue;
    // Sanity guard: fee is ~1% of the eth side. If it's wildly off, this log
    // was mis-split (e.g. a near-parity trade) — skip rather than pollute sums.
    if (fee > 0n && (fee * 1000n < ethWei || fee * 10n > ethWei)) continue;
    const blockNum = BigInt(log.blockNumber ?? "0x0");

    const prev = agg.get(token) ?? {
      volumeWei: 0n, netRaisedWei: 0n, trades: 0, firstBlock: blockNum, lastPriceEth: null, lastBlock: 0n,
    };
    prev.volumeWei += ethWei;                                   // gross (both sides)
    prev.netRaisedWei += isBuy ? ethWei : -ethWei;              // buys add, sells subtract
    prev.trades += 1;
    if (blockNum < prev.firstBlock) prev.firstBlock = blockNum;
    if (blockNum >= prev.lastBlock) {
      // price of one whole token in ETH: (ethWei/1e18)/(tokWei/1e18) = ethWei/tokWei
      prev.lastPriceEth = Number(ethWei) / Number(tokWei);
      prev.lastBlock = blockNum;
    }
    agg.set(token, prev);
  }

  const windowStart = from;
  // Rank by live volume, cap the metadata fan-out.
  const ranked = [...agg.entries()]
    .sort((a, b) => (b[1].volumeWei > a[1].volumeWei ? 1 : b[1].volumeWei < a[1].volumeWei ? -1 : 0))
    .slice(0, PONS_MAX_TOKENS);

  const rows = await Promise.all(ranked.map(async ([token, a]): Promise<BondingToken | null> => {
    try {
      const [name, symbol, totalSupply] = await Promise.all([
        readErc20(token, "name"),
        readErc20(token, "symbol"),
        readErc20(token, "totalSupply"),
      ]);
      const priceUsd = a.lastPriceEth != null && ethUsd != null ? a.lastPriceEth * ethUsd : null;
      const supply = typeof totalSupply === "bigint" ? Number(totalSupply) / 1e18 : null;
      const marketCapUsd = priceUsd != null && supply != null ? priceUsd * supply : null;
      const volumeUsd = ethUsd != null ? (Number(a.volumeWei) / 1e18) * ethUsd : null;

      // Bonding progress = net WETH raised / graduation target. Only trust it
      // when we captured the token's first trade in-window (else the sum
      // undercounts) — otherwise fall back to the honest "climbing" state.
      const caughtBirth = a.firstBlock > windowStart + PONS_BIRTH_MARGIN_BLOCKS;
      const netRaisedEth = Number(a.netRaisedWei) / 1e18;
      const progressPct = caughtBirth && netRaisedEth > 0
        ? Math.min(100, Math.max(0, Math.round((netRaisedEth / PONS_GRADUATION_ETH) * 100)))
        : null;

      return {
        source: "pons",
        address: token,
        name: typeof name === "string" ? name : "",
        symbol: typeof symbol === "string" ? symbol : "",
        deployer: null,               // creation tx not indexed on this chain's explorer
        logo: null,                   // pons metadata lives behind their Cloudflare-gated API
        progressPct,                  // net-raised / 4.2 ETH, gated on capturing birth
        graduated: false,
        marketCapUsd,
        mcapInVirtual: null,
        volume24hUsd: volumeUsd,      // volume over the live window (see PONS_WINDOW_BLOCKS)
        priceChange24hPct: null,
        holderCount: null,
        createdAt: null,
        socials: {},
        launchpadUrl: `https://pons.family/token/${token}`,
        scanAddress: token,           // real ERC-20 on 4663 — scannable now
      };
    } catch (err) {
      logger.warn({ err: (err as Error)?.message, token }, "pons: token metadata read failed");
      return null;
    }
  }));

  return rows.filter((t): t is BondingToken => t !== null && (t.name !== "" || t.symbol !== ""));
}

async function readErc20(address: string, fn: "name" | "symbol" | "totalSupply"): Promise<unknown> {
  return cachedRpc.readContract({
    address: address as Address,
    abi: erc20Abi as readonly unknown[],
    functionName: fn,
    ttlMs: 6 * 60 * 60 * 1000, // name/symbol/supply are immutable — cache long
  });
}

async function getEthUsd(): Promise<number | null> {
  try {
    const cached = await redis.get("price:eth-usd");
    if (cached) return Number(cached);
  } catch { /* fall through */ }
  try {
    const data = (await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    )) as { ethereum?: { usd?: number } };
    const price = data.ethereum?.usd;
    if (typeof price === "number" && price > 0) {
      try { await redis.setex("price:eth-usd", 300, String(price)); } catch { /* best effort */ }
      return price;
    }
  } catch { /* no price — NOXA USD fields stay null */ }
  return null;
}

export async function getBondingFeed(): Promise<BondingFeed> {
  const cacheKey = "bonding:robinhood:v4";
  const virtualsLastGoodKey = "bonding:robinhood:virtuals:last-good";
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const ethUsd = await getEthUsd();
  const [noxaResult, virtualsResult, ponsResult] = await Promise.allSettled([
    fetchNoxa(ethUsd),
    fetchVirtuals(),
    fetchPons(ethUsd),
  ]);

  const tokens: BondingToken[] = [];
  const sources: BondingFeed["sources"] = { noxa: "ok", virtuals: "ok", pons: "ok" };

  if (noxaResult.status === "fulfilled") tokens.push(...noxaResult.value);
  else {
    sources.noxa = "error";
    logger.warn({ err: noxaResult.reason?.message }, "bonding feed: NOXA source failed");
  }
  if (virtualsResult.status === "fulfilled") {
    tokens.push(...virtualsResult.value);
    try {
      await redis.setex(virtualsLastGoodKey, LAST_GOOD_SOURCE_TTL_S, JSON.stringify(virtualsResult.value));
    } catch { /* best effort: the live response remains usable */ }
  } else {
    let lastGoodVirtuals: BondingToken[] = [];
    try {
      const cached = await redis.get(virtualsLastGoodKey);
      const parsed = cached ? JSON.parse(cached) : [];
      if (Array.isArray(parsed)) {
        lastGoodVirtuals = parsed.filter((token): token is BondingToken =>
          token?.source === "virtuals" && isNewLaunch(token.createdAt)
        );
      }
    } catch { /* no fallback snapshot available */ }

    if (lastGoodVirtuals.length > 0) {
      tokens.push(...lastGoodVirtuals);
      sources.virtuals = "stale";
      logger.warn({ err: virtualsResult.reason?.message, tokens: lastGoodVirtuals.length }, "bonding feed: serving stale Virtuals snapshot");
    } else {
      sources.virtuals = "error";
      logger.warn({ err: virtualsResult.reason?.message }, "bonding feed: Virtuals source failed");
    }
  }

  if (ponsResult.status === "fulfilled") tokens.push(...ponsResult.value);
  else {
    sources.pons = "error";
    logger.warn({ err: ponsResult.reason?.message }, "bonding feed: Pons source failed");
  }

  // NOXA and Virtuals carry a graduation %, so they sort by proximity to bonding.
  // Pons has no decodable ceiling (progressPct null) — those rows come pre-ranked
  // by live volume from fetchPons, so a stable sort leaves that order intact
  // while the %-bearing sources sort ahead of them.
  tokens.sort((a, b) => (b.progressPct ?? -1) - (a.progressPct ?? -1));

  const feed: BondingFeed = { tokens, sources, cachedAt: Date.now() };
  try { await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(feed)); } catch { /* best effort */ }
  return feed;
}
