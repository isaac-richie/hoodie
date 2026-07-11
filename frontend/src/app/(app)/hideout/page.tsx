"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { EllipsisRings } from "@/components/ui/EllipsisRings";
import { useQuiverStore } from "@/stores/quiver";
import { useScanHistoryStore } from "@/stores/scan-history";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function HideoutPage() {
  const [cmd, setCmd] = useState("");
  const router = useRouter();
  const quiver = useQuiverStore((state) => state.addresses);
  const history = useScanHistoryStore((state) => state.items);

  const runCmd = () => {
    const value = cmd.trim();
    if (value) {
      router.push(`/scan/${value}`);
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
          Your home base. Your saved marks, your recent scans, and a scan line ready when you are.
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
              placeholder="paste a token address"
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
        {/* left col — your quiver */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
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

            {quiver.length === 0 ? (
              <div style={{ padding: "22px 16px", color: "#7FA68A", fontSize: 13, lineHeight: "20px" }}>
                No marks yet. Scan a token and hit{" "}
                <span style={{ color: "#D4A937" }}>add quiver</span> to keep an eye on it — it&apos;ll
                show up here.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 2fr",
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
                  <span>address</span>
                </div>
                {quiver.slice(0, 8).map((addr) => (
                  <Link
                    key={addr}
                    href={`/scan/${addr}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 2fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "11px 16px",
                      borderBottom: "1px solid #164A2A",
                      fontSize: 12,
                      color: "#E6FBEA",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{shortAddress(addr)}</span>
                    <span style={{ color: "#496552", fontSize: 11, overflowWrap: "anywhere" }}>{addr}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* right col — recent scans */}
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
            Recent scans
          </div>

          {history.length === 0 ? (
            <div style={{ padding: "22px 16px", color: "#7FA68A", fontSize: 13, lineHeight: "20px" }}>
              Nothing scanned yet. Your recent scans will appear here.
            </div>
          ) : (
            history.slice(0, 6).map((item) => (
              <Link
                key={item.address}
                href={`/scan/${item.address}`}
                style={{
                  background: "#06140B",
                  padding: "10px 14px",
                  borderBottom: "1px solid #164A2A",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <ScoreBadge score={item.score} />
                <span style={{ fontWeight: 700, color: "#E6FBEA" }}>{shortAddress(item.address)}</span>
                <span style={{ marginLeft: "auto", color: "#496552", fontSize: 10 }}>
                  {timeAgo(item.scannedAt)}
                </span>
              </Link>
            ))
          )}

          <div style={{ padding: "12px 16px", marginTop: "auto" }}>
            <Link
              href="/warrants"
              style={{
                display: "block",
                textAlign: "center",
                background: "transparent",
                border: "1px solid #164A2A",
                color: "#00C805",
                fontSize: 12,
                padding: 9,
                borderRadius: 3,
              }}
            >
              ＋ Set an alert
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
