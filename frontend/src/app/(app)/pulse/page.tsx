"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBondingFeed } from "@/lib/queries";
import type { BondingToken } from "@/lib/api";

type SourceFilter = "all" | "noxa" | "virtuals";

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
};

export default function PulsePage() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [heatOnly, setHeatOnly] = useState(false);
  const { data, isLoading, error } = useBondingFeed();

  const tokens = useMemo(() => {
    const live = (data?.tokens ?? []).filter((t) => !t.graduated);
    const filtered = source === "all" ? live : live.filter((t) => t.source === source);
    const hot = heatOnly
      ? filtered.filter((t) => (t.progressPct ?? 0) >= 40 || (t.source === "virtuals" && (t.holderCount ?? 0) >= 100))
      : filtered;
    if (source !== "all") return hot;
    // Interleave both sources so neither buries the other in the combined view.
    const n = hot.filter((t) => t.source === "noxa");
    const v = hot.filter((t) => t.source === "virtuals");
    const merged: BondingToken[] = [];
    for (let i = 0; i < Math.max(n.length, v.length); i++) {
      if (i < n.length) merged.push(n[i]);
      if (i < v.length) merged.push(v[i]);
    }
    return merged;
  }, [data, source, heatOnly]);

  const noxaCount = (data?.tokens ?? []).filter((t) => !t.graduated && t.source === "noxa").length;
  const virtCount = (data?.tokens ?? []).filter((t) => !t.graduated && t.source === "virtuals").length;
  const noxaDown = data?.sources.noxa === "error";
  const virtualsDown = data?.sources.virtuals === "error";

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ marginBottom: 22, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#E6FBEA", letterSpacing: "-0.02em" }}>Bounty Board</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#D4A937", border: "1px solid #6b5111", background: "rgba(212,169,55,0.08)", padding: "3px 9px", borderRadius: 999, letterSpacing: "0.08em", textTransform: "uppercase" }}>Premium</span>
        </div>
        <div style={{ fontSize: 13, color: "#8FB39D", marginTop: 8, lineHeight: "20px", maxWidth: 680 }}>
          Every token climbing a bonding curve across Robinhood Chain launchpads, ranked live. Scan any of them in Hood Terminal <em style={{ color: "#D4A937", fontStyle: "normal" }}>before</em> the launchpad — that's the edge.
        </div>
      </div>

      {/* Controls: source pills + heat filter + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <SourcePill active={source === "all"} onClick={() => setSource("all")} label="All launchpads" count={noxaCount + virtCount} />
        <SourcePill active={source === "noxa"} onClick={() => setSource("noxa")} label="NOXA" count={noxaCount} color="#00C805" />
        <SourcePill active={source === "virtuals"} onClick={() => setSource("virtuals")} label="Virtuals" count={virtCount} color="#8B7CF6" />
        <div style={{ width: 1, height: 22, background: "#164A2A", marginInline: 4 }} />
        <button
          onClick={() => setHeatOnly((v) => !v)}
          style={{
            padding: "7px 13px", fontSize: 12, cursor: "pointer", borderRadius: 999, fontWeight: 700,
            border: `1px solid ${heatOnly ? "#FF3B30" : "#164A2A"}`,
            background: heatOnly ? "rgba(255,59,48,0.10)" : "transparent",
            color: heatOnly ? "#FF3B30" : "#7FA68A",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
          title="Show only tokens most likely to graduate soon"
        >
          <span style={{ fontSize: 13 }}>🔥</span> Heat
        </button>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#496552", fontFamily: "var(--font-mono, monospace)" }}>
          {tokens.length} shown · refreshes 45s
        </span>
      </div>

      {(noxaDown || virtualsDown) && (
        <div style={{ background: "rgba(255,176,32,0.08)", border: "1px solid #6b4d11", padding: "10px 14px", fontSize: 12, color: "#FFB020", marginBottom: 14, borderRadius: 6 }}>
          {noxaDown && virtualsDown ? "Both launchpad feeds are temporarily unavailable." : `${noxaDown ? "NOXA" : "Virtuals"} feed is temporarily unavailable — showing the other source.`}
        </div>
      )}

      {isLoading && <SkeletonGrid />}
      {error && <Message text="bonding feed unavailable — the backend could not reach the launchpads." tone="#FFB020" />}
      {!isLoading && !error && tokens.length === 0 && <Message text="no tokens match this filter right now — try turning off Heat or switching launchpads." />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(322px, 1fr))", gap: 14 }}>
        {tokens.map((t) => <PremiumCard key={`${t.source}-${t.address}`} token={t} />)}
      </div>
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

/* ── Premium bonding card ───────────────────────────────────────────── */

function PremiumCard({ token }: { token: BondingToken }) {
  const meta = SOURCE_META[token.source];
  const pct = token.progressPct;
  // Heat tier drives the accent — the closer to bonding, the hotter the ring.
  const hot = pct != null && pct >= 60;
  const warm = pct != null && pct >= 30;
  const scanHref = token.scanAddress ? `/scan/${token.scanAddress}` : null;
  const changeVal = token.priceChange24hPct;

  return (
    <article
      style={{
        position: "relative",
        background: "#06140B",
        border: `1px solid ${hot ? "#3a1f11" : "#164A2A"}`,
        borderRadius: 14,
        padding: 16,
        display: "flex", flexDirection: "column", gap: 12,
        boxShadow: hot ? `0 0 0 1px rgba(255,59,48,0.15), 0 8px 24px rgba(0,0,0,0.4)` : "0 4px 12px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      {/* subtle source-tinted top gradient */}
      <span aria-hidden style={{ position: "absolute", inset: 0, background: meta.tint, pointerEvents: "none" }} />
      {/* heat badge */}
      {hot && (
        <span style={{
          position: "absolute", top: 10, right: 10, zIndex: 2,
          fontSize: 9, fontWeight: 800, color: "#FF3B30", background: "rgba(255,59,48,0.12)",
          border: "1px solid #6b1f18", padding: "2px 7px", borderRadius: 999, letterSpacing: "0.08em",
        }}>🔥 HOT</span>
      )}

      {/* header: logo + name/symbol clickable → launchpad */}
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
            <span style={{ fontSize: 9, fontWeight: 700, color: meta.ring, border: `1px solid ${meta.ring}`, borderRadius: 999, padding: "1px 6px", flexShrink: 0, letterSpacing: "0.04em" }}>{meta.label}</span>
          </div>
        </div>
      </a>

      {/* progress meter */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <span style={{ color: "#5E7D6A" }}>bonding progress</span>
          <span style={{ color: pct != null ? (hot ? "#FF3B30" : warm ? "#D4A937" : "#00C805") : "#8B7CF6", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", letterSpacing: 0 }}>
            {pct != null ? `${pct.toFixed(1)}%` : "climbing"}
          </span>
        </div>
        <ProgressBar pct={pct} hot={hot} warm={warm} source={token.source} />
      </div>

      {/* metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 14px", fontSize: 11, position: "relative", zIndex: 1 }}>
        <Stat label="Mcap" value={mcapText(token)} />
        <Stat label="Vol 24h" value={fmtUsd(token.volume24hUsd)} />
        <Stat label="24h" value={fmtPct(changeVal)} color={changeColor(changeVal)} />
      </div>

      {/* deployer + secondary metric */}
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

      {/* primary CTA: SCAN → premium button; secondary: launchpad */}
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
            title="Pre-graduation Virtuals agents have no tradable ERC20 yet — the scan unlocks the moment they graduate."
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

/* ── Progress bar with ticks + tint by heat ─────────────────────────── */

function ProgressBar({ pct, hot, warm, source }: { pct: number | null; hot: boolean; warm: boolean; source: BondingToken["source"] }) {
  const w = pct != null ? Math.min(100, Math.max(2, pct)) : 12;
  const barColor = pct == null
    ? "linear-gradient(90deg,#4c4283,#8B7CF6)"
    : hot
      ? "linear-gradient(90deg,#7d0f08,#FF3B30)"
      : warm
        ? "linear-gradient(90deg,#6b4d11,#D4A937)"
        : "linear-gradient(90deg,#0A7D2C,#00C805)";
  return (
    <div style={{ position: "relative", height: 8, background: "#0A1F12", border: "1px solid #11331F", borderRadius: 4, overflow: "hidden" }}>
      {/* tick marks at 25/50/75 */}
      {[25, 50, 75].map((t) => (
        <span key={t} aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${t}%`, width: 1, background: "rgba(127,166,138,0.15)" }} />
      ))}
      <div style={{ width: `${w}%`, height: "100%", background: barColor, transition: "width 0.4s ease", boxShadow: pct != null && pct > 50 ? "0 0 12px rgba(255,255,255,0.08)" : "none" }} />
      {pct == null && (
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${source === "virtuals" ? "rgba(139,124,246,0.35)" : "rgba(0,200,5,0.35)"}, transparent)`, animation: "hoodShimmer 2.2s linear infinite" }} />
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

/* ── Skeleton (loading state) ───────────────────────────────────────── */

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(322px, 1fr))", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ background: "#06140B", border: "1px solid #164A2A", borderRadius: 14, padding: 16, height: 232, overflow: "hidden", position: "relative" }}>
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
  if (t.marketCapUsd != null) return fmtUsd(t.marketCapUsd);
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
