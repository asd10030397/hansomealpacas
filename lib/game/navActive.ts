/**
 * Active-tab matching for game nav on both:
 * - apex: /game/dashboard
 * - game host pretty: /dashboard  (and raw /game/dashboard URLs)
 */

const PRETTY_TO_INTERNAL: Record<string, string> = {
  "/": "/game",
  "/dashboard": "/game/dashboard",
  "/mint": "/game/mint",
  "/explore": "/game/explore",
  "/my-nfts": "/game/my-nfts",
  "/claim": "/game/claim",
  "/rewards": "/game/claim",
  "/leaderboard": "/game/leaderboard",
  "/forum": "/game/forum",
  "/docs": "/game/docs",
  "/commit": "/game/commit",
  "/result": "/game/result",
  "/reveal": "/game/result",
  "/settlement": "/game/result",
};

/** HOME on game host is `/` → title menu (`/game`), never dashboard. */
export function isNavActive(pathname: string, href: string, homeHref: string): boolean {
  if (href === homeHref) {
    if (homeHref === "/") {
      // Title menu only — exclude /game/dashboard and other /game/*
      return pathname === "/" || pathname === "/game";
    }
    return pathname === href;
  }

  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const internal = PRETTY_TO_INTERNAL[href];
  if (internal && (pathname === internal || pathname.startsWith(`${internal}/`))) {
    return true;
  }

  // Claim nav item: treat legacy /rewards as active too.
  if (
    href === "/claim" ||
    href === "/game/claim" ||
    href.endsWith("/claim")
  ) {
    if (
      pathname === "/rewards" ||
      pathname === "/game/rewards" ||
      pathname.startsWith("/rewards/") ||
      pathname.startsWith("/game/rewards/")
    ) {
      return true;
    }
  }

  return false;
}
