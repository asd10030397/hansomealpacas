import { isGameHostHostname } from "@/lib/game/paths";

export { isGameHostHostname } from "@/lib/game/paths";

/** Internal Next routes that always use the game shell. */
export function isGameInternalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/game" || pathname.startsWith("/game/");
}

/**
 * True for any surface that must use gameplay BGM (Alpaca Warpath)
 * and must never play marketing ambient.
 *
 * - www: `/game` and `/game/*`
 * - game.hansomealpacas.xyz: entire host (pretty URLs like `/`, `/dashboard`)
 */
export function isGameAudioRoute(
  pathname: string | null | undefined,
  hostname?: string | null,
): boolean {
  if (isGameInternalPath(pathname)) return true;
  if (isGameHostHostname(hostname)) return true;
  return false;
}

/**
 * Pretty public paths on the game host (rewritten → /game/*).
 * On marketing host, `/` is the meme site — do NOT treat as game chrome.
 */
const GAME_HOST_PRETTY = new Set([
  "/",
  "/mint",
  "/explore",
  "/my-nfts",
  "/claim",
  "/rewards",
  "/leaderboard",
  "/docs",
  "/dashboard",
  "/commit",
  "/result",
  "/reveal",
  "/settlement",
  "/game",
]);

/** True when the marketing LanguageToggle must not render. */
export function shouldHideMarketingLanguageToggle(
  pathname: string | null | undefined,
  hostname?: string,
): boolean {
  if (isGameInternalPath(pathname)) return true;
  if (hostname && isGameHostHostname(hostname) && pathname && GAME_HOST_PRETTY.has(pathname)) {
    return true;
  }
  if (hostname && isGameHostHostname(hostname)) return true;
  return false;
}
