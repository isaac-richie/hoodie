"use client";

import { useState } from "react";
import Link from "next/link";
import { HoodWalletButton } from "@/components/wallet/HoodWalletButton";

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="nav-glass"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      <div
        className="marketing-nav-inner"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "baseline", gap: 8, color: "var(--text)" }}
        >
          <span
            className="text-glow-green"
            style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 26, color: "var(--text)" }}
          >
            Hood
          </span>
          <span
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: "var(--green)" }}
          >
            TERMINAL
          </span>
        </Link>

        <nav className="marketing-nav-links" style={{ display: "flex", gap: 6, fontSize: 13, marginLeft: 12 }}>
          {[
            { href: "/#what-it-sees", label: "what it sees" },
            { href: "/#discover", label: "sample scan" },
            { href: "/blog", label: "field notes" },
            { href: "/hideout", label: "api" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-pill"
              style={{
                color: "var(--muted)",
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid rgba(22, 74, 42, 0.4)",
                background: "rgba(6, 20, 11, 0.5)",
                transition: "all 0.25s ease",
                display: "inline-flex",
                alignItems: "center",
                fontSize: 12,
                letterSpacing: "0.02em",
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="marketing-nav-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <HoodWalletButton showVerify={false} />
          <Link
            href="/hideout"
            className="cta-gold"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--bg)",
              padding: "9px 18px",
              borderRadius: 4,
              display: "inline-block",
            }}
          >
            ❯ Enter the Hideout
          </Link>
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid var(--border)",
            padding: "6px 8px",
            borderRadius: 3,
            cursor: "pointer",
            color: "var(--text)",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span style={{ height: 2, width: 18, background: "var(--text)", transition: "all 0.2s" }} />
          <span style={{ height: 2, width: 18, background: "var(--text)", transition: "all 0.2s" }} />
          <span style={{ height: 2, width: 18, background: "var(--text)", transition: "all 0.2s" }} />
        </button>
      </div>

      {open && (
        <div className="mobile-menu" style={{ background: "var(--bg)", padding: "0 32px 16px" }}>
          <Link
            href="/#what-it-sees"
            onClick={() => setOpen(false)}
            style={{ display: "block", padding: "14px 8px", fontSize: 15, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
          >
            what it sees
          </Link>
          <Link
            href="/#discover"
            onClick={() => setOpen(false)}
            style={{ display: "block", padding: "14px 8px", fontSize: 15, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
          >
            sample scan
          </Link>
          <Link
            href="/blog"
            onClick={() => setOpen(false)}
            style={{ display: "block", padding: "14px 8px", fontSize: 15, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
          >
            field notes
          </Link>
          <Link
            href="/hideout"
            onClick={() => setOpen(false)}
            style={{ display: "block", padding: "14px 8px", fontSize: 15, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
          >
            api
          </Link>
          <div style={{ marginTop: 12 }}>
            <HoodWalletButton size="full" showVerify={false} onConnectedAction={() => setOpen(false)} />
          </div>
          <Link
            href="/hideout"
            className="cta-gold mobile-cta"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              marginTop: 8,
              textAlign: "center",
              padding: 12,
              borderRadius: 4,
              color: "var(--bg)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Enter the Hideout
          </Link>
        </div>
      )}
    </header>
  );
}
