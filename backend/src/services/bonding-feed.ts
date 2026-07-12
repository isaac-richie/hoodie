/**
 * Launchpad Feed — early lifecycle tokens across Robinhood Chain launchpads.
 *
 * Aggregates the earliest useful state from two launchpads:
 *
 *   - NOXA Fun  — memecoins launched directly into a locked Uniswap V3
 *                 position. These are already live and scannable; NOXA does
 *                 not expose a bonding-curve graduation phase to track.
 *   - Virtuals  — AI agents. Pre-graduation agents with status UNDERGRAD are
 *                 kept scan-locked until their token and liquidity exist.
 *
 * Both upstreams are undocumented public APIs, so every call is cached in Redis
 * (short TTL) and the whole feed degrades gracefully: if one source errors we
 * still return the other, and if both fail we return an empty list with a note
 * rather than throwing. We never hammer the upstreams from the browser — the
 * frontend only ever talks to us.
 */
import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

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

export type BondingSource = "noxa" | "virtuals";

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

export interface BondingFeed {
  tokens: BondingToken[];
  sources: { noxa: "ok" | "stale" | "error"; virtuals: "ok" | "stale" | "error" };
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
  const cacheKey = "bonding:robinhood:v3";
  const virtualsLastGoodKey = "bonding:robinhood:virtuals:last-good";
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const ethUsd = await getEthUsd();
  const [noxaResult, virtualsResult] = await Promise.allSettled([fetchNoxa(ethUsd), fetchVirtuals()]);

  const tokens: BondingToken[] = [];
  const sources: BondingFeed["sources"] = { noxa: "ok", virtuals: "ok" };

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

  // Both sources now carry progressPct. Sort by it so the UI's tier filters
  // and interleaving see tokens ordered from closest-to-graduation downward.
  tokens.sort((a, b) => (b.progressPct ?? -1) - (a.progressPct ?? -1));

  const feed: BondingFeed = { tokens, sources, cachedAt: Date.now() };
  try { await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(feed)); } catch { /* best effort */ }
  return feed;
}
