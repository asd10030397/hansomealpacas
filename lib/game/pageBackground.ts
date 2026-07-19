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
  | "reward";

export const PAGE_BG_EVENT = "hansome:page-bg";

export const PAGE_BG_URLS: Record<PageBgTheme, string> = {
  world: "/game/backgrounds/world.webp",
  home: "/game/backgrounds/home.webp",
  mountain: "/game/backgrounds/mountain.webp",
  grassland: "/game/backgrounds/grassland.webp",
  forest: "/game/backgrounds/forest.webp",
  river: "/game/backgrounds/river.webp",
  battle: "/game/backgrounds/battle.webp",
  reward: "/game/backgrounds/reward.webp",
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
  if (path === "/rewards") return "reward";
  if (path === "/mint") return "home";
  if (path === "/my-nfts") return "home";
  if (path === "/explore" || path === "/commit") {
    return locTheme ?? "world";
  }
  if (path === "/dashboard") return "world";
  if (path === "/" || path === "") return "world";
  if (path === "/leaderboard" || path === "/docs" || path.startsWith("/docs/")) {
    return "world";
  }
  return "world";
}

export function dispatchPageBackgroundLocation(locationId: number | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PAGE_BG_EVENT, { detail: { locationId } }),
  );
}
