"use client";

import { useAccount } from "wagmi";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";
import { useSession } from "@/lib/queries";
import { useScanHistoryStore } from "@/stores/scan-history";
import { useQuiverStore } from "@/stores/quiver";
import { useSessionStore } from "@/stores/session";

export default function AccountPage() {
  const { address, isConnected, chain } = useAccount();
  const session = useSession();
  const scanHistory = useScanHistoryStore((state) => state.items);
  const clearHistory = useScanHistoryStore((state) => state.clear);
  const quiver = useQuiverStore((state) => state.addresses);
  const apiKey = useSessionStore((state) => state.apiKey);
  const verifiedWallet = useSessionStore((state) => state.walletAddress);
  const walletVerifiedAt = useSessionStore((state) => state.walletVerifiedAt);
  const localTier = useSessionStore((state) => state.tier);
  const clearApiKey = useSessionStore((state) => state.clearApiKey);
  const backendUser = session.data?.user;
  const backendSession = session.data?.session;
  const tier = backendSession?.tier ?? backendUser?.tier ?? localTier ?? "guest";

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
          { label: "session", value: backendSession ? "active" : "none", color: backendSession ? "#00C805" : "#D4A937" },
          { label: "tier", value: tier, color: tier === "free" || tier === "guest" ? "#D4A937" : "#00C805" },
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
            backend session
          </div>
          {session.isLoading && <InfoLine label="status" value="checking signed cookie..." />}
          {session.isError && (
            <div style={{ color: "#FFB020", fontSize: 12, lineHeight: "19px", marginBottom: 10 }}>
              No active backend session. Verify your wallet to create a signed API cookie.
            </div>
          )}
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <InfoLine label="user id" value={backendSession?.userId ?? backendUser?.id ?? "not signed in"} />
            <InfoLine label="wallet" value={backendSession?.walletAddress ?? backendUser?.walletAddress ?? address ?? "not connected"} />
            <InfoLine label="tier" value={tier} />
            <InfoLine label="scopes" value={backendSession?.scopes?.join(", ") || "none"} />
            <InfoLine label="expires" value={backendSession?.exp ? new Date(backendSession.exp * 1000).toLocaleString() : "no cookie"} />
          </div>
        </div>

        <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
          <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            local browser state
          </div>
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            <InfoLine label="network" value={chain?.name || "not selected"} />
            <InfoLine label="wallet proof" value={walletVerifiedAt ? new Date(walletVerifiedAt).toLocaleString() : "not signed"} />
            <InfoLine label="verified wallet" value={verifiedWallet ?? "none"} />
            <InfoLine label="stored api key" value={apiKey ? "present" : "none"} />
            <InfoLine label="quiver" value={String(quiver.length)} />
          </div>
          {apiKey && (
            <button onClick={clearApiKey} style={{ marginTop: 16, background: "transparent", border: "1px solid #164A2A", color: "#FFB020", padding: "8px 12px", cursor: "pointer" }}>
              clear local api key
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
        <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
          scan history
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {scanHistory.slice(0, 8).map((item) => (
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
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: "#7FA68A" }}>{label}</span>
      <span style={{ overflowWrap: "anywhere", textAlign: "right" }}>{value}</span>
    </div>
  );
}
