"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { BlinkCursor } from "@/components/ui/BlinkCursor";
import { usePulse } from "@/lib/queries";
import type { TokenSummary } from "@/lib/api";

// "Threats" is the default because this is billed as a Live Pulse threat
// tracker — visitors should see actual threats first, not "newest" filler.
type Sort = "threats" | "newest" | "scanned";
const THREAT_THRESHOLD = 60; // latestScore ≥ 60 = flagged as a threat

const SORTS: { id: Sort; label: string }[] = [
  { id: "threats", label: "Threats" },
  { id: "newest", label: "Newest" },
  { id: "scanned", label: "Most scanned" },
];

export function TokenTable() {
  const [sort, setSort] = useState<Sort>("threats");
  // Start with the filter OFF so we always show a triaged board on first paint.
  // An auto-enable effect flips it ON the moment a real threat appears — so
  // the "🚨 Threats only" affordance kicks in the moment it becomes meaningful,
  // and users never see an empty pane before then.
  const [threatsOnly, setThreatsOnly] = useState(false);
  const [threatsOnlyAutoApplied, setThreatsOnlyAutoApplied] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const { data, isLoading, error, isFetching, dataUpdatedAt } = usePulse();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const threatCount = (data?.tokens ?? []).filter((t) => (t.latestScore ?? 0) >= THREAT_THRESHOLD).length;

  useEffect(() => {
    if (!threatsOnlyAutoApplied && threatCount > 0) {
      setThreatsOnly(true);
      setThreatsOnlyAutoApplied(true);
    }
  }, [threatCount, threatsOnlyAutoApplied]);

  const rows = useMemo(() => {
    const all = data?.tokens ?? [];
    const filtered = threatsOnly ? all.filter((t) => (t.latestScore ?? 0) >= THREAT_THRESHOLD) : all;
    return sortRows(filtered, sort).slice(0, 12);
  }, [data, sort, threatsOnly]);

  const staleSeconds = dataUpdatedAt && now != null ? Math.floor((now - dataUpdatedAt) / 1000) : null;

  return (
    <>
      <div
        style={{
          background: "#06140B",
          border: "1px solid #164A2A",
          marginBottom: 1,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          padding: "0 14px",
        }}
      >
        <div style={{ display: "flex", gap: 2, alignItems: "center", padding: "11px 0 11px 14px" }}>
          <span style={{ position: "relative", width: 8, height: 8, marginRight: 8 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#FF3B30", animation: "hoodPulse 1.6s ease-out infinite" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#FF3B30" }} />
          </span>
          <span style={{ fontSize: 12, color: "#E6FBEA", fontWeight: 700 }}>Live Pulse</span>
          {threatCount > 0 && (
            <span style={{ marginLeft: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#FF3B30", background: "rgba(255,59,48,0.10)", border: "1px solid #6b1f18", borderRadius: 999, letterSpacing: "0.05em" }}>
              {threatCount} threat{threatCount === 1 ? "" : "s"}
            </span>
          )}
          <style>{`@keyframes hoodPulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.8); opacity: 0; } }`}</style>
        </div>
        <span style={{ width: 1, height: 18, background: "#164A2A" }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 0" }}>
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              style={{
                padding: "5px 9px",
                fontSize: 10,
                cursor: "pointer",
                borderRadius: 3,
                border: `1px solid ${sort === s.id ? "#00C805" : "#164A2A"}`,
                color: sort === s.id ? "#00C805" : "#7FA68A",
                background: sort === s.id ? "#0D2A19" : "transparent",
                fontWeight: sort === s.id ? 700 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setThreatsOnly((v) => !v)}
            title="Show only tokens flagged as threats (risk score ≥ 60)"
            style={{
              marginLeft: 4, padding: "5px 9px", fontSize: 10, cursor: "pointer", borderRadius: 3,
              border: `1px solid ${threatsOnly ? "#FF3B30" : "#164A2A"}`,
              color: threatsOnly ? "#FF3B30" : "#7FA68A",
              background: threatsOnly ? "rgba(255,59,48,0.10)" : "transparent",
              fontWeight: threatsOnly ? 700 : 400,
            }}
          >
            {threatsOnly ? "🚨 Threats only" : "all scans"}
          </button>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#496552", display: "flex", alignItems: "center", gap: 8, padding: "0 4px 0 0" }}>
          {isFetching ? <><BlinkCursor w={6} h={11} /> updating</> : staleSeconds != null && staleSeconds < 60 ? `${staleSeconds}s ago` : "live"}
        </span>
      </div>

      <div className="token-table-scroll">
        <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "30px 1.8fr 1.5fr 84px 84px 54px 64px",
              gap: 10,
              padding: "9px 16px",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#496552",
              borderBottom: "1px solid #164A2A",
              alignItems: "center",
            }}
          >
            <span>#</span>
            <span>token</span>
            <span>risk</span>
            <span style={{ textAlign: "right" }}>status</span>
            <span style={{ textAlign: "right" }}>scans</span>
            <span style={{ textAlign: "right" }}>age</span>
            <span style={{ textAlign: "right" }}>band</span>
          </div>

          {isLoading && <TableMessage message="loading live token board..." />}
          {error && <TableMessage message="backend pulse unavailable" tone="#FFB020" />}
          {!isLoading && !error && rows.length === 0 && (
            <TableMessage message={threatsOnly ? "no threats in the current window. every scanned token is under the risk threshold." : "no scans yet. run one to populate the board."} />
          )}

          {rows.map((token, i) => {
            const isThreat = (token.latestScore ?? 0) >= THREAT_THRESHOLD;
            const symbol = token.symbol && token.symbol.trim() ? token.symbol : shortAddress(token.address);
            const name = token.name && token.name.trim() ? token.name : "resolving…";
            return (
              <Link
                key={token.address}
                href={`/scan/${token.address}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1.8fr 1.5fr 84px 84px 54px 64px",
                  gap: 10,
                  alignItems: "center",
                  background: isThreat ? "rgba(255,59,48,0.04)" : "#06140B",
                  padding: "8px 16px",
                  borderBottom: "1px solid #113020",
                  borderLeft: isThreat ? "2px solid #FF3B30" : "2px solid transparent",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span style={{ color: isThreat ? "#FF3B30" : "#496552", display: "flex", alignItems: "center", gap: 4 }}>
                  {isThreat && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF3B30", boxShadow: "0 0 6px #FF3B30" }} />}
                  {i + 1}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <span style={avatarStyle}>{initials(symbol)}</span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: "15px" }}>
                    <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {symbol}
                    </span>
                    <span style={{ fontSize: 10, color: "#496552", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <ScoreBadge score={token.latestScore ?? 0} />
                  <span style={{ fontSize: 9, color: bandColor(token.latestBand) }}>{token.latestBand ?? "unscored"}</span>
                </span>
                <span style={{ textAlign: "right", color: statusColor(token.status), fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
                  {statusLabel(token.status)}
                </span>
                <span style={{ textAlign: "right" }}>{token.totalScans ?? 0}</span>
                <span style={{ textAlign: "right", color: "#7FA68A" }}>{age(token.updatedAt)}</span>
                <span style={{ textAlign: "right", color: bandColor(token.latestBand), fontWeight: 700 }}>{token.latestScore ?? "—"}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

const avatarStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  flexShrink: 0,
  borderRadius: "50%",
  background: "#164A2A",
  color: "#7FA68A",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 700,
};

function sortRows(tokens: TokenSummary[], sort: Sort): TokenSummary[] {
  const rows = [...tokens];
  if (sort === "threats") return rows.sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
  if (sort === "scanned") return rows.sort((a, b) => (b.totalScans ?? 0) - (a.totalScans ?? 0));
  return rows.sort((a, b) => Date.parse(b.updatedAt ?? "0") - Date.parse(a.updatedAt ?? "0"));
}

// The `status` field is only meaningful when the persister sets it explicitly
// (e.g. 'rugged', 'honeypot', 'dead'). Everything else was showing a fake
// "live" filler — replace with an em-dash so unknowns aren't misrepresented.
function statusLabel(status: string | null): string {
  if (!status) return "—";
  const known = ["rugged", "honeypot", "dead", "flagged", "clean"];
  return known.includes(status) ? status : "—";
}

function statusColor(status: string | null): string {
  if (status === "rugged" || status === "honeypot") return "#FF3B30";
  if (status === "dead" || status === "flagged") return "#FFB020";
  if (status === "clean") return "#00C805";
  return "#496552";
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
