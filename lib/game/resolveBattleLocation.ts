/**
 * Resolve the location shown on Battle Result cards.
 * On-chain locationOf defaults to 0 until reveal — never treat that alone as Home.
 */

import type { LocationId, NftSide } from "@/types/game";

export function resolveBattleLocationId(input: {
  committed: boolean;
  revealed: boolean;
  settled: boolean;
  /** Raw locationOf(tokenId, day); 0 means unrevealed OR Home. */
  locationOf?: number | null;
  /** Same-day local / vault commit secret. */
  secretLocationId?: LocationId | null;
  /** Location from Revealed(tokenId, day, locationId, …) logs. */
  cohortLocationId?: LocationId | null;
  side?: NftSide | null;
}): LocationId | null {
  if (!input.committed) return null;

  if (input.cohortLocationId != null) {
    return input.cohortLocationId;
  }

  const chain =
    input.locationOf == null || Number.isNaN(Number(input.locationOf))
      ? null
      : Number(input.locationOf);

  if (chain != null && chain !== 0) {
    return chain as LocationId;
  }

  if (input.secretLocationId != null) {
    return input.secretLocationId;
  }

  // Cougars cannot be at Home — locationOf===0 without secret/cohort is unknown.
  if (input.side === "Cougar") return null;

  // Alpaca Home reveal: locationOf stays 0 after reveal/settle.
  if ((input.revealed || input.settled) && chain === 0) {
    return 0;
  }

  return null;
}
