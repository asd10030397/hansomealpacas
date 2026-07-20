/**
 * Once-per-wallet/day auto-navigation from Battle Result → Choose Location
 * when the next day enters CommitOpen after a completed battle day.
 *
 * Frontend UX only — does not touch settlement, reveal, or phase timing.
 *
 * Authoritative gate: presentationComplete(wallet, battleDay) + queue idle.
 * Clock COMMIT alone never navigates.
 */

import type { GamePhase } from "@/types/game";

export type AutoNavigateCommitFlagState = "pending" | "done";

export type AutoNavigateCommitPlan =
  | { action: "noop" }
  /** Already on Choose Location — mark handled, do not force-scroll. */
  | { action: "mark_only" }
  /** Leave Battle Result and open Commit; scroll once after mount. */
  | { action: "navigate" };

const FLAG_PREFIX = "autoNavigatedToCommit:";

const MEMORY = new Map<string, AutoNavigateCommitFlagState>();

export function autoNavigateToCommitStorageKey(
  wallet: string,
  day: number,
): string {
  const w = (wallet || "anon").toLowerCase();
  return `${FLAG_PREFIX}${w}:${day}`;
}

/** Battle viewing / resolve phases. */
export function isBattlePhase(phase: GamePhase | null | undefined): boolean {
  return phase === "REVEAL" || phase === "SETTLEMENT" || phase === "CLAIM";
}

/**
 * Next day CommitOpen after a battle day.
 * Requires a real day advance — not initial hydration, not same-day noise.
 */
export function isBattleToCommitTransition(input: {
  previousDay: number | null | undefined;
  currentDay: number;
  previousPhase: GamePhase | null | undefined;
  currentPhase: GamePhase;
}): boolean {
  if (input.currentPhase !== "COMMIT") return false;
  if (input.previousDay == null || input.previousPhase == null) return false;
  if (input.currentDay <= input.previousDay) return false;
  return isBattlePhase(input.previousPhase);
}

/** Previous battle day when global clock is on next-day COMMIT. */
export function battleDayForCommitNav(currentDay: number): number {
  return currentDay - 1;
}

export function isChooseLocationPath(
  pathname: string,
  choosePaths: readonly string[],
): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return choosePaths.some((p) => path === p || path.endsWith(p));
}

export function isBattleResultPath(
  pathname: string,
  resultPath: string,
): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === resultPath || path.endsWith(resultPath);
}

export function getAutoNavigatedToCommit(
  wallet: string,
  day: number,
): AutoNavigateCommitFlagState | null {
  const key = autoNavigateToCommitStorageKey(wallet, day);
  const mem = MEMORY.get(key);
  if (mem) return mem;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === "pending" || raw === "done") {
      MEMORY.set(key, raw);
      return raw;
    }
    if (raw === "1") {
      MEMORY.set(key, "done");
      return "done";
    }
  } catch {
    /* private mode */
  }
  return null;
}

export function setAutoNavigatedToCommit(
  wallet: string,
  day: number,
  state: AutoNavigateCommitFlagState,
): void {
  const key = autoNavigateToCommitStorageKey(wallet, day);
  MEMORY.set(key, state);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, state);
  } catch {
    /* private mode */
  }
}

export function shouldScrollAfterAutoNavigateToCommit(
  wallet: string,
  day: number,
): boolean {
  return getAutoNavigatedToCommit(wallet, day) === "pending";
}

export function markAutoNavigateToCommitScrollDone(
  wallet: string,
  day: number,
): void {
  setAutoNavigatedToCommit(wallet, day, "done");
}

/**
 * Decide whether to route to Choose Location on a battle-day → next COMMIT flip.
 *
 * Requires presentationComplete + queueIdle. Busy-false alone is never enough.
 */
export function planAutoNavigateToCommit(input: {
  previousDay: number | null | undefined;
  currentDay: number;
  previousPhase: GamePhase | null | undefined;
  currentPhase: GamePhase;
  pathname: string;
  commitPath: string;
  explorePath: string;
  resultPath: string;
  alreadyHandled: boolean;
  /** Authoritative: battleDay (= currentDay-1) fully presented. */
  presentationComplete: boolean;
  /** Presentation cue queue idle. */
  queueIdle: boolean;
}): AutoNavigateCommitPlan {
  if (input.alreadyHandled) return { action: "noop" };
  if (
    !isBattleToCommitTransition({
      previousDay: input.previousDay,
      currentDay: input.currentDay,
      previousPhase: input.previousPhase,
      currentPhase: input.currentPhase,
    })
  ) {
    return { action: "noop" };
  }
  if (!input.presentationComplete) return { action: "noop" };
  if (!input.queueIdle) return { action: "noop" };

  if (
    isChooseLocationPath(input.pathname, [input.commitPath, input.explorePath])
  ) {
    return { action: "mark_only" };
  }

  return { action: "navigate" };
}

/** Anchor on the Commit / Explore page — scroll target (not document top). */
export { GAME_SECTION_IDS } from "@/lib/game/scrollToGameSection";
/** @deprecated Prefer GAME_SECTION_IDS.commit */
export const COMMIT_CHOOSE_LOCATION_ID = "commit-section";

export function resetAutoNavigateToCommitForTests(): void {
  MEMORY.clear();
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(FLAG_PREFIX)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}
