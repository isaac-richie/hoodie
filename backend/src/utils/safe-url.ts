/**
 * SSRF guard for user-supplied webhook URLs.
 *
 * Alert webhooks are POSTed from inside our trust boundary, so an attacker who
 * can set the URL could reach internal services, localhost, or the cloud
 * metadata endpoint (169.254.169.254) to steal instance credentials. We block:
 *   - non-http(s) schemes
 *   - loopback / private / link-local / unique-local IP ranges
 *   - the cloud metadata address
 *   - hostnames that resolve to any of the above (checked again at delivery time,
 *     which also defeats DNS-rebinding between validation and send)
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // "this" network
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded v4 address.
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }

  return true; // not a parseable IP — treat as blocked
}

/** Synchronous structural check — safe to run inside a Zod refinement. */
export function isStructurallyAllowedWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  // If the host is a literal IP, block private/loopback/metadata ranges now.
  if (net.isIP(host) && isBlockedIp(host)) return false;

  return true;
}

/**
 * Full async check for delivery time: resolves DNS and rejects if any resolved
 * address is in a blocked range. Throws with a clear reason if unsafe.
 */
export async function assertSafeWebhookTarget(raw: string): Promise<URL> {
  if (!isStructurallyAllowedWebhookUrl(raw)) {
    throw new Error("Webhook URL is not an allowed public http(s) endpoint.");
  }
  const url = new URL(raw);

  // Literal IPs already validated structurally; only DNS names need resolving.
  if (!net.isIP(url.hostname)) {
    const results = await lookup(url.hostname, { all: true });
    for (const { address } of results) {
      if (isBlockedIp(address)) {
        throw new Error("Webhook hostname resolves to a private or restricted address.");
      }
    }
  }

  return url;
}
