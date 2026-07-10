"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { EllipsisRings } from "@/components/ui/EllipsisRings";

const QUIVER_GLANCE = [
  { t: "$NIGHTJAR", px: "$0.0041", chg: "+22.4%", cc: "#00C805", score: 74, spark: "2,4 6,5 10,8 14,6 18,4 22,5 26,7 30,9 34,12 38,14 42,11 46,9 50,7 54,10 58,13 62,15", sparkCol: "#FF3B30", note: "deployer moved 12 SOL · 6h" },
  { t: "$NOCK", px: "$0.12", chg: "+12.4%", cc: "#00C805", score: 12, spark: "2,14 6,13 10,11 14,10 18,9 22,7 26,6 30,5 34,4 38,3 42,4 46,5 50,4 54,3 58,2 62,3", sparkCol: "#00C805", note: "" },
  { t: "$SCARLET", px: "$0.0083", chg: "+4.1%", cc: "#00C805", score: 31, spark: "2,9 6,8 10,10 14,9 18,8 22,7 26,8 30,9 34,10 38,8 42,7 46,6 50,8 54,9 58,7 62,6", sparkCol: "#FFB020", note: "" },
  { t: "$SHRF", px: "$0.0021", chg: "-18.2%", cc: "#FF3B30", score: 66, spark: "2,4 6,5 10,7 14,8 18,10 22,11 26,13 30,12 34,14 38,15 42,14 46,13 50,15 54,14 58,16 62,15", sparkCol: "#FF3B30", note: "LP still unlocked" },
  { t: "$OUTLAWX", px: "$0.48", chg: "+2.2%", cc: "#00C805", score: 9, spark: "2,9 6,8 10,9 14,9 18,8 22,9 26,9 30,8 34,9 38,8 42,9 46,8 50,9 54,8 58,9 62,8", sparkCol: "#00C805", note: "" },
];

const ALERTS = [
  { t: "$TITHE", msg: "LP pull detected. Score jumped to 88. Flagged extreme.", time: "14m", c: "#FF3B30" },
  { t: "$NIGHTJAR", msg: "Dev wallet sent 12 SOL to fresh address 0x91be…44aa.", time: "2h", c: "#FFB020" },
  { t: "$NOCK", msg: "Price crossed your $0.10 line. Currently $0.12.", time: "5h", c: "#00C805" },
];

