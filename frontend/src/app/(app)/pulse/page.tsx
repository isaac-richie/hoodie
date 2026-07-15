"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBondingFeed } from "@/lib/queries";
import type { BondingToken } from "@/lib/api";

type SourceFilter = "all" | "noxa" | "virtuals" | "pons";
type ProgressTier = "all" | "almost" | "mid" | "climbing" | "new";
const PAGE_SIZE = 12;

const SOURCE_META: Record<
  BondingToken["source"],
  { label: string; ring: string; glow: string; tint: string; url: (t: BondingToken) => string }
> = {
  noxa: {
    label: "NOXA",
    ring: "#00C805",
    glow: "rgba(0,200,5,0.14)",
    tint: "linear-gradient(180deg, rgba(10,125,44,0.10) 0%, rgba(6,20,11,0) 60%)",
    url: (t) => t.launchpadUrl,
  },
  virtuals: {
    label: "Virtuals",
    ring: "#8B7CF6",
    glow: "rgba(139,124,246,0.16)",
    tint: "linear-gradient(180deg, rgba(139,124,246,0.10) 0%, rgba(6,20,11,0) 60%)",
    url: (t) => t.launchpadUrl,
  },
  pons: {
    label: "Pons",
    ring: "#38BDF8",
    glow: "rgba(56,189,248,0.16)",
    tint: "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(6,20,11,0) 60%)",
    url: (t) => t.launchpadUrl,
  },
};

const TIERS: { id: ProgressTier; label: string; emoji: string; accent: string; range: string; min: number; max: number }[] = [
  { id: "almost",  label: "Almost bonded", emoji: "", accent: "#00C805", range: "75%+",   min: 75, max: 100 },
  { id: "mid",     label: "Mid-curve",     emoji: "", accent: "#00C805", range: "50–74%", min: 50, max: 74  },
  { id: "climbing",label: "Climbing",      emoji: "", accent: "#00C805", range: "25–49%", min: 25, max: 49  },
  { id: "new",     label: "New launch",    emoji: "", accent: "#00C805", range: "<25%",   min: 0,  max: 24  },
];

function matchesTier(t: BondingToken, tier: ProgressTier): boolean {
  if (tier === "all") return true;
  const pct = t.progressPct ?? 0;
  const def = TIERS.find((d) => d.id === tier)!;
  return pct >= def.min && pct <= def.max;
}

