import type { GameHrefMap } from "@/lib/game/paths";

/** Public game navigation — single source for desktop, drawer, and bottom dock. */
export type GameNavId =
  | "home"
  | "play"
  | "mint"
  | "myNfts"
  | "claim"
  | "leaderboard"
  | "docs";

export type GameNavItemDef = {
  id: GameNavId;
  hrefKey: keyof GameHrefMap;
  /** i18n key under `t.nav` */
  labelKey: "home" | "play" | "mint" | "myNfts" | "claim" | "leaderboard" | "docs";
  requiresWallet?: boolean;
};

/** Full public route list (desktop + mobile menu). */
export const GAME_NAV_ITEMS: readonly GameNavItemDef[] = [
  { id: "home", hrefKey: "home", labelKey: "home" },
  { id: "play", hrefKey: "dashboard", labelKey: "play" },
  { id: "mint", hrefKey: "mint", labelKey: "mint" },
  /** Always route to the page — it owns the connect/empty states (no modal gate). */
  { id: "myNfts", hrefKey: "myNfts", labelKey: "myNfts" },
  { id: "claim", hrefKey: "claim", labelKey: "claim" },
  { id: "leaderboard", hrefKey: "leaderboard", labelKey: "leaderboard" },
  { id: "docs", hrefKey: "docs", labelKey: "docs" },
] as const;

/** Primary bottom-dock slots (mobile). */
export const GAME_DOCK_PRIMARY: readonly GameNavId[] = [
  "home",
  "play",
  "mint",
  "myNfts",
] as const;

/** Secondary routes revealed via MORE. */
export const GAME_DOCK_MORE: readonly GameNavId[] = [
  "claim",
  "leaderboard",
  "docs",
] as const;

export function navItemById(id: GameNavId): GameNavItemDef {
  const item = GAME_NAV_ITEMS.find((n) => n.id === id);
  if (!item) throw new Error(`Unknown nav id: ${id}`);
  return item;
}
