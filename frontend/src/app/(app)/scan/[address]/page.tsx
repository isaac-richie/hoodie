"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAddress } from "viem";
import { ApiClientError, type ModuleResult, type ModuleStatus, type ScanResult } from "@/lib/api";
import { useTokenScan } from "@/lib/queries";
import { useQuiverStore } from "@/stores/quiver";
import { useScanHistoryStore } from "@/stores/scan-history";
import { scoreToBand } from "@/types";

const MODULE_TABS = ["All", "Security", "Holders", "Launch", "Liquidity", "Creator", "Meta"] as const;

const CATEGORY_TAB: Record<string, (typeof MODULE_TABS)[number]> = {
  security: "Security",
  holders: "Holders",
  launch: "Launch",
  liquidity: "Liquidity",
  creator: "Creator",
  social: "Meta",
  meta: "Meta",
};


function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Robinhood Chain block explorer — every address in the report links out so
// users can verify our claims themselves instead of taking our word for it.
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://robinhoodchain.blockscout.com";

function explorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}

function explorerTokenUrl(address: string) {
  return `${EXPLORER_URL}/token/${address}`;
}

function formatBand(band: ScanResult["band"]) {
  return band.replace("_", " ");
}

// ── Status affordance ────────────────────────────────────────────────
const STATUS_META: Record<ModuleStatus, { label: string; fg: string; bg: string; accent: string }> = {
  pass: { label: "Pass", fg: "#00C805", bg: "rgba(0,200,5,0.12)", accent: "#00C805" },
  warn: { label: "Watch", fg: "#FFB020", bg: "rgba(255,176,32,0.12)", accent: "#FFB020" },
  fail: { label: "Flag", fg: "#FF3B30", bg: "rgba(255,59,48,0.14)", accent: "#FF3B30" },
  timeout: { label: "Skipped", fg: "#7FA68A", bg: "rgba(127,166,138,0.12)", accent: "#7FA68A" },
  error: { label: "Error", fg: "#FF3B30", bg: "rgba(255,59,48,0.14)", accent: "#FF3B30" },
};

// ── Evidence humanisation ────────────────────────────────────────────
// Turn raw engine field names + values into something a person reads, not a
// JSON dump. Unknown keys fall back to a de-camelCased label.
const EVIDENCE_LABELS: Record<string, string> = {
  canSell: "Can sell", buyTax: "Buy tax", sellTax: "Sell tax", totalTax: "Total tax",
  gasAnomaly: "Gas anomaly", sellGas: "Sell gas units",
  pool: "Pool", dex: "DEX", burned: "LP burned", locked: "LP locked",
  lockDays: "Lock length", unlockDate: "Unlocks", locker: "Locker", owner: "Owner",
  liquidity: "Liquidity", burnedPct: "LP burned", lockedPct: "LP locked",
  renounced: "Ownership renounced",
  totalLaunches: "Tokens launched", confirmedRugs: "Confirmed rugs",
  survivalRate: "30-day survival", medianLifeHours: "Median token life",
  mintReachable: "Mint reachable", mintByOwner: "Owner can mint",
  setTaxCallable: "Tax is mutable",
  holderCount: "Holders", top1Pct: "Top holder", top10Pct: "Top 10 holders",
  top10SybilAdjusted: "Top 10 (sybil-adjusted)", freshWalletPct: "Fresh wallets",
  commonFunders: "Shared funders",
  bundlePct: "Bundled supply", walletCount: "Bundled wallets", funderCount: "Funder wallets",
  funders: "Funder wallets", wallets: "Wallets",
  count: "Snipers", soldAll: "Already exited", address: "Wallet",
  hasBlacklist: "Blacklist function", hasPause: "Pause function",
  templatesChecked: "Templates checked",
  databaseSeeded: "Template database seeded",
  explorerConfigured: "Explorer configured",
  verified: "Source verified",
  contractName: "Contract name",
  compilerVersion: "Compiler",
  proxy: "Proxy",
  implementation: "Implementation",
  abiAvailable: "ABI available",
  verifiedBy: "Verified by", externalVerifier: "External verifier",
  positionsChecked: "Positions checked", burnedPositions: "Burned positions",
  lockedPositions: "Locked positions", unlockedPositions: "Unlocked positions",
  unlockedOwners: "Unlocked holders", owners: "Position owners",
  highVolume: "High-volume token",
};
// Internal plumbing that shouldn't reach a person reading a report.
const EVIDENCE_HIDE = new Set([
  "fundingTraceAvailable", "poolCount", "sybilBands", "method", "bundleBlock",
  "kind", "isSerialRug", "pastTokens",
]);
const EVIDENCE_PCT = new Set([
  "buyTax", "sellTax", "totalTax", "survivalRate", "top1Pct", "top10Pct",
  "top10SybilAdjusted", "freshWalletPct", "bundlePct", "burnedPct", "lockedPct",
]);

