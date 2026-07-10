"use client";

interface Props {
  w?: number;
  h?: number;
  color?: string;
}

export function BlinkCursor({ w = 8, h = 15, color = "#00C805" }: Props) {
  return (
    <span
      className="blink-cursor"
      style={{ width: w, height: h, background: color }}
    />
  );
}
