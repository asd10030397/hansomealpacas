/**
 * Pure settlement UI status helpers (no network).
 * On-chain DayState: Idle=0, CommitOpen=1, CommitClosed=2, RevealOpen=3,
 * RevealClosed=4, Settlement=5, Claimable=6 — HansomeGame mainly uses 1/3/4/6.
 *
 * Battle presentation uses battle-ready (finalizeDay), not full credit completion.
 */

import { isSeedMissingError } from "@/lib/game/missedReveal";

export type SettlementUiStatus =
  | "loading"
  | "pending"
  | "available"
  | "waiting_seed"
  | "processing"
  /** finalizeDay done — outcomes ready; creditBatch may still run. */
  | "battle_ready"
  /** All creditBatch writes done (isSettled). */
  | "fully_settled"
  /**
   * @deprecated Prefer fully_settled / battle_ready.
   * Kept for local mock rows; treated as fully settled.
   */
  | "completed"
  | "unavailable"
  | "error";

export type ChainDayState = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Outcomes + animations may start (do not wait for creditBatch). */
export function isSettlementBattleReady(
  status: SettlementUiStatus | null | undefined,
): boolean {
  return (
    status === "battle_ready" ||
    status === "fully_settled" ||
    status === "completed"
  );
}

/** Distributor credits fully written for the day. */
export function isSettlementFullySettled(
  status: SettlementUiStatus | null | undefined,
): boolean {
  return status === "fully_settled" || status === "completed";
}

/** Rewards still being credited in the background. */
export function isSettlementRewardProcessing(
  status: SettlementUiStatus | null | undefined,
): boolean {
  return status === "battle_ready";
}

/**
 * Map contract dayState + isSettled (+ optional in-flight settle tx) → UI status.
 */
export function deriveSettlementUiStatus(input: {
  dayState: number | null;
  isSettled: boolean | null;
  /** Outcomes + reward tables ready (credits may still be batching). */
  isFinalized?: boolean | null;
  settleTxPending?: boolean;
  error?: string | null;
  loading?: boolean;
  /** When settle is eligible but day seed is not fulfilled yet. */
  hasDaySeed?: boolean | null;
  /**
   * Wire UI phase from the day clock. When SETTLEMENT/CLAIM, settle is eligible
   * even if dayState already rolled to Idle after the Battle pad (late settle).
   */
  phase?: "COMMIT" | "REVEAL" | "SETTLEMENT" | "CLAIM" | null;
}): SettlementUiStatus {
  if (input.loading) return "loading";
  if (input.settleTxPending) return "processing";

  // Full credits first — stronger than battle-ready.
  if (input.isSettled === true) return "fully_settled";

  // Battle-ready as soon as finalizeDay lands (credits may still batch).
  if (input.isFinalized === true) return "battle_ready";

  // Seed gate — prefer dedicated UI over generic contract error.
  if (isSeedMissingError(input.error)) return "waiting_seed";

  if (input.error) return "error";
  if (input.isSettled == null) return "unavailable";

  // RevealClosed (4) or Settlement (5) → settle eligible (Battle window)
  if (input.dayState === 4 || input.dayState === 5) {
    if (input.hasDaySeed === false) return "waiting_seed";
    return "available";
  }

  // Clock says Battle/Claim and not settled — cover late settle after dayEnd → Idle.
  if (input.phase === "SETTLEMENT" || input.phase === "CLAIM") {
    if (input.hasDaySeed === false) return "waiting_seed";
    return "available";
  }

  // Still in commit/reveal window
  if (input.dayState === 1 || input.dayState === 2 || input.dayState === 3) {
    return "pending";
  }

  // Claimable dayState after finalize (credits may still be in flight)
  if (input.dayState === 6) return "battle_ready";

  if (input.dayState == null) return "unavailable";
  return "unavailable";
}

export function settlementStatusLabel(status: SettlementUiStatus): string {
  switch (status) {
    case "loading":
      return "Loading…";
    case "pending":
      return "Resolving battle…";
    case "available":
      return "Settling battle now";
    case "waiting_seed":
      return "Waiting for settlement randomness.";
    case "processing":
      return "Processing…";
    case "battle_ready":
      return "Battle ready";
    case "fully_settled":
    case "completed":
      return "Fully settled";
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
