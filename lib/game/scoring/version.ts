/** Locked production scoring direction — do not bump without a new approved spec. */
export const SCORING_VERSION = "v0.1.1" as const;

export type ScoringVersion = typeof SCORING_VERSION;
