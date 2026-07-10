import Link from "next/link";

export default function PublicTokenPage() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 32px 96px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#7FA68A",
          }}
        >
          public scan result · shareable
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#496552" }}>scanned 2m ago</span>
      </div>
      <div
        style={{
          background: "#0D2A19",
          border: "1px solid #164A2A",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "20px 26px",
            borderBottom: "1px solid #164A2A",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700 }}>$SHRF</span>
          <span style={{ fontSize: 13, color: "#7FA68A" }}>Sheriffcoin · 0x8f3c…a2e1</span>
          <Link
            href="/signin"
            style={{
              marginLeft: "auto",
              fontSize: 12,
              fontWeight: 700,
              color: "#0A1F12",
              background: "#D4A937",
              padding: "8px 14px",
              borderRadius: 3,
            }}
          >
            ❯ Run your own scan
          </Link>
        </div>
        {/* verdict */}
        <div
          style={{
            padding: 26,
            display: "flex",
            gap: 28,
            alignItems: "center",
            borderBottom: "1px solid #164A2A",
          }}
        >
          <div
            style={{
              textAlign: "center",
              minWidth: 120,
              border: "1px solid #164A2A",
              borderRadius: 4,
              padding: "18px 14px",
              background: "#06140B",
            }}
          >
            <div style={{ fontSize: 52, fontWeight: 700, color: "#FF3B30", lineHeight: 1 }}>66</div>
            <div
              style={{
                height: 4,
                background: "#164A2A",
                borderRadius: 2,
                margin: "12px 0 6px",
                overflow: "hidden",
              }}
            >
              <div style={{ width: "66%", height: 4, background: "#FF3B30" }} />
            </div>
            <div style={{ fontSize: 10, color: "#7FA68A" }}>rug score / 100</div>
          </div>
          <div>
            <div
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 3,
                background: "#FF3B30",
                color: "#0A1F12",
                marginBottom: 10,
              }}
            >
              High risk
            </div>
            <div style={{ fontSize: 15, lineHeight: "23px", maxWidth: 440 }}>
              Deployer has three confirmed rugs. Top ten holds 52 percent sybil adjusted. LP is
              unlocked.
            </div>
            <div style={{ fontSize: 11, color: "#496552", marginTop: 8 }}>
              confidence: high · 31/31 modules · not financial advice. DYOR.
            </div>
          </div>
        </div>
        {/* stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 1,
            background: "#164A2A",
            borderBottom: "1px solid #164A2A",
          }}
        >
          {[
            { v: "$98k", l: "liquidity", c: "#E6FBEA" },
            { v: "1,942", l: "holders", c: "#E6FBEA" },
            { v: "52%", l: "top 10, sybil adj", c: "#FF3B30" },
            { v: "unlocked", l: "LP status", c: "#FFB020" },
            { v: "$1.4M", l: "market cap", c: "#E6FBEA" },
            { v: "7h", l: "age", c: "#E6FBEA" },
          ].map((s) => (
            <div key={s.l} style={{ background: "#0D2A19", padding: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* evidence rows */}
        <div style={{ padding: "16px 26px", display: "flex", flexDirection: "column" }}>
          {[
            { l: "honeypot simulation", v: "✓ sell executed · 4.1% tax", c: "#00C805" },
            { l: "deployer reputation", v: "✕ 3 confirmed rugs · view rap sheet", c: "#FF3B30", href: "/deployer/0x3d71" },
            { l: "bundles at launch", v: "✕ 22% of supply, single funder", c: "#FF3B30" },
            { l: "socials", v: "! x only, 2 days old", c: "#FFB020" },
          ].map((r, i, arr) => (
            <div
              key={r.l}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: i < arr.length - 1 ? "1px solid #164A2A" : "none",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#7FA68A" }}>{r.l}</span>
              {r.href ? (
                <a href={r.href} style={{ color: r.c }}>{r.v}</a>
              ) : (
                <span style={{ color: r.c }}>{r.v}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#7FA68A" }}>
        Full evidence, holder graphs, and money flow live in the terminal.{" "}
        <Link href="/signin">Enter the Hideout ❯</Link>
      </div>
    </div>
  );
}
