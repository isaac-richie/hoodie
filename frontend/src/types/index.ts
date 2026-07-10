export type RiskBand = "Low" | "Some risk" | "High" | "Extreme";

export interface ScoreBand {
  label: RiskBand;
  fg: string;
  bg: string;
}

export function scoreToBand(score: number): ScoreBand {
  if (score >= 75) return { label: "Extreme", fg: "#E6FBEA", bg: "#8B1E1A" };
  if (score >= 50) return { label: "High", fg: "#0A1F12", bg: "#FF3B30" };
  if (score >= 25) return { label: "Some risk", fg: "#0A1F12", bg: "#FFB020" };
  return { label: "Low", fg: "#0A1F12", bg: "#00C805" };
}

export interface TokenRow {
  rank: number;
  ticker: string;
  name: string;
  score: number;
  honeypot: "clear" | "trap";
  mcap: string;
  vol: string;
  liq?: string;
  age: string;
  change24h: string;
  spark?: string;
}

export interface ScanLogLine {
  t?: string;
  m: string;
  tag: string;
  msg: string;
  c: string;
}

export interface Alert {
  token: string;
  msg: string;
  time: string;
  color: string;
}

export interface QuiverEntry {
  ticker: string;
  price: string;
  change24h: string;
  changeColor: string;
  score: number;
  note: string;
  spark: string;
  sparkColor: string;
  honeypot: string;
  top10: string;
  lp: string;
}
