import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GAME_HOSTS } from "@/lib/game/paths";

/**
 * On game.hansomealpacas.xyz, map pretty public URLs → /game/* internals.
 * Marketing host (hansomealpacas.xyz) is untouched — `/` stays the marketing site.
 *
 * Public (game host)     → Internal
 * /                      → /game              (title menu — not marketing HOME)
 * /game                  → /game/dashboard    (PLAY)
 * /dashboard             → /game/dashboard
 * /mint                  → /game/mint
 * …other pretty game routes
 *
 * Marketing HOME lives on hansomealpacas.xyz `/` (nav uses absolute URL from game host).
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (!GAME_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Pretty /game → dashboard (homepage is /)
  if (pathname === "/game") {
    const url = request.nextUrl.clone();
    url.pathname = "/game/dashboard";
    return NextResponse.rewrite(url);
  }

  // Nested game routes already match app/game/*
  if (pathname.startsWith("/game/")) {
    return NextResponse.next();
  }

  const map: Record<string, string> = {
    "/": "/game",
    "/mint": "/game/mint",
    "/explore": "/game/explore",
    "/my-nfts": "/game/my-nfts",
    "/rewards": "/game/rewards",
    "/leaderboard": "/game/leaderboard",
    "/docs": "/game/docs",
    "/dashboard": "/game/dashboard",
    "/commit": "/game/commit",
    "/reveal": "/game/reveal",
    "/settlement": "/game/settlement",
  };

  const target = map[pathname];
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
