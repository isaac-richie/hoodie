"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { usePulse } from "@/lib/queries";
import type { TokenSummary } from "@/lib/api";

type Tab = "new" | "grad" | "done";
type Sort = "" | "gainers" | "losers" | "traded" | "score" | "liq" | "age";

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "grad", label: "Graduating" },
  { id: "done", label: "Graduated" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "traded", label: "Most traded" },
  { id: "score", label: "Riskiest" },
  { id: "liq", label: "Liquidity" },
  { id: "age", label: "Newest" },
];

export default function PulsePage() {
  const [tab, setTab] = useState<Tab>("new");
  const [sort, setSort] = useState<Sort>("");
  const [hideFlagged, setHideFlagged] = useState(false);
  const { data, isLoading, error } = usePulse();

  const base = filterTokens(data?.tokens ?? [], tab);
  const rows = sortTokens(hideFlagged ? base.filter((r) => (r.latestScore ?? 0) < 75) : base, sort);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Bounty Board</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Discover</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Fresh tokens as they launch, close their curve, and land on Uniswap. Every one arrives pre scored.
        </div>
      </div>

      {/* controls */}
      <div style={{ background: "#06140B", border: "1px solid #164A2A", marginBottom: 1, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "0 14px" }}>
        <div style={{ display: "flex", gap: 2 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "11px 14px", fontSize: 12, cursor: "pointer", border: "none", background: "transparent",
              borderBottom: `2px solid ${tab === t.id ? "#00C805" : "transparent"}`,
              color: tab === t.id ? "#E6FBEA" : "#7FA68A",
              fontWeight: tab === t.id ? 700 : 400,
            }}>{t.label}</button>
          ))}
        </div>
        <span style={{ width: 1, height: 18, background: "#164A2A" }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", padding: "8px 0" }}>
          <span style={{ color: "#496552", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>sort</span>
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => setSort(sort === s.id ? "" : s.id)} style={{
              padding: "5px 9px", fontSize: 10, cursor: "pointer", borderRadius: 3,
              border: `1px solid ${sort === s.id ? "#00C805" : "#164A2A"}`,
              color: sort === s.id ? "#00C805" : "#7FA68A",
              background: sort === s.id ? "#0D2A19" : "transparent",
            }}>{s.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", padding: "8px 0", fontSize: 11 }}>
          <span style={{ border: "1px solid #164A2A", padding: "5px 9px", borderRadius: 3, color: "#7FA68A" }}>min liq: $25k</span>
          <span style={{ border: "1px solid #164A2A", padding: "5px 9px", borderRadius: 3, color: "#7FA68A" }}>max top10: 60%</span>
          <button onClick={() => setHideFlagged(!hideFlagged)} style={{ background: "transparent", border: "1px solid #164A2A", color: "#FFB020", fontSize: 11, padding: "5px 9px", borderRadius: 3, cursor: "pointer" }}>
            {hideFlagged ? "show flagged" : "hide flagged"}
          </button>
        </div>
      </div>

      {/* table */}
      <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "30px 1.7fr 1.4fr 70px 70px 66px 46px 58px 64px",
          gap: 10, padding: "9px 16px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#496552", borderBottom: "1px solid #164A2A", alignItems: "center",
        }}>
          <span>#</span><span>token</span><span>risk</span>
          <span style={{ textAlign: "right" }}>mcap</span>
          <span style={{ textAlign: "right" }}>vol 24h</span>
          <span style={{ textAlign: "right" }}>liq</span>
          <span style={{ textAlign: "right" }}>age</span>
          <span style={{ textAlign: "right" }}>24h</span>
          <span style={{ textAlign: "right" }}>7d</span>
        </div>
        {isLoading && <TableMessage message="loading live pulse..." />}
        {error && <TableMessage message="backend pulse unavailable" tone="#FFB020" />}
        {!isLoading && !error && rows.length === 0 && <TableMessage message="no scanned tokens yet. run a scan to seed the board." />}
        {rows.map((p, i) => (
          <Link key={p.address} href={`/scan/${p.address}`} style={{
            display: "grid", gridTemplateColumns: "30px 1.7fr 1.4fr 70px 70px 66px 46px 58px 64px",
            gap: 10, alignItems: "center", background: "#06140B", padding: "7px 16px", borderBottom: "1px solid #113020", fontSize: 12, cursor: "pointer", color: "inherit", textDecoration: "none",
          }}>
            <span style={{ color: "#496552" }}>{i + 1}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", background: "#164A2A", color: "#7FA68A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initials(p.symbol ?? p.name ?? p.address)}</span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: "15px" }}>
                <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.symbol ?? shortAddress(p.address)}</span>
                <span style={{ fontSize: 10, color: "#496552", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name ?? p.address}</span>
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <ScoreBadge score={p.latestScore ?? 0} />
              <span style={{ fontSize: 9, color: bandColor(p.latestBand) }}>{p.latestBand ?? "unscored"}</span>
            </span>
            <span style={{ textAlign: "right" }}>—</span>
            <span style={{ textAlign: "right" }}>{p.totalScans ?? 0} scans</span>
            <span style={{ textAlign: "right" }}>—</span>
            <span style={{ textAlign: "right", color: "#7FA68A" }}>{age(p.createdAt)}</span>
            <span style={{ textAlign: "right", color: bandColor(p.latestBand) }}>{p.status ?? "live"}</span>
            <svg width="60" height="16" viewBox="0 0 68 18" preserveAspectRatio="none" style={{ justifySelf: "end" }}>
              <polyline points={spark(p.latestScore ?? 0)} fill="none" stroke={bandColor(p.latestBand)} strokeWidth="1.5" />
            </svg>
          </Link>
        ))}
        <div style={{ padding: "10px 16px", fontSize: 11, color: "#496552", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>Scam templates and repeat offender deployers are demoted or hidden by default. Click any row for the full scan.</span>
          <span style={{ color: "#FFB020" }}>{hideFlagged ? "flagged hidden" : `${rows.length} live rows`}</span>
        </div>
      </div>
    </div>
  );
}

function filterTokens(tokens: TokenSummary[], tab: Tab): TokenSummary[] {
  if (tab === "grad") return tokens.filter((token) => (token.latestScore ?? 0) < 60);
  if (tab === "done") return tokens.filter((token) => (token.totalScans ?? 0) > 1);
  return tokens;
}

function sortTokens(tokens: TokenSummary[], sort: Sort): TokenSummary[] {
  const rows = [...tokens];
  if (sort === "score") return rows.sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
  if (sort === "age") return rows.sort((a, b) => Date.parse(b.createdAt ?? "0") - Date.parse(a.createdAt ?? "0"));
  return rows.sort((a, b) => Date.parse(b.updatedAt ?? "0") - Date.parse(a.updatedAt ?? "0"));
}

function TableMessage({ message, tone = "#7FA68A" }: { message: string; tone?: string }) {
  return <div style={{ padding: "18px 16px", color: tone, background: "#06140B", fontSize: 12 }}>{message}</div>;
}

function initials(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "HT";
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function age(date: string | null): string {
  if (!date) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 36e5));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function bandColor(band: TokenSummary["latestBand"]): string {
  if (band === "extreme" || band === "rugged") return "#FF3B30";
  if (band === "high") return "#FFB020";
  if (band === "some_risk") return "#D4A937";
  return "#00C805";
}

function spark(score: number): string {
  const y = Math.max(3, 16 - Math.round(score / 8));
  return `0,14 12,${y + 1} 25,${y} 39,${Math.max(2, y - 3)} 53,${y + 2} 68,${Math.max(2, y - 1)}`;
}