export default function PulsePage() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [progressTier, setProgressTier] = useState<ProgressTier>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useBondingFeed();

  const tokens = useMemo(() => {
    const live = (data?.tokens ?? []).filter((t) => !t.graduated);
    const bySource = source === "all" ? live : live.filter((t) => t.source === source);
    const byTier = bySource.filter((t) => matchesTier(t, progressTier));
    if (source !== "all") return byTier;
    // Round-robin all three sources so none buries the others in the combined view.
    const lanes = [
      byTier.filter((t) => t.source === "noxa"),
      byTier.filter((t) => t.source === "virtuals"),
      byTier.filter((t) => t.source === "pons"),
    ];
    const merged: BondingToken[] = [];
    const longest = Math.max(...lanes.map((l) => l.length), 0);
    for (let i = 0; i < longest; i++) {
      for (const lane of lanes) if (i < lane.length) merged.push(lane[i]);
    }
    return merged;
  }, [data, source, progressTier]);

  const allLive = (data?.tokens ?? []).filter((t) => !t.graduated);
  const noxaCount = allLive.filter((t) => t.source === "noxa").length;
  const virtCount = allLive.filter((t) => t.source === "virtuals").length;
  const ponsCount = allLive.filter((t) => t.source === "pons").length;
  const noxaDown     = data?.sources.noxa     === "error";
  const virtualsDown = data?.sources.virtuals === "error";
  const ponsDown     = data?.sources.pons     === "error";
  const noxaStale     = data?.sources.noxa     === "stale";
  const virtualsStale = data?.sources.virtuals === "stale";
  const pageCount  = Math.max(1, Math.ceil(tokens.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const pageTokens = tokens.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  function changeSource(next: SourceFilter) { setSource(next); setPage(1); }
  function changeTier(next: ProgressTier)   { setProgressTier(next); setPage(1); }

  // Tier counts for the active source filter
  function tierCount(tier: ProgressTier) {
    const base = source === "all" ? allLive : allLive.filter((t) => t.source === source);
    return base.filter((t) => matchesTier(t, tier)).length;
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ marginBottom: 20, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#E6FBEA", letterSpacing: "-0.02em" }}>Bounty Board</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#D4A937", border: "1px solid #6b5111", background: "rgba(212,169,55,0.08)", padding: "3px 9px", borderRadius: 999, letterSpacing: "0.08em", textTransform: "uppercase" }}>Premium</span>
        </div>
        <div style={{ fontSize: 13, color: "#8FB39D", marginTop: 8, lineHeight: "20px", maxWidth: 680 }}>
          Catch tokens across NOXA, Virtuals and Pons before they graduate. Filter by how close each one is to bonding — then scan the ones you like.
        </div>
      </div>

      {/* Row 1: source pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <SourcePill active={source === "all"}      onClick={() => changeSource("all")}      label="All launchpads" count={noxaCount + virtCount + ponsCount} />
        <SourcePill active={source === "noxa"}     onClick={() => changeSource("noxa")}     label="NOXA"     count={noxaCount} color="#00C805" />
        <SourcePill active={source === "virtuals"} onClick={() => changeSource("virtuals")} label="Virtuals" count={virtCount}  color="#8B7CF6" />
        <SourcePill active={source === "pons"}     onClick={() => changeSource("pons")}     label="Pons"     count={ponsCount}  color="#38BDF8" />
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#496552", fontFamily: "var(--font-mono, monospace)" }}>
          {tokens.length} tokens · refreshes 45s
        </span>
      </div>

      {/* Row 2: progress tier pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        <TierPill id="all" active={progressTier === "all"} onClick={() => changeTier("all")} count={tierCount("all")} />
        {TIERS.map((tier) => (
          <TierPill key={tier.id} id={tier.id} active={progressTier === tier.id} onClick={() => changeTier(tier.id)} count={tierCount(tier.id)} />
        ))}
      </div>

      {(noxaDown || virtualsDown || ponsDown) && (
        <div style={{ background: "rgba(255,176,32,0.08)", border: "1px solid #6b4d11", padding: "10px 14px", fontSize: 12, color: "#FFB020", marginBottom: 14, borderRadius: 6 }}>
          {(() => {
            const down = [noxaDown && "NOXA", virtualsDown && "Virtuals", ponsDown && "Pons"].filter(Boolean);
            return down.length >= 3
              ? "All launchpad feeds are temporarily unavailable."
              : `${down.join(" and ")} ${down.length > 1 ? "feeds are" : "feed is"} temporarily unavailable — showing the other sources.`;
          })()}
        </div>
      )}
      {(noxaStale || virtualsStale) && (
        <div style={{ background: "rgba(255,176,32,0.08)", border: "1px solid #6b4d11", padding: "10px 14px", fontSize: 12, color: "#FFB020", marginBottom: 14, borderRadius: 6 }}>
          {`${noxaStale ? "NOXA" : "Virtuals"} is temporarily stale — showing the most recent verified launchpad snapshot while it reconnects.`}
        </div>
      )}

      {isLoading && <SkeletonGrid />}
      {error && <Message text="bonding feed unavailable — the backend could not reach the launchpads." tone="#FFB020" />}
      {!isLoading && !error && tokens.length === 0 && (
        <Message text={progressTier !== "all"
          ? `No tokens in the "${TIERS.find((t) => t.id === progressTier)?.label}" tier right now — try a different range.`
          : "no tokens match this filter right now — try switching launchpads."} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(322px, 100%), 1fr))", gap: 14 }}>
        {pageTokens.map((t) => <PremiumCard key={`${t.source}-${t.address}`} token={t} />)}
      </div>
      {!isLoading && !error && tokens.length > 0 && (
        <Pagination
          page={activePage}
          pageCount={pageCount}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
        />
      )}
    </div>
  );
}

/* ── Source filter pill ─────────────────────────────────────────────── */

function SourcePill({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  const accent = color ?? "#00C805";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", fontSize: 12, cursor: "pointer", borderRadius: 999, fontWeight: 700,
        border: `1px solid ${active ? accent : "#164A2A"}`,
        background: active ? "rgba(0,200,5,0.08)" : "transparent",
        color: active ? "#E6FBEA" : "#7FA68A",
        display: "inline-flex", alignItems: "center", gap: 8,
        transition: "all 0.15s ease",
      }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />}
      {label}
      <span style={{ fontSize: 10, color: active ? accent : "#496552", fontFamily: "var(--font-mono, monospace)" }}>{count}</span>
    </button>
  );
}

/* ── Progress tier pill ─────────────────────────────────────────────── */

function TierPill({ id, active, onClick, count }: { id: ProgressTier; active: boolean; onClick: () => void; count: number }) {
  if (id === "all") {
    return (
      <button
        onClick={onClick}
        style={{
          padding: "6px 13px", fontSize: 11, cursor: "pointer", borderRadius: 999, fontWeight: 700,
          border: `1px solid ${active ? "#00C805" : "#164A2A"}`,
          background: active ? "rgba(0,200,5,0.08)" : "transparent",
          color: active ? "#E6FBEA" : "#7FA68A",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}
      >
        All progress
        <span style={{ fontSize: 10, color: active ? "#00C805" : "#496552", fontFamily: "var(--font-mono, monospace)" }}>{count}</span>
      </button>
    );
  }
  const tier = TIERS.find((t) => t.id === id)!;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px", fontSize: 11, cursor: "pointer", borderRadius: 999, fontWeight: 700,
        border: `1px solid ${active ? "#00C805" : "#164A2A"}`,
        background: active ? "rgba(0,200,5,0.08)" : "transparent",
        color: active ? "#E6FBEA" : "#7FA68A",
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "all 0.15s ease",
      }}
    >
      {tier.label}
      <span style={{ fontSize: 9, color: active ? "#7FA68A" : "#496552", fontFamily: "var(--font-mono, monospace)" }}>{tier.range}</span>
      <span style={{ fontSize: 10, color: active ? "#00C805" : "#496552", fontFamily: "var(--font-mono, monospace)" }}>{count}</span>
    </button>
  );
}

