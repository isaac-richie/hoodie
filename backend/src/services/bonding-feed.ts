/**
 * Bonding Feed — "about to bond" tokens across Robinhood Chain launchpads.
 *
 * Aggregates tokens that are climbing their bonding curve but haven't graduated
 * to a DEX yet, so users can catch them before the migration. Two sources:
 *
 *   - NOXA Fun  — memecoins. Graduation target is 4.2 WETH of net buy.
 *                 Progress = netBuyAmountEth / 4.2. (exact, from their contract)
 *   - Virtuals  — AI agents. Prototypes with status UNDERGRAD, ranked by
 *                 mcapInVirtual (funding). No published exact ceiling, so we
 *                 rank by funding rather than fake a precise %.
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
const NOXA_BONDING_TARGET_ETH = 4.2; // WETH net-buy to graduate (from NOXA contract config)
const CACHE_TTL_S = 45;
const UPSTREAM_TIMEOUT_MS = 8_000;

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
  sources: { noxa: "ok" | "error"; virtuals: "ok" | "error" };
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

async function fetchNoxa(ethUsd: number | null): Promise<BondingToken[]> {
  // Cover every genuinely-progressing curve — pull two overlapping pages so no
  // near-bond token slips through: the "hot" band (peak ≥3 WETH, closest to
  // the 4.2 target) plus the broader "climbing" band (peak ≥1 WETH, earlier
  // curves that are still moving). Dedup by address; the higher-ath row wins.
  // Sorting is by CURRENT netBuy client-side, so tokens ranked purely by peak
  // don't push actively-climbing ones down.
  const [hot, climbing] = await Promise.all([
    fetchJson(`${NOXA_BASE}/v1/robinhood/tokens?sort=ath&order=asc&minAthNetBuyAmountEth=3&limit=100`),
    fetchJson(`${NOXA_BASE}/v1/robinhood/tokens?sort=ath&order=asc&minAthNetBuyAmountEth=1&limit=100`),
  ]) as [{ tokens?: any[] }, { tokens?: any[] }];
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const r of [...(hot.tokens ?? []), ...(climbing.tokens ?? [])]) {
    const a = String(r.address ?? "").toLowerCase();
    if (!a || seen.has(a)) continue;
    seen.add(a);
    rows.push(r);
  }

  return rows
    .map((t): BondingToken | null => {
      const ath = Number(t.athNetBuyAmountEth ?? 0);
      const net = Number(t.netBuyAmountEth ?? 0);
      const graduated = ath >= NOXA_BONDING_TARGET_ETH;
      const progressPct = graduated ? 100 : Math.min((net / NOXA_BONDING_TARGET_ETH) * 100, 100);
      const address = String(t.address ?? "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(address)) return null;
      const mcapEth = Number(t.marketCapEth ?? 0);
      const volEth = Number(t.volume24hEth ?? 0);
      return {
        source: "noxa",
        address,
        name: t.name ?? "",
        symbol: t.symbol ?? "",
        deployer: typeof t.creator === "string" ? t.creator.toLowerCase() : null,
        logo: ipfsToHttp(t.logo),
        progressPct: Math.round(progressPct * 10) / 10,
        graduated,
        marketCapUsd: ethUsd ? mcapEth * ethUsd : null,
        mcapInVirtual: null,
        volume24hUsd: ethUsd ? volEth * ethUsd : null,
        priceChange24hPct: t.priceChange6hPct != null ? Number(t.priceChange6hPct) : null,
        holderCount: null, // NOXA list endpoint doesn't include holder count
        createdAt: t.createdAtTime ?? null,
        socials: { twitter: t.twitter || undefined, telegram: t.telegram || undefined, website: t.website || undefined },
        launchpadUrl: `https://fun.noxa.fi/rh/token/${address}`, // canonical slug (/robinhood/ 301-redirects here)
        scanAddress: address, // NOXA tokens are real ERC20s from block one — scannable now
      };
    })
    .filter((t): t is BondingToken => t !== null);
}

async function fetchVirtuals(): Promise<BondingToken[]> {
  // Grab the top 100 undergrad prototypes ranked by funding (mcapInVirtual) —
  // this gives us every genuinely close-to-bonding agent, not just 30. Anything
  // beyond page 1 has near-zero funding and isn't launch-day relevant.
  const params = new URLSearchParams({
    "filters[chain]": "ROBINHOOD",
    "filters[status]": "UNDERGRAD",
    "pagination[pageSize]": "100",
    "sort[0]": "mcapInVirtual:desc",
  });
  const data = (await fetchJson(`${VIRTUALS_BASE}?${params.toString()}`)) as { data?: any[] };
  const rows = Array.isArray(data.data) ? data.data : [];

  return rows
    .map((t): BondingToken | null => {
      const pre = typeof t.preToken === "string" ? t.preToken : null;
      if (!pre) return null;
      const socials = t.socials ?? {};
      return {
        source: "virtuals",
        address: pre.toLowerCase(),
        name: t.name ?? "",
        symbol: t.symbol ?? "",
        deployer: typeof t.creator === "object" && t.creator?.walletAddress
          ? String(t.creator.walletAddress).toLowerCase()
          : (typeof t.walletAddress === "string" ? t.walletAddress.toLowerCase() : null),
        logo: ipfsToHttp(t.image?.url ?? t.image),
        progressPct: null, // no published exact graduation ceiling — rank by funding instead
        graduated: false,
        // Virtuals denominates mcap in $VIRTUAL. Surface it as a native
        // metric so the card can render "1.5M VIRTUAL" instead of a dash —
        // it's what actually determines when the curve graduates on their
        // platform, so it's the honest thing to show.
        marketCapUsd: null,
        mcapInVirtual: t.mcapInVirtual != null ? Number(t.mcapInVirtual) : null,
        volume24hUsd: t.volume24h != null ? Number(t.volume24h) : null,
        priceChange24hPct: t.priceChangePercent24h != null ? Number(t.priceChangePercent24h) : null,
        holderCount: t.holderCount != null ? Number(t.holderCount) : null,
        createdAt: t.createdAt ?? null,
        socials: {
          twitter: socials.VERIFIED_LINKS?.TWITTER || socials.twitter || undefined,
          website: socials.USER_LINKS?.WEBSITE || undefined,
        },
        // Prototype (pre-graduation) agents live at /prototypes/{preToken}
        launchpadUrl: `https://app.virtuals.io/prototypes/${pre}`,
        scanAddress: typeof t.tokenAddress === "string" ? t.tokenAddress.toLowerCase() : null,
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
  const cacheKey = "bonding:robinhood:v1";
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
  if (virtualsResult.status === "fulfilled") tokens.push(...virtualsResult.value);
  else {
    sources.virtuals = "error";
    logger.warn({ err: virtualsResult.reason?.message }, "bonding feed: Virtuals source failed");
  }

  // Ranking, most-actionable first:
  //   1. not-yet-graduated before graduated
  //   2. tokens with a real progress % (NOXA) before funding-ranked (Virtuals)
  //   3. higher progress first; ties broken by recency
  // This keeps "about to bond" at the top and drops just-bonded ones to the tail.
  tokens.sort((a, b) => {
    if (a.graduated !== b.graduated) return a.graduated ? 1 : -1;
    const aHasPct = a.progressPct != null;
    const bHasPct = b.progressPct != null;
    if (aHasPct !== bHasPct) return aHasPct ? -1 : 1;
    if (aHasPct && bHasPct && a.progressPct !== b.progressPct) return b.progressPct! - a.progressPct!;
    return Date.parse(b.createdAt ?? "0") - Date.parse(a.createdAt ?? "0");
  });

  const feed: BondingFeed = { tokens, sources, cachedAt: Date.now() };
  try { await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(feed)); } catch { /* best effort */ }
  return feed;
}
