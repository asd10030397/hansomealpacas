import { SCORING_CONSTANTS } from "./constants";
import { midrankPercentileScores, roundMetric } from "./percentile";
import { normalizeOwner } from "./alpaca";
import type { NftDailyScore, SettlementCougarInput } from "./types";

/**
 * Cougar performance: relative contest quality, not binary hunt count.
 * m = σ + η·huntPoolShare on success; 0 on miss.
 */
export function cougarPerformanceMetric(c: SettlementCougarInput): number {
  if (!c.huntSuccess) return 0;
  const sigma = Math.max(0, c.alpacaCountAtLocation);
  return roundMetric(sigma + SCORING_CONSTANTS.eta * c.huntPoolShare);
}

export function scoreCougarsWithinRole(
  cougars: SettlementCougarInput[],
): NftDailyScore[] {
  const ordered = [...cougars].sort((a, b) => a.tokenId - b.tokenId);
  const ranked = midrankPercentileScores(ordered, cougarPerformanceMetric);

  return ranked
    .map((row) => {
      const c = row.item;
      return {
        tokenId: c.tokenId,
        owner: normalizeOwner(c.owner),
        side: "Cougar" as const,
        locationId: c.locationId,
        performanceMetric: row.metric,
        score: row.score,
        fallback: row.fallback,
        peerCount: row.peerCount,
        survivorDayScore: null,
      };
    })
    .sort((a, b) => a.tokenId - b.tokenId);
}
