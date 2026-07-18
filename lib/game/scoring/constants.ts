import { SCORING_VERSION } from "./version";

/** Spec constants for scoringVersion v0.1.1 */
export const SCORING_CONSTANTS = {
  scoringVersion: SCORING_VERSION,
  /** Max active NFTs counted per wallet per day. */
  K: 3,
  /** Season length in days (full average denominator). */
  L: 90,
  /** Minimum active days to appear on Season board. */
  D_min: 25,
  /** Minimum peers in a ranking cohort; below → neutral score 50. */
  n_min: 5,
  /** Under-hunt survival weight inside Alpaca local metric. */
  mu: 0.55,
  /** Cougar hunt-pool share weight in performance metric. */
  eta: 0.15,
  /** Neutral score when n < n_min. */
  neutralScore: 50,
  /** Survivor board: minimum under-hunt days for listing. */
  D_min_survivor: 15,
  /**
   * Round performance metrics to this many decimal places before ranking
   * for cross-platform reproducibility.
   */
  metricDecimals: 8,
} as const;
