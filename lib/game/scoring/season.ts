import { SCORING_CONSTANTS } from "./constants";
import { SCORING_VERSION } from "./version";
import type { DayScoreResult, SeasonScoreResult, WalletDailyScore } from "./types";

/**
 * Full-season average: SeasonScore = (1/L) * Σ S_w(d), inactive days = 0.
 *
 * Day index is the **protocol day integer** (GDS §6), not a wall-clock timezone.
 * Production callers MUST pass `seasonStartDay` so the L-day window is pinned
 * (missing days inside the window contribute 0).
 *
 * Duplicate `day` values throw — never silently overwrite.
 */
export function computeSeasonScores(
  dayResults: DayScoreResult[],
  options?: {
    L?: number;
    D_min?: number;
    seasonId?: string;
    /** Protocol day index of season slot 0. Required for deterministic backfill. */
    seasonStartDay?: number;
  },
): SeasonScoreResult {
  const L = options?.L ?? SCORING_CONSTANTS.L;
  const D_min = options?.D_min ?? SCORING_CONSTANTS.D_min;
  const seasonId =
    options?.seasonId ?? dayResults[0]?.seasonId ?? "unknown-season";

  if (dayResults.some((d) => d.scoringVersion !== SCORING_VERSION)) {
    throw new Error(
      `computeSeasonScores: expected scoringVersion ${SCORING_VERSION}`,
    );
  }

  assertUniqueProtocolDays(dayResults.map((d) => d.day));

  // Map day -> wallet scores
  const byDay = new Map<number, Map<string, WalletDailyScore>>();
  const owners = new Set<string>();

  for (const day of dayResults) {
    const m = new Map<string, WalletDailyScore>();
    for (const w of day.walletScores) {
      m.set(w.owner, w);
      owners.add(w.owner);
    }
    byDay.set(day.day, m);
  }

  const dayKeys = [...byDay.keys()].sort((a, b) => a - b);
  const seasonStart =
    options?.seasonStartDay ?? dayKeys[0] ?? 0;
  const dayIndex = (offset: number) => seasonStart + offset;

  const wallets = [...owners].sort((a, b) => a.localeCompare(b)).map((owner) => {
    const dailyScores: number[] = [];
    let activeDays = 0;
    for (let i = 0; i < L; i++) {
      const d = dayIndex(i);
      const w = byDay.get(d)?.get(owner);
      const s = w?.score ?? 0;
      dailyScores.push(s);
      if (w?.active) activeDays += 1;
    }
    const seasonScore = dailyScores.reduce((a, b) => a + b, 0) / L;
    return {
      owner,
      seasonScore,
      activeDays,
      eligible: activeDays >= D_min,
      dailyScores,
    };
  });

  return {
    scoringVersion: SCORING_VERSION,
    seasonId,
    L,
    wallets,
  };
}

/**
 * Recompute a single day then fold into season — helper for historical rebuilds.
 */
export function emptyDayWalletScores(owners: string[]): WalletDailyScore[] {
  return owners.map((owner) => ({
    owner,
    score: 0,
    activeTokenIds: [],
    countedTokenIds: [],
    active: false,
  }));
}

/** Reject duplicate protocol-day records (settlement must be I-SINGLE-SETTLE). */
export function assertUniqueProtocolDays(days: number[]): void {
  const seen = new Set<number>();
  for (const d of days) {
    if (seen.has(d)) {
      throw new Error(
        `Duplicate settlement day record for protocol day ${d}`,
      );
    }
    seen.add(d);
  }
}
