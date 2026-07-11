import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div
        className="footer-grid"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "44px 32px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 32,
          fontSize: 12,
        }}
      >
        <div className="footer-brand">
          <Link
            href="/"
            style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, color: "inherit", textDecoration: "none" }}
          >
            <span
              style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 20 }}
            >
              Hood
            </span>
            <span
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#00C805" }}
            >
              TERMINAL
            </span>
          </Link>
          <div style={{ color: "#496552", lineHeight: "18px" }}>
            Sherwood Signals Ltd. Company no 15382077.
            <br />
            Not financial advice. DYOR.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{ color: "#496552", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            product
          </span>
          <Link href="/token/0x8f3c" style={{ color: "#7FA68A" }}>sample scan</Link>
          <Link href="/deployer/0x3d71" style={{ color: "#7FA68A" }}>deployer lookup</Link>
          <Link href="/wallet/0x91be" style={{ color: "#7FA68A" }}>wallet rap sheet</Link>
          <Link href="/hideout" style={{ color: "#7FA68A" }}>api docs</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{ color: "#496552", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            company
          </span>
          <Link href="/blog" style={{ color: "#7FA68A" }}>field notes</Link>
          <Link href="#" style={{ color: "#7FA68A" }}>terms</Link>
          <Link href="#" style={{ color: "#7FA68A" }}>privacy</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{ color: "#496552", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            crew
          </span>
          <Link href="#" style={{ color: "#7FA68A" }}>telegram</Link>
          <Link href="#" style={{ color: "#7FA68A" }}>x</Link>
          <Link href="#" style={{ color: "#7FA68A" }}>github</Link>
        </div>
      </div>
    </footer>
  );
}
