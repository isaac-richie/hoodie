"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { BlinkCursor } from "@/components/ui/BlinkCursor";

const GHOSTS: Record<string, string> = {
  s: "can 0x…",
  sc: "an 0x…",
  w: "atch",
  h: "eist",
  p: "ulse",
  q: "uiver",
};

export function CommandBar() {
  const [cmd, setCmd] = useState("");
  const router = useRouter();

  const ghost = cmd.length > 0 ? GHOSTS[cmd.toLowerCase()] || "" : "";

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && ghost) {
      e.preventDefault();
      setCmd(cmd + ghost);
      return;
    }
    if (e.key === "Enter" && cmd.trim()) {
      const lower = cmd.trim().toLowerCase();
      if (lower.startsWith("scan ") || lower.startsWith("0x")) {
        const addr = lower.startsWith("scan ") ? lower.slice(5).trim() : lower;
        router.push(isAddress(addr) ? `/scan/${addr}` : "/hideout");
      } else if (lower === "pulse" || lower === "bounty") {
        router.push("/pulse");
      } else if (lower === "quiver" || lower === "watch") {
        router.push("/quiver");
      } else if (lower === "heist") {
        router.push("/heist");
      } else if (lower === "hideout" || lower === "home") {
        router.push("/hideout");
      } else {
        router.push(isAddress(cmd.trim()) ? `/scan/${cmd.trim()}` : "/hideout");
      }
      setCmd("");
    }
  };

  return (
    <div
      className="command-bar nav-glass"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid var(--glass-border)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
        height: 52,
      }}
    >
      <span className="text-glow-gold" style={{ color: "var(--gold)", fontSize: 16, fontWeight: 700 }}>❯</span>
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            fontSize: 13,
            pointerEvents: "none",
            whiteSpace: "pre",
            overflow: "hidden",
          }}
        >
          <span style={{ color: "transparent" }}>{cmd}</span>
          <span style={{ color: "var(--dim)" }}>{ghost}</span>
        </div>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={handleKey}
          placeholder="scan 0x… · watch · heist · pulse · help. tab completes, up recalls."
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 13,
            padding: "8px 0",
          }}
        />
      </div>
      <BlinkCursor />
      <button
        className="friar-btn cta-outline"
        style={{
          background: "transparent",
          color: "var(--gold)",
          fontSize: 11,
          padding: "7px 12px",
          borderRadius: 4,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        ✒ Friar Tuck <span style={{ color: "var(--dim)" }}>· Assistant</span>
      </button>
      <span
        className="rank-badge glow-green"
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "5px 10px",
          borderRadius: 4,
          border: "1px solid var(--green)",
          color: "var(--green)",
          whiteSpace: "nowrap",
        }}
      >
        Merry Men
      </span>
    </div>
  );
}
