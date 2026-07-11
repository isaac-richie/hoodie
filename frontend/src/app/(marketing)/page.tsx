import Link from "next/link";
import { HeroTerminal } from "@/components/scan/HeroTerminal";
import { TokenTable } from "@/components/scan/TokenTable";
import { EllipsisRings } from "@/components/ui/EllipsisRings";
import { BlinkCursor } from "@/components/ui/BlinkCursor";
import { BinRain } from "@/components/ui/BinRain";

const CAP_SECURITY = ["honeypot simulation", "hidden mint", "mutable taxes", "blacklist + pause", "upgradeable proxy", "ownership"];
const CAP_HOLDERS = ["distribution", "sheriff watch whales", "fresh wallets", "insider network graph", "cross funding", "sybil bands", "holder overlap"];
const CAP_LAUNCH = ["launchpad lifecycle", "snipers", "bundles", "historical bundles", "funding origin"];
const CAP_MOAT = ["deployer reputation", "wallet rap sheet", "signal fusion", "rug receipts"];
const CAP_DISCOVERY = ["pulse board", "pre scored launches", "graduation tracking"];

function Cap({ label }: { label: string }) {
  return (
    <span
      className="tag-pill"
      style={{
        fontSize: 11,
        color: "var(--text)",
        border: "1px solid var(--border)",
        padding: "5px 9px",
        borderRadius: 4,
        background: "var(--surface)",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </span>
  );
}

const TICKER = [
  { t: "$CURFEW", s: "rugged. caught 6h 12m before." },
  { t: "$TITHE", s: "LP pulled. flagged at score 88." },
  { t: "$GALLOWS", s: "honeypot. blocked 2,140 scans." },
  { t: "$FROSTY", s: "rugged. deployer had 4 priors." },
  { t: "$PILGRIM", s: "dev dumped. arrow struck first." },
  { t: "$TOLLGATE", s: "proxy upgraded. marked extreme." },
];

const CLIFF_BARS = Array.from({ length: 20 }, (_, i) => ({
  h: i < 10 ? Math.round(20 + i * 7) : Math.round(90 - (i - 10) * 9),
  c: i < 14 ? "#2B7A3D" : "#FF3B30",
}));

export default function MarketingHome() {
  const tickers = [...TICKER, ...TICKER];

  return (
    <>
      {/* ticker */}
      <div style={{ borderBottom: "1px solid #164A2A", background: "#06140B", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            width: "max-content",
            animation: "tick 36s linear infinite",
          }}
        >
          {tickers.map((tk, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 26px",
                fontSize: 11,
                whiteSpace: "nowrap",
                borderRight: "1px solid #164A2A",
              }}
            >
              <span style={{ color: "#FF3B30" }}>●</span>
              <span style={{ color: "#E6FBEA" }}>{tk.t}</span>
              <span style={{ color: "#7FA68A" }}>{tk.s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* hero */}
      <div
        className="section-gradient-glow"
        style={{
          position: "relative",
          borderBottom: "1px solid var(--border)",
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        <BinRain />
        <div className="scan-sweep" />
        <div
          style={{
            position: "absolute",
            right: -180,
            top: -260,
            pointerEvents: "none",
          }}
        >
          <EllipsisRings cx={450} cy={450} radii={[90, 160, 235, 315, 400, 440]} ratioY={0.78} />
        </div>
        <div
          className="hero-section section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "84px 32px 80px",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <h1
            className="hero-heading"
            style={{
              margin: "0 0 40px",
              fontWeight: 700,
              fontSize: 44,
              lineHeight: "54px",
              color: "#E6FBEA",
              maxWidth: 880,
            }}
          >
            Onchain token risk intelligence for{" "}
            <span className="text-glow-green" style={{ color: "var(--green)" }}>Robinhood Chain</span>
          </h1>
          <div style={{ position: "relative", width: "100%", maxWidth: 680, textAlign: "left" }}>
            <HeroTerminal />
          </div>
          <p
            className="hero-subtext"
            style={{
              fontSize: 16,
              lineHeight: "24px",
              color: "#7FA68A",
              maxWidth: 560,
              margin: "32px 0 30px",
              fontFamily: "var(--font-inter), Inter, sans-serif",
            }}
          >
            Scan any Robinhood Chain token and see if it will rob you, and how. Thirty one
            modules, one verdict, every piece of evidence on the table.
          </p>
          <Link
            href="/hideout"
            className="cta-gold"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--bg)",
              padding: "14px 28px",
              borderRadius: 5,
              display: "inline-block",
            }}
          >
            ❯ Enter the Hideout
          </Link>
        </div>
      </div>

      {/* discover preview */}
      <div id="discover" style={{ borderBottom: "1px solid #164A2A" }}>
        <div className="section-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "72px 32px" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "#7FA68A",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            discover · every launch, pre scored
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#06140B",
                border: "1px solid #164A2A",
                borderRadius: 3,
                padding: "0 14px",
              }}
            >
              <span style={{ color: "#D4A937", fontWeight: 700 }}>❯</span>
              <input
                placeholder="paste a Robinhood Chain token address"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#E6FBEA",
                  fontSize: 13,
                  padding: "13px 0",
                }}
              />
            </div>
            <Link
              href="/hideout"
              className="cta-gold"
              style={{
                display: "flex",
                alignItems: "center",
                color: "var(--bg)",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 700,
                padding: "0 22px",
              }}
            >
              ❯ Scan
            </Link>
          </div>
          <div className="token-table-scroll">
            <TokenTable />
          </div>
        </div>
      </div>

      {/* stats bar */}
      <div style={{ borderBottom: "1px solid #164A2A", background: "#06140B" }}>
        <div
          className="stats-grid section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "52px 32px",
            display: "grid",
            gridTemplateColumns: "3fr 2.6fr 2.4fr 2.8fr",
            gap: 1,
            background: "#164A2A",
            border: "1px solid #164A2A",
          }}
        >
          {[
            { n: "---", l: "tokens scouted", c: "#E6FBEA" },
            { n: "---", l: "rugs caught before collapse", c: "#00C805" },
            { n: "---", l: "wallets tracked", c: "#E6FBEA" },
            { n: "---", l: "deployers on the rap sheet", c: "#FF3B30" },
          ].map((s) => (
            <div key={s.l} style={{ background: "#06140B", padding: "26px" }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: s.c }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 6 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* what it sees */}
      <div id="what-it-sees" style={{ borderBottom: "1px solid #164A2A" }}>
        <div className="section-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "88px 32px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 34 }}>
            <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 34 }}>ii.</span>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              What it sees
            </h2>
            <span style={{ fontSize: 13, color: "#7FA68A", marginLeft: "auto" }}>
              15 modules run on every scan
            </span>
          </div>
          <div
            className="capabilities-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gridAutoRows: 132,
              gap: 14,
            }}
          >
            {/* Contract security — 3x2 */}
            <div
              className="card-hover surface-gradient"
              style={{
                gridColumn: "span 3",
                gridRow: "span 2",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 26,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                Contract security
              </div>
              <div style={{ fontSize: 13, color: "#7FA68A", marginBottom: 18 }}>
                Read the trap before you step in it.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                {CAP_SECURITY.map((c) => <Cap key={c} label={c} />)}
              </div>
            </div>
            {/* Holder forensics — 3x2 */}
            <div
              className="card-hover surface-gradient"
              style={{
                gridColumn: "span 3",
                gridRow: "span 2",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 26,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                Holder forensics
              </div>
              <div style={{ fontSize: 13, color: "#7FA68A", marginBottom: 18 }}>
                Count the hands on the bag, and who funds them.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                {CAP_HOLDERS.map((c) => <Cap key={c} label={c} />)}
              </div>
            </div>
            {/* Launch forensics — 2x2 */}
            <div
              className="card-hover"
              style={{
                gridColumn: "span 2",
                gridRow: "span 2",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 26,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                Launch forensics
              </div>
              <div style={{ fontSize: 13, color: "#7FA68A", marginBottom: 18 }}>
                Who sniped, who bundled, who paid for it.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                {CAP_LAUNCH.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontSize: 11,
                      color: "#E6FBEA",
                      border: "1px solid #164A2A",
                      padding: "5px 9px",
                      borderRadius: 3,
                      background: "#0A1F12",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {/* The moat — 4x1 */}
            <div
              className="cap-wide"
              style={{
                gridColumn: "span 4",
                gridRow: "span 1",
                background: "#0D2A19",
                border: "1px solid #164A2A",
                borderRadius: 8,
                padding: "22px 26px",
                display: "flex",
                alignItems: "center",
                gap: 26,
              }}
            >
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>The moat</div>
                <div style={{ fontSize: 13, color: "#7FA68A" }}>
                  Memory the lords cannot buy.
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CAP_MOAT.map((c) => <Cap key={c} label={c} />)}
              </div>
            </div>
            {/* Discovery — 4x1 */}
            <div
              className="cap-wide"
              style={{
                gridColumn: "span 4",
                gridRow: "span 1",
                background: "#0D2A19",
                border: "1px solid #164A2A",
                borderRadius: 8,
                padding: "22px 26px",
                display: "flex",
                alignItems: "center",
                gap: 26,
              }}
            >
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>Discovery</div>
                <div style={{ fontSize: 13, color: "#7FA68A" }}>
                  Every fresh track, already scored.
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CAP_DISCOVERY.map((c) => <Cap key={c} label={c} />)}
              </div>
            </div>
            {/* Quote cell — 2x1 */}
            <div
              style={{
                gridColumn: "span 2",
                gridRow: "span 1",
                background: "#0A1F12",
                border: "1px solid #164A2A",
                borderRadius: 8,
                padding: "22px 26px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 13, color: "#7FA68A", lineHeight: "20px" }}>
                Every module returns raw evidence. No black boxes, no vibes.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* how it works */}
      <div style={{ borderBottom: "1px solid #164A2A" }}>
        <div
          className="how-it-works section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "88px 32px",
            display: "grid",
            gridTemplateColumns: "6fr 5fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 34 }}>
              <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 34 }}>
                iii.
              </span>
              <h2 style={{ margin: 0, fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
                How it works
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                {
                  n: "❯ 1",
                  title: "Paste a contract.",
                  body: "Any Robinhood Chain token address, from anywhere in the product.",
                },
                {
                  n: "❯ 2",
                  title: "Thirty one modules run at once.",
                  body: "Contract, holders, launch, liquidity, creator, funding. Under two seconds.",
                },
                {
                  n: "❯ 3",
                  title: "Get a verdict from 0 to 100.",
                  body: "With every piece of evidence shown. Challenge any line of it.",
                },
              ].map((s, i, arr) => (
                <div
                  key={s.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    gap: 18,
                    padding: "20px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid #164A2A" : "none",
                  }}
                >
                  <div style={{ color: "#D4A937", fontSize: 18, fontWeight: 700 }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: "22px",
                        color: "#7FA68A",
                        fontFamily: "var(--font-inter), Inter, sans-serif",
                      }}
                    >
                      {s.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* sample result card */}
          <div
            className="card-hover"
            style={{
              background: "var(--surface-dark)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid #164A2A",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 11,
                color: "#7FA68A",
              }}
            >
              <span style={{ color: "#D4A937" }}>❯</span> scan $SHRF · sheriffcoin · 7h old
            </div>
            <div
              style={{
                padding: "22px 18px",
                display: "flex",
                gap: 20,
                alignItems: "center",
                borderBottom: "1px solid #164A2A",
              }}
            >
              <div style={{ textAlign: "center", minWidth: 96 }}>
                <div style={{ fontSize: 44, fontWeight: 700, color: "#FF3B30", lineHeight: 1 }}>
                  66
                </div>
                <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 4 }}>rug score</div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 3,
                    background: "#FF3B30",
                    color: "#0A1F12",
                    marginBottom: 8,
                  }}
                >
                  High risk
                </div>
                <div style={{ fontSize: 13, lineHeight: "19px", color: "#E6FBEA" }}>
                  Deployer has three confirmed rugs. Top ten holds 52 percent sybil adjusted.
                </div>
                <div style={{ fontSize: 11, color: "#496552", marginTop: 6 }}>
                  confidence: high · 15/15 modules reported
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
                background: "#164A2A",
              }}
            >
              {[
                { l: "honeypot sim", v: "✓ sell ok", c: "#00C805" },
                { l: "deployer", v: "✕ 3 rugs", c: "#FF3B30" },
                { l: "bundles", v: "✕ 22%", c: "#FF3B30" },
                { l: "LP status", v: "! unlocked", c: "#FFB020" },
              ].map((r) => (
                <div
                  key={r.l}
                  style={{
                    background: "#0D2A19",
                    padding: "10px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#7FA68A" }}>{r.l}</span>
                  <span style={{ color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div
              style={{ padding: "10px 18px", fontSize: 10, color: "#496552", borderTop: "1px solid #164A2A" }}
            >
              Not financial advice. DYOR.
            </div>
          </div>
        </div>
      </div>

      {/* pulse preview */}
      <div style={{ borderBottom: "1px solid #164A2A", background: "#06140B" }}>
        <div className="section-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "88px 32px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 34 }}>iv.</span>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              The Pulse board
            </h2>
            <BlinkCursor w={8} h={14} />
          </div>
          <p
            style={{
              margin: "0 0 30px 52px",
              fontSize: 14,
              color: "#7FA68A",
              fontFamily: "var(--font-inter), Inter, sans-serif",
              maxWidth: 560,
            }}
          >
            Every new launch on Robinhood Chain, scored before you ever click it. Known scam
            templates are demoted on sight.
          </p>
          <div className="pulse-preview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              {
                label: "new · minutes old",
                items: [
                  { t: "$MARIAN", age: "4m", score: 18, hp: "clear", dep: "clean 6/6", bu: "4%", fr: "12%", top: "19%", lp: "locked", soc: "x + tg" },
                  { t: "$GALLOWS", age: "11m", score: 83, hp: "trap", dep: "2 rugs", bu: "31%", fr: "58%", top: "64%", lp: "unlocked", soc: "none" },
                  { t: "$TITHE", age: "26m", score: 47, hp: "clear", dep: "unknown", bu: "12%", fr: "29%", top: "38%", lp: "locked 7d", soc: "tg only" },
                ],
              },
              {
                label: "graduating · on the curve",
                items: [
                  { t: "$NOCK", age: "3h", score: 12, hp: "clear", dep: "clean 9/9", bu: "2%", fr: "8%", top: "14%", lp: "burned", soc: "x + tg + site" },
                  { t: "$SCARLET", age: "5h", score: 31, hp: "clear", dep: "1 dead", bu: "9%", fr: "17%", top: "26%", lp: "locked 30d", soc: "x + tg" },
                  { t: "$SHRF", age: "7h", score: 66, hp: "clear", dep: "3 rugs", bu: "22%", fr: "41%", top: "52%", lp: "unlocked", soc: "x only" },
                ],
              },
              {
                label: "graduated · full pool",
                items: [
                  { t: "$OUTLAWX", age: "3d", score: 9, hp: "clear", dep: "clean 12/12", bu: "1%", fr: "4%", top: "11%", lp: "burned", soc: "x + tg + site" },
                  { t: "$FLETCH", age: "6d", score: 28, hp: "clear", dep: "unknown", bu: "6%", fr: "11%", top: "23%", lp: "locked 90d", soc: "x + tg" },
                  { t: "$CURFEW", age: "9d", score: 96, hp: "trap", dep: "4 rugs", bu: "38%", fr: "61%", top: "71%", lp: "pulled", soc: "deleted" },
                ],
              },
            ].map((col) => {
              return (
                <div key={col.label}>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#7FA68A",
                      padding: "0 2px 10px",
                    }}
                  >
                    {col.label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.items.map((p) => {
                      const band = p.score >= 75 ? { l: "Extreme", bg: "#8B1E1A", fg: "#E6FBEA" } : p.score >= 50 ? { l: "High", bg: "#FF3B30", fg: "#0A1F12" } : p.score >= 25 ? { l: "Some risk", bg: "#FFB020", fg: "#0A1F12" } : { l: "Low", bg: "#00C805", fg: "#0A1F12" };
                      return (
                        <div
                          key={p.t}
                          className="card-hover"
                          style={{
                            background: "var(--surface-dark)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{p.t}</span>
                            <span style={{ fontSize: 11, color: "#7FA68A" }}>{p.age}</span>
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 3,
                                background: band.bg,
                                color: band.fg,
                              }}
                            >
                              {p.score} · {band.l}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              fontSize: 10,
                              color: "#7FA68A",
                            }}
                          >
                            <span>
                              hp:{" "}
                              <span
                                style={{ color: p.hp === "clear" ? "#00C805" : "#FF3B30" }}
                              >
                                {p.hp}
                              </span>
                            </span>
                            <span>dep: {p.dep}</span>
                            <span>bundle {p.bu}</span>
                            <span>fresh {p.fr}</span>
                            <span>top10 {p.top}</span>
                            <span>lp: {p.lp}</span>
                            <span>{p.soc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* rug receipts */}
      <div style={{ borderBottom: "1px solid #164A2A", position: "relative", overflow: "hidden" }}>
        <div
          style={{ position: "absolute", left: -220, bottom: -300, pointerEvents: "none", opacity: 0.5 }}
        >
          <EllipsisRings cx={350} cy={350} radii={[80, 150, 225, 305]} ratioY={0.73} opacity={1} />
        </div>
        <div
          className="rug-receipts section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "88px 32px",
            display: "grid",
            gridTemplateColumns: "5fr 7fr",
            gap: 56,
            alignItems: "center",
            position: "relative",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#7FA68A",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              rug receipts
            </div>
            <h2 style={{ margin: "0 0 16px", fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              We keep the receipts. Every one.
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 15,
                lineHeight: "24px",
                color: "#7FA68A",
                fontFamily: "var(--font-inter), Inter, sans-serif",
                maxWidth: 420,
              }}
            >
              When a token collapses, HOOD publishes what it saw and when it saw it. The score at
              first scan. The hours of warning. The wallets already on the sheet.
            </p>
            <Link href="/signin" style={{ fontSize: 13, color: "#00C805" }}>
              Browse the gallery ❯
            </Link>
          </div>
          <div
            className="glow-red"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--red-bg)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 22px",
                borderBottom: "1px solid var(--red-bg)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "#FF3B30",
                  textTransform: "uppercase",
                }}
              >
                rugged
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>$CURFEW · Curfew Bell</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#7FA68A" }}>
                receipt #9314
              </span>
            </div>
            <div
              className="rug-receipt-stats"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 1,
                background: "#164A2A",
                borderBottom: "1px solid #164A2A",
              }}
            >
              {[
                { n: "88", l: "score at first scan", c: "#FF3B30" },
                { n: "6h 12m", l: "warning before collapse", c: "#E6FBEA" },
                { n: "61", l: "wallets already known", c: "#E6FBEA" },
              ].map((s) => (
                <div key={s.l} style={{ background: "#06140B", padding: "16px 22px" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.c }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
                {CLIFF_BARS.map((b, i) => (
                  <div key={i} style={{ width: 10, background: b.c, height: b.h }} />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "#496552",
                  marginTop: 8,
                }}
              >
                <span>first scan · flagged extreme</span>
                <span>LP pulled · minus 98 percent</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* surfaces + api */}
      <div style={{ borderBottom: "1px solid #164A2A" }}>
        <div
          className="surfaces-grid section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "88px 32px",
            display: "grid",
            gridTemplateColumns: "5fr 7fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#7FA68A",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              every surface
            </div>
            <h2 style={{ margin: "0 0 16px", fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              One subscription. Five roads in.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #164A2A" }}>
              {[
                { name: "Web terminal", desc: "the full instrument" },
                { name: "Telegram bot", desc: "scan from any chat" },
                { name: "Public API", desc: "build on the moat" },
                { name: "Chrome extension", desc: "verdicts on every dex page" },
                { name: "Mobile", desc: "arrows in your pocket" },
              ].map((s, i, arr) => (
                <div
                  key={s.name}
                  style={{
                    padding: "14px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid #164A2A" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                  }}
                >
                  <span>{s.name}</span>
                  <span style={{ color: "#7FA68A", fontSize: 12 }}>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#7FA68A",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              for builders
            </div>
            <h2 style={{ margin: "0 0 16px", fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              One call. Full verdict. Under two seconds.
            </h2>
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 14,
                lineHeight: "22px",
                color: "#7FA68A",
                fontFamily: "var(--font-inter), Inter, sans-serif",
              }}
            >
              A rug score and every signal behind it, plus webhooks for score changes and LP pulls.
            </p>
            <div
              style={{
                background: "#06140B",
                border: "1px solid #164A2A",
                borderRadius: 4,
                fontSize: 12,
                lineHeight: "20px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid #164A2A",
                  fontSize: 10,
                  color: "#496552",
                }}
              >
                POST /v1/analyze
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  overflow: "auto",
                  fontFamily: "var(--font-jetbrains), monospace",
                  color: "#E6FBEA",
                  fontSize: 12,
                }}
              >
                {`curl -X POST https://api.hood.sh/v1/analyze \\
  -H "Authorization: Bearer ht_live_4f2a…" \\
  -d '{"token": "0x8f3c…a2e1"}'

`}
                <span style={{ color: "#496552" }}>{"// 1.4s later"}</span>
                {`
{ "score": 66, "band": "high",
  "honeypot": false, "bundles": 0.22,
  "deployer": { "rugs": 3, "launches": 11 },
  "lp": { "locked": false } }`}
              </pre>
            </div>
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <Link href="/hideout" style={{ color: "#00C805" }}>
                Read the docs ❯
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* pricing */}
      <div style={{ borderBottom: "1px solid #164A2A", background: "#06140B" }}>
        <div className="section-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "88px 32px" }}>
          <div className="pricing-header" style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 34 }}>v.</span>
            <h2 style={{ margin: 0, fontSize: 28, lineHeight: "36px", fontWeight: 600 }}>
              Pick your rank
            </h2>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#D4A937" }}>
              Founding crew: Legend locked at $59 for life. 137 seats left.
            </span>
          </div>
          <div
            className="pricing-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1.15fr",
              gap: 14,
              margin: "30px 0 40px",
              alignItems: "stretch",
            }}
          >
            {[
              {
                name: "Outlaw",
                price: "$0",
                period: "forever",
                features: ["3 scans a day", "core security modules", "pulse board, delayed", "1 arrow"],
                cta: "Join the outlaws",
                border: "var(--border)",
                ctaClass: "cta-outline",
                ctaStyle: { color: "var(--text)", background: "transparent" },
              },
              {
                name: "Yeoman",
                price: "$15",
                period: "per month",
                features: ["unlimited scans", "holders + launch modules", "live pulse + filters", "10 arrows, telegram delivery"],
                cta: "Take the bow",
                border: "var(--border)",
                ctaClass: "cta-outline",
                ctaStyle: { color: "var(--text)", background: "transparent" },
              },
              {
                name: "Merry Men",
                price: "$39",
                period: "per month",
                features: ["everything in Yeoman", "sheriff watch + the heist", "100 arrows, webhooks", "saved presets + column alerts"],
                cta: "Join the crew",
                border: "var(--border-bright)",
                ctaClass: "cta-green",
                ctaStyle: { color: "var(--bg)", fontWeight: 700 },
              },
            ].map((t) => (
              <div
                key={t.name}
                className="card-hover"
                style={{
                  background: "var(--surface-dark)",
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 26, fontWeight: 700, margin: "10px 0 2px" }}>{t.price}</div>
                <div style={{ fontSize: 11, color: "#7FA68A", marginBottom: 16 }}>{t.period}</div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: "22px",
                    color: "#7FA68A",
                    borderTop: "1px solid #164A2A",
                    paddingTop: 14,
                  }}
                >
                  {t.features.map((f) => <div key={f}>{f}</div>)}
                </div>
                <Link
                  href="/hideout"
                  className={t.ctaClass}
                  style={{
                    marginTop: "auto",
                    textAlign: "center",
                    fontSize: 12,
                    padding: 9,
                    borderRadius: 4,
                    marginBlockStart: 18,
                    ...t.ctaStyle,
                  }}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
            {/* legend */}
            <div
              className="gradient-border glow-gold"
              style={{
                background: "var(--surface)",
                borderRadius: 8,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -1,
                  right: 16,
                  background: "#D4A937",
                  color: "#0A1F12",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "0 0 3px 3px",
                }}
              >
                the vault
              </div>
              <div className="text-glow-gold" style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, color: "var(--gold)" }}>
                Legend of Sherwood
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, margin: "10px 0 2px" }}>$99</div>
              <div style={{ fontSize: 11, color: "#7FA68A", marginBottom: 16 }}>
                per month · founding $59 for life
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: "22px",
                  color: "#7FA68A",
                  borderTop: "1px solid #164A2A",
                  paddingTop: 14,
                }}
              >
                <div>all deep modules: insiders, money flow</div>
                <div>time travel + magic nodes</div>
                <div>every surface, one seat</div>
                <div>unlimited arrows, priority lanes</div>
              </div>
              <Link
                href="/hideout"
                className="cta-gold"
                style={{
                  marginTop: "auto",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--bg)",
                  padding: 9,
                  borderRadius: 4,
                  marginBlockStart: 18,
                }}
              >
                Open the vault
              </Link>
            </div>
          </div>

          {/* API tiers */}
          <div style={{ border: "1px solid #164A2A", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                padding: "10px 18px",
                background: "#0A1F12",
                borderBottom: "1px solid #164A2A",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#7FA68A",
              }}
            >
              developer api tiers
            </div>
            <div
              className="api-tiers-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 1,
                background: "#164A2A",
              }}
            >
              {[
                { name: "Free", desc: "100 req/day\ncore endpoints" },
                { name: "Starter · $29", desc: "10k req/mo\n+ webhooks" },
                { name: "Pro · $149", desc: "100k req/mo\nall 21 endpoints" },
                { name: "Enterprise", desc: "custom limits\nSLA + dedicated lane" },
              ].map((t) => (
                <div key={t.name} style={{ background: "#0A1F12", padding: "16px 18px", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ color: "#7FA68A", lineHeight: "19px", whiteSpace: "pre-line" }}>
                    {t.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* community */}
      <div style={{ borderBottom: "1px solid #164A2A" }}>
        <div
          className="community-grid section-inner"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "88px 32px",
            display: "grid",
            gridTemplateColumns: "7fr 5fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#7FA68A",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              merry men
            </div>
            <h2
              className="community-heading"
              style={{
                margin: "0 0 16px",
                fontFamily: "var(--font-unifraktur), serif",
                fontSize: 44,
                lineHeight: "48px",
                fontWeight: 700,
              }}
            >
              Ride with the crew.
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                fontSize: 15,
                lineHeight: "24px",
                color: "#7FA68A",
                fontFamily: "var(--font-inter), Inter, sans-serif",
                maxWidth: 480,
              }}
            >
              A community that posts receipts, not rumors. Shared signals, verified calls, and a
              Telegram crew that catches what one pair of eyes misses.
            </p>
            <Link
              href="/hideout"
              className="cta-outline"
              style={{
                fontSize: 13,
                color: "var(--text)",
                background: "transparent",
                padding: "11px 18px",
                borderRadius: 4,
                display: "inline-block",
              }}
            >
              Join the Merry Men
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                user: "littlejohn.eth",
                time: "12m",
                msg: "$SCARLET deployer wallet just moved 40 SOL to a fresh address. Arrow loosed, receipts attached.",
                indent: false,
              },
              {
                user: "tuck_reads",
                time: "41m",
                msg: "Called $CURFEW at score 88, six hours before the pull. Screenshot in the room.",
                indent: true,
              },
            ].map((c) => (
              <div
                key={c.user}
                className="card-hover"
                style={{
                  background: "var(--surface-dark)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "14px 16px",
                  fontSize: 12,
                  marginLeft: c.indent ? 28 : 0,
                }}
              >
                <span style={{ color: "#00C805", fontWeight: 700 }}>{c.user}</span>{" "}
                <span style={{ color: "#496552" }}>· {c.time}</span>
                <div style={{ color: "#E6FBEA", marginTop: 6, lineHeight: "19px" }}>{c.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
