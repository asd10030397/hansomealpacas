"use client";

import type { PageBgTheme } from "@/lib/game/pageBackground";
import "@/styles/game-scenic-bg.css";

/** Themes that use the new layered scenic system (HOME / MINT excluded). */
const SCENIC_THEMES = new Set<PageBgTheme>([
  "world",
  "battle",
  "nfts",
  "rewards",
  "reward",
  "leaderboard",
  "docs",
]);

type ScenicKind = "play" | "battle" | "ranch" | "vault" | "hall" | "library";

function themeToScenic(theme: PageBgTheme): ScenicKind | null {
  switch (theme) {
    case "world":
      return "play";
    case "battle":
      return "battle";
    case "nfts":
      return "ranch";
    case "rewards":
    case "reward":
      return "vault";
    case "leaderboard":
      return "hall";
    case "docs":
      return "library";
    default:
      return null;
  }
}

/**
 * Layered scenic backdrop for game pages (not HOME / MINT).
 * Presentation only — does not affect gameplay.
 */
export function GamePageScenic({ theme }: { theme: PageBgTheme }) {
  if (!SCENIC_THEMES.has(theme)) return null;
  const kind = themeToScenic(theme);
  if (!kind) return null;

  const animated = kind === "play" || kind === "battle";

  return (
    <div
      className={`game-scenic game-scenic--${kind}${animated ? " game-scenic--animated" : ""}`}
      aria-hidden
      data-scenic={kind}
    >
      <div className="game-scenic__sky" />
      <div className="game-scenic__art" />
      {animated ? (
        <>
          <div className="game-scenic__clouds game-scenic__clouds--a" />
          <div className="game-scenic__clouds game-scenic__clouds--b" />
        </>
      ) : null}
      <div className="game-scenic__depth" />
      <div className="game-scenic__wash" />
    </div>
  );
}

export function usesGamePageScenic(theme: PageBgTheme): boolean {
  return SCENIC_THEMES.has(theme);
}
