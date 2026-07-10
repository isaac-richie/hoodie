"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { useWalletRap } from "@/lib/queries";

export default function PublicWalletPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;
  const validAddress = Boolean(address && isAddress(address));
  const walletQuery = useWalletRap(validAddress ? address : undefined);
  const wallet = walletQuery.data?.wallet;
  const labels = wallet?.labels ?? [];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 32px 96px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 12 }}>
        public wallet rap sheet
      </div>
      <div style={{ background: "#0D2A19", border: "1px solid #164A2A", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "20px 26px", borderBottom: "1px solid #164A2A", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{validAddress ? shortAddress(address) : "invalid wallet"}</span>
          {labels.length > 0 ? labels.map((label) => (
            <Badge key={label} label={label} tone={labelTone(label)} />
          )) : <Badge label={wallet ? "observed" : "no persisted flags"} tone="#7FA68A" />}
        </div>

        {!validAddress && <StateBlock title="Invalid wallet address" message="Paste a full EVM wallet address to view a rap sheet." tone="#FF3B30" />}
        {validAddress && walletQuery.isLoading && <StateBlock title="Checking the sheet" message="Looking for persisted wallet intelligence." />}
        {validAddress && walletQuery.isError && <StateBlock title="Wallet lookup failed" message="The backend wallet endpoint did not respond cleanly." tone="#FFB020" />}
        {validAddress && !walletQuery.isLoading && !walletQuery.isError && !wallet && (
          <StateBlock
            title="No rap sheet yet"
            message="This wallet has no persisted labels or incident history. Unknown is not clean; it means the indexer has not built a record yet."
          />
        )}

        {wallet && (
          <>
            <div style={{ padding: "8px 26px 4px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 0", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#496552", borderBottom: "1px solid #164A2A" }}>
                <span>signal</span>
                <span>value</span>
              </div>
              {[
                ["repeat offender", wallet.isRepeatOffender ? "yes" : "no"],
                ["confirmed rugs", String(wallet.confirmedRugs ?? 0)],
                ["tokens appeared in", String(wallet.tokensAppearedIn ?? 0)],
                ["realized pnl 30d", wallet.realizedPnl30d === null || wallet.realizedPnl30d === undefined ? "unknown" : String(wallet.realizedPnl30d)],
                ["win rate 30d", wallet.winRate30d === null || wallet.winRate30d === undefined ? "unknown" : `${Math.round(wallet.winRate30d * 100)}%`],
                ["first seen", wallet.firstSeen ? new Date(wallet.firstSeen).toLocaleString() : "unknown"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "11px 0", fontSize: 12, borderBottom: "1px solid #164A2A", alignItems: "center" }}>
                  <span style={{ color: "#7FA68A" }}>{label}</span>
                  <span style={{ color: valueColor(label, value), overflowWrap: "anywhere" }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 26px", background: "#06140B", borderTop: "1px solid #164A2A", fontSize: 12, color: "#7FA68A", lineHeight: "19px" }}>
              Labels: {labels.length ? labels.join(", ") : "none"}. Last updated: {wallet.updatedAt ? new Date(wallet.updatedAt).toLocaleString() : "unknown"}.
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#7FA68A" }}>
        Track this wallet live. <Link href="/signin">Enter the Hideout ❯</Link>
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 3, background: "transparent", border: `1px solid ${tone}`, color: tone }}>
      {label}
    </span>
  );
}

function StateBlock({ title, message, tone = "#7FA68A" }: { title: string; message: string; tone?: string }) {
  return (
    <div style={{ padding: "26px", background: "#06140B" }}>
      <div style={{ color: tone, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "#7FA68A", fontSize: 12, lineHeight: "19px" }}>{message}</div>
    </div>
  );
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function labelTone(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("rug") || lower.includes("offender")) return "#FF3B30";
  if (lower.includes("sniper") || lower.includes("insider")) return "#FFB020";
  return "#00C805";
}

function valueColor(label: string, value: string): string {
  if (label === "confirmed rugs" && Number(value) > 0) return "#FF3B30";
  if (label === "repeat offender" && value === "yes") return "#FF3B30";
  if (value === "unknown") return "#496552";
  return "#E6FBEA";
}
