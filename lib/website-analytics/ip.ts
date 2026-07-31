/**
 * Privacy-preserving client IP extraction + hashing.
 * Never persist raw IP — only HMAC hashes with server salt.
 */

import { createHmac, createHash } from "node:crypto";

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

/** Expand / normalize IPv6 for stable hashing (lowercase, full 8 hextets). */
export function normalizeIp(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  let ip = trimmed;
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }
  const zone = ip.indexOf("%");
  if (zone >= 0) ip = ip.slice(0, zone);

  // host:port for IPv4
  if (ip.includes(".") && ip.includes(":") && !ip.includes("::")) {
    const maybePort = ip.split(":");
    if (maybePort.length === 2 && IPV4_RE.test(maybePort[0]!)) {
      ip = maybePort[0]!;
    }
  }

  if (IPV4_RE.test(ip)) {
    return ip;
  }

  // IPv4-mapped IPv6 ::ffff:a.b.c.d
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped?.[1] && IPV4_RE.test(v4mapped[1])) {
    return v4mapped[1];
  }

  if (!ip.includes(":")) return null;

  return normalizeIpv6(ip);
}

function normalizeIpv6(ip: string): string | null {
  const parts = expandIpv6(ip);
  if (!parts) return null;
  return parts.join(":");
}

function expandIpv6(ip: string): string[] | null {
  if ((ip.match(/::/g) || []).length > 1) return null;

  let head: string[];
  let tail: string[];
  if (ip.includes("::")) {
    const [h, t] = ip.split("::");
    head = h ? h.split(":") : [];
    tail = t ? t.split(":") : [];
  } else {
    head = ip.split(":");
    tail = [];
  }

  const last = tail.length ? tail[tail.length - 1]! : head[head.length - 1];
  if (last && IPV4_RE.test(last)) {
    const nums = last.split(".").map((n) => Number(n));
    const hex = [
      ((nums[0]! << 8) | nums[1]!).toString(16),
      ((nums[2]! << 8) | nums[3]!).toString(16),
    ];
    if (tail.length) {
      tail = [...tail.slice(0, -1), ...hex];
    } else {
      head = [...head.slice(0, -1), ...hex];
    }
  }

  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return null;
  if (!ip.includes("::") && missing !== 0) return null;

  const full = [
    ...head,
    ...Array.from({ length: missing }, () => "0"),
    ...tail,
  ];
  if (full.length !== 8) return null;

  const normalized: string[] = [];
  for (const g of full) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    normalized.push(g.toLowerCase().padStart(4, "0"));
  }
  return normalized;
}

/**
 * Extract client IP from trusted platform headers only.
 *
 * On Vercel (`VERCEL=1`): trust `x-real-ip`, then first hop of
 * `x-vercel-forwarded-for` / platform `x-forwarded-for`.
 * Off Vercel: ignore client-supplied `x-forwarded-for` (spoofable).
 */
export function extractTrustedClientIp(
  headers: Headers,
  options?: { vercel?: boolean; trustProxy?: boolean },
): string | null {
  const onVercel =
    options?.vercel ??
    (process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV));
  const trustProxy =
    options?.trustProxy ?? process.env.ANALYTICS_TRUST_PROXY === "1";

  const realIp = headers.get("x-real-ip")?.trim() || null;
  const vercelFwd = headers.get("x-vercel-forwarded-for")?.trim() || null;

  if (onVercel || trustProxy) {
    if (realIp) {
      const n = normalizeIp(realIp);
      if (n) return n;
    }
    if (vercelFwd) {
      const first = vercelFwd.split(",")[0]?.trim();
      if (first) {
        const n = normalizeIp(first);
        if (n) return n;
      }
    }
    if (onVercel || trustProxy) {
      const xff = headers.get("x-forwarded-for")?.trim();
      if (xff) {
        const first = xff.split(",")[0]?.trim();
        if (first) {
          const n = normalizeIp(first);
          if (n) return n;
        }
      }
    }
    return null;
  }

  // Non-Vercel / untrusted: do NOT honor x-forwarded-for.
  const xff = headers.get("x-forwarded-for");
  if (xff) return null;
  if (realIp) return normalizeIp(realIp);
  return null;
}

export function getIpSalt(): string | null {
  const salt = process.env.ANALYTICS_IP_SALT?.trim();
  return salt || null;
}

/** HMAC-SHA256(ip) hex — requires ANALYTICS_IP_SALT. Returns null without salt. */
export function hashIp(normalizedIp: string, salt?: string | null): string | null {
  const s = salt === undefined ? getIpSalt() : salt;
  if (!s) return null;
  return createHmac("sha256", s).update(normalizedIp, "utf8").digest("hex");
}

/** Hash opaque ids (visitor UUID / session) — never wallet-linked. */
export function hashOpaqueId(id: string, salt?: string | null): string {
  const s = salt === undefined ? getIpSalt() : salt;
  if (s) {
    return createHmac("sha256", s).update(id, "utf8").digest("hex");
  }
  return createHash("sha256").update(`hansome-analytics|${id}`, "utf8").digest("hex");
}

/** Trusted edge country (ISO 3166-1 alpha-2) from Vercel — never lat/long. */
export function extractTrustedCountry(headers: Headers): string | null {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  if (!country || country.length !== 2 || country === "XX") return null;
  if (!/^[A-Z]{2}$/.test(country)) return null;
  return country;
}
