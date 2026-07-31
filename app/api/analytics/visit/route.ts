import { NextResponse } from "next/server";
import { bindAndAssertDeploymentScope } from "@/lib/hansome-score/deployment-scope";
import {
  OPT_OUT_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SEC,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE_SEC,
} from "@/lib/website-analytics/constants";
import { recordPageView } from "@/lib/website-analytics/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pathname?: string;
  visitorId?: string;
  sessionId?: string;
  referrer?: string | null;
};

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function newId(): string {
  return crypto.randomUUID();
}

function cookieHeader(
  name: string,
  value: string,
  maxAge: number,
): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function POST(request: Request) {
  try {
    bindAndAssertDeploymentScope(request);
    let body: Body = {};
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = (await request.json()) as Body;
    } else {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text) as Body;
        } catch {
          body = {};
        }
      }
    }

    const optOut = readCookie(request, OPT_OUT_COOKIE) === "1";
    let visitorId =
      (body.visitorId && isUuid(body.visitorId) ? body.visitorId : null) ||
      readCookie(request, VISITOR_COOKIE);
    let sessionId =
      (body.sessionId && isUuid(body.sessionId) ? body.sessionId : null) ||
      readCookie(request, SESSION_COOKIE);

    const setCookies: string[] = [];
    if (!visitorId || !isUuid(visitorId)) {
      visitorId = newId();
    }
    setCookies.push(
      cookieHeader(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_MAX_AGE_SEC),
    );

    if (!sessionId || !isUuid(sessionId)) {
      sessionId = newId();
    }
    setCookies.push(
      cookieHeader(SESSION_COOKIE, sessionId, SESSION_COOKIE_MAX_AGE_SEC),
    );

    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host");

    const result = await recordPageView({
      pathname: body.pathname || "/",
      visitorId,
      sessionId,
      referrer: body.referrer ?? request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
      host,
      optOut,
      headers: request.headers,
    });

    const json = NextResponse.json(
      {
        ok: true,
        counted: result.counted,
        debounced: Boolean(result.debounced),
        excluded: result.excluded ?? null,
      },
      { status: 200 },
    );
    for (const c of setCookies) {
      json.headers.append("Set-Cookie", c);
    }
    return json;
  } catch {
    // Fail silently for clients — do not block UX
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
