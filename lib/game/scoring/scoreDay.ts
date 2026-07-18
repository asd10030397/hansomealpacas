import { scoreAlpacasWithinLocations, normalizeOwner } from "./alpaca";
import { scoreCougarsWithinRole } from "./cougar";
import { SCORING_VERSION } from "./version";
import { scoreWalletsForDay } from "./wallet";
import type { DayScoreResult, SettlementDayInput } from "./types";

/**
 * Score one settlement day under scoringVersion v0.1.1.
 * Pure function of SettlementDayInput — suitable for historical recomputation.
 */
export function scoreSettlementDay(input: SettlementDayInput): DayScoreResult {
  if (input.scoringVersion !== SCORING_VERSION) {
    throw new Error(
      `scoreSettlementDay: unsupported scoringVersion "${input.scoringVersion}" (expected ${SCORING_VERSION})`,
    );
  }

  const alpacas = input.alpacas.map((a) => ({
    ...a,
    owner: normalizeOwner(a.owner),
  }));
  const cougars = input.cougars.map((c) => ({
    ...c,
    owner: normalizeOwner(c.owner),
  }));

  assertUniqueTokenIds([...alpacas, ...cougars].map((x) => x.tokenId));

  const nftScores = [
    ...scoreAlpacasWithinLocations(alpacas),
    ...scoreCougarsWithinRole(cougars),
  ].sort((a, b) => a.tokenId - b.tokenId);

  const walletScores = scoreWalletsForDay(nftScores);

  return {
    scoringVersion: SCORING_VERSION,
    day: input.day,
    seasonId: input.seasonId,
    nftScores,
    walletScores,
  };
}

function assertUniqueTokenIds(ids: number[]): void {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate tokenId in settlement input: ${id}`);
    }
    seen.add(id);
  }
}
