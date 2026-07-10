"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandBar } from "@/components/layout/CommandBar";
import { WalletGate } from "@/components/providers/WalletGate";

declare global {
  interface Window {
    __toggleSidebar?: () => void;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletGate>
      <div style={{ display: "flex", minHeight: "100vh", background: "#0A1F12", alignItems: "stretch" }}>
        <AppSidebar />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="mobile-topbar">
            <button
              onClick={() => window.__toggleSidebar?.()}
              style={{ background: "transparent", border: "1px solid #164A2A", padding: "5px 7px", borderRadius: 3, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}
            >
              <span style={{ display: "block", width: 16, height: 2, background: "#E6FBEA" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#E6FBEA" }} />
              <span style={{ display: "block", width: 16, height: 2, background: "#E6FBEA" }} />
            </button>
            <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 18, color: "#E6FBEA" }}>Hood</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", color: "#00C805" }}>TERMINAL</span>
          </div>
          <CommandBar />
          <main style={{ flex: 1, padding: "14px 14px 56px", minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </WalletGate>
  );
}
