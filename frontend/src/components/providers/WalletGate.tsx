"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";
import { useSession } from "@/lib/queries";
import { useSessionStore } from "@/stores/session";

const REQUIRE_WALLET = process.env.NEXT_PUBLIC_REQUIRE_WALLET !== "false";

// Scanning and intel are open to everyone — asking for a wallet just to run a
// scan reads as a phishing pattern and turns visitors away. Only account-bound
// features (saved marks, alerts, multi-token ops, keys) need a wallet session.
const GATED_PREFIXES = ["/quiver", "/warrants", "/heist", "/account", "/api-keys"];

const GATED_FEATURE_COPY: Record<string, string> = {
  "/quiver": "Your quiver marks are saved to your wallet.",
  "/warrants": "Warrants fire alerts tied to your account.",
  "/heist": "Heist runs multi-token ops under your account.",
  "/account": "Account settings are bound to your wallet.",
  "/api-keys": "API keys are issued to your wallet identity.",
};

export function WalletGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const session = useSession(isConnected);
  const clearWalletSession = useSessionStore((state) => state.clearWalletSession);
  const activeWallet = address?.toLowerCase();
  const sessionWallet = session.data?.session.walletAddress?.toLowerCase();
  const hasBackendSession = Boolean(session.data?.session && activeWallet && sessionWallet === activeWallet);

  useEffect(() => {
    if (session.isError) clearWalletSession();
  }, [clearWalletSession, session.isError]);

  const gatedPrefix = GATED_PREFIXES.find((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`));

  if (!REQUIRE_WALLET || !gatedPrefix || hasBackendSession) return <>{children}</>;

  const featureLine = GATED_FEATURE_COPY[gatedPrefix] ?? "This feature is bound to your wallet.";
  const title = !isConnected ? "Connect wallet" : "Verify wallet";
  const message = !isConnected
    ? `${featureLine} Connect to continue — scanning stays free without one.`
    : "Sign the Hood Terminal message to create your backend session. This proves wallet ownership without approvals or gas.";

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 520, border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          account-bound feature
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
