import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GAME_HOSTS } from "@/lib/game/paths";

/**
 * On game.hansomealpacas.xyz, map pretty public URLs → /game/* internals.
 * Marketing host (hansomealpacas.xyz) is untouched — `/` stays the marketing site.
 *
 * Public (game host)     → Internal
 * /                      → /game              (main menu)
 * /game                  → /game/dashboard
 * /mint                  → /game/mint
 * /explore               → /game/explore
 * /my-nfts               → /game/my-nfts
 * /claim                 → /game/claim
 * /rewards               → /game/claim (legacy)
 * /leaderboard           → /game/leaderboard
 * /season                → /game/season
 * /season/:id            → /game/season/:id
 * /docs                  → /game/docs
 * /game/commit|reveal    → same
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

  // Pretty forum thread URLs on game host
  if (pathname.startsWith("/forum/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/game${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Pretty season URLs on game host (e.g. /season/1)
  if (pathname.startsWith("/season/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/game${pathname}`;
    return NextResponse.rewrite(url);
  }

  const map: Record<string, string> = {
    "/": "/game",
    "/mint": "/game/mint",
    "/explore": "/game/explore",
    "/my-nfts": "/game/my-nfts",
    "/claim": "/game/claim",
    "/rewards": "/game/claim",
    "/leaderboard": "/game/leaderboard",
    "/forum": "/game/forum",
    "/season": "/game/season",
    "/docs": "/game/docs",
    "/docs/guide": "/game/docs/guide",
    "/dashboard": "/game/dashboard",
    "/commit": "/game/commit",
    "/result": "/game/result",
    "/reveal": "/game/result",
    "/settlement": "/game/result",
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
