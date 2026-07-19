/**
 * Home (locationId=0) is ambiguous with the unrevealed locationOf default (0).
 * Never treat locationOf===0 as proof that a Home commit was already revealed.
 */

/** True only when on-chain locationOf proves a prior non-Home reveal. */
export function isDefinitelyAlreadyRevealed(input: {
  locationOf: number;
  commitLocationId: number;
}): boolean {
  const loc = Number(input.locationOf);
  const committed = Number(input.commitLocationId);
  if (!Number.isInteger(loc) || !Number.isInteger(committed)) return false;
  if (loc < 0 || loc > 4 || committed < 0 || committed > 4) return false;
  // Unrevealed storage is 0 — cannot distinguish from Home.
  if (loc === 0) return false;
  return loc === committed;
}
