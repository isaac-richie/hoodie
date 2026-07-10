"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { BlinkCursor } from "@/components/ui/BlinkCursor";
import { usePulse } from "@/lib/queries";
import type { TokenSummary } from "@/lib/api";

type Sort = "gainers" | "losers" | "traded" | "";

const SORTS: { id: Sort; label: string }[] = [
  { id: "gainers", label: "Newest" },
  { id: "losers", label: "Riskiest" },
  { id: "traded", label: "Most scanned" },
];

export function TokenTable() {
  const [sort, setSort] = useState<Sort>("");
  const { data, isLoading, error } = usePulse();
  const rows = sortRows(data?.tokens ?? [], sort).slice(0, 12);

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
        <div style={{ display: "flex", gap: 2 }}>
          <span style={{ padding: "11px 14px", fontSize: 12, color: "#E6FBEA", fontWeight: 700 }}>
            Live Pulse
          </span>
        </div>
        <span style={{ width: 1, height: 18, background: "#164A2A" }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 0" }}>
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(sort === s.id ? "" : s.id)}
              style={{
                padding: "5px 9px",
                fontSize: 10,
                cursor: "pointer",
                borderRadius: 3,
                border: `1px solid ${sort === s.id ? "#00C805" : "#164A2A"}`,
                color: sort === s.id ? "#00C805" : "#7FA68A",
                background: sort === s.id ? "#0D2A19" : "transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#496552", display: "flex", alignItems: "center", gap: 8 }}>
          backend <BlinkCursor w={6} h={11} />
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
          {!isLoading && !error && rows.length === 0 && <TableMessage message="no scans yet. run one to populate the board." />}

          {rows.map((token, i) => (
            <Link
              key={token.address}
              href={`/scan/${token.address}`}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1.8fr 1.5fr 84px 84px 54px 64px",
                gap: 10,
                alignItems: "center",
                background: "#06140B",
                padding: "8px 16px",
                borderBottom: "1px solid #113020",
                fontSize: 12,
                cursor: "pointer",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <span style={{ color: "#496552" }}>{i + 1}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={avatarStyle}>{initials(token.symbol ?? token.name ?? token.address)}</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: "15px" }}>
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {token.symbol ?? shortAddress(token.address)}
                  </span>
                  <span style={{ fontSize: 10, color: "#496552", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {token.name ?? token.address}
                  </span>
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <ScoreBadge score={token.latestScore ?? 0} />
                <span style={{ fontSize: 9, color: bandColor(token.latestBand) }}>{token.latestBand ?? "unscored"}</span>
              </span>
              <span style={{ textAlign: "right" }}>{token.status ?? "live"}</span>
              <span style={{ textAlign: "right" }}>{token.totalScans ?? 0}</span>
              <span style={{ textAlign: "right", color: "#7FA68A" }}>{age(token.createdAt)}</span>
              <span style={{ textAlign: "right", color: bandColor(token.latestBand) }}>{token.latestScore ?? "—"}</span>
            </Link>
          ))}
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
  if (sort === "losers") return rows.sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
  if (sort === "traded") return rows.sort((a, b) => (b.totalScans ?? 0) - (a.totalScans ?? 0));
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
