/**
 * Internal Next.js paths live under `/game/*`.
 * On `game.hansomealpacas.xyz`, middleware rewrites pretty URLs → these paths.
 *
 * HOME is always the marketing landing page — never a /game route.
 * PLAY is the live daily-game dashboard.
 */

export const MARKETING_ORIGIN = (
  process.env.NEXT_PUBLIC_WEBSITE?.trim() || "https://hansomealpacas.xyz"
).replace(/\/$/, "");

/** Absolute marketing homepage (use on game subdomain so HOME leaves the game host). */
export const MARKETING_HOME = `${MARKETING_ORIGIN}/`;

export const GAME_INTERNAL = {
  home: "/",
  /** Daily Game command center */
  dashboard: "/game/dashboard",
  /** Game title / main menu (not HOME) */
  title: "/game",
  mint: "/game/mint",
  commit: "/game/commit",
  reveal: "/game/reveal",
  explore: "/game/explore",
  settlement: "/game/settlement",
  myNfts: "/game/my-nfts",
  rewards: "/game/rewards",
  leaderboard: "/game/leaderboard",
  docs: "/game/docs",
} as const;

/** Pretty public paths on game.hansomealpacas.xyz (and game.localhost). */
export const GAME_PUBLIC = {
  /** Leave game host → marketing site */
  home: MARKETING_HOME,
  dashboard: "/dashboard",
  /** On game host, `/` is the title menu (middleware → /game) */
  title: "/",
  mint: "/mint",
  commit: "/commit",
  reveal: "/reveal",
  explore: "/explore",
  settlement: "/settlement",
  myNfts: "/my-nfts",
  rewards: "/rewards",
  leaderboard: "/leaderboard",
  docs: "/docs",
} as const;

export type GameHrefMap = { readonly [K in keyof typeof GAME_INTERNAL]: string };

export const GAME_HOSTS = new Set([
  "game.hansomealpacas.xyz",
  "game.localhost",
  "game.local",
]);

export function isGameHostHostname(hostname?: string | null): boolean {
  if (!hostname) return false;
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return GAME_HOSTS.has(host);
}

/** Resolve link map for the current host (browser) or an explicit hostname. */
export function getGameHref(hostname?: string | null): GameHrefMap {
  let host = hostname;
  if (host == null && typeof window !== "undefined") {
    host = window.location.hostname;
  }
  return isGameHostHostname(host) ? GAME_PUBLIC : GAME_INTERNAL;
}

/**
 * Default export for SSR / apex `/game/*` pages.
 * Prefer `useGameHref()` in client components so game-host HOME is absolute.
 */
export const gameHref: GameHrefMap = GAME_INTERNAL;
