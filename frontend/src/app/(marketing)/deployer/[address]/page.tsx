"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * Public deployer record. Per-deployer reputation profiles aren't wired to the
 * live API yet, so instead of rendering fabricated rug history we show the real
 * requested address with an honest "coming soon" and a path to the live scanner.
 */
export default function PublicDeployerPage() {
  const params = useParams<{ address: string }>();
  const address = Array.isArray(params.address) ? params.address[0] : params.address;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 32px 96px" }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#7FA68A",
          marginBottom: 12,
        }}
      >
        deployer record
      </div>
      <div
        style={{
          background: "#0D2A19",
          border: "1px solid #164A2A",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 26px", borderBottom: "1px solid #164A2A" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E6FBEA" }}>Deployer wallet</div>
          <div style={{ fontSize: 13, color: "#7FA68A", marginTop: 6, overflowWrap: "anywhere" }}>
            {address ?? "unknown"}
          </div>
        </div>
        <div style={{ padding: "26px", color: "#7FA68A", fontSize: 14, lineHeight: "22px" }}>
          <p style={{ margin: "0 0 14px" }}>
            Full deployer reputation profiles — launch history, confirmed rugs, and survival rate —
            are computed by the scan engine and are being wired into a public page. In the meantime,
            a deployer&apos;s track record is surfaced inside each token&apos;s scan under the{" "}
            <span style={{ color: "#E6FBEA" }}>Creator</span> section.
          </p>
          <Link
            href="/hideout"
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 700,
              color: "#0A1F12",
              background: "#D4A937",
              padding: "10px 16px",
              borderRadius: 3,
            }}
          >
            ❯ Run a token scan
          </Link>
        </div>
      </div>
    </div>
  );
}
