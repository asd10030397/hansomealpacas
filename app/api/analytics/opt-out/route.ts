import { NextResponse } from "next/server";
import {
  OPT_OUT_COOKIE,
  VISITOR_COOKIE_MAX_AGE_SEC,
} from "@/lib/website-analytics/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optOutCookie(enabled: boolean): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const parts = [
    `${OPT_OUT_COOKIE}=${enabled ? "1" : "0"}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${enabled ? VISITOR_COOKIE_MAX_AGE_SEC : 0}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** POST { optOut: true|false } — sets first-party opt-out cookie. */
export async function POST(request: Request) {
  let optOut = true;
  try {
    const body = (await request.json()) as { optOut?: boolean };
    if (typeof body.optOut === "boolean") optOut = body.optOut;
  } catch {
    optOut = true;
  }
  const res = NextResponse.json({ ok: true, optOut });
  res.headers.append("Set-Cookie", optOutCookie(optOut));
  return res;
}
