/**
 * UI helpers for GDS E9 — Commit without Reveal.
 * Presentation / local mock only; does not change on-chain rules.
 */

import type { GamePhase } from "@/types/game";

/** Stable outcome key stored on settlement rows (i18n maps this to copy). */
export const MISSED_REVEAL_OUTCOME = "missed_reveal" as const;

export function isMissedRevealOutcome(outcome: string | null | undefined): boolean {
  if (!outcome) return false;
  const o = outcome.trim().toLowerCase();
  return (
    o === MISSED_REVEAL_OUTCOME ||
    o.includes("missed today's reveal") ||
    o.includes("missed reveal") ||
    o.includes("錯過今日的揭露")
  );
}

/** Reveal window is over for this day (Settlement / Claim / settled / dayState ≥ 4). */
export function isRevealPhaseClosed(input: {
  phase: GamePhase | string;
  dayState?: number | null;
  settled?: boolean;
}): boolean {
  if (input.settled) return true;
  if (input.dayState != null && input.dayState >= 4) return true;
  return input.phase === "SETTLEMENT" || input.phase === "CLAIM";
}

/**
 * E9 UI gate: committed, never revealed, and the Reveal window has closed.
 * While Reveal is still open, callers should keep “awaiting reveal” copy.
 */
export function isCommitWithoutReveal(input: {
  revealPhaseClosed: boolean;
  committed: boolean;
  revealed: boolean;
}): boolean {
  return input.revealPhaseClosed && input.committed && !input.revealed;
}

/** Mock / display reward for E9 exclusion — always zero. */
export function e9ZeroReward(): 0 {
  return 0;
}

/** GameRandomness.SeedAlreadySet() — concurrent fulfill is success, not a UI error. */
export function isSeedAlreadySetError(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return /SeedAlreadySet/i.test(message) || /0xbf136bb2/i.test(message);
}

export function isSeedMissingError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /SeedMissing|settlement randomness|等待結算隨機數/i.test(message);
}

/** Canonical friendly copy key used by formatRobinhoodWriteError + UI. */
export const SEED_MISSING_UI_MESSAGE = "Waiting for settlement randomness.";
