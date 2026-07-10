import Link from "next/link";

const NOTES = [
  { slug: "bundles-hide", tag: "security", tagColor: "#00C805", title: "How bundles hide: reading a launch before the snipers sell", date: "jul 02, 2026", mins: "9 min" },
  { slug: "rap-sheet-method", tag: "forensics", tagColor: "#7FA68A", title: "The rap sheet method: why unknown is not the same as clean", date: "jun 24, 2026", mins: "6 min" },
  { slug: "exit-liquidity-math", tag: "trading", tagColor: "#7FA68A", title: "Exit liquidity math for people who hate math", date: "jun 17, 2026", mins: "7 min" },
  { slug: "proxy-upgrades", tag: "security", tagColor: "#7FA68A", title: "Proxy upgrades: the rug that happens after you buy", date: "jun 09, 2026", mins: "5 min" },
];

export default function FieldNotesPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>Field Notes</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Intel</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Trading and security guides from the greenwood. Written by the crew, for the crew.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {NOTES.map((n) => (
          <Link key={n.slug} href={`/blog/${n.slug}`} style={{ display: "block", background: "#0D2A19", border: "1px solid #164A2A", padding: "18px 20px", color: "#E6FBEA", textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: n.tagColor }}>{n.tag}</span>
              <span style={{ fontSize: 11, color: "#496552" }}>{n.date} · {n.mins}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: "23px" }}>{n.title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
