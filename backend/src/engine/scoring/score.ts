/**
 * Scoring Functions
 *
 * scoreToband(): maps a 0-100 numeric score to a human-readable risk band.
 *   0-25  = low (green)   — no significant flags
 *   26-50 = some_risk (yellow) — proceed with caution
 *   51-75 = high (red)    — significant red flags found
 *   76-100 = extreme (dark red) — almost certainly a scam/rug
 *
 * computeConfidence(): how much of the scan completed successfully.
 *   95%+ modules = high, 80%+ = medium, below = low
 *   Low confidence means the score may be unreliable.
 *
 * bandColor(): hex colors matching the frontend design system.
 */
import type { RiskBand, Confidence } from "../types.js";

export function scoreToband(score: number): RiskBand {
  if (score <= 25) return "low";
  if (score <= 50) return "some_risk";
  if (score <= 75) return "high";
  return "extreme";
}

export function computeConfidence(ran: number, total: number): Confidence {
  const ratio = ran / total;
  if (ratio >= 0.95) return "high";
  if (ratio >= 0.8) return "medium";
  return "low";
}

export function bandColor(band: RiskBand): string {
  switch (band) {
    case "low":
      return "#00C805";
    case "some_risk":
      return "#FFB020";
    case "high":
      return "#FF3B30";
    case "extreme":
      return "#8B1E1A";
  }
}
