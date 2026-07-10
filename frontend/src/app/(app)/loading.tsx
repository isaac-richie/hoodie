export default function AppLoading() {
  return (
    <section style={{ border: "1px solid #164A2A", background: "#06140B", padding: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7FA68A", marginBottom: 12 }}>
        loading
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ height: 18, background: "#0D2A19", border: "1px solid #164A2A", opacity: 0.7 }} />
        ))}
      </div>
    </section>
  );
}
