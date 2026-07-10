import Link from "next/link";

export default function ArticlePage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 32px 96px" }}>
      <Link href="/blog" style={{ fontSize: 12, color: "#7FA68A" }}>
        ❮ field notes
      </Link>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#00C805",
          margin: "28px 0 14px",
        }}
      >
        security
      </div>
      <h1 style={{ margin: "0 0 14px", fontSize: 40, lineHeight: "48px", fontWeight: 700 }}>
        How bundles hide: reading a launch before the snipers sell
      </h1>
      <div
        style={{
          fontSize: 12,
          color: "#496552",
          marginBottom: 36,
          paddingBottom: 24,
          borderBottom: "1px solid #164A2A",
        }}
      >
        by the crew · jul 02, 2026 · 9 min read
      </div>
      <div
        style={{
          fontFamily: "var(--font-inter), Inter, sans-serif",
          fontSize: 16,
          lineHeight: "26px",
          color: "#E6FBEA",
        }}
      >
        <p style={{ margin: "0 0 20px" }}>
          A bundle is a set of buys placed in the same block as the launch, funded from the same
          purse, dressed up as organic demand. On a chart it looks like a crowd. On chain it is one
          person wearing forty coats.
        </p>
        <p style={{ margin: "0 0 20px", color: "#7FA68A" }}>
          The trick is not spotting the buys. Anyone can see block zero. The trick is proving the
          coats belong to one owner before they sell into you.
        </p>
        <div
          style={{
            background: "#06140B",
            border: "1px solid #164A2A",
            borderRadius: 4,
            padding: "16px 18px",
            margin: "0 0 20px",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 12,
            lineHeight: "20px",
            color: "#E6FBEA",
          }}
        >
          bundle check: 14 wallets · block 0 buys
          <br />
          funding origin: 1 hop from wallet 0x3d…9c
          <br />
          <span style={{ color: "#FF3B30" }}>
            verdict: single funder. 31 percent of supply.
          </span>
        </div>
        <h3
          style={{
            margin: "32px 0 12px",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 20,
            lineHeight: "28px",
            fontWeight: 600,
          }}
        >
          Follow the funding, not the timing
        </h3>
        <p style={{ margin: "0 0 20px" }}>
          Timing is circumstantial. Funding is a confession. When fourteen fresh wallets all trace
          back one hop to the same address, and that address traces to the deployer, the launch is
          a stage play. HOOD runs this trace on every scan and prices it into the score.
        </p>
        <p style={{ margin: "0 0 20px", color: "#7FA68A" }}>
          Historical bundles matter too. A deployer who bundled the last three launches will bundle
          the fourth. The rap sheet remembers so you do not have to.
        </p>
      </div>
      <div
        style={{
          marginTop: 36,
          paddingTop: 20,
          borderTop: "1px solid #164A2A",
          fontSize: 11,
          color: "#496552",
        }}
      >
        Not financial advice. DYOR.
      </div>
    </div>
  );
}
