import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE_SEC,
} from "@/lib/website-analytics/constants";

export function getAdminSecret(): string | null {
  return process.env.ANALYTICS_ADMIN_SECRET?.trim() || null;
}

function signAdminToken(secret: string, issuedAt: number): string {
  const payload = `v1.${issuedAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function mintAdminCookieValue(secret?: string | null): string | null {
  const s = secret === undefined ? getAdminSecret() : secret;
  if (!s) return null;
  return signAdminToken(s, Date.now());
}

export function verifyAdminCookieValue(
  value: string | null | undefined,
  secret?: string | null,
): boolean {
  const s = secret === undefined ? getAdminSecret() : secret;
  if (!s || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > ADMIN_COOKIE_MAX_AGE_SEC * 1000) return false;
  const expected = signAdminToken(s, issuedAt);
  try {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function secretsEqual(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAuthorizedAdmin(request: Request): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (secretsEqual(token, secret)) return true;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`));
  if (!match) return false;
  const value = decodeURIComponent(match.slice(ADMIN_COOKIE.length + 1));
  return verifyAdminCookieValue(value, secret);
}

export function adminSetCookieHeader(value: string): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${ADMIN_COOKIE_MAX_AGE_SEC}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function adminClearCookieHeader(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
