import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { webhookAllowedHosts } from "../config.js";

const WEBHOOK_TIMEOUT_MS = 10_000;

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** [first, last] inclusive, as 32-bit integers. */
const BLOCKED_V4_RANGES: Array<[string, string, string]> = [
  ["0.0.0.0", "0.255.255.255", "this-network"],
  ["10.0.0.0", "10.255.255.255", "private"],
  ["100.64.0.0", "100.127.255.255", "carrier-grade NAT"],
  ["127.0.0.0", "127.255.255.255", "loopback"],
  ["169.254.0.0", "169.254.255.255", "link-local / cloud metadata"],
  ["172.16.0.0", "172.31.255.255", "private"],
  ["192.0.0.0", "192.0.0.255", "IETF protocol assignments"],
  ["192.168.0.0", "192.168.255.255", "private"],
  ["198.18.0.0", "198.19.255.255", "benchmarking"],
  ["224.0.0.0", "239.255.255.255", "multicast"],
  ["240.0.0.0", "255.255.255.255", "reserved"]
];

/** Returns the reason the address is blocked, or null if it is routable. */
export function blockedReasonForAddress(address: string): string | null {
  const family = isIP(address);
  if (family === 0) return "not an IP address";

  if (family === 4) {
    const value = ipv4ToInt(address);
    if (value === null) return "malformed IPv4 address";
    for (const [first, last, reason] of BLOCKED_V4_RANGES) {
      const low = ipv4ToInt(first)!;
      const high = ipv4ToInt(last)!;
      if (value >= low && value <= high) return reason;
    }
    return null;
  }

  const normalized = address.toLowerCase().split("%")[0];
  // ::ffff:10.0.0.1 and ::ffff:0a00:0001 are both IPv4 wearing an IPv6 hat.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized);
  if (mapped) return blockedReasonForAddress(mapped[1]);
  if (normalized === "::" || normalized === "::1") return "loopback / unspecified";
  if (/^f[cd]/.test(normalized)) return "unique local address";
  if (/^fe[89ab]/.test(normalized)) return "link-local";
  if (/^ff/.test(normalized)) return "multicast";
  if (/^::ffff:/.test(normalized) || /^64:ff9b:/.test(normalized)) return "IPv4-mapped address";
  return null;
}

export type WebhookTarget = { url: URL; addresses: string[] };

/**
 * Rejects webhook targets that would make the server fetch its own network:
 * localhost, RFC1918 space, and 169.254.169.254 (cloud metadata). Hosts named
 * in WEBHOOK_ALLOWED_HOSTS are exempt, because pointing a rule at an n8n
 * instance on the LAN is a legitimate use of this feature.
 *
 * Note: `fetch` resolves the hostname again, so a DNS record that flips between
 * this check and the request can still slip through. Re-checking at fire time
 * (which sendWebhook does) narrows that window but does not close it; closing
 * it would mean pinning the connection to the validated IP, which breaks TLS
 * certificate validation for https targets.
 */
export async function assertWebhookUrlAllowed(rawUrl: string): Promise<WebhookTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw badRequest(`Webhook URL is not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw badRequest(`Webhook URL must use http or https, got ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (webhookAllowedHosts.includes(hostname)) {
    return { url, addresses: [] };
  }

  if (isIP(hostname) !== 0) {
    const reason = blockedReasonForAddress(hostname);
    if (reason) {
      throw badRequest(
        `Webhook URL points at a ${reason} address (${hostname}). Add the host to WEBHOOK_ALLOWED_HOSTS to permit it.`
      );
    }
    return { url, addresses: [hostname] };
  }

  let resolved: Array<{ address: string }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw badRequest(`Webhook host does not resolve: ${hostname}`);
  }

  if (resolved.length === 0) {
    throw badRequest(`Webhook host does not resolve: ${hostname}`);
  }

  for (const entry of resolved) {
    const reason = blockedReasonForAddress(entry.address);
    if (reason) {
      throw badRequest(
        `Webhook host ${hostname} resolves to a ${reason} address (${entry.address}). Add it to WEBHOOK_ALLOWED_HOSTS to permit it.`
      );
    }
  }

  return { url, addresses: resolved.map((entry) => entry.address) };
}

/**
 * Fire-and-forget POST. Re-validates the target first: a rule's URL was checked
 * when it was created, but DNS may have changed since.
 */
export async function sendWebhook(rawUrl: string, payload: unknown): Promise<void> {
  try {
    await assertWebhookUrlAllowed(rawUrl);
  } catch (error) {
    console.warn("[webhook] blocked:", error instanceof Error ? error.message : error);
    return;
  }

  try {
    await fetch(rawUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
    });
  } catch (error) {
    console.warn("[webhook] delivery failed:", error instanceof Error ? error.message : error);
  }
}
