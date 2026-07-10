"use client";

import { useAccount } from "wagmi";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";

const REQUIRE_WALLET = process.env.NEXT_PUBLIC_REQUIRE_WALLET === "true";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  if (!REQUIRE_WALLET || isConnected) return <>{children}</>;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0A1F12" }}>
      <section style={{ width: "100%", maxWidth: 520, border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          access check
        </div>
        <h1 style={{ margin: "0 0 10px", color: "#E6FBEA", fontSize: 28 }}>Connect wallet</h1>
        <p style={{ margin: "0 0 18px", color: "#7FA68A", lineHeight: "22px" }}>
          This environment requires a connected wallet before entering the terminal.
        </p>
        <HoodWalletButton size="full" />
        {(isConnecting || isReconnecting) && (
          <div style={{ marginTop: 14, color: "#FFB020", fontSize: 12 }}>checking wallet session...</div>
        )}
      </section>
    </main>
  );
}