export default function HideoutPage() {
  const [cmd, setCmd] = useState("");
  const router = useRouter();

  const runCmd = () => {
    if (cmd.trim()) {
      const addr = cmd.trim().startsWith("0x") ? cmd.trim() : cmd.trim();
      router.push(`/scan/${addr}`);
      setCmd("");
    }
  };

  return (
    <div>
      {/* title */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>The Hideout</span>
          <span
            style={{
              fontSize: 10,
              color: "#496552",
              border: "1px solid #164A2A",
              padding: "2px 8px",
              borderRadius: 3,
              letterSpacing: "0.06em",
            }}
          >
            Home
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Your home base. Live risk on your marks, alerts that fired, and a scan line ready when you
          are.
        </div>
      </div>

      {/* scan input */}
      <div
        style={{
          background: "#06140B",
          border: "1px solid #164A2A",
          padding: 22,
          marginBottom: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -120, top: -120, pointerEvents: "none" }}>
          <EllipsisRings cx={250} cy={200} radii={[70, 130, 190]} ratioY={0.75} opacity={0.5} />
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#7FA68A",
            marginBottom: 10,
            position: "relative",
          }}
        >
          run a scan
        </div>
        <div style={{ display: "flex", gap: 12, position: "relative" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#0A1F12",
              border: "1px solid #164A2A",
              borderRadius: 3,
              padding: "0 14px",
            }}
          >
            <span style={{ color: "#D4A937", fontWeight: 700 }}>❯</span>
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCmd()}
              placeholder="paste a token or wallet address"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#E6FBEA",
                fontSize: 14,
                padding: "13px 0",
              }}
            />
          </div>
          <button
            onClick={runCmd}
            style={{
              background: "#D4A937",
              color: "#0A1F12",
              border: "none",
              borderRadius: 3,
              fontSize: 13,
              fontWeight: 700,
              padding: "0 22px",
              cursor: "pointer",
            }}
          >
            ❯ Scan ⏎
          </button>
        </div>
      </div>

      {/* main grid */}
      <div
        className="hideout-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 1,
          alignItems: "stretch",
        }}
      >
        {/* left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          {/* quiver glance */}
          <div
            style={{
              background: "#0D2A19",
              border: "1px solid #164A2A",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#06140B",
                padding: "8px 14px",
                borderBottom: "1px solid #164A2A",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>The Quiver · your marks</span>
              <Link href="/quiver" style={{ fontSize: 11, color: "#7FA68A" }}>
                open the Quiver ❯
              </Link>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr .9fr 1.1fr 1.2fr 2fr",
                gap: 10,
                padding: "8px 16px",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#496552",
                borderBottom: "1px solid #164A2A",
              }}
            >
              <span>mark</span>
              <span>price</span>
              <span>7d · 24h</span>
              <span>risk</span>
              <span>what changed</span>
            </div>
            {QUIVER_GLANCE.map((q) => (
              <div
                key={q.t}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr .9fr 1.1fr 1.2fr 2fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: "1px solid #164A2A",
                  fontSize: 12,
                }}
              >
                <Link
                  href={`/scan/${q.t}`}
                  style={{ fontWeight: 700, color: "#E6FBEA" }}
                >
                  {q.t}
                </Link>
                <span style={{ color: "#7FA68A" }}>{q.px}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <svg width="50" height="15" viewBox="0 0 68 18" preserveAspectRatio="none" style={{ flexShrink: 0 }}>
                    <polyline points={q.spark} fill="none" stroke={q.sparkCol} strokeWidth="1.5" />
                  </svg>
                  <span style={{ color: q.cc }}>{q.chg}</span>
                </span>
                <span>
                  <ScoreBadge score={q.score} />
                </span>
                <span style={{ color: "#496552", fontSize: 11 }}>{q.note}</span>
              </div>
            ))}
          </div>

          {/* spoils PnL */}
          <div
            style={{
              background: "#0D2A19",
              border: "1px solid #164A2A",
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              Spoils <span style={{ fontSize: 10, color: "#496552", fontWeight: 400 }}>· Profit and Loss</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: 20,
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#00C805" }}>+$1,990</div>
                  <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>realized, 30d</div>
                </div>
                <div style={{ display: "flex", gap: 22 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>$12,410</div>
                    <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>bags at risk</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#FFB020" }}>1 mark</div>
                    <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>above high risk</div>
                  </div>
                </div>
              </div>
              <div>
                <svg width="100%" height="64" viewBox="0 0 200 30" preserveAspectRatio="none" style={{ display: "block" }}>
                  <line x1="0" x2="200" y1="18" y2="18" stroke="#164A2A" strokeWidth="1" strokeDasharray="2,3" />
                  <polyline points="0,20 15,19 30,22 45,18 60,16 75,14 90,12 105,14 120,10 135,8 150,6 165,9 180,7 195,5" fill="none" stroke="#00C805" strokeWidth="1.2" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#496552", marginTop: 4 }}>
                  <span>30d ago</span>
                  <span>today</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right col — alerts */}
        <div
          style={{
            background: "#0D2A19",
            border: "1px solid #164A2A",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: "#06140B",
              padding: "8px 14px",
              borderBottom: "1px solid #164A2A",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Alerts that fired
          </div>
          {ALERTS.map((a) => (
            <div
              key={a.t + a.time}
              style={{
                background: "#06140B",
                padding: "9px 14px",
                borderBottom: "1px solid #164A2A",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: a.c }}>➶</span>
                <Link
                  href={`/scan/${a.t}`}
                  style={{ fontWeight: 700, color: "#E6FBEA" }}
                >
                  {a.t}
                </Link>
                <span style={{ marginLeft: "auto", color: "#496552", fontSize: 10 }}>{a.time}</span>
              </div>
              <div style={{ color: "#7FA68A", lineHeight: "17px" }}>{a.msg}</div>
            </div>
          ))}
          <div style={{ padding: "12px 16px", marginTop: "auto" }}>
            <button
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #164A2A",
                color: "#00C805",
                fontSize: 12,
                padding: 9,
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              ＋ Set alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
