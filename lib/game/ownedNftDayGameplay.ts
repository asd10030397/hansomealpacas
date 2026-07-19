/**
 * Pure per-day gameplay status for owned NFT cards.
 * Must only use commit/location data for the *current* game day.
 */

import type { LocationId } from "@/types/game";

export const ZERO_COMMIT_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type OwnedNftDayGameStatus =
  | "Idle"
  | "Committed"
  | "Revealed"
  | "Settled";

export type OwnedNftDayGameplayState = {
  gameStatus: OwnedNftDayGameStatus;
  selectedLocationId: LocationId | null;
};

function isCommittedHash(
  commitHash: `0x${string}` | null | undefined,
): boolean {
  return Boolean(commitHash && commitHash !== ZERO_COMMIT_HASH);
}

/**
 * Derive today's Game / Location fields for an NFT card.
 *
 * - No commit hash for this day → Idle, no location (fresh day).
 * - Never infers participation from undated claimable balances.
 * - `locationOf === 0` alone is not Home; only trust it after a non-zero
 *   location, or via a same-day local commit secret.
 */
export function deriveOwnedNftDayGameplayState(input: {
  /** Must be the UI/clock day currently shown to the player. */
  gameplayDay: number | null;
  /** commitHashOf(tokenId, gameplayDay) */
  commitHash: `0x${string}` | null | undefined;
  /** locationOf(tokenId, gameplayDay) — 0 until reveal (or Home after reveal). */
  locationOf: number | null | undefined;
  /** Local secret for the same gameplayDay only. */
  secretLocationId?: LocationId | null;
  secretStatus?: "prepared" | "submitted" | "revealed" | null;
  /** True when HansomeGame.isSettled(gameplayDay). */
  daySettled?: boolean;
}): OwnedNftDayGameplayState {
  if (input.gameplayDay == null || input.gameplayDay < 0) {
    return { gameStatus: "Idle", selectedLocationId: null };
  }

  if (!isCommittedHash(input.commitHash)) {
    return { gameStatus: "Idle", selectedLocationId: null };
  }

  const onChainLoc =
    input.locationOf == null || Number.isNaN(Number(input.locationOf))
      ? null
      : Number(input.locationOf);

  let selectedLocationId: LocationId | null = null;
  let gameStatus: OwnedNftDayGameStatus = "Committed";

  if (onChainLoc != null && onChainLoc !== 0) {
    selectedLocationId = onChainLoc as LocationId;
    gameStatus = "Revealed";
  } else if (input.secretLocationId != null) {
    selectedLocationId = input.secretLocationId;
    gameStatus =
      input.secretStatus === "revealed" ? "Revealed" : "Committed";
  } else {
    selectedLocationId = null;
    gameStatus = "Committed";
  }

  if (input.daySettled) {
    gameStatus = "Settled";
  }

  return { gameStatus, selectedLocationId };
}
