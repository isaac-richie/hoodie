"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section style={{ border: "1px solid #8B1E1A", background: "#06140B", padding: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF3B30", marginBottom: 12 }}>
        route error
      </div>
      <h1 style={{ margin: "0 0 8px", color: "#E6FBEA", fontSize: 24 }}>The trail broke.</h1>
      <p style={{ margin: "0 0 16px", color: "#7FA68A", lineHeight: "22px" }}>{error.message || "This screen failed to render."}</p>
      <button onClick={reset} style={{ background: "#D4A937", border: "none", color: "#0A1F12", fontSize: 12, fontWeight: 700, padding: "9px 13px", cursor: "pointer" }}>
        try again
      </button>
    </section>
  );
}
