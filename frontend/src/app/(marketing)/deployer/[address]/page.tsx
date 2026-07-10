import Link from "next/link";

const DEP_TOKENS = [
  { t: "$SHRF", dt: "jul 08, 2026", mc: "$1.4M", st: "live", stc: "#00C805", sc: "66 high", scc: "#FF3B30" },
  { t: "$CURFEW", dt: "jun 29, 2026", mc: "$890k", st: "rugged", stc: "#FF3B30", sc: "88 extreme", scc: "#FF3B30" },
  { t: "$TOLLGATE", dt: "jun 11, 2026", mc: "$310k", st: "rugged", stc: "#FF3B30", sc: "79 extreme", scc: "#FF3B30" },
  { t: "$PILGRIM", dt: "may 30, 2026", mc: "$120k", st: "dead", stc: "#496552", sc: "54 high", scc: "#FF3B30" },
  { t: "$ABBOT", dt: "may 12, 2026", mc: "$95k", st: "rugged", stc: "#FF3B30", sc: "81 extreme", scc: "#FF3B30" },
];

export default function PublicDeployerPage() {
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
        public deployer record
      </div>
      <div
        style={{
          background: "#0D2A19",
          border: "1px solid #164A2A",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 26px",
            borderBottom: "1px solid #164A2A",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>0x3d71…f09c</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 3,
              background: "#8B1E1A",
              color: "#E6FBEA",
            }}
          >
            serial rug flag
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#496552" }}>
            first seen mar 2026
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 1,
            background: "#164A2A",
            borderBottom: "1px solid #164A2A",
          }}
        >
          {[
            { v: "11", l: "tokens launched", c: "#E6FBEA" },
            { v: "3", l: "confirmed rugs", c: "#FF3B30" },
            { v: "18%", l: "30 day survival", c: "#FFB020" },
            { v: "2.1d", l: "median token life", c: "#E6FBEA" },
          ].map((s) => (
            <div key={s.l} style={{ background: "#0D2A19", padding: "16px 22px" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "#7FA68A", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 26px 18px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr .8fr .8fr 1fr",
              gap: 12,
              padding: "10px 0",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#496552",
              borderBottom: "1px solid #164A2A",
            }}
          >
            <span>token</span>
            <span>launched</span>
            <span>peak mc</span>
            <span>status</span>
            <span>first scan score</span>
          </div>
          {DEP_TOKENS.map((d) => (
            <div
              key={d.t}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr .8fr .8fr 1fr",
                gap: 12,
                padding: "11px 0",
                fontSize: 12,
                borderBottom: "1px solid #164A2A",
                alignItems: "center",
              }}
            >
              <Link href={`/token/${d.t}`} style={{ color: "#00C805", fontWeight: 600 }}>
                {d.t}
              </Link>
              <span style={{ color: "#7FA68A" }}>{d.dt}</span>
              <span>{d.mc}</span>
              <span style={{ color: d.stc }}>{d.st}</span>
              <span style={{ color: d.scc }}>{d.sc}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: "#7FA68A" }}>
        Loose an arrow on this deployer&apos;s next launch.{" "}
        <Link href="/signin">Enter the Hideout ❯</Link>
      </div>
    </div>
  );
}
