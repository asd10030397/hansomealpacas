import { scoreSettlementDay } from "./scoreDay";
import { assertUniqueProtocolDays, computeSeasonScores } from "./season";
import { SCORING_VERSION } from "./version";
import type {
  DayScoreResult,
  SeasonScoreResult,
  SettlementDayInput,
} from "./types";

/**
 * Historical recomputation: re-score every day from stored settlement snapshots,
 * then rebuild season aggregates. Deterministic for identical inputs.
 *
 * Input contract (indexer responsibility):
 * - Each snapshot is built only after that day's on-chain settlement finalized.
 * - `owner` = ERC-721 owner at Reveal close (not mutable client state).
 * - At most one record per protocol day (duplicate days throw).
 */
export function recomputeSeasonFromSettlements(
  days: SettlementDayInput[],
  options?: {
    L?: number;
    D_min?: number;
    seasonId?: string;
    seasonStartDay?: number;
  },
): {
  scoringVersion: typeof SCORING_VERSION;
  dayResults: DayScoreResult[];
  season: SeasonScoreResult;
} {
  assertUniqueProtocolDays(days.map((d) => d.day));

  const sorted = [...days].sort((a, b) => a.day - b.day);
  for (const d of sorted) {
    if (d.scoringVersion !== SCORING_VERSION) {
      throw new Error(
        `recomputeSeasonFromSettlements: day ${d.day} has version ${d.scoringVersion}`,
      );
    }
  }

  const dayResults = sorted.map((d) => scoreSettlementDay(d));
  const season = computeSeasonScores(dayResults, {
    ...options,
    seasonId: options?.seasonId ?? sorted[0]?.seasonId,
  });

  return {
    scoringVersion: SCORING_VERSION,
    dayResults,
    season,
  };
}

/** Canonical JSON stringify for snapshot hashing / audit (sorted keys). */
export function canonicalSettlementJson(input: SettlementDayInput): string {
  return JSON.stringify(sortKeys(input));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortKeys(obj[k]);
    }
    return out;
  }
  return value;
}
