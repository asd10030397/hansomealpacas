/**
 * HANSOME Season Scoring — production module
 * scoringVersion = "v0.1.1"
 *
 * Spec: docs/HANSOME_Season_Scoring_Spec_v0.1.1.md
 * Not wired to the Demo leaderboard UI yet.
 */

export { SCORING_VERSION } from "./version";
export type { ScoringVersion } from "./version";
export { SCORING_CONSTANTS } from "./constants";
export { scoreSettlementDay } from "./scoreDay";
export {
  computeSeasonScores,
  emptyDayWalletScores,
  assertUniqueProtocolDays,
} from "./season";
export {
  recomputeSeasonFromSettlements,
  canonicalSettlementJson,
} from "./recompute";
export {
  computeHunterSeason,
  computeSurvivorSeason,
  rankEarningsWithinRole,
  BOARDS_META,
} from "./boards";
export { alpacaLocalMetric, scoreAlpacasWithinLocations } from "./alpaca";
export { cougarPerformanceMetric, scoreCougarsWithinRole } from "./cougar";
export { scoreWalletsForDay } from "./wallet";
export { midrankPercentileScores, roundMetric } from "./percentile";

export type {
  SettlementDayInput,
  SettlementAlpacaInput,
  SettlementCougarInput,
  ScoringLocationId,
  NftDailyScore,
  WalletDailyScore,
  DayScoreResult,
  SeasonScoreResult,
  ScoreFallback,
} from "./types";
