/**
 * Pure settlement UI status helpers (no network).
 * On-chain DayState: Idle=0, CommitOpen=1, CommitClosed=2, RevealOpen=3,
 * RevealClosed=4, Settlement=5, Claimable=6 — HansomeGame mainly uses 1/3/4/6.
 */

import { isSeedMissingError } from "@/lib/game/missedReveal";

export type SettlementUiStatus =
  | "loading"
  | "pending"
  | "available"
  | "waiting_seed"
  | "processing"
  | "completed"
  | "unavailable"
  | "error";

export type ChainDayState = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Map contract dayState + isSettled (+ optional in-flight settle tx) → UI status.
 */
export function deriveSettlementUiStatus(input: {
  dayState: number | null;
  isSettled: boolean | null;
  settleTxPending?: boolean;
  error?: string | null;
  loading?: boolean;
  /** When settle is eligible but day seed is not fulfilled yet. */
  hasDaySeed?: boolean | null;
}): SettlementUiStatus {
  if (input.loading) return "loading";
  if (input.settleTxPending) return "processing";
  if (input.isSettled === true) return "completed";

  // Seed gate — prefer dedicated UI over generic contract error.
  if (isSeedMissingError(input.error)) return "waiting_seed";

  if (input.error) return "error";
  if (input.dayState == null || input.isSettled == null) return "unavailable";

  // RevealClosed (4) or Settlement (5) → settleDay eligible
  if (input.dayState === 4 || input.dayState === 5) {
    if (input.hasDaySeed === false) return "waiting_seed";
    return "available";
  }

  // Still in commit/reveal window
  if (input.dayState === 1 || input.dayState === 2 || input.dayState === 3) {
    return "pending";
  }

  // Claimable without isSettled should not happen; treat as completed if claimed path
  if (input.dayState === 6) return "completed";

  return "unavailable";
}

export function settlementStatusLabel(status: SettlementUiStatus): string {
  switch (status) {
    case "loading":
      return "Loading…";
    case "pending":
      return "Move revealed — battle resolves when Reveal ends";
    case "available":
      return "Reveal closed — settling battle now";
    case "waiting_seed":
      return "Waiting for settlement randomness.";
    case "processing":
      return "Processing…";
    case "completed":
      return "Completed";
    case "unavailable":
      return "Unavailable";
    case "error":
      return "Error";
  }
}

/** Prevent double claim submissions while a tx is in flight or already claimed. */
export function canSubmitClaim(input: {
  claimableTotal: bigint;
  isSubmitting: boolean;
  hasPendingTx: boolean;
}): boolean {
  if (input.isSubmitting || input.hasPendingTx) return false;
  return input.claimableTotal > 0n;
}
