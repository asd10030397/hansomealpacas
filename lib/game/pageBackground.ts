/**
 * Presentation-only page background themes for /game/* routes.
 * Does not affect gameplay, commits, or rewards.
 */

import type { LocationId } from "@/types/game";

export type PageBgTheme =
  | "world"
  | "home"
  | "mountain"
  | "grassland"
  | "forest"
  | "river"
  | "battle"
  | "reward"
  | "navHome"
  | "nfts"
  | "rewards"
  | "leaderboard"
  | "docs";

export const PAGE_BG_EVENT = "hansome:page-bg";

/** Primary URLs — WebP for performance. PNG siblings exist for authoring. */
export const PAGE_BG_URLS: Record<PageBgTheme, string> = {
  world: "/game/backgrounds/world.webp",
  home: "/game/backgrounds/home.webp",
  mountain: "/game/backgrounds/mountain.webp",
  grassland: "/game/backgrounds/grassland.webp",
  forest: "/game/backgrounds/forest.webp",
  river: "/game/backgrounds/river.webp",
  battle: "/game/backgrounds/battle.webp",
  reward: "/game/backgrounds/reward.webp",
  navHome: "/game/backgrounds/nav-home.webp",
  nfts: "/game/backgrounds/nfts.webp",
  rewards: "/game/backgrounds/rewards.webp",
  leaderboard: "/game/backgrounds/leaderboard.webp",
  docs: "/game/backgrounds/docs.webp",
};

const LOCATION_THEME: Record<LocationId, PageBgTheme> = {
  0: "home",
  1: "mountain",
  2: "grassland",
  3: "forest",
  4: "river",
};

export function locationToPageBg(locationId: number | null | undefined): PageBgTheme | null {
  if (locationId == null || locationId < 0 || locationId > 4) return null;
  return LOCATION_THEME[locationId as LocationId];
}

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  // Pretty game-host paths and apex /game/* both supported
  if (p === "/game") return "/";
  if (p.startsWith("/game/")) return p.slice("/game".length) || "/";
  return p;
}

export function resolvePageBackground(
  pathname: string,
  opts?: { locationId?: number | null },
): PageBgTheme {
  const path = normalizePath(pathname);
  const locTheme = locationToPageBg(opts?.locationId ?? null);

  if (path === "/result" || path === "/reveal" || path === "/settlement") {
    return "battle";
  }
  if (path === "/claim" || path === "/rewards") return "rewards";
  if (path === "/my-nfts") return "nfts";
  if (path === "/leaderboard") return "leaderboard";
  if (path === "/docs" || path.startsWith("/docs/")) return "docs";
  if (path === "/mint") return "home";
  if (path === "/explore" || path === "/commit") {
    return locTheme ?? "world";
  }
  if (path === "/dashboard") return "world";
  // Title / HOME menu
  if (path === "/" || path === "") return "navHome";
  return "world";
}

export function dispatchPageBackgroundLocation(locationId: number | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PAGE_BG_EVENT, { detail: { locationId } }),
  );
}
