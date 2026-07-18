import { describe, expect, it } from "vitest";
import { SCORING_VERSION } from "../version";
import { scoreSettlementDay } from "../scoreDay";
import { alpacaLocalMetric } from "../alpaca";
import type { SettlementDayInput } from "../types";

function baseInput(
  overrides: Partial<SettlementDayInput> = {},
): SettlementDayInput {
  return {
    scoringVersion: SCORING_VERSION,
    day: 1,
    seasonId: "season-test",
    alpacas: [],
    cougars: [],
    ...overrides,
  };
}

describe("scoreSettlementDay v0.1.1", () => {
  it("rejects wrong scoringVersion", () => {
    expect(() =>
      scoreSettlementDay(
        baseInput({ scoringVersion: "v0.1.0" as typeof SCORING_VERSION }),
      ),
    ).toThrow(/unsupported scoringVersion/);
  });

  it("scores Alpacas within location only (River vs Home not globally compared)", () => {
    const alpacas = [];
    // 5 Home with low net, 5 River with high net — within-loc means both cohorts ~mean 50
    for (let i = 0; i < 5; i++) {
      alpacas.push({
        tokenId: i + 1,
        owner: `0xhome${i}`,
        locationId: 0 as const,
        netReward: 100 + i,
        penaltyRate: 0,
        underHunt: false,
      });
      alpacas.push({
        tokenId: 100 + i,
        owner: `0xriver${i}`,
        locationId: 4 as const,
        netReward: 9000 + i,
        penaltyRate: 0.2,
        underHunt: true,
      });
    }
    const result = scoreSettlementDay(baseInput({ alpacas }));
    const home = result.nftScores.filter((n) => n.locationId === 0);
    const river = result.nftScores.filter((n) => n.locationId === 4);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(home.map((h) => h.score))).toBeCloseTo(50, 5);
    expect(mean(river.map((r) => r.score))).toBeCloseTo(50, 5);
  });

  it("assigns identical scores when same-location inputs are identical", () => {
    const alpacas = Array.from({ length: 6 }, (_, i) => ({
      tokenId: i + 1,
      owner: `0x${i}`,
      locationId: 2 as const,
      netReward: 500,
      penaltyRate: 0.1,
      underHunt: true,
    }));
    const result = scoreSettlementDay(baseInput({ alpacas }));
    const scores = result.nftScores.map((n) => n.score);
    expect(new Set(scores).size).toBe(1);
    expect(result.nftScores.every((n) => n.fallback === "identical_tie_shared_midrank")).toBe(
      true,
    );
  });

  it("uses lowest tokenIds when wallet has more than K actives", () => {
    const owner = "0xabc";
    const alpacas = Array.from({ length: 6 }, (_, i) => ({
      tokenId: 10 + i, // 10..15
      owner,
      locationId: 1 as const,
      netReward: 100 * (i + 1), // different scores
      penaltyRate: 0,
      underHunt: false,
    }));
    // pad peers so n_min satisfied with variety
    for (let i = 0; i < 4; i++) {
      alpacas.push({
        tokenId: 200 + i,
        owner: `0xpeer${i}`,
        locationId: 1 as const,
        netReward: 50,
        penaltyRate: 0,
        underHunt: false,
      });
    }
    const result = scoreSettlementDay(baseInput({ alpacas }));
    const w = result.walletScores.find((x) => x.owner === owner)!;
    expect(w.countedTokenIds).toEqual([10, 11, 12]);
    expect(w.activeTokenIds).toHaveLength(6);
    const countedScores = result.nftScores
      .filter((n) => w.countedTokenIds.includes(n.tokenId))
      .map((n) => n.score);
    const expected = countedScores.reduce((a, b) => a + b, 0) / 3;
    expect(w.score).toBeCloseTo(expected, 10);
  });

  it("does not score Cougars by binary hunt alone (σ differentiates)", () => {
    const cougars = [];
    for (let i = 0; i < 6; i++) {
      cougars.push({
        tokenId: i + 1,
        owner: `0xc${i}`,
        locationId: 3 as const,
        huntSuccess: true,
        alpacaCountAtLocation: i === 0 ? 100 : 1,
        huntPoolShare: 10,
      });
    }
    const result = scoreSettlementDay(baseInput({ cougars }));
    const top = result.nftScores.find((n) => n.tokenId === 1)!;
    const low = result.nftScores.find((n) => n.tokenId === 2)!;
    expect(top.score).toBeGreaterThan(low.score);
  });

  it("missed hunts get metric 0", () => {
    const cougars = Array.from({ length: 6 }, (_, i) => ({
      tokenId: i + 1,
      owner: `0xc${i}`,
      locationId: 2 as const,
      huntSuccess: i < 3,
      alpacaCountAtLocation: i < 3 ? 5 : 0,
      huntPoolShare: i < 3 ? 1 : 0,
    }));
    const result = scoreSettlementDay(baseInput({ cougars }));
    const miss = result.nftScores.filter((n) => n.performanceMetric === 0);
    expect(miss.length).toBe(3);
  });

  it("alpacaLocalMetric boosts under-hunt survival", () => {
    const base = {
      tokenId: 1,
      owner: "0x1",
      locationId: 4 as const,
      netReward: 100,
      penaltyRate: 0,
      underHunt: true,
    };
    const mSurvived = alpacaLocalMetric(base);
    const mHit = alpacaLocalMetric({ ...base, penaltyRate: 1 });
    expect(mSurvived).toBeGreaterThan(mHit);
  });
});
