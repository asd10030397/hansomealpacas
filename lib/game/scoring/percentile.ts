import { SCORING_CONSTANTS } from "./constants";
import type { ScoreFallback } from "./types";

export type RankedItem<T> = {
  item: T;
  metric: number;
  score: number;
  fallback: ScoreFallback;
  peerCount: number;
};

/**
 * Midrank percentile in (0, 100].
 * Ties share the average midrank → identical metrics get identical scores.
 * Does not invent artificial differences (no tokenId jitter).
 *
 * If n < n_min → every item scores neutralScore (50).
 */
export function midrankPercentileScores<T>(
  items: T[],
  metricOf: (item: T) => number,
  options?: { nMin?: number; neutralScore?: number },
): RankedItem<T>[] {
  const nMin = options?.nMin ?? SCORING_CONSTANTS.n_min;
  const neutral = options?.neutralScore ?? SCORING_CONSTANTS.neutralScore;
  const n = items.length;

  if (n === 0) return [];

  if (n < nMin) {
    return items.map((item) => ({
      item,
      metric: metricOf(item),
      score: neutral,
      fallback: "neutral_insufficient_peers",
      peerCount: n,
    }));
  }

  const indexed = items.map((item, index) => ({
    item,
    index,
    metric: metricOf(item),
  }));

  // Sort by metric ascending only — stable sort preserves input order inside ties
  // but midrank assignment makes tie order irrelevant to the final score.
  indexed.sort((a, b) => {
    if (a.metric < b.metric) return -1;
    if (a.metric > b.metric) return 1;
    return a.index - b.index; // stable; does not change shared midrank scores
  });

  const scores = new Array<number>(n);
  const fallbacks = new Array<ScoreFallback>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.metric === indexed[i]!.metric) j++;
    const mid = (i + j) / 2; // 0-based midrank
    const score = (100 * (mid + 0.5)) / n;
    const tied = j > i;
    for (let k = i; k <= j; k++) {
      const orig = indexed[k]!.index;
      scores[orig] = score;
      fallbacks[orig] = tied ? "identical_tie_shared_midrank" : "none";
    }
    i = j + 1;
  }

  return items.map((item, index) => ({
    item,
    metric: metricOf(item),
    score: scores[index]!,
    fallback: fallbacks[index]!,
    peerCount: n,
  }));
}

/** Round metric for reproducible ranking across JS engines. */
export function roundMetric(value: number, decimals = SCORING_CONSTANTS.metricDecimals): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
