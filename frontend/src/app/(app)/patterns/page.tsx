// Scam archetypes the engine actively checks for. These map to live scan
// modules (honeypot sim, hidden mint, mutable tax, proxy/upgrade, blacklist,
// trading pause) — not to a fabricated match feed. The bytecode fingerprint
// library (exact-match against known rug bytecode) is still being seeded from
// confirmed rugs, so we don't show match counts we don't have.
const ARCHETYPES = [
  { name: "Classic honeypot", detects: "Buys succeed but sells revert or are taxed to zero", module: "honeypot sim", severity: "extreme", sevBg: "#8B1E1A" },
  { name: "Tax ratchet", detects: "Owner can raise buy/sell tax after launch", module: "mutable tax", severity: "high", sevBg: "#FF3B30" },
  { name: "Hidden mint", detects: "Owner-reachable mint that can inflate supply", module: "hidden mint", severity: "extreme", sevBg: "#8B1E1A" },
  { name: "Upgrade bait", detects: "Proxy whose implementation can be swapped for malicious code", module: "upgradeable check", severity: "high", sevBg: "#FF3B30" },
  { name: "Delayed blacklist", detects: "Wallets can be blocked from selling after buying", module: "blacklist", severity: "high", sevBg: "#FF3B30" },
  { name: "Trading pause", detects: "Owner can freeze all transfers", module: "trading pause", severity: "high", sevBg: "#FF3B30" },
];

export default function PatternsPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Patterns</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Scam Archetypes</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          The scam archetypes the scan engine checks every token against. Each maps to a live module —
          when one triggers, it&apos;s reflected in the token&apos;s score and evidence.
        </div>
      </div>

      <div className="data-table-scroll">
        <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.4fr 1fr .8fr", gap: 12, padding: "9px 16px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#496552", borderBottom: "1px solid #164A2A" }}>
            <span>archetype</span><span>what it catches</span><span>module</span><span>severity</span>
          </div>
          {ARCHETYPES.map((t) => (
            <div key={t.name} style={{ display: "grid", gridTemplateColumns: "1.2fr 2.4fr 1fr .8fr", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{t.name}</span>
              <span style={{ color: "#7FA68A" }}>{t.detects}</span>
              <span style={{ color: "#D4A937", fontSize: 11 }}>{t.module}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, background: t.sevBg, color: "#E6FBEA" }}>{t.severity}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#496552", lineHeight: "17px" }}>
        Exact-bytecode fingerprinting against known rug contracts is being seeded from confirmed
        rugs and will add template-level matches on top of these behavioural checks.
      </div>
    </div>
  );
}
