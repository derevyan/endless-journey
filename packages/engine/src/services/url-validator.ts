/**
 * URL Validator Service
 *
 * Provides SSRF (Server-Side Request Forgery) protection by validating
 * webhook URLs before execution. Blocks requests to:
 * - Private IP ranges (10.x, 172.16-31.x, 192.168.x)
 * - Localhost addresses (127.x, ::1)
 * - Link-local addresses (169.254.x)
 * - Cloud metadata endpoints (AWS, GCP, Azure)
 */

/**
 * Custom error for SSRF blocked requests
 */
export class SSRFBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFBlockedError";
  }
}

/**
 * Blocked hostnames (case-insensitive match)
 */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  // AWS metadata endpoints
  "169.254.169.254",
  "instance-data",
  // GCP metadata endpoints
  "metadata.google.internal",
  "metadata",
  // Azure metadata endpoints
  "169.254.169.254",
  // Kubernetes
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/**
 * Check if an IP is in a private/blocked range
 * Returns the range name if blocked, null if allowed
 */
function getBlockedIpRange(ip: string): string | null {
  // IPv6 loopback
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") {
    return "IPv6 loopback";
  }

  // IPv4 patterns
  const parts = ip.split(".");
  if (parts.length !== 4) {
    // Not a valid IPv4, could be IPv6 - allow for now
    // (full IPv6 validation is complex and most webhooks use IPv4)
    return null;
  }

  const octets = parts.map((p) => parseInt(p, 10));
  if (octets.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return null; // Not a valid IP
  }

  const [a, b] = octets;

  // 0.0.0.0/8 - Current network
  if (a === 0) {
    return "current network (0.0.0.0/8)";
  }

  // 10.0.0.0/8 - Private Class A
  if (a === 10) {
    return "private network (10.0.0.0/8)";
  }

  // 100.64.0.0/10 - Carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) {
    return "carrier-grade NAT (100.64.0.0/10)";
  }

  // 127.0.0.0/8 - Loopback
  if (a === 127) {
    return "loopback (127.0.0.0/8)";
  }

  // 169.254.0.0/16 - Link-local (includes AWS metadata at 169.254.169.254)
  if (a === 169 && b === 254) {
    return "link-local (169.254.0.0/16)";
  }

  // 172.16.0.0/12 - Private Class B
  if (a === 172 && b >= 16 && b <= 31) {
    return "private network (172.16.0.0/12)";
  }

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (a === 192 && b === 0 && octets[2] === 0) {
    return "IETF protocol assignments (192.0.0.0/24)";
  }

  // 192.0.2.0/24 - TEST-NET-1 (documentation)
  if (a === 192 && b === 0 && octets[2] === 2) {
    return "TEST-NET-1 (192.0.2.0/24)";
  }

  // 192.168.0.0/16 - Private Class C
  if (a === 192 && b === 168) {
    return "private network (192.168.0.0/16)";
  }

  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) {
    return "benchmarking (198.18.0.0/15)";
  }

  // 198.51.100.0/24 - TEST-NET-2 (documentation)
  if (a === 198 && b === 51 && octets[2] === 100) {
    return "TEST-NET-2 (198.51.100.0/24)";
  }

  // 203.0.113.0/24 - TEST-NET-3 (documentation)
  if (a === 203 && b === 0 && octets[2] === 113) {
    return "TEST-NET-3 (203.0.113.0/24)";
  }

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) {
    return "multicast (224.0.0.0/4)";
  }

  // 240.0.0.0/4 - Reserved
  if (a >= 240) {
    return "reserved (240.0.0.0/4)";
  }

  return null;
}

/**
 * Validates a webhook URL for SSRF protection
 *
 * @param url - The URL to validate
 * @throws SSRFBlockedError if the URL targets a blocked host or IP range
 */
export function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SSRFBlockedError(`Invalid URL: ${url}`);
  }

  // Only allow http and https protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFBlockedError(`Blocked protocol: ${parsed.protocol} (only http/https allowed)`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check against blocked hostnames
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new SSRFBlockedError(`Blocked host: ${hostname}`);
  }

  // Check if hostname is an IP address in blocked range
  const blockedRange = getBlockedIpRange(hostname);
  if (blockedRange) {
    throw new SSRFBlockedError(`Blocked IP range: ${hostname} (${blockedRange})`);
  }

  // Block hostnames ending with common internal suffixes
  const internalSuffixes = [".local", ".internal", ".localhost", ".localdomain"];
  for (const suffix of internalSuffixes) {
    if (hostname.endsWith(suffix)) {
      throw new SSRFBlockedError(`Blocked internal hostname: ${hostname}`);
    }
  }
}
