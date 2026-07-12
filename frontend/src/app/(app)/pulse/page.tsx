"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBondingFeed } from "@/lib/queries";
import type { BondingToken } from "@/lib/api";

type SourceFilter = "all" | "noxa" | "virtuals";

const SOURCE_META: Record<BondingToken["source"], { label: string; color: string }> = {
  noxa: { label: "NOXA", color: "#00C805" },
  virtuals: { label: "Virtuals", color: "#8B7CF6" },
};

export default function PulsePage() {
  const [source, setSource] = useState<SourceFilter>("all");
  const { data, isLoading, error } = useBondingFeed();

  const tokens = useMemo(() => {
    const all = data?.tokens ?? [];
    const live = all.filter((t) => !t.graduated);
    return source === "all" ? live : live.filter((t) => t.source === source);
  }, [data, source]);

  const noxaDown = data?.sources.noxa === "error";
  const virtualsDown = data?.sources.virtuals === "error";

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Bounty Board</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>About to bond</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Live tokens climbing their bonding curve across Robinhood Chain launchpads. Scan one before you ape — then jump to the launchpad.
        </div>
      </div>

      {/* source filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "noxa", "virtuals"] as SourceFilter[]).map((s) => {
          const active = source === s;
          const label = s === "all" ? "All launchpads" : SOURCE_META[s].label;
          return (
            <button
              key={s}
              onClick={() => setSource(s)}
              style={{
                padding: "6px 12px", fontSize: 12, cursor: "pointer", borderRadius: 999,
                border: `1px solid ${active ? "#1F5A34" : "#164A2A"}`,
                background: active ? "#0D2A19" : "transparent",
                color: active ? "#00C805" : "#7FA68A", fontWeight: active ? 700 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#496552" }}>
          {tokens.length} live · refreshes every 45s
        </span>
      </div>

      {(noxaDown || virtualsDown) && (
        <div style={{ background: "#3a2a08", border: "1px solid #FFB020", padding: "8px 12px", fontSize: 11, color: "#FFB020", marginBottom: 12, borderRadius: 4 }}>
          {noxaDown && virtualsDown ? "Both launchpad feeds are temporarily unavailable." : `${noxaDown ? "NOXA" : "Virtuals"} feed is temporarily unavailable — showing the other source.`}
        </div>
      )}

      {isLoading && <Message text="loading live bonding curves…" />}
      {error && <Message text="bonding feed unavailable — the backend could not reach the launchpads." tone="#FFB020" />}
      {!isLoading && !error && tokens.length === 0 && <Message text="no tokens are close to bonding right now. check back in a bit." />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 12 }}>
        {tokens.map((t) => <BondingCard key={`${t.source}-${t.address}`} token={t} />)}
      </div>
    </div>
  );
}

function BondingCard({ token }: { token: BondingToken }) {
  const meta = SOURCE_META[token.source];
  const pct = token.progressPct;

  return (
    <div style={{ background: "#06140B", border: "1px solid #164A2A", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
      {/* header: logo, symbol, source */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TokenLogo token={token} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#E6FBEA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>${token.symbol || "?"}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 11, color: "#7FA68A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.name || "—"}</div>
        </div>
      </div>

      {/* bonding progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5E7D6A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>bonding progress</span>
          <span style={{ color: pct != null ? "#00C805" : "#7FA68A", fontWeight: 700 }}>
            {pct != null ? `${pct}%` : "climbing"}
          </span>
        </div>
        <div style={{ height: 6, background: "#11331F", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${pct ?? 12}%`, height: 6, background: pct != null ? "linear-gradient(90deg,#0A7D2C,#00C805)" : "#2A5A3C", borderRadius: 3 }} />
        </div>
      </div>

      {/* basic details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 12px", fontSize: 11 }}>
        <Stat label="market cap" value={fmtUsd(token.marketCapUsd)} />
        <Stat label="24h volume" value={fmtUsd(token.volume24hUsd)} />
        <Stat label="24h change" value={fmtPct(token.priceChange24hPct)} color={changeColor(token.priceChange24hPct)} />
        <Stat label={token.holderCount != null ? "holders" : "age"} value={token.holderCount != null ? token.holderCount.toLocaleString() : age(token.createdAt)} />
      </div>

      {/* deployer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, borderTop: "1px solid #11331F", paddingTop: 9 }}>
        <span style={{ color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.06em" }}>deployer</span>
        {token.deployer ? (
          <Link href={`/deployer/${token.deployer}`} style={{ fontFamily: "var(--font-mono, monospace)", color: "#8FB39D", textDecoration: "none", background: "#0A1F12", border: "1px solid #164A2A", borderRadius: 3, padding: "2px 7px" }}>
            {shortAddr(token.deployer)}
          </Link>
        ) : (
          <span style={{ color: "#496552" }}>unknown</span>
        )}
      </div>

      {/* actions: scan-first, then launchpad */}
      <div style={{ display: "flex", gap: 7 }}>
        {token.scanAddress ? (
          <Link href={`/scan/${token.scanAddress}`} style={{ flex: 1, textAlign: "center", background: "#0D2A19", border: "1px solid #1F5A34", color: "#00C805", fontSize: 12, fontWeight: 700, padding: "8px 0", borderRadius: 5, textDecoration: "none" }}>
            Scan first
          </Link>
        ) : (
          <span title="Pre-graduation agents have no tradable ERC20 to scan yet" style={{ flex: 1, textAlign: "center", background: "#0A1F12", border: "1px solid #164A2A", color: "#496552", fontSize: 12, padding: "8px 0", borderRadius: 5 }}>
            Scan on launch
          </span>
        )}
        <a href={token.launchpadUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", background: "transparent", border: "1px solid #164A2A", color: "#E6FBEA", fontSize: 12, padding: "8px 0", borderRadius: 5, textDecoration: "none" }}>
          {meta.label} ↗
        </a>
      </div>
    </div>
  );
}

function TokenLogo({ token }: { token: BondingToken }) {
  const [broken, setBroken] = useState(false);
  const initials = (token.symbol || token.name || "?").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
  if (token.logo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={token.logo} alt={token.symbol} width={38} height={38} onError={() => setBroken(true)} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "#164A2A" }} />;
  }
  return <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", background: "#164A2A", color: "#7FA68A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{initials}</span>;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ color: "#5E7D6A", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ color: color ?? "#E6FBEA", fontWeight: 600, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function Message({ text, tone = "#7FA68A" }: { text: string; tone?: string }) {
  return <div style={{ padding: "18px 16px", color: tone, background: "#06140B", border: "1px solid #164A2A", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{text}</div>;
}

function fmtUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
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
