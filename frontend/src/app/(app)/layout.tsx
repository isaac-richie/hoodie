"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandBar } from "@/components/layout/CommandBar";
import { WalletGate } from "@/components/providers/WalletGate";

declare global {
  interface Window {
    __toggleSidebar?: () => void;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide the global command bar on pages that already have their own prominent
  // scan entry, so users never see two stacked search fields:
  //   /scan/*   — the inline "← Back / scan another address" bar
  //   /hideout  — the "run a scan" hero input
  const hideCommandBar = pathname?.startsWith("/scan/") || pathname === "/hideout";

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
            <Link
              href="/"
              style={{ display: "inline-flex", alignItems: "baseline", gap: 7, color: "inherit", textDecoration: "none" }}
            >
              <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 18, color: "#E6FBEA" }}>Hood</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", color: "#00C805" }}>TERMINAL</span>
            </Link>
          </div>
          {!hideCommandBar && <CommandBar />}
          <main style={{ flex: 1, padding: "14px 14px 56px", minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </WalletGate>
  );
}
