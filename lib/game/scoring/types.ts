import type { ScoringVersion } from "./version";

/** GDS location ids: Home=0 … River=4 */
export type ScoringLocationId = 0 | 1 | 2 | 3 | 4;

/**
 * Reproducible settlement snapshot for one day.
 *
 * Integrity contract (indexer / backend only — never trust the client):
 * - Built only after on-chain settlement for `day` has finalized (I-SINGLE-SETTLE).
 * - Fields must be derived from finalized reveal/settlement outputs (or equivalent
 *   audited indexer reconstruction), not from mutable UI or wallet RPC guesses.
 * - `owner` = ERC-721 owner at **Reveal close** for that protocol day.
 * - `day` is the GDS integer protocol day (UTC day bounds per GDS §6.2); scoring
 *   never interprets local wall-clock timezones.
 */
export type SettlementDayInput = {
  scoringVersion: ScoringVersion;
  /** Protocol day index (integer). */
  day: number;
  /** Season identifier (e.g. "season-1"). Hard reset per season. */
  seasonId: string;
  alpacas: SettlementAlpacaInput[];
  cougars: SettlementCougarInput[];
};

export type SettlementAlpacaInput = {
  tokenId: number;
  /** Owner at Reveal close — lowercase hex recommended. */
  owner: string;
  locationId: ScoringLocationId;
  /** GDS net Alpaca reward r^A,net for the day. */
  netReward: number;
  /** Final penalty rate π ∈ [0, 1]. */
  penaltyRate: number;
  /** True iff huntable location and C_d(L) ≥ 1. */
  underHunt: boolean;
};

export type SettlementCougarInput = {
  tokenId: number;
  owner: string;
  locationId: ScoringLocationId;
  /** GDS hunt success: A_d(L) ≥ 1. */
  huntSuccess: boolean;
  /** σ = A_d(L) on success; 0 on miss. */
  alpacaCountAtLocation: number;
  /** Hunting Pool share r^C,hunt (0 on miss). */
  huntPoolShare: number;
};

export type NftDailyScore = {
  tokenId: number;
  owner: string;
  side: "Alpaca" | "Cougar";
  locationId: ScoringLocationId;
  /** Local/role performance metric before percentile. */
  performanceMetric: number;
  /** Midrank percentile score in (0, 100], or exactly 50 if neutral fallback. */
  score: number;
  /** Why this score was assigned. */
  fallback: ScoreFallback;
  peerCount: number;
  /** Survivor component: only meaningful for under-hunt Alpacas. */
  survivorDayScore: number | null;
};

export type ScoreFallback =
  | "none"
  | "neutral_insufficient_peers"
  | "identical_tie_shared_midrank";

export type WalletDailyScore = {
  owner: string;
  score: number;
  activeTokenIds: number[];
  countedTokenIds: number[];
  /** True if wallet had ≥1 valid NFT that day. */
  active: boolean;
};

export type DayScoreResult = {
  scoringVersion: ScoringVersion;
  day: number;
  seasonId: string;
  nftScores: NftDailyScore[];
  walletScores: WalletDailyScore[];
};

export type SeasonScoreResult = {
  scoringVersion: ScoringVersion;
  seasonId: string;
  L: number;
  wallets: {
    owner: string;
    seasonScore: number;
    activeDays: number;
    eligible: boolean;
    /** Length L; inactive days are 0. */
    dailyScores: number[];
  }[];
};
