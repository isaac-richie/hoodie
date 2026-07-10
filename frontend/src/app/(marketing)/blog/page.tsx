import Link from "next/link";
import { EllipsisRings } from "@/components/ui/EllipsisRings";

const POSTS = [
  {
    slug: "bundles-hide",
    size: "lead",
    tag: "security",
    tagColor: "#00C805",
    title: "How bundles hide: reading a launch before the snipers sell",
    date: "jul 02, 2026",
    mins: "9 min",
  },
  {
    slug: "rap-sheet-method",
    size: "sm",
    tag: "forensics",
    tagColor: "#7FA68A",
    title: "The rap sheet method: why unknown is not the same as clean",
    date: "jun 24, 2026",
    mins: "6 min",
  },
  {
    slug: "exit-liquidity-math",
    size: "sm",
    tag: "trading",
    tagColor: "#7FA68A",
    title: "Exit liquidity math for people who hate math",
    date: "jun 17, 2026",
    mins: "7 min",
  },
  {
    slug: "proxy-upgrades",
    size: "sm",
    tag: "security",
    tagColor: "#7FA68A",
    title: "Proxy upgrades: the rug that happens after you buy",
    date: "jun 09, 2026",
    mins: "5 min",
  },
];

export default function BlogPage() {
  const [lead, ...rest] = POSTS;
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 32px 96px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 36 }}>
        <span style={{ fontFamily: "var(--font-unifraktur), serif", fontSize: 40 }}>
          Field notes
        </span>
        <span style={{ fontSize: 13, color: "#7FA68A" }}>
          trading and security guides from the greenwood
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 14 }}>
        <Link
          href={`/blog/${lead.slug}`}
          style={{
            display: "block",
            background: "#0D2A19",
            border: "1px solid #164A2A",
            borderRadius: 8,
            padding: 34,
            color: "#E6FBEA",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", right: -140, top: -140, pointerEvents: "none" }}>
            <EllipsisRings
              cx={210}
              cy={210}
              radii={[70, 130, 190]}
              ratioY={0.8}
              opacity={0.5}
            />
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#00C805",
              marginBottom: 14,
            }}
          >
            {lead.tag} · lead note
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: "36px",
              fontWeight: 600,
              maxWidth: 440,
              position: "relative",
            }}
          >
            {lead.title}
          </div>
          <div style={{ fontSize: 11, color: "#496552", marginTop: 18 }}>
            {lead.date} · {lead.mins}
          </div>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rest.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              style={{
                display: "block",
                background: "#0D2A19",
                border: "1px solid #164A2A",
                borderRadius: 8,
                padding: "20px 24px",
                color: "#E6FBEA",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#7FA68A",
                  marginBottom: 8,
                }}
              >
                {p.tag}
              </div>
              <div style={{ fontSize: 16, lineHeight: "23px", fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#496552", marginTop: 10 }}>
                {p.date} · {p.mins}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
