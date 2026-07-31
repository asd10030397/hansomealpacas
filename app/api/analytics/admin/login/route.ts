import { NextResponse } from "next/server";
import {
  adminClearCookieHeader,
  adminSetCookieHeader,
  getAdminSecret,
  mintAdminCookieValue,
  secretsEqual,
} from "@/lib/website-analytics/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = getAdminSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Admin secret not configured" },
      { status: 503 },
    );
  }

  let provided = "";
  try {
    const body = (await request.json()) as { secret?: string };
    provided = body.secret?.trim() || "";
  } catch {
    provided = "";
  }

  if (!provided || !secretsEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = mintAdminCookieValue(secret);
  if (!token) {
    return NextResponse.json({ error: "Mint failed" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", adminSetCookieHeader(token));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", adminClearCookieHeader());
  return res;
}
