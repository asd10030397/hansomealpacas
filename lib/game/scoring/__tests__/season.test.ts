import { describe, expect, it } from "vitest";
import { SCORING_VERSION } from "../version";
import { scoreSettlementDay } from "../scoreDay";
import { computeSeasonScores } from "../season";
import { recomputeSeasonFromSettlements } from "../recompute";
import type { SettlementDayInput } from "../types";

function dayWithOneAlpaca(
  day: number,
  owner: string,
  netReward: number,
): SettlementDayInput {
  const alpacas = Array.from({ length: 5 }, (_, i) => ({
    tokenId: day * 100 + i + 1,
    owner: i === 0 ? owner : `0xpad${day}_${i}`,
    locationId: 1 as const,
    netReward: i === 0 ? netReward : 10,
    penaltyRate: 0,
    underHunt: false,
  }));
  return {
    scoringVersion: SCORING_VERSION,
    day,
    seasonId: "season-1",
    alpacas,
    cougars: [],
  };
}

describe("computeSeasonScores", () => {
  it("averages over full L with zeros on inactive days", () => {
    const owner = "0xplayer";
    // Only day 0 active; L=5 → season = score/5
    const d0 = scoreSettlementDay(dayWithOneAlpaca(0, owner, 100));
    const season = computeSeasonScores([d0], { L: 5, D_min: 1, seasonId: "season-1" });
    const w = season.wallets.find((x) => x.owner === owner)!;
    expect(w.dailyScores).toHaveLength(5);
    expect(w.dailyScores[0]).toBeGreaterThan(0);
    expect(w.dailyScores.slice(1).every((s) => s === 0)).toBe(true);
    expect(w.seasonScore).toBeCloseTo(w.dailyScores[0]! / 5, 10);
    expect(w.activeDays).toBe(1);
  });

  it("recompute is deterministic", () => {
    const days = [0, 1, 2].map((d) => dayWithOneAlpaca(d, "0xae", 50 + d));
    const a = recomputeSeasonFromSettlements(days, { L: 3, D_min: 1 });
    const b = recomputeSeasonFromSettlements([...days].reverse(), {
      L: 3,
      D_min: 1,
    });
    expect(a.season.wallets).toEqual(b.season.wallets);
    expect(a.scoringVersion).toBe(SCORING_VERSION);
  });
});
