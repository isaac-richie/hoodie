interface Props {
  cx?: number;
  cy?: number;
  radii?: number[];
  ratioY?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

export function EllipsisRings({
  cx = 450,
  cy = 450,
  radii = [90, 160, 235, 315, 400, 440],
  ratioY = 0.78,
  opacity = 0.55,
  style,
}: Props) {
  const w = cx * 2;
  const h = cy * 2;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ pointerEvents: "none", opacity, ...style }}
      aria-hidden
    >
      {radii.map((rx, i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={Math.round(rx * ratioY)}
          fill="none"
          stroke="#164A2A"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
