import { SCORING_CONSTANTS } from "./constants";
import { midrankPercentileScores, roundMetric } from "./percentile";
import type { NftDailyScore, SettlementAlpacaInput } from "./types";

/**
 * What differentiates Alpacas on the same location:
 * - netReward (GDS r^A,net) after settlement
 * - underHunt + penaltyRate via μ·(1−π) multiplier when under hunt
 *
 * If two Alpacas on the same tile share identical (netReward, underHunt, penaltyRate),
 * they receive the same performance metric and the same midrank score (true tie).
 * No artificial noise is added.
 */
export function alpacaLocalMetric(a: SettlementAlpacaInput): number {
  const net = a.netReward;
  if (a.underHunt) {
    const pi = clamp01(a.penaltyRate);
    return roundMetric(net * (1 + SCORING_CONSTANTS.mu * (1 - pi)));
  }
  return roundMetric(net);
}

export function scoreAlpacasWithinLocations(
  alpacas: SettlementAlpacaInput[],
): NftDailyScore[] {
  const byLoc = new Map<number, SettlementAlpacaInput[]>();
  for (const a of alpacas) {
    const list = byLoc.get(a.locationId) ?? [];
    list.push(a);
    byLoc.set(a.locationId, list);
  }

  const out: NftDailyScore[] = [];

  for (const [, cohort] of byLoc) {
    // Deterministic cohort order for stable processing (scores unaffected by ties).
    const ordered = [...cohort].sort((x, y) => x.tokenId - y.tokenId);
    const ranked = midrankPercentileScores(ordered, alpacaLocalMetric);

    for (const row of ranked) {
      const a = row.item;
      const survivorDayScore = a.underHunt
        ? roundMetric((1 - clamp01(a.penaltyRate)) * row.score)
        : null;

      out.push({
        tokenId: a.tokenId,
        owner: normalizeOwner(a.owner),
        side: "Alpaca",
        locationId: a.locationId,
        performanceMetric: row.metric,
        score: row.score,
        fallback: row.fallback,
        peerCount: row.peerCount,
        survivorDayScore,
      });
    }
  }

  return out.sort((a, b) => a.tokenId - b.tokenId);
}

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

export function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}
