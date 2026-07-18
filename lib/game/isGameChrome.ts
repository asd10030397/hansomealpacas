import { GAME_HOSTS } from "@/lib/game/paths";

/** Internal Next routes that always use the game shell. */
export function isGameInternalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/game" || pathname.startsWith("/game/");
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
  "/rewards",
  "/leaderboard",
  "/docs",
  "/dashboard",
  "/commit",
  "/reveal",
  "/game",
]);

export function isGameHostHostname(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return GAME_HOSTS.has(host);
}

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
