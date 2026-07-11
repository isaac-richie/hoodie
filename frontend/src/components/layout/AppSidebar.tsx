"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";

const WATCH_NAV = [
  { href: "/hideout", label: "Hideout", sub: "Home base", key: "H" },
  { href: "/quiver", label: "Quiver", sub: "Your watchlist", key: "Q" },
  { href: "/pulse", label: "Bounty Board", sub: "Discover", key: "B" },
  { href: "/heist", label: "The Heist", sub: "Multi-token ops", key: "X" },
  { href: "/warrants", label: "Warrants", sub: "Alerts & tracking", key: "W" },
];

const INTEL_NAV = [
  { href: "/deployers", label: "Deployers", sub: "Rap sheets", key: "D" },
  { href: "/field-notes", label: "Field Notes", sub: "Intel docs", key: "F" },
  { href: "/patterns", label: "Patterns", sub: "Scam templates", key: "P" },
];

const SYS_NAV = [
  { href: "/account", label: "Account" },
  { href: "/api-keys", label: "API keys" },
  { href: "/", label: "← Marketing site" },
];

declare global {
  interface Window {
    __toggleSidebar?: () => void;
    __closeSidebar?: () => void;
  }
}

function NavItem({ href, label, sub, k, active, onNav }: { href: string; label: string; sub: string; k: string; active: boolean; onNav?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNav}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 4,
        fontSize: 13,
        color: active ? "var(--text)" : "var(--muted)",
        background: active ? "var(--surface-dark)" : "transparent",
        textDecoration: "none",
        justifyContent: "space-between",
        transition: "all 0.2s ease",
        borderLeft: active ? "2px solid var(--green)" : "2px solid transparent",
        boxShadow: active ? "0 0 12px var(--green-glow)" : "none",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ lineHeight: "15px" }}>{label}</span>
        <span style={{ fontSize: 9, color: "var(--dim)", lineHeight: "11px" }}>{sub}</span>
      </span>
      <span style={{ fontSize: 10, color: "var(--dim)" }}>{k}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    window.__toggleSidebar = () => setSidebarOpen((value) => !value);
    window.__closeSidebar = () => setSidebarOpen(false);
    return () => {
      delete window.__toggleSidebar;
      delete window.__closeSidebar;
    };
  }, []);

  const closeSidebar = () => setSidebarOpen(false);
  const goHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    closeSidebar();
    window.location.assign("/");
  };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <nav
        className={`app-sidebar sidebar-glass${sidebarOpen ? " open" : ""}`}
        style={{
          width: 204,
          flexShrink: 0,
          borderRight: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <Link
          href="/"
          onClick={goHome}
          aria-label="Go to Hood Terminal home page"
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--glass-border)",
            display: "flex",
            alignItems: "baseline",
            gap: 7,
            color: "inherit",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <span
            className="text-glow-green"
            style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 21, color: "var(--text)" }}
          >
            Hood
          </span>
          <span
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", color: "var(--green)" }}
          >
            TERMINAL
          </span>
        </Link>

        {/* nav items */}
        <div style={{ padding: "14px 10px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#496552",
              padding: "4px 10px 6px",
            }}
          >
            watch
          </div>
          {WATCH_NAV.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              label={n.label}
              sub={n.sub}
              k={n.key}
              active={pathname === n.href}
              onNav={closeSidebar}
            />
          ))}

          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#496552",
              padding: "14px 10px 6px",
            }}
          >
            intel
          </div>
          {INTEL_NAV.map((n) => (
            <NavItem
              key={n.href}
              href={n.href}
              label={n.label}
              sub={n.sub}
              k={n.key}
              active={pathname === n.href}
              onNav={closeSidebar}
            />
          ))}

          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#496552",
              padding: "14px 10px 6px",
            }}
          >
            crew
          </div>
          <NavItem href="/crew" label="Merry Men" sub="Community" k="M" active={pathname === "/crew"} onNav={closeSidebar} />
        </div>

        {/* bottom */}
        <div
          style={{
            marginTop: "auto",
            padding: 10,
            borderTop: "1px solid #164A2A",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {SYS_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={closeSidebar}
              style={{
                padding: "7px 10px",
                fontSize: 12,
                color: "#7FA68A",
                borderRadius: 3,
                textDecoration: "none",
              }}
            >
              {n.label}
            </Link>
          ))}
          <div style={{ padding: "10px 10px", fontSize: 10, color: "#496552", lineHeight: "16px" }}>
            <HoodWalletButton size="full" />
          </div>
        </div>
      </nav>
    </>
  );
}
