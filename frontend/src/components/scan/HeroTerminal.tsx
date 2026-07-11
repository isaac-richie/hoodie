"use client";

import { useEffect, useRef, useState } from "react";
import { BlinkCursor } from "@/components/ui/BlinkCursor";
import { tagColor, SCAN_LOG_LINES } from "@/lib/mock-data";
import { BinRain } from "@/components/ui/BinRain";

const LOG_LINES = [
  { m: "dispatch", tag: "  ..", msg: "scouting sherwood · 15 modules" },
  { m: "honeypot_sim", tag: "[ OK ]", msg: "sell executed · 4.1% tax" },
  { m: "hidden_mint", tag: "[ OK ]", msg: "none found" },
  { m: "bundles", tag: "[FAIL]", msg: "22% of supply · one funder" },
  { m: "deployer_rep", tag: "[FAIL]", msg: "3 confirmed rugs of 11" },
  { m: "holders", tag: "[WARN]", msg: "top10 52% sybil adjusted" },
  { m: "lp_lock", tag: "[WARN]", msg: "unlocked · owner is deployer" },
  { m: "verdict", tag: " ❯❯", msg: "score 66 · high risk" },
];

export function HeroTerminal() {
  const [cmd, setCmd] = useState("");
  const [log, setLog] = useState<typeof LOG_LINES>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<"ready" | "running" | "verdict">("ready");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = () => {
    if (running) return;
    if (timer.current) clearInterval(timer.current);
    setLog([]);
    setDone(false);
    setRunning(true);
    setStatus("running");
    setCmd("scan 0x8f3c…a2e1");
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setLog(LOG_LINES.slice(0, i));
      if (i >= LOG_LINES.length) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
        setDone(true);
        setStatus("verdict");
      }
    }, 200);
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const statusColor = status === "running" ? "#FFB020" : "#00C805";
  const statusLabel = status === "running" ? "running" : status === "verdict" ? "verdict in" : "ready";

  return (
    <div
      style={{
        position: "relative",
        background: "#06140B",
        border: "1px solid #164A2A",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {/* header bar */}
      <div
        style={{
          padding: "9px 14px",
          borderBottom: "1px solid #164A2A",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11,
        }}
      >
        <span style={{ color: "#496552" }}>┌ hood terminal · live demo</span>
        <span style={{ marginLeft: "auto", color: statusColor }}>● {statusLabel}</span>
      </div>
      {/* terminal body */}
      <div style={{ padding: "14px 16px", minHeight: 264, display: "flex", flexDirection: "column", fontSize: 12, lineHeight: "21px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: "#D4A937", fontWeight: 700 }}>❯</span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runScan()}
            placeholder="scan a token. type anything, hit enter."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#E6FBEA",
              fontSize: 13,
              padding: "4px 0",
            }}
          />
          <BlinkCursor />
        </div>
        {log.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "#7FA68A", width: 120, flex: "none" }}>{l.m}</span>
            <span style={{ color: tagColor(l.tag), width: 56, flex: "none" }}>{l.tag}</span>
            <span style={{ color: "#E6FBEA", minWidth: 0 }}>{l.msg}</span>
          </div>
        ))}
        {done && (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #164A2A",
              background: "#0A1F12",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: "#FF3B30", lineHeight: 1 }}>66</span>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 3,
                  background: "#FF3B30",
                  color: "#0A1F12",
                }}
              >
                High risk
              </span>
              <div style={{ fontSize: 11, color: "#7FA68A", marginTop: 5 }}>
                Deployer has three confirmed rugs. Top ten holds 52 percent.
              </div>
            </div>
            <a href="/signin" style={{ fontSize: 11, color: "#00C805", whiteSpace: "nowrap" }}>
              full scan ❯
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScanTerminal({ address }: { address: string }) {
  const [log, setLog] = useState<typeof SCAN_LOG_LINES>([]);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setLog(SCAN_LOG_LINES.slice(0, i));
      if (i >= SCAN_LOG_LINES.length) {
        if (timer.current) clearInterval(timer.current);
        setTimeout(() => setDone(true), 400);
      }
    }, 160);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  return (
    <div
      style={{
        background: "#06140B",
        border: "1px solid #164A2A",
        minHeight: 440,
        padding: "16px 18px",
        fontSize: 12,
        lineHeight: "22px",
        position: "relative",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <BinRain />
      <div className="scan-sweep" />
      <div style={{ color: "#7FA68A", marginBottom: 10 }}>
        <span style={{ color: "#D4A937", fontWeight: 700 }}>❯</span>{" "}
        scan {address}
      </div>
      {log.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 14 }}>
          <span style={{ color: "#7FA68A", width: 128, flex: "none" }}>{l.m}</span>
          <span style={{ color: tagColor(l.tag), width: 58, flex: "none" }}>{l.tag}</span>
          <span style={{ color: "#E6FBEA", minWidth: 0 }}>{l.msg}</span>
        </div>
      ))}
      {!done && (
        <div style={{ marginTop: 8, paddingLeft: 0 }}>
          <BlinkCursor w={8} h={14} />
        </div>
      )}
    </div>
  );
}
