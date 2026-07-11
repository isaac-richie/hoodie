"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";
import { useSession } from "@/lib/queries";
import { useSessionStore } from "@/stores/session";

const REQUIRE_WALLET = process.env.NEXT_PUBLIC_REQUIRE_WALLET !== "false";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const session = useSession(isConnected);
  const clearWalletSession = useSessionStore((state) => state.clearWalletSession);
  const activeWallet = address?.toLowerCase();
  const sessionWallet = session.data?.session.walletAddress?.toLowerCase();
  const hasBackendSession = Boolean(session.data?.session && activeWallet && sessionWallet === activeWallet);

  useEffect(() => {
    if (session.isError) clearWalletSession();
  }, [clearWalletSession, session.isError]);

  if (!REQUIRE_WALLET || hasBackendSession) return <>{children}</>;

  const title = !isConnected ? "Connect wallet" : "Verify wallet";
  const message = !isConnected
    ? "Connect a wallet before entering Hood Terminal. Scans, watchlists, alerts, and keys are account-bound."
    : "Sign the Hood Terminal message to create your backend session. This proves wallet ownership without approvals or gas.";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0A1F12" }}>
      <section style={{ width: "100%", maxWidth: 520, border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          access check
        </div>
        <h1 style={{ margin: "0 0 10px", color: "#E6FBEA", fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "0 0 18px", color: "#7FA68A", lineHeight: "22px" }}>
          {message}
        </p>
        <HoodWalletButton size="full" />
        {(isConnecting || isReconnecting || session.isLoading) && (
          <div style={{ marginTop: 14, color: "#FFB020", fontSize: 12 }}>checking wallet session...</div>
        )}
        {isConnected && session.isError && (
          <div style={{ marginTop: 14, color: "#7FA68A", fontSize: 12, lineHeight: "18px" }}>
            Open the wallet menu and choose <span style={{ color: "#D4A937" }}>Verify wallet</span>.
          </div>
        )}
      </section>
    </main>
  );
}
