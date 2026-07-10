import { scoreToBand } from "@/types";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "sm" }: Props) {
  const band = scoreToBand(score);
  const padding = size === "lg" ? "5px 12px" : size === "md" ? "4px 10px" : "3px 8px";
  const fontSize = size === "lg" ? "12px" : size === "md" ? "11px" : "10px";
  return (
    <span
      style={{
        display: "inline-block",
        fontWeight: 700,
        padding,
        borderRadius: 3,
        background: band.bg,
        color: band.fg,
        fontSize,
        whiteSpace: "nowrap",
      }}
    >
      {score} {band.label}
    </span>
  );
}

export function BandBadge({ score, label }: { score?: number; label: string }) {
  const band = scoreToBand(score ?? 0);
  return (
    <span
      style={{
        display: "inline-block",
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 3,
        background: band.bg,
        color: band.fg,
        fontSize: 11,
      }}
    >
      {label}
    </span>
  );
}
