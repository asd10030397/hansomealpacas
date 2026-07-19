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
  /** Unified Result Phase (reveal + settle + battle + claim). */
  result: "/game/result",
  /** Alias → Result (legacy deep links). */
  reveal: "/game/result",
  explore: "/game/explore",
  /** Alias → Result (legacy deep links). */
  settlement: "/game/result",
  myNfts: "/game/my-nfts",
  /** Global Claim page — permanently claimable HANSOME. */
  claim: "/game/claim",
  /** @deprecated Alias → claim (legacy deep links / bookmarks). */
  rewards: "/game/claim",
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
  result: "/result",
  reveal: "/result",
  explore: "/explore",
  settlement: "/result",
  myNfts: "/my-nfts",
  claim: "/claim",
  /** @deprecated Alias → claim. */
  rewards: "/claim",
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
