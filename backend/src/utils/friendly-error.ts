/**
 * Friendly Error Messages — turn raw RPC/infra errors into plain language.
 *
 * Scan modules run against a live RPC and can hit transient provider errors
 * (rate limits, block-range caps, malformed responses). Those raw messages
 * ("JSON is not a valid request object", "eth_getLogs ... 10000 block range",
 * long provider URLs) are meaningless and alarming to a non-technical community
 * member reading a token report. This maps them to short, reassuring text and
 * strips anything that leaks internal infrastructure (URLs, API keys, stack
 * traces) so the report stays readable and safe to screenshot.
 */

export function friendlyError(err: unknown, whatWeChecked: string): string {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  // Transient / infrastructure conditions — reassure, don't alarm.
  if (
    raw.includes("block range") ||
    raw.includes("10000 block") ||
    raw.includes("rate limit") ||
    raw.includes("429") ||
    raw.includes("timeout") ||
    raw.includes("timed out") ||
    raw.includes("econnreset") ||
    raw.includes("etimedout") ||
    raw.includes("fetch failed") ||
    raw.includes("json is not a valid") ||
    raw.includes("request object") ||
    raw.includes("network") ||
    raw.includes("503") ||
    raw.includes("502") ||
    raw.includes("500")
  ) {
    return `We couldn't finish the ${whatWeChecked} check right now — the chain data provider was briefly unavailable. Hit "run again" in a moment and it should complete.`;
  }

  // Unknown/unexpected — keep it generic and non-technical.
  return `The ${whatWeChecked} check couldn't complete for this token. This is usually temporary — try running the scan again.`;
}
