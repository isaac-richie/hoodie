"use client";

const COLS = [6, 16, 27, 39, 52, 64, 77, 91];

function makeTxt(seed: number) {
  let s = seed;
  const rr = () => { s = (s * 16807 + 12345) % 2147483647; return s / 2147483647; };
  let t = "";
  for (let j = 0; j < 44; j++) t += (rr() > 0.5 ? "1" : "0") + "\n";
  return t + t;
}

export function BinRain() {
  return (
    <div
      className="bin-rain"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: -1 }}
      aria-hidden
    >
      {COLS.map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: 0,
            fontSize: 11,
            lineHeight: "18px",
            color: "#2B7A3D",
            opacity: i % 3 === 0 ? 0.26 : 0.16,
            whiteSpace: "pre",
            animation: `rainfall ${10 + (i % 4) * 3}s linear ${(-i * 2.7).toFixed(1)}s infinite`,
          }}
        >
          {makeTxt(x * 13 + 7)}
        </div>
      ))}
    </div>
  );
}
