/**
 * Detect whether a committed NFT completed reveal for Battle Result UI.
 * Prefer on-chain evidence over Revealed logs / localStorage secrets (gasless).
 */

import type { NftSide } from "@/types/game";

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
}): boolean {
  if (!input.committed) return false;
  if (input.cohortRevealed) return true;
  if (input.secretRevealed) return true;

  const loc = input.locationOf;
  if (loc != null && !Number.isNaN(loc) && loc !== 0) {
    return true;
  }

  if (
    input.battleReady &&
    input.pendingRewardWei != null &&
    input.pendingRewardWei > 0n
  ) {
    return true;
  }

  // Cougars cannot be Home — locationOf===0 without other evidence is not reveal.
  if (input.side === "Cougar") return false;

  return false;
}
