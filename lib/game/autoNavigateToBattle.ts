/**
 * Once-per-wallet/day auto-navigation from Choose Location → Battle Result
 * when the day phase leaves CommitOpen.
 *
 * Frontend UX only — does not touch settlement, reveal, or phase timing.
 */

import type { GamePhase } from "@/types/game";

export type AutoNavigateFlagState = "pending" | "done";

export type AutoNavigatePlan =
  | { action: "noop" }
  /** Already on Battle Result — mark handled, do not force-scroll. */
  | { action: "mark_only" }
  /** Leave Choose Location and open Battle Result; scroll once after mount. */
  | { action: "navigate" };

const FLAG_PREFIX = "autoNavigatedToBattle:";

/** In-memory mirror so SSR/tests and private-mode sessionStorage stay consistent. */
const MEMORY = new Map<string, AutoNavigateFlagState>();

export function autoNavigateToBattleStorageKey(
  wallet: string,
  day: number,
): string {
  const w = (wallet || "anon").toLowerCase();
  return `${FLAG_PREFIX}${w}:${day}`;
}

/** CommitOpen → RevealOpen / Battle Result (REVEAL | SETTLEMENT | CLAIM). */
export function isCommitToBattleTransition(
  previousPhase: GamePhase | null | undefined,
  currentPhase: GamePhase,
): boolean {
  if (previousPhase !== "COMMIT") return false;
  return (
    currentPhase === "REVEAL" ||
    currentPhase === "SETTLEMENT" ||
    currentPhase === "CLAIM"
  );
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

export function getAutoNavigatedToBattle(
  wallet: string,
  day: number,
): AutoNavigateFlagState | null {
  const key = autoNavigateToBattleStorageKey(wallet, day);
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

export function setAutoNavigatedToBattle(
  wallet: string,
  day: number,
  state: AutoNavigateFlagState,
): void {
  const key = autoNavigateToBattleStorageKey(wallet, day);
  MEMORY.set(key, state);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, state);
  } catch {
    /* private mode */
  }
}

/** True when result page should scroll into the settlement section once. */
export function shouldScrollAfterAutoNavigate(
  wallet: string,
  day: number,
): boolean {
  return getAutoNavigatedToBattle(wallet, day) === "pending";
}

/** Mark scroll/navigation fully handled for this wallet+day. */
export function markAutoNavigateScrollDone(wallet: string, day: number): void {
  setAutoNavigatedToBattle(wallet, day, "done");
}

/**
 * Decide whether to route to Battle Result on a Commit → battle phase flip.
 * Call once per observed phase change; storage flag enforces once per day.
 */
export function planAutoNavigateToBattle(input: {
  previousPhase: GamePhase | null | undefined;
  currentPhase: GamePhase;
  pathname: string;
  resultPath: string;
  choosePaths: readonly string[];
  alreadyHandled: boolean;
}): AutoNavigatePlan {
  if (input.alreadyHandled) return { action: "noop" };
  if (
    !isCommitToBattleTransition(input.previousPhase, input.currentPhase)
  ) {
    return { action: "noop" };
  }

  if (isBattleResultPath(input.pathname, input.resultPath)) {
    return { action: "mark_only" };
  }

  if (isChooseLocationPath(input.pathname, input.choosePaths)) {
    return { action: "navigate" };
  }

  // Other game surfaces: do not yank the user; still mark so we never force later.
  return { action: "mark_only" };
}

/** Test helper — clear in-memory + session flags. */
export function resetAutoNavigateToBattleForTests(): void {
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
