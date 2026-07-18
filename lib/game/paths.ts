/**
 * Internal Next.js paths live under `/game/*`.
 * On `game.hansomealpacas.xyz`, middleware rewrites pretty URLs → these paths.
 */

export const GAME_INTERNAL = {
  home: "/game",
  dashboard: "/game/dashboard",
  mint: "/game/mint",
  commit: "/game/commit",
  reveal: "/game/reveal",
  explore: "/game/explore",
  myNfts: "/game/my-nfts",
  rewards: "/game/rewards",
  leaderboard: "/game/leaderboard",
  docs: "/game/docs",
} as const;

/** Links used inside the game shell (work on apex `/game/*` and game host after rewrite). */
export const gameHref = {
  home: "/game",
  dashboard: "/game/dashboard",
  mint: "/game/mint",
  commit: "/game/commit",
  reveal: "/game/reveal",
  explore: "/game/explore",
  myNfts: "/game/my-nfts",
  rewards: "/game/rewards",
  leaderboard: "/game/leaderboard",
  docs: "/game/docs",
} as const;

export const GAME_HOSTS = new Set([
  "game.hansomealpacas.xyz",
  "game.localhost",
  "game.local",
]);
