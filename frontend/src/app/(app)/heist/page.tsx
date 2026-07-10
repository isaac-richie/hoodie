import { EllipsisRings } from "@/components/ui/EllipsisRings";

export default function HeistPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>The Heist</span>
          <span style={{ fontSize: 10, color: "#496552", border: "1px solid #164A2A", padding: "2px 8px", borderRadius: 3, letterSpacing: "0.06em" }}>Multi-token ops</span>
        </div>
        <div style={{ fontSize: 12, color: "#7FA68A", marginTop: 5, lineHeight: "18px" }}>
          Compare multiple tokens side by side. Batch scan an entire wallet. Run cross-deployer analysis.
        </div>
      </div>
      <div style={{ background: "#06140B", border: "1px solid #164A2A", padding: "80px 40px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
          <EllipsisRings cx={300} cy={200} radii={[80, 150, 220]} ratioY={0.75} opacity={0.4} />
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 22, color: "#D4A937", marginBottom: 10 }}>⚔</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>The Heist is coming.</div>
          <div style={{ fontSize: 13, color: "#7FA68A", lineHeight: "20px", maxWidth: 420, margin: "0 auto" }}>
            Multi-token comparison, batch wallet scans, and cross-deployer forensics. Currently in the forge.
          </div>
        </div>
      </div>
    </div>
  );
}