/* ── Premium bonding card ───────────────────────────────────────────── */

function PremiumCard({ token }: { token: BondingToken }) {
  const meta = SOURCE_META[token.source];
  const pct = token.progressPct;
  const scanHref = token.scanAddress ? `/scan/${token.scanAddress}` : null;
  const changeVal = token.priceChange24hPct;

  return (
    <article
      style={{
        position: "relative",
        background: "#06140B",
        border: "1px solid #164A2A",
        borderRadius: 14,
        padding: 16,
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      {/* source-tinted top gradient */}
      <span aria-hidden style={{ position: "absolute", inset: 0, background: meta.tint, pointerEvents: "none" }} />

      {/* header: logo + name clickable → launchpad */}
      <a
        href={meta.url(token)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", position: "relative", zIndex: 1 }}
        title={`Open ${token.symbol || token.name} on ${meta.label}`}
      >
        <TokenLogo token={token} ring={meta.ring} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#E6FBEA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>${token.symbol || "?"}</span>
            <ExternalArrow color="#7FA68A" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "#8FB39D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.name || "—"}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: meta.ring, border: `1px solid ${meta.ring}22`, borderRadius: 999, padding: "1px 6px", flexShrink: 0, letterSpacing: "0.04em" }}>{meta.label}</span>
          </div>
        </div>
      </a>

      {/* progress section */}
      <div style={{ position: "relative", zIndex: 1, background: "rgba(0,0,0,0.14)", border: "1px solid #0E2B19", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 7 }}>
          <div>
            <div style={{ fontSize: 9, color: "#496552", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 2 }}>
              {token.source === "noxa" ? "bonding progress" : token.source === "pons" ? "live on curve" : "graduation rank"}
            </div>
            <span style={{
              fontSize: 26, fontWeight: 900, lineHeight: 1,
              fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.04em",
              color: "#E6FBEA",
            }}>
              {pct != null ? `${Math.round(pct)}%` : token.source === "virtuals" ? "—" : "live"}
            </span>
          </div>
          <span style={{ fontSize: 10, color: "#496552", fontFamily: "var(--font-mono, monospace)", paddingBottom: 2 }}>
            {token.source === "noxa" && pct != null
              ? `${((pct / 100) * 4.2).toFixed(2)} / 4.2 ETH`
              : token.mcapInVirtual != null
                ? `${fmtCompact(token.mcapInVirtual)} VIRT`
                : token.source === "pons"
                  ? "trading now"
                  : ""}
          </span>
        </div>
        <ProgressBar pct={pct} source={token.source} ring={meta.ring} />
      </div>

      {/* metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 14px", fontSize: 11, position: "relative", zIndex: 1 }}>
        <Stat label="Mcap" value={mcapText(token)} />
        <Stat label={token.source === "pons" ? "Vol 1h" : "Vol 24h"} value={fmtUsd(token.volume24hUsd)} />
        <Stat label="24h" value={fmtPct(changeVal)} color={changeColor(changeVal)} />
      </div>

      {/* deployer + holder/age */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, borderTop: "1px solid #11331F", paddingTop: 10, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.08em" }}>deployer</span>
          {token.deployer ? (
            <Link href={`/deployer/${token.deployer}`} onClick={(e) => e.stopPropagation()} style={{ fontFamily: "var(--font-mono, monospace)", color: "#B7D9C2", textDecoration: "none", background: "rgba(10,31,18,0.6)", border: "1px solid #164A2A", borderRadius: 4, padding: "3px 8px", fontSize: 10 }}>
              {shortAddr(token.deployer)}
            </Link>
          ) : (
            <span style={{ color: "#496552" }}>unknown</span>
          )}
        </div>
        <span style={{ color: "#5E7D6A", fontFamily: "var(--font-mono, monospace)", fontSize: 10 }}>
          {token.holderCount != null ? `${token.holderCount.toLocaleString()} holders` : age(token.createdAt)}
        </span>
      </div>

      {/* CTAs */}
      <div style={{ display: "grid", gridTemplateColumns: scanHref ? "1fr auto" : "1fr", gap: 8, position: "relative", zIndex: 1, marginTop: 2 }}>
        {scanHref ? (
          <Link
            href={scanHref}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "linear-gradient(180deg, #00C805 0%, #0A7D2C 100%)",
              color: "#03210C", fontSize: 13, fontWeight: 800,
              padding: "10px 14px", borderRadius: 8, textDecoration: "none",
              boxShadow: `0 0 0 1px rgba(0,200,5,0.4), 0 4px 12px ${meta.glow}`,
              letterSpacing: "0.02em",
            }}
          >
            <ScanIcon /> Scan in Hood
          </Link>
        ) : (
          <span
            title="Scan will unlock once this token graduates"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: "rgba(139,124,246,0.08)", border: "1px solid #2f2755",
              color: "#B7A9F0", fontSize: 12, fontWeight: 700,
              padding: "10px 14px", borderRadius: 8, cursor: "help",
            }}
          >
            <span aria-hidden>🔒</span> Scan unlocks on graduation
          </span>
        )}
        {scanHref && (
          <a
            href={meta.url(token)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open on ${meta.label}`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "rgba(6,20,11,0.6)", border: `1px solid ${meta.ring}`,
              color: meta.ring, fontSize: 12, fontWeight: 700,
              padding: "10px 14px", borderRadius: 8, textDecoration: "none",
            }}
          >
            {meta.label} <ExternalArrow color={meta.ring} />
          </a>
        )}
      </div>
    </article>
  );
}

/* ── Progress bar ───────────────────────────────────────────────────── */

function ProgressBar({ pct, source, ring }: { pct: number | null; source: BondingToken["source"]; ring: string }) {
  const w = pct != null ? Math.min(100, Math.max(2, pct)) : 10;
  // Single accent colour per source — no tier rainbow
  const dim = source === "virtuals" ? "#2a1f55" : "#0A3A1A";
  const bright = ring;

  return (
    <div style={{ position: "relative", height: 10, background: "#0A1F12", border: "1px solid #0E2B19", borderRadius: 5, overflow: "hidden" }}>
      {[25, 50, 75].map((t) => (
        <span key={t} aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${t}%`, width: 1, background: "rgba(127,166,138,0.12)", zIndex: 1 }} />
      ))}
      <div style={{
        width: `${w}%`, height: "100%",
        background: `linear-gradient(90deg, ${dim}, ${bright})`,
        transition: "width 0.4s ease",
      }} />
      {pct == null && (
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent, ${ring}30, transparent)`,
          animation: "hoodShimmer 2.2s linear infinite",
        }} />
      )}
      <style>{`@keyframes hoodShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

/* ── Token logo with source-colored ring ────────────────────────────── */

function TokenLogo({ token, ring }: { token: BondingToken; ring: string }) {
  const [broken, setBroken] = useState(false);
  const initials = (token.symbol || token.name || "?").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
  const style: React.CSSProperties = {
    width: 42, height: 42, flexShrink: 0, borderRadius: "50%",
    background: "#0A1F12", border: `2px solid ${ring}22`,
    boxShadow: `0 0 0 1px ${ring}55`,
    objectFit: "cover" as const,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 800, color: "#B7D9C2",
  };
  if (token.logo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={token.logo} alt={token.symbol} width={42} height={42} onError={() => setBroken(true)} style={style} />;
  }
  return <span style={style}>{initials}</span>;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ color: "#5E7D6A", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ color: color ?? "#E6FBEA", fontWeight: 700, marginTop: 2, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>{value}</div>
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────── */

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(322px, 100%), 1fr))", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ background: "#06140B", border: "1px solid #164A2A", borderRadius: 14, padding: 16, height: 270, overflow: "hidden", position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(127,166,138,0.05), transparent)", animation: "hoodShimmer 1.6s linear infinite" }} />
          <style>{`@keyframes hoodShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
        </div>
      ))}
    </div>
  );
}

function Message({ text, tone = "#7FA68A" }: { text: string; tone?: string }) {
  return <div style={{ padding: "20px 16px", color: tone, background: "#06140B", border: "1px solid #164A2A", borderRadius: 10, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{text}</div>;
}

function Pagination({ page, pageCount, onPrevious, onNext }: { page: number; pageCount: number; onPrevious: () => void; onNext: () => void }) {
  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    minWidth: 92, padding: "9px 13px", borderRadius: 7, fontSize: 12, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.42 : 1,
    background: "#06140B", border: "1px solid #164A2A", color: "#B7D9C2",
  });
  return (
    <nav aria-label="Launchpad pages" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20 }}>
      <button type="button" onClick={onPrevious} disabled={page === 1} style={buttonStyle(page === 1)}>← Previous</button>
      <span style={{ minWidth: 80, textAlign: "center", color: "#7FA68A", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>Page {page} / {pageCount}</span>
      <button type="button" onClick={onNext} disabled={page === pageCount} style={buttonStyle(page === pageCount)}>Next →</button>
    </nav>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────── */

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" />
    </svg>
  );
}

function ExternalArrow({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7" /><path d="M8 7h9v9" />
    </svg>
  );
}

/* ── Formatters ─────────────────────────────────────────────────────── */

function mcapText(t: BondingToken): string {
  if (t.marketCapUsd  != null) return fmtUsd(t.marketCapUsd);
  if (t.mcapInVirtual != null) return `${fmtCompact(t.mcapInVirtual)} VIRT`;
  return "—";
}

function fmtUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtCompact(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function changeColor(v: number | null): string {
  if (v == null) return "#7FA68A";
  return v >= 0 ? "#00C805" : "#FF3B30";
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function age(date: string | null): string {
  if (!date) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 36e5));
  if (hours < 1) return "<1h";
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}
