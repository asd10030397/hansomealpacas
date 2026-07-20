/**
 * Battle Result day-scoped reward display (UI only).
 *
 * Batched settlement emits DaySettled without Credited logs; creditBatch writes
 * credits later. Prefer HansomeGame.pendingRewardOf(tokenId, day) — it recomputes
 * the same nets after finalize whether or not credits have finished.
 */

/**
 * Resolve the wei amount shown on a Battle Result card for one day.
 * Returns null while battle is not ready or pendingRewardOf is still loading.
 */
export function resolveBattleDayRewardWei(input: {
  missedReveal: boolean;
  /** finalizeDay done (credits may still batch). */
  battleReady: boolean;
  /** HansomeGame.pendingRewardOf(tokenId, day); null/undefined = not loaded. */
  pendingWei: bigint | null | undefined;
}): bigint | null {
  if (input.missedReveal) return 0n;
  if (!input.battleReady) return null;
  if (input.pendingWei == null) return null;
  return input.pendingWei;
}
