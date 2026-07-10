"use client";

import { useAccount } from "wagmi";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";
import { useScanHistoryStore } from "@/stores/scan-history";
import { useQuiverStore } from "@/stores/quiver";
import { useSessionStore } from "@/stores/session";

export default function AccountPage() {
  const { address, isConnected, chain } = useAccount();
  const scanHistory = useScanHistoryStore((state) => state.items);
  const clearHistory = useScanHistoryStore((state) => state.clear);
  const quiver = useQuiverStore((state) => state.addresses);
  const apiKey = useSessionStore((state) => state.apiKey);
  const verifiedWallet = useSessionStore((state) => state.walletAddress);
  const walletVerifiedAt = useSessionStore((state) => state.walletVerifiedAt);
  const clearApiKey = useSessionStore((state) => state.clearApiKey);

  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px", display: "grid", gap: 1 }}>
      <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          account
        </div>
        <h1 style={{ fontSize: 28, margin: "0 0 14px", color: "#E6FBEA" }}>Operator profile</h1>
        <HoodWalletButton size="full" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 1, background: "#164A2A", border: "1px solid #164A2A" }}>
        {[
          { label: "wallet", value: isConnected ? "connected" : "offline", color: isConnected ? "#00C805" : "#FFB020" },
          { label: "proof", value: verifiedWallet ? "verified" : "unsigned", color: verifiedWallet ? "#00C805" : "#D4A937" },
          { label: "network", value: chain?.name || "not selected", color: "#E6FBEA" },
          { label: "scans", value: scanHistory.length, color: "#E6FBEA" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#06140B", padding: 18 }}>
            <div style={{ color: stat.color, fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
            <div style={{ color: "#7FA68A", fontSize: 11, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
          <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            session
          </div>
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#7FA68A" }}>wallet</span>
              <span style={{ overflowWrap: "anywhere" }}>{address || "not connected"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#7FA68A" }}>stored api key</span>
              <span>{apiKey ? "present" : "none"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#7FA68A" }}>wallet proof</span>
              <span>{walletVerifiedAt ? new Date(walletVerifiedAt).toLocaleString() : "not signed"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ color: "#7FA68A" }}>quiver</span>
              <span>{quiver.length}</span>
            </div>
          </div>
          {apiKey && (
            <button onClick={clearApiKey} style={{ marginTop: 16, background: "transparent", border: "1px solid #164A2A", color: "#FFB020", padding: "8px 12px", cursor: "pointer" }}>
              clear local api key
            </button>
          )}
        </div>

        <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
          <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            scan history
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {scanHistory.slice(0, 5).map((item) => (
              <div key={`${item.address}-${item.scannedAt}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: "#00C805" }}>{item.address.slice(0, 6)}...{item.address.slice(-4)}</span>
                <span>{item.score} · {item.band}</span>
              </div>
            ))}
            {scanHistory.length === 0 && <span style={{ color: "#496552", fontSize: 12 }}>No scans recorded in this browser yet.</span>}
          </div>
          {scanHistory.length > 0 && (
            <button onClick={clearHistory} style={{ marginTop: 16, background: "transparent", border: "1px solid #164A2A", color: "#FFB020", padding: "8px 12px", cursor: "pointer" }}>
              clear history
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
