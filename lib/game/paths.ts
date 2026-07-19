/**
 * Path maps for the game UI.
 *
 * - Apex www `/game/*` uses GAME_INTERNAL (unchanged marketing site at `/`).
 * - game.hansomealpacas.xyz uses GAME_PUBLIC pretty URLs.
 *
 * CRITICAL (game host): `/game` is rewritten to `/game/dashboard` (PLAY).
 * HOME on the game host MUST be `/` (title menu), never `/game`.
 */

export const GAME_INTERNAL = {
  home: "/game",
  dashboard: "/game/dashboard",
  mint: "/game/mint",
  commit: "/game/commit",
  reveal: "/game/reveal",
  explore: "/game/explore",
  settlement: "/game/settlement",
  myNfts: "/game/my-nfts",
  rewards: "/game/rewards",
  leaderboard: "/game/leaderboard",
  docs: "/game/docs",
  playerGuide: "/game/docs/guide",
} as const;

/** Pretty public paths on game.hansomealpacas.xyz (and game.localhost). */
export const GAME_PUBLIC = {
  home: "/",
  dashboard: "/dashboard",
  mint: "/mint",
  commit: "/commit",
  reveal: "/reveal",
  explore: "/explore",
  settlement: "/settlement",
  myNfts: "/my-nfts",
  rewards: "/rewards",
  leaderboard: "/leaderboard",
  docs: "/docs",
  playerGuide: "/docs/guide",
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
 * Client UI on the game subdomain should use `useGameHref()` or `getGameHref()`.
 */
export const gameHref: GameHrefMap = GAME_INTERNAL;
