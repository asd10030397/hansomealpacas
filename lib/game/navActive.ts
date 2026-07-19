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
  "/rewards": "/game/rewards",
  "/leaderboard": "/game/leaderboard",
  "/docs": "/game/docs",
  "/commit": "/game/commit",
  "/reveal": "/game/reveal",
  "/settlement": "/game/settlement",
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

  return false;
}
