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

const STATUS_COLOR: Record<ModuleStatus, string> = {
  pass: "#00C805",
  warn: "#FFB020",
  fail: "#FF3B30",
  timeout: "#7FA68A",
  error: "#FF3B30",
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBand(band: ScanResult["band"]) {
  return band.replace("_", " ");
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
  const entries = Object.entries(evidence || {});

  if (entries.length === 0) {
    return <div style={{ color: "#496552", fontSize: 12 }}>no structured evidence returned</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, fontSize: 12 }}>
          <span style={{ color: "#496552" }}>{key}</span>
          <span style={{ color: "#E6FBEA", overflowWrap: "anywhere" }}>
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
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

function ScanResultView({ result, onRescan }: { result: ScanResult; onRescan: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof MODULE_TABS)[number]>("All");
  const addToQuiver = useQuiverStore((state) => state.add);
  const isInQuiver = useQuiverStore((state) => state.has(result.tokenAddress));
  const band = scoreToBand(result.score);
  const timedOut = result.modulesTotal - result.modulesRan;
  const gated = result.summary.toLowerCase().includes("advanced") || result.moduleResults.length < 14;
  const modules = useMemo(() => {
    const filtered =
      activeTab === "All"
        ? result.moduleResults
        : result.moduleResults.filter((module) => moduleCategory(module) === activeTab);

    return [...filtered].sort(sortModules);
  }, [activeTab, result.moduleResults]);

  return (
    <div style={{ display: "grid", gap: 1 }}>
      <NewScanBar />
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#06140B", border: "1px solid #164A2A", padding: "8px 14px", fontSize: 11, flexWrap: "wrap" }}>
        <span style={{ color: "#496552" }}>scan.log</span>
        <span style={{ color: "#7FA68A" }}>
          {result.modulesRan}/{result.modulesTotal} modules · {result.durationMs}ms · confidence {result.confidence}
        </span>
        <button
          onClick={onRescan}
          style={{ marginLeft: "auto", background: "transparent", border: "1px solid #164A2A", color: "#00C805", fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
        >
          run again
        </button>
        <button
          onClick={() => addToQuiver(result.tokenAddress)}
          style={{ background: "transparent", border: "1px solid #164A2A", color: isInQuiver ? "#FFB020" : "#E6FBEA", fontSize: 11, padding: "5px 10px", cursor: "pointer" }}
        >
          {isInQuiver ? "in quiver" : "add quiver"}
        </button>
      </div>

      {timedOut > 0 && (
        <div style={{ background: "#3a2a08", border: "1px solid #FFB020", padding: "10px 14px", fontSize: 12, color: "#FFB020" }}>
          Partial analysis. {timedOut} module{timedOut === 1 ? "" : "s"} timed out, so the score can shift after a clean retry.
        </div>
      )}

      {gated && (
        <div style={{ background: "#06140B", border: "1px solid #D4A937", padding: "10px 14px", fontSize: 12, color: "#D4A937" }}>
          Module-gated result. Advanced launch/funding modules are hidden for this session tier; use a Pro or Team key/session for the full evidence set.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) 1fr", gap: 1 }}>
        <Panel style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ minWidth: 96 }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: band.bg, lineHeight: 1 }}>{result.score}</div>
            <div style={{ height: 4, background: "#164A2A", marginTop: 12 }}>
              <div style={{ width: `${Math.min(result.score, 100)}%`, height: 4, background: band.bg }} />
            </div>
            <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 6 }}>risk score / 100</div>
          </div>
          <div>
            {(result.tokenSymbol || result.tokenName) && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {result.tokenSymbol && (
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#D4A937" }}>${result.tokenSymbol}</span>
                )}
                {result.tokenName && (
                  <span style={{ fontSize: 14, color: "#E6FBEA" }}>{result.tokenName}</span>
                )}
              </div>
            )}
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "4px 9px", background: band.bg, color: band.fg, marginBottom: 10 }}>
              {formatBand(result.band)}
            </span>
            <div style={{ fontSize: 13, lineHeight: "20px", color: "#E6FBEA" }}>{result.summary}</div>
            <div style={{ fontSize: 11, color: "#496552", marginTop: 8 }}>{formatAddress(result.tokenAddress)}</div>
          </div>
        </Panel>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 1, background: "#164A2A", border: "1px solid #164A2A" }}>
          {[
            { label: "critical", value: result.moduleResults.filter((module) => module.status === "fail").length, color: "#FF3B30" },
            { label: "warnings", value: result.moduleResults.filter((module) => module.status === "warn").length, color: "#FFB020" },
            { label: "passed", value: result.moduleResults.filter((module) => module.status === "pass").length, color: "#00C805" },
            { label: "timeouts", value: result.moduleResults.filter((module) => module.status === "timeout").length, color: "#7FA68A" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "#06140B", padding: 18 }}>
              <div style={{ color: stat.color, fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
              <div style={{ color: "#7FA68A", fontSize: 11, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", marginTop: 14 }}>
        {MODULE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? "#0D2A19" : "#06140B",
              border: "1px solid #164A2A",
              color: activeTab === tab ? "#00C805" : "#7FA68A",
              padding: "9px 13px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 1 }}>
      {modules.map((module) => (
          <Panel key={module.module}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: STATUS_COLOR[module.status], fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    {module.status}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{module.label}</span>
                  <span style={{ color: "#496552", fontSize: 11 }}>{module.module}</span>
                </div>
                <p style={{ margin: "8px 0 0", color: "#7FA68A", lineHeight: "20px", fontSize: 13 }}>{module.detail}</p>
                <EvidenceBlock evidence={module.evidence} />
              </div>
              <div style={{ textAlign: "right", minWidth: 92 }}>
                <div style={{ color: STATUS_COLOR[module.status], fontSize: 22, fontWeight: 700 }}>{module.score}</div>
                <div style={{ color: "#496552", fontSize: 10 }}>weight {module.weight}</div>
                <div style={{ color: "#496552", fontSize: 10 }}>{module.durationMs}ms</div>
              </div>
            </div>
          </Panel>
        ))}
        {modules.length === 0 && (
          <Panel>
            <div style={{ color: "#7FA68A", fontSize: 13 }}>No modules returned for this filter. Switch back to All or retry the scan.</div>
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

  return <ScanResultView result={scan.data} onRescan={() => scan.refetch()} />;
}
