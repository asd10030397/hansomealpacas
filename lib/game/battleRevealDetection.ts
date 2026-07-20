/**
 * Detect whether a committed NFT completed reveal for Battle Result UI.
 * Prefer on-chain evidence over Revealed logs / localStorage secrets (gasless).
 *
 * Enum location Home === 0 is valid — never use truthiness on locationId.
 */

import type { NftSide } from "@/types/game";

export type BattleRevealStatus =
  /** Still gathering location / cohort / pendingReward evidence. */
  | "loading"
  /** Committed; reveal window still open and not yet proven on-chain. */
  | "pending"
  /** Affirmative on-chain (or equivalent) reveal evidence. */
  | "revealed"
  /** Commit without reveal after window closed — confirmed. */
  | "missed";

/**
 * True when reveal completed on-chain (or equivalently proven).
 * Does not invent Home (locationOf===0) as reveal without other evidence.
 */
export function isBattleRevealDetected(input: {
  committed: boolean;
  /** Revealed(day) log cohort includes this token. */
  cohortRevealed?: boolean;
  /** Local commit secret status === revealed. */
  secretRevealed?: boolean;
  /**
   * Raw HansomeGame.locationOf(tokenId, day).
   * Non-zero proves reveal. Zero is ambiguous (unrevealed OR Alpaca Home).
   */
  locationOf?: number | null;
  side?: NftSide | null;
  /**
   * After finalize, pendingRewardOf > 0 proves the token was in settlement
   * tables (revealed). Zero is inconclusive (missed or zero-net).
   */
  pendingRewardWei?: bigint | null;
  /** finalizeDay / isSettled UI — enables pendingRewardOf evidence. */
  battleReady?: boolean;
  /** Supplemental: local secret location (incl. Home 0). */
  secretLocationId?: number | null;
  secretStatus?: "prepared" | "submitted" | "revealed" | string | null;
}): boolean {
  return resolveBattleRevealStatus({
    committed: input.committed,
    revealPhaseClosed: true,
    cohortIndexed: true,
    cohortRevealed: input.cohortRevealed ?? false,
    secretRevealed: input.secretRevealed ?? false,
    secretLocationId: input.secretLocationId,
    secretStatus: input.secretStatus,
    locationOf: input.locationOf,
    locationOfLoaded: input.locationOf !== undefined,
    side: input.side,
    pendingRewardWei: input.pendingRewardWei,
    pendingRewardLoaded:
      input.battleReady === true
        ? input.pendingRewardWei !== undefined
        : true,
    battleReady: input.battleReady,
  }) === "revealed";
}

/**
 * Full reveal classification for Battle Result rows.
 * Unknown/loading never collapses into missedReveal.
 */
export function resolveBattleRevealStatus(input: {
  committed: boolean;
  revealPhaseClosed: boolean;
  /**
   * null = Revealed-log index still loading / not attempted.
   * true = index finished (may be empty).
   * false = index failed (do not treat as missed).
   */
  cohortIndexed: boolean | null;
  cohortRevealed: boolean;
  secretRevealed: boolean;
  secretLocationId?: number | null;
  secretStatus?: string | null;
  locationOf?: number | null;
  locationOfLoaded: boolean;
  side?: NftSide | null;
  pendingRewardWei?: bigint | null;
  pendingRewardLoaded: boolean;
  battleReady?: boolean;
}): BattleRevealStatus {
  if (!input.committed) return "pending";

  if (hasAffirmativeRevealEvidence(input)) {
    return "revealed";
  }

  if (!input.revealPhaseClosed) {
    return "pending";
  }

  // After reveal closes: wait for decisive evidence before MISSED.
  if (!input.locationOfLoaded) return "loading";
  if (input.cohortIndexed == null) return "loading";
  if (input.cohortIndexed === false) return "loading";
  if (input.battleReady && !input.pendingRewardLoaded) return "loading";

  // Home (0) + Alpaca: after evidence loaded, secret Home is supplemental only.
  if (
    input.side === "Alpaca" &&
    input.locationOf != null &&
    !Number.isNaN(input.locationOf) &&
    input.locationOf === 0 &&
    input.secretLocationId === 0 &&
    (input.secretStatus === "submitted" ||
      input.secretStatus === "revealed" ||
      input.secretRevealed)
  ) {
    return "revealed";
  }

  // battleReady + locationOf===0 + Alpaca + pending loaded as 0n:
  // still inconclusive alone — require cohort membership or secret Home match above.
  // Confirmed miss: closed window, indexes loaded, no affirmative evidence.
  return "missed";
}

function hasAffirmativeRevealEvidence(input: {
  cohortRevealed: boolean;
  secretRevealed: boolean;
  locationOf?: number | null;
  side?: NftSide | null;
  pendingRewardWei?: bigint | null;
  battleReady?: boolean;
}): boolean {
  if (input.cohortRevealed) return true;
  if (input.secretRevealed) return true;

  const loc = input.locationOf;
  if (loc != null && !Number.isNaN(Number(loc)) && Number(loc) !== 0) {
    return true;
  }

  if (
    input.battleReady &&
    input.pendingRewardWei != null &&
    input.pendingRewardWei > 0n
  ) {
    return true;
  }

  return false;
}
