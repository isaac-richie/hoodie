const TEMPLATES = [
  { id: "T-114", name: "Classic honeypot v3", matches: 847, lastSeen: "2h ago", severity: "extreme", sevBg: "#8B1E1A" },
  { id: "T-089", name: "Tax ratchet", matches: 312, lastSeen: "6h ago", severity: "high", sevBg: "#FF3B30" },
  { id: "T-201", name: "Proxy swap bait", matches: 156, lastSeen: "1d ago", severity: "extreme", sevBg: "#8B1E1A" },
  { id: "T-167", name: "Delayed blacklist", matches: 94, lastSeen: "3d ago", severity: "high", sevBg: "#FF3B30" },
  { id: "T-045", name: "LP drain via side pool", matches: 221, lastSeen: "12h ago", severity: "extreme", sevBg: "#8B1E1A" },
  { id: "T-312", name: "Mint + dump cycle", matches: 189, lastSeen: "4h ago", severity: "high", sevBg: "#FF3B30" },
];

export default function PatternsPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Patterns</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Scam Templates</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Known bytecode patterns matched against every new contract. When a template matches, the score reflects it.
        </div>
      </div>

      <div className="data-table-scroll">
      <div style={{ background: "#0D2A19", border: "1px solid #164A2A", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: ".6fr 1.6fr .6fr .8fr .7fr", gap: 12, padding: "9px 16px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#496552", borderBottom: "1px solid #164A2A" }}>
          <span>id</span><span>pattern</span><span>matches</span><span>last seen</span><span>severity</span>
        </div>
        {TEMPLATES.map((t) => (
          <div key={t.id} style={{ display: "grid", gridTemplateColumns: ".6fr 1.6fr .6fr .8fr .7fr", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid #164A2A", fontSize: 12 }}>
            <span style={{ color: "#D4A937", fontWeight: 600 }}>{t.id}</span>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span>{t.matches}</span>
            <span style={{ color: "#7FA68A" }}>{t.lastSeen}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3, background: t.sevBg, color: "#E6FBEA" }}>{t.severity}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
