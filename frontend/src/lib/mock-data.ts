import { scoreToBand } from "@/types";

export function makeRow(
  ticker: string,
  name: string,
  score: number,
  hp: "clear" | "trap",
  mcap: string,
  vol: string,
  age: string,
  change: string,
  rank: number
) {
  const band = scoreToBand(score);
  return {
    rank,
    ticker,
    name,
    logo: ticker.charAt(1),
    score,
    band: band.label,
    fg: band.fg,
    bg: band.bg,
    honeypot: hp,
    honeypotColor: hp === "clear" ? "#00C805" : "#FF3B30",
    mcap,
    vol,
    age,
    change24h: change,
    changeColor: change.startsWith("-") ? "#FF3B30" : "#00C805",
    spark: genSpark(score),
    sparkColor: score < 25 ? "#00C805" : score < 50 ? "#FFB020" : "#FF3B30",
  };
}

function genSpark(score: number): string {
  const pts: string[] = [];
  let y = 9;
  for (let i = 0; i < 14; i++) {
    const delta = (Math.random() - (score > 50 ? 0.55 : 0.45)) * 4;
    y = Math.max(2, Math.min(16, y + delta));
    pts.push(`${i * 5},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export const NEW_TOKENS = [
  makeRow("$MARIAN", "Maid Marian", 18, "clear", "$92k", "$96k", "4m", "+31.0%", 1),
  makeRow("$TITHE", "Tithe Collector", 47, "clear", "$210k", "$88k", "26m", "-3.8%", 2),
  makeRow("$GALLOWS", "Gallows Pole", 83, "trap", "$310k", "$150k", "11m", "-42.6%", 3),
  makeRow("$FRIARFEE", "Friar Fee", 91, "trap", "$45k", "$9k", "2h", "-71.2%", 4),
];

export const GRAD_TOKENS = [
  makeRow("$NOCK", "Full Nock", 12, "clear", "$8.4M", "$1.4M", "3h", "+12.4%", 1),
  makeRow("$SCARLET", "Will Scarlet", 31, "clear", "$3.2M", "$620k", "5h", "+4.1%", 2),
  makeRow("$SHRF", "Sheriffcoin", 66, "clear", "$1.1M", "$410k", "7h", "-18.2%", 3),
  makeRow("$NIGHTJAR", "Nightjar", 74, "clear", "$2.1M", "$310k", "3d", "+22.4%", 4),
];

export const DONE_TOKENS = [
  makeRow("$OUTLAWX", "Outlaw Exchange", 9, "clear", "$14M", "$2.8M", "3d", "+2.2%", 1),
  makeRow("$FLETCH", "Fletcher", 28, "clear", "$2.2M", "$540k", "6d", "+6.8%", 2),
  makeRow("$QUARREL", "Crossbow Quarrel", 39, "clear", "$960k", "$180k", "8d", "-1.4%", 3),
  makeRow("$PILGRIM", "Pilgrim", 54, "clear", "$80k", "$1k", "40d", "-0.6%", 4),
];

export const TICKER_ITEMS = [
  { ticker: "$CURFEW", note: "rugged. caught 6h 12m before." },
  { ticker: "$TITHE", note: "LP pulled. flagged at score 88." },
  { ticker: "$GALLOWS", note: "honeypot. blocked 2,140 scans." },
  { ticker: "$FROSTY", note: "rugged. deployer had 4 priors." },
  { ticker: "$PILGRIM", note: "dev dumped. arrow struck first." },
  { ticker: "$TOLLGATE", note: "proxy upgraded. marked extreme." },
];

export const SCAN_LOG_LINES = [
  { m: "dispatch", tag: "  ..", msg: "scouting sherwood · 14 modules riding" },
  { m: "honeypot_sim", tag: "[ OK ]", msg: "sell executed · 9.8% total tax" },
  { m: "hidden_mint", tag: "[FAIL]", msg: "mint reachable by owner" },
  { m: "mutable_tax", tag: "[FAIL]", msg: "setTax callable · current 4/6, no cap" },
  { m: "ownership", tag: "[WARN]", msg: "not renounced · owner is deployer" },
  { m: "holders", tag: "[WARN]", msg: "top10 41% · sybil adjusted 57%" },
  { m: "bundles", tag: "[FAIL]", msg: "18% of supply · one funder · block 0" },
  { m: "lp_lock", tag: "[ OK ]", msg: "locked 30d via archery.fun" },
  { m: "deployer_rep", tag: "[FAIL]", msg: "2 confirmed rugs of 11 launches" },
  { m: "social", tag: "[WARN]", msg: "x is 4 days old · no site" },
  { m: "verdict", tag: " ❯❯", msg: "score 74 · high risk · confidence medium" },
];

export function tagColor(tag: string): string {
  if (tag.includes("OK")) return "#00C805";
  if (tag.includes("FAIL")) return "#FF3B30";
  if (tag.includes("WARN") || tag.includes("TIME")) return "#FFB020";
  if (tag.includes("❯❯")) return "#D4A937";
  return "#7FA68A";
}