function humanizeKey(key: string): string {
  if (EVIDENCE_LABELS[key]) return EVIDENCE_LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatUsd(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  if (value > 0) return `$${value.toPrecision(3)}`;
  return "$0";
}

function humanizeModuleName(name: string): string {
  const spaced = name.replace(/[_-]+/g, " ");
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bLp\b/, "LP").replace(/\bV3\b/i, "V3");
}

function looksLikeAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function AddressChip({ value }: { value: string }) {
  return (
    <a
      href={explorerAddressUrl(value)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${value} — view on explorer`}
      style={{
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 11,
        color: "#B7D9C2",
        background: "#0A1F12",
        border: "1px solid #164A2A",
        borderRadius: 3,
        padding: "1px 6px",
        textDecoration: "none",
      }}
    >
      {formatAddress(value)}
      <span style={{ color: "#3F5A49", marginLeft: 4, fontSize: 10 }}>↗</span>
    </a>
  );
}

function AddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        title="Copy address"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "#0A1F12",
          border: "1px solid #164A2A",
          borderRadius: 4,
          padding: "5px 9px",
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          color: "#8FB39D",
        }}
      >
        {formatAddress(address)}
        <span style={{ color: copied ? "#00C805" : "#3F5A49", fontSize: 10 }}>{copied ? "copied" : "copy"}</span>
      </button>
      <a
        href={explorerTokenUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title="View token on block explorer"
        style={{
          background: "#0A1F12",
          border: "1px solid #164A2A",
          borderRadius: 4,
          padding: "5px 9px",
          fontSize: 11,
          color: "#8FB39D",
          textDecoration: "none",
        }}
      >
        explorer ↗
      </a>
    </span>
  );
}

function EvidenceValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (typeof value === "boolean") {
    return (
      <span style={{ color: value ? "#E6FBEA" : "#7FA68A", fontWeight: 600 }}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (EVIDENCE_PCT.has(fieldKey) && typeof value === "number") {
    return <span style={{ color: "#E6FBEA" }}>{value}%</span>;
  }
  if (looksLikeAddress(value)) return <AddressChip value={value} />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "#496552" }}>none</span>;
    if (value.every(looksLikeAddress)) {
      return (
        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {value.slice(0, 3).map((addr) => (
            <AddressChip key={addr as string} value={addr as string} />
          ))}
          {value.length > 3 && <span style={{ color: "#496552", fontSize: 11 }}>+{value.length - 3} more</span>}
        </span>
      );
    }
    return <span style={{ color: "#E6FBEA" }}>{value.length} items</span>;
  }
  if (typeof value === "number") {
    return <span style={{ color: "#E6FBEA" }}>{value.toLocaleString()}</span>;
  }
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "#496552" }}>—</span>;
  }
  return <span style={{ color: "#E6FBEA", overflowWrap: "anywhere" }}>{String(value)}</span>;
}

function LiquidityValue({ text, pool }: { text: string; pool?: string }) {
  const style: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#00C805", marginTop: 3 };
  if (!pool) return <div style={style}>{text}</div>;
  return (
    <div style={style}>
      <a
        href={explorerAddressUrl(pool)}
        target="_blank"
        rel="noopener noreferrer"
        title="View LP pool on block explorer"
        style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dotted #1F5A34" }}
      >
        {text} <span style={{ fontSize: 10, color: "#3F5A49" }}>↗</span>
      </a>
    </div>
  );
}

function moduleCategory(module: ModuleResult) {
  return CATEGORY_TAB[module.category ?? "meta"] || "Meta";
}

function sortModules(a: ModuleResult, b: ModuleResult) {
  if (a.status === "fail" && b.status !== "fail") return -1;
  if (a.status !== "fail" && b.status === "fail") return 1;
  if (a.status === "warn" && b.status === "pass") return -1;
  if (a.status === "pass" && b.status === "warn") return 1;
  return b.score - a.score;
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: "#06140B",
        border: "1px solid #164A2A",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function LoadingState({ address }: { address: string }) {
  return (
    <Panel style={{ minHeight: 360, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ color: "#D4A937", fontWeight: 700, marginBottom: 14 }}>scan {formatAddress(address)}</div>
      {["resolving token metadata", "checking liquidity pool", "running risk modules", "assembling evidence"].map((line, index) => (
        <div key={line} style={{ display: "flex", gap: 12, color: "#7FA68A", fontSize: 13, padding: "7px 0" }}>
          <span style={{ color: index < 2 ? "#00C805" : "#FFB020", width: 58 }}>{index < 2 ? "[ OK ]" : "[ .. ]"}</span>
          <span>{line}</span>
        </div>
      ))}
    </Panel>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Panel style={{ maxWidth: 760, margin: "24px auto" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FFB020", marginBottom: 10 }}>
        scan halted
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>{title}</h1>
      <p style={{ margin: 0, color: "#7FA68A", lineHeight: "22px" }}>{message}</p>
    </Panel>
  );
}

function EvidenceBlock({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence || {}).filter(
    ([key, value]) =>
      !EVIDENCE_HIDE.has(key) &&
      value !== null &&
      value !== undefined &&
      !(typeof value === "object" && !Array.isArray(value))
  );

  if (entries.length === 0) return null;

  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "8px 24px",
        margin: "14px 0 0",
        paddingTop: 12,
        borderTop: "1px solid #11331F",
      }}
    >
      {entries.slice(0, 8).map(([key, value]) => (
        <div key={key} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <dt style={{ color: "#5E7D6A", whiteSpace: "nowrap" }}>{humanizeKey(key)}</dt>
          <dd style={{ margin: 0, textAlign: "right", minWidth: 0 }}>
            <EvidenceValue fieldKey={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NewScanBar() {
  const [input, setInput] = useState("");
  const router = useRouter();

  function handleScan() {
    const trimmed = input.trim();
    if (trimmed) {
      router.push(`/scan/${trimmed}`);
      setInput("");
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#06140B", border: "1px solid #164A2A", padding: "8px 14px" }}>
      <button
        onClick={() => router.push("/hideout")}
        style={{ background: "transparent", border: "1px solid #164A2A", color: "#7FA68A", fontSize: 11, padding: "5px 10px", cursor: "pointer", borderRadius: 3, whiteSpace: "nowrap" }}
      >
        ← Back
      </button>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#0A1F12", border: "1px solid #164A2A", borderRadius: 3, padding: "0 10px" }}>
        <span style={{ color: "#D4A937", fontWeight: 700 }}>❯</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="scan another address"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#E6FBEA", fontSize: 12, padding: "8px 0" }}
        />
      </div>
      <button
        onClick={handleScan}
        style={{ background: "#D4A937", color: "#0A1F12", border: "none", borderRadius: 3, fontSize: 11, fontWeight: 700, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Scan
      </button>
    </div>
  );
}

function ScanResultView({ result, onRescan, rescanning }: { result: ScanResult; onRescan: () => void; rescanning: boolean }) {
  const [activeTab, setActiveTab] = useState<(typeof MODULE_TABS)[number]>("All");
  const addToQuiver = useQuiverStore((state) => state.add);
  const isInQuiver = useQuiverStore((state) => state.has(result.tokenAddress));
  const band = scoreToBand(result.score);
  // The LP pool address lives in the lp_lock module's evidence — used to make
  // the liquidity stat link straight to the pool on the explorer.
  const poolAddress = (() => {
    const evidence = result.moduleResults.find((m) => m.module === "lp_lock")?.evidence as
      | Record<string, unknown>
      | undefined;
    const pool = evidence?.pool;
    return typeof pool === "string" && /^0x[a-fA-F0-9]{40}$/.test(pool) ? pool : undefined;
  })();
  const timedOut = result.modulesTotal - result.modulesRan;
  const gated = result.summary.toLowerCase().includes("advanced") || result.moduleResults.length < 14;
  const modules = useMemo(() => {
    const filtered =
      activeTab === "All"
        ? result.moduleResults
        : result.moduleResults.filter((module) => moduleCategory(module) === activeTab);

    return [...filtered].sort(sortModules);
  }, [activeTab, result.moduleResults]);

  const durationLabel = result.durationMs >= 1000
    ? `${(result.durationMs / 1000).toFixed(1)}s`
    : `${result.durationMs}ms`;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <NewScanBar />
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#06140B", border: "1px solid #164A2A", padding: "8px 14px", fontSize: 11, flexWrap: "wrap" }}>
        <span style={{ color: "#5E7D6A" }}>
          {result.modulesRan}/{result.modulesTotal} checks · {durationLabel} · {result.confidence} confidence
        </span>
        <button
          onClick={onRescan}
          disabled={rescanning}
          style={{ marginLeft: "auto", background: "transparent", border: "1px solid #164A2A", color: rescanning ? "#FFB020" : "#00C805", fontSize: 11, padding: "5px 12px", cursor: rescanning ? "wait" : "pointer", borderRadius: 3 }}
        >
          {rescanning ? "Rescanning…" : "Rescan"}
        </button>
        <button
          onClick={() => addToQuiver(result.tokenAddress)}
          style={{ background: "transparent", border: "1px solid #164A2A", color: isInQuiver ? "#FFB020" : "#E6FBEA", fontSize: 11, padding: "5px 12px", cursor: "pointer", borderRadius: 3 }}
        >
          {isInQuiver ? "✓ In quiver" : "+ Add to quiver"}
        </button>
      </div>

      {timedOut > 0 && (
        <div style={{ background: "#3a2a08", border: "1px solid #FFB020", padding: "10px 14px", fontSize: 12, color: "#FFB020" }}>
          Partial analysis. {timedOut} check{timedOut === 1 ? "" : "s"} timed out, so the score can shift after a clean rescan.
        </div>
      )}

      {gated && (
        <div style={{ background: "#06140B", border: "1px solid #D4A937", padding: "10px 14px", fontSize: 12, color: "#D4A937" }}>
          Some advanced launch/funding checks are hidden on this tier. Use a Pro or Team key for the full evidence set.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 10 }}>
        <Panel style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
          {(result.tokenSymbol || result.tokenName) && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
              {result.tokenSymbol && (
                <span style={{ fontSize: 22, fontWeight: 700, color: "#D4A937", letterSpacing: "-0.01em" }}>
                  ${result.tokenSymbol}
                </span>
              )}
              {result.tokenName && (
                <span style={{ fontSize: 14, color: "#8FB39D" }}>{result.tokenName}</span>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: band.bg, letterSpacing: "-0.02em" }}>{result.score}</div>
              <div style={{ fontSize: 10, color: "#5E7D6A", marginTop: 4 }}>risk score / 100</div>
            </div>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: band.bg,
                  color: band.fg,
                }}
              >
                {formatBand(result.band)}
              </span>
              <div style={{ height: 3, background: "#11331F", marginTop: 12, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(result.score, 100)}%`, height: 3, background: band.bg }} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, lineHeight: "20px", color: "#B7D9C2" }}>{result.summary}</div>

          {(result.priceUsd != null || result.marketCapUsd != null || result.liquidityUsd != null || result.liquidityEth != null) && (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", borderTop: "1px solid #11331F", paddingTop: 12 }}>
              {result.priceUsd != null && (
                <div>
                  <div style={{ fontSize: 10, color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.06em" }}>price</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E6FBEA", marginTop: 3 }}>{formatUsd(result.priceUsd)}</div>
                </div>
              )}
              {result.marketCapUsd != null && (
                <div>
                  <div style={{ fontSize: 10, color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.06em" }}>market cap</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#D4A937", marginTop: 3 }}>{formatUsd(result.marketCapUsd)}</div>
                </div>
              )}
              {result.liquidityUsd != null ? (
                <div>
                  <div style={{ fontSize: 10, color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.06em" }}>liquidity</div>
                  <LiquidityValue text={formatUsd(result.liquidityUsd)} pool={poolAddress} />
                </div>
              ) : result.liquidityEth != null ? (
                <div>
                  <div style={{ fontSize: 10, color: "#5E7D6A", textTransform: "uppercase", letterSpacing: "0.06em" }}>liquidity</div>
                  <LiquidityValue text={`Ξ ${result.liquidityEth.toFixed(2)}`} pool={poolAddress} />
                </div>
              ) : null}
            </div>
          )}

          <AddressCopy address={result.tokenAddress} />
        </Panel>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: 8 }}>
          {[
            { label: "flags", value: result.moduleResults.filter((module) => module.status === "fail").length, color: "#FF3B30" },
            { label: "watch", value: result.moduleResults.filter((module) => module.status === "warn").length, color: "#FFB020" },
            { label: "passed", value: result.moduleResults.filter((module) => module.status === "pass").length, color: "#00C805" },
            { label: "skipped", value: result.moduleResults.filter((module) => module.status === "timeout").length, color: "#7FA68A" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "#06140B", border: "1px solid #164A2A", padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ color: stat.color, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: "#5E7D6A", fontSize: 11, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {MODULE_TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: active ? "#0D2A19" : "transparent",
                border: `1px solid ${active ? "#1F5A34" : "#164A2A"}`,
                color: active ? "#00C805" : "#7FA68A",
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                borderRadius: 999,
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
      {modules.map((module) => {
          const meta = STATUS_META[module.status];
          return (
          <section
            key={module.module}
            style={{
              background: "#06140B",
              border: "1px solid #164A2A",
              borderLeft: `2px solid ${meta.accent}`,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: meta.fg,
                      background: meta.bg,
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#E6FBEA" }}>{module.label}</span>
                  <span style={{ color: "#3F5A49", fontSize: 11, marginLeft: "auto" }}>
                    {humanizeModuleName(module.module)}
                  </span>
                </div>
                <p style={{ margin: "9px 0 0", color: "#8FB39D", lineHeight: "21px", fontSize: 13 }}>{module.detail}</p>
                <EvidenceBlock evidence={module.evidence} />
              </div>
              <div style={{ textAlign: "right", minWidth: 64 }}>
                <div style={{ color: meta.accent, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{module.score}</div>
                <div style={{ color: "#3F5A49", fontSize: 10, marginTop: 5, letterSpacing: "0.04em" }}>
                  weight {module.weight}
                </div>
              </div>
            </div>
          </section>
          );
        })}
        {modules.length === 0 && (
          <Panel>
            <div style={{ color: "#7FA68A", fontSize: 13 }}>No checks in this category for this scan. Switch back to All.</div>
          </Panel>
        )}
      </div>
    </div>
  );
}

export default function ScanPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;
  const validAddress = Boolean(address && isAddress(address));
  const scan = useTokenScan(address);
  const recordScan = useScanHistoryStore((state) => state.record);

  useEffect(() => {
    if (!scan.data) return;

    recordScan({
      address: scan.data.tokenAddress,
      score: scan.data.score,
      band: scan.data.band,
      scannedAt: scan.data.timestamp,
    });
  }, [recordScan, scan.data]);

  if (!address || !validAddress) {
    return (
      <EmptyState
        title="Invalid token address"
        message="Paste a full EVM token address into the command bar. Short demo addresses and tickers stay in the hideout until the real search index is wired."
      />
    );
  }

  if (scan.isLoading || scan.isFetching) {
    return <LoadingState address={address} />;
  }

  if (scan.isError) {
    const error = scan.error instanceof ApiClientError ? scan.error : null;

    return (
      <div style={{ display: "grid", gap: 1 }}>
      <NewScanBar />
      <Panel style={{ maxWidth: 820, margin: "24px auto" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF3B30", marginBottom: 10 }}>
          scan failed
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>{error?.message || "The backend could not complete this scan."}</h1>
        <p style={{ margin: "0 0 18px", color: "#7FA68A", lineHeight: "22px" }}>
          {error ? `Backend returned ${error.status} (${error.code}).` : "Check that the API, Redis, PostgreSQL, and RPC endpoint are running."}
        </p>
        {error?.status === 429 && (
          <p style={{ margin: "0 0 18px", color: "#FFB020", lineHeight: "22px" }}>
            This session hit its scan quota or per-minute limit. Wait for the window to reset or use a higher-tier API key.
          </p>
        )}
        {error?.status === 401 && (
          <p style={{ margin: "0 0 18px", color: "#FFB020", lineHeight: "22px" }}>
            The backend requires authentication. Verify your wallet or provide a valid API key.
          </p>
        )}
        <button
          onClick={() => scan.refetch()}
          style={{ background: "#D4A937", border: "none", color: "#0A1F12", fontSize: 12, fontWeight: 700, padding: "10px 16px", cursor: "pointer" }}
        >
          retry scan
        </button>
      </Panel>
      </div>
    );
  }

  if (!scan.data) {
    return <EmptyState title="No scan data returned" message="The API completed without returning a scan payload. That response shape needs backend attention." />;
  }

  return (
    <ScanResultView
      result={scan.data}
      onRescan={() => scan.rescan.mutate()}
      rescanning={scan.rescan.isPending}
    />
  );
}
