"use client";

import { useQuiverStore } from "@/stores/quiver";
import { useScanHistoryStore } from "@/stores/scan-history";

export default function CrewPage() {
  const quiver = useQuiverStore((state) => state.addresses);
  const remove = useQuiverStore((state) => state.remove);
  const history = useScanHistoryStore((state) => state.items);

  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px", display: "grid", gap: 1 }}>
      <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 10 }}>
          crew
        </div>
        <h1 style={{ fontSize: 28, margin: "0 0 10px", color: "#E6FBEA" }}>Merry Men</h1>
        <p style={{ margin: 0, color: "#7FA68A", lineHeight: "24px" }}>
          Local operator workspace for watched tokens and recent scans. Server-side teams can plug into this shape later.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
          <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            quiver
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {quiver.map((address) => (
              <div key={address} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: "#00C805", overflowWrap: "anywhere" }}>{address}</span>
                <button onClick={() => remove(address)} style={{ background: "transparent", border: "1px solid #164A2A", color: "#FFB020", cursor: "pointer" }}>
                  remove
                </button>
              </div>
            ))}
            {quiver.length === 0 && <span style={{ color: "#496552", fontSize: 12 }}>No watched tokens yet.</span>}
          </div>
        </div>

        <div style={{ border: "1px solid #164A2A", background: "#06140B", padding: 20 }}>
          <div style={{ color: "#7FA68A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>
            recent scans
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {history.slice(0, 8).map((item) => (
              <div key={`${item.address}-${item.scannedAt}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: "#E6FBEA" }}>{item.address.slice(0, 6)}...{item.address.slice(-4)}</span>
                <span style={{ color: "#7FA68A" }}>{item.score} · {item.band}</span>
              </div>
            ))}
            {history.length === 0 && <span style={{ color: "#496552", fontSize: 12 }}>Scan history will appear here.</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
