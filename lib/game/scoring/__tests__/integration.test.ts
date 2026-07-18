import { describe, expect, it } from "vitest";
import { SCORING_VERSION, SCORING_CONSTANTS } from "../index";
import { scoreSettlementDay } from "../scoreDay";
import { computeSeasonScores } from "../season";
import {
  canonicalSettlementJson,
  recomputeSeasonFromSettlements,
} from "../recompute";
import {
  computeHunterSeason,
  computeSurvivorSeason,
  rankEarningsWithinRole,
} from "../boards";
import { midrankPercentileScores } from "../percentile";
import type { SettlementDayInput } from "../types";

const L = SCORING_CONSTANTS.L;
const K = SCORING_CONSTANTS.K;

function emptyDay(day: number, seasonId = "season-1"): SettlementDayInput {
  return {
    scoringVersion: SCORING_VERSION,
    day,
    seasonId,
    alpacas: [],
    cougars: [],
  };
}

function alpacaPeers(
  day: number,
  entries: {
    tokenId: number;
    owner: string;
    locationId: 0 | 1 | 2 | 3 | 4;
    netReward: number;
    penaltyRate?: number;
    underHunt?: boolean;
  }[],
  seasonId = "season-1",
): SettlementDayInput {
  return {
    scoringVersion: SCORING_VERSION,
    day,
    seasonId,
    alpacas: entries.map((e) => ({
      tokenId: e.tokenId,
      owner: e.owner,
      locationId: e.locationId,
      netReward: e.netReward,
      penaltyRate: e.penaltyRate ?? 0,
      underHunt: e.underHunt ?? false,
    })),
    cougars: [],
  };
}

describe("integration: settlement integrity & edges", () => {
  it("handles no participants (empty settlement day)", () => {
    const result = scoreSettlementDay(emptyDay(0));
    expect(result.nftScores).toEqual([]);
    expect(result.walletScores).toEqual([]);
  });

  it("handles one participant at a location (n < n_min → neutral 50)", () => {
    const result = scoreSettlementDay(
      alpacaPeers(0, [
        {
          tokenId: 1,
          owner: "0xsolo",
          locationId: 2,
          netReward: 9999,
        },
      ]),
    );
    expect(result.nftScores).toHaveLength(1);
    expect(result.nftScores[0]!.score).toBe(50);
    expect(result.nftScores[0]!.fallback).toBe("neutral_insufficient_peers");
  });

  it("keeps true ties — score equal; no tokenId/wallet/order break", () => {
    const peers = Array.from({ length: 6 }, (_, i) => ({
      tokenId: 100 - i, // reverse ids to prove order does not invent spread
      owner: `0x${i.toString(16).padStart(40, "0")}`,
      locationId: 1 as const,
      netReward: 400,
    }));
    const a = scoreSettlementDay(alpacaPeers(0, peers));
    const b = scoreSettlementDay(alpacaPeers(0, [...peers].reverse()));
    const scoresA = a.nftScores.map((n) => n.score);
    const scoresB = b.nftScores.map((n) => n.score);
    expect(new Set(scoresA).size).toBe(1);
    expect(scoresA).toEqual(scoresB);
    // midrank percentile itself must not depend on address
    const ranked = midrankPercentileScores(peers, () => 400, { nMin: 5 });
    expect(new Set(ranked.map((r) => r.score)).size).toBe(1);
  });

  it("enforces K = 3 with lowest tokenIds exactly", () => {
    expect(K).toBe(3);
    const owner = "0xmany";
    const alpacas = Array.from({ length: 8 }, (_, i) => ({
      tokenId: 50 + i,
      owner,
      locationId: 1 as const,
      netReward: 10 + i * 100,
      penaltyRate: 0,
      underHunt: false,
    }));
    for (let i = 0; i < 4; i++) {
      alpacas.push({
        tokenId: 900 + i,
        owner: `0xpeer${i}`,
        locationId: 1,
        netReward: 1,
        penaltyRate: 0,
        underHunt: false,
      });
    }
    const result = scoreSettlementDay({
      scoringVersion: SCORING_VERSION,
      day: 0,
      seasonId: "season-1",
      alpacas,
      cougars: [],
    });
    const w = result.walletScores.find((x) => x.owner === owner)!;
    expect(w.countedTokenIds).toEqual([50, 51, 52]);
    expect(w.countedTokenIds).toHaveLength(K);
    expect(w.activeTokenIds).toHaveLength(8);
  });

  it("never credits the same NFT to two wallets on the same day", () => {
    expect(() =>
      scoreSettlementDay(
        alpacaPeers(0, [
          { tokenId: 7, owner: "0xaaa", locationId: 1, netReward: 10 },
          { tokenId: 7, owner: "0xbbb", locationId: 1, netReward: 20 },
          { tokenId: 8, owner: "0xccc", locationId: 1, netReward: 30 },
          { tokenId: 9, owner: "0xddd", locationId: 1, netReward: 40 },
          { tokenId: 10, owner: "0xeee", locationId: 1, netReward: 50 },
        ]),
      ),
    ).toThrow(/Duplicate tokenId/);
  });

  it("transfer mid-season: day-N owner gets day-N score; prior owner does not", () => {
    const tokenId = 42;
    const day0 = alpacaPeers(0, [
      { tokenId, owner: "0xalice", locationId: 1, netReward: 100 },
      ...Array.from({ length: 4 }, (_, i) => ({
        tokenId: 100 + i,
        owner: `0xpad0_${i}`,
        locationId: 1 as const,
        netReward: 10,
      })),
    ]);
    const day1 = alpacaPeers(1, [
      { tokenId, owner: "0xbob", locationId: 1, netReward: 100 },
      ...Array.from({ length: 4 }, (_, i) => ({
        tokenId: 200 + i,
        owner: `0xpad1_${i}`,
        locationId: 1 as const,
        netReward: 10,
      })),
    ]);
    const { dayResults, season } = recomputeSeasonFromSettlements(
      [day0, day1],
      { L: 2, D_min: 1, seasonStartDay: 0 },
    );
    const d0Alice = dayResults[0]!.walletScores.find((w) => w.owner === "0xalice");
    const d0Bob = dayResults[0]!.walletScores.find((w) => w.owner === "0xbob");
    const d1Alice = dayResults[1]!.walletScores.find((w) => w.owner === "0xalice");
    const d1Bob = dayResults[1]!.walletScores.find((w) => w.owner === "0xbob");
    expect(d0Alice?.active).toBe(true);
    expect(d0Bob).toBeUndefined();
    expect(d1Bob?.active).toBe(true);
    expect(d1Alice).toBeUndefined();
    const alice = season.wallets.find((w) => w.owner === "0xalice")!;
    const bob = season.wallets.find((w) => w.owner === "0xbob")!;
    expect(alice.dailyScores[0]).toBeGreaterThan(0);
    expect(alice.dailyScores[1]).toBe(0);
    expect(bob.dailyScores[0]).toBe(0);
    expect(bob.dailyScores[1]).toBeGreaterThan(0);
  });

  it("missing settlement day inside pinned window counts as zero", () => {
    const owner = "0xsparse";
    const d0 = scoreSettlementDay(
      alpacaPeers(0, [
        { tokenId: 1, owner, locationId: 1, netReward: 50 },
        ...Array.from({ length: 4 }, (_, i) => ({
          tokenId: 10 + i,
          owner: `0xp${i}`,
          locationId: 1 as const,
          netReward: 1,
        })),
      ]),
    );
    // day 1 missing entirely
    const d2 = scoreSettlementDay(
      alpacaPeers(2, [
        { tokenId: 1, owner, locationId: 1, netReward: 50 },
        ...Array.from({ length: 4 }, (_, i) => ({
          tokenId: 20 + i,
          owner: `0xq${i}`,
          locationId: 1 as const,
          netReward: 1,
        })),
      ]),
    );
    const season = computeSeasonScores([d0, d2], {
      L: 3,
      D_min: 1,
      seasonStartDay: 0,
    });
    const w = season.wallets.find((x) => x.owner === owner)!;
    expect(w.dailyScores).toEqual([
      expect.any(Number),
      0,
      expect.any(Number),
    ]);
    expect(w.dailyScores[1]).toBe(0);
    expect(w.seasonScore).toBeCloseTo(
      (w.dailyScores[0]! + w.dailyScores[2]!) / 3,
      10,
    );
  });

  it("rejects duplicate settlement day records", () => {
    const a = emptyDay(5);
    const b = emptyDay(5);
    expect(() => recomputeSeasonFromSettlements([a, b])).toThrow(
      /Duplicate settlement day/,
    );
  });

  it("season rollover: separate seasonId aggregates do not mix", () => {
    const owner = "0xroll";
    const s1 = alpacaPeers(
      0,
      [
        { tokenId: 1, owner, locationId: 1, netReward: 80 },
        ...Array.from({ length: 4 }, (_, i) => ({
          tokenId: 10 + i,
          owner: `0xa${i}`,
          locationId: 1 as const,
          netReward: 1,
        })),
      ],
      "season-1",
    );
    const s2 = alpacaPeers(
      0,
      [
        { tokenId: 1, owner, locationId: 1, netReward: 80 },
        ...Array.from({ length: 4 }, (_, i) => ({
          tokenId: 20 + i,
          owner: `0xb${i}`,
          locationId: 1 as const,
          netReward: 1,
        })),
      ],
      "season-2",
    );
    const r1 = recomputeSeasonFromSettlements([s1], {
      L: 2,
      D_min: 1,
      seasonId: "season-1",
      seasonStartDay: 0,
    });
    const r2 = recomputeSeasonFromSettlements([s2], {
      L: 2,
      D_min: 1,
      seasonId: "season-2",
      seasonStartDay: 0,
    });
    expect(r1.season.seasonId).toBe("season-1");
    expect(r2.season.seasonId).toBe("season-2");
    // Each season uses its own L denominator independently
    expect(r1.season.L).toBe(2);
    expect(r2.season.L).toBe(2);
  });

  it("rejects scoring-version mismatch", () => {
    expect(() =>
      scoreSettlementDay({
        ...emptyDay(0),
        scoringVersion: "v0.1.0" as typeof SCORING_VERSION,
      }),
    ).toThrow(/unsupported scoringVersion/);

    expect(() =>
      recomputeSeasonFromSettlements([
        {
          ...emptyDay(0),
          scoringVersion: "v9.9.9" as typeof SCORING_VERSION,
        },
      ]),
    ).toThrow(/version/);
  });
});

describe("integration: full-season L=90 replay determinism", () => {
  it("recomputes identical SeasonScore from the same 90-day dataset", () => {
    expect(L).toBe(90);
    const seasonStartDay = 1000;
    const seasonId = "season-replay";

    const days: SettlementDayInput[] = [];
    for (let offset = 0; offset < L; offset++) {
      const day = seasonStartDay + offset;
      // Sparse participation: owner active every 3rd day only
      if (offset % 3 === 0) {
        days.push(
          alpacaPeers(
            day,
            [
              {
                tokenId: 1,
                owner: "0xreplay",
                locationId: 2,
                netReward: 100 + (offset % 7),
              },
              ...Array.from({ length: 4 }, (_, i) => ({
                tokenId: day * 10 + i + 2,
                owner: `0xfill_${offset}_${i}`,
                locationId: 2 as const,
                netReward: 20 + i,
              })),
            ],
            seasonId,
          ),
        );
      } else {
        days.push(emptyDay(day, seasonId));
      }
    }

    const pass1 = recomputeSeasonFromSettlements(days, {
      L,
      D_min: 1,
      seasonId,
      seasonStartDay,
    });
    const reversed = [...days].reverse();
    const pass2 = recomputeSeasonFromSettlements(reversed, {
      L,
      D_min: 1,
      seasonId,
      seasonStartDay,
    });

    expect(pass1.season.wallets).toEqual(pass2.season.wallets);
    expect(pass1.dayResults.map((d) => d.nftScores)).toEqual(
      pass2.dayResults.map((d) => d.nftScores),
    );

    const w = pass1.season.wallets.find((x) => x.owner === "0xreplay")!;
    expect(w.dailyScores).toHaveLength(L);
    expect(w.activeDays).toBe(Math.ceil(L / 3));
    for (let i = 0; i < L; i++) {
      if (i % 3 !== 0) expect(w.dailyScores[i]).toBe(0);
      else expect(w.dailyScores[i]).toBeGreaterThan(0);
    }
    expect(w.seasonScore).toBeCloseTo(
      w.dailyScores.reduce((a, b) => a + b, 0) / L,
      12,
    );

    expect(canonicalSettlementJson(days[0]!)).toBe(
      canonicalSettlementJson(days[0]!),
    );
  });
});

describe("integration: special boards", () => {
  it("Hunter is Cougar-only; Survivor is Alpaca under-hunt only", () => {
    const day: SettlementDayInput = {
      scoringVersion: SCORING_VERSION,
      day: 0,
      seasonId: "season-1",
      alpacas: Array.from({ length: 5 }, (_, i) => ({
        tokenId: i + 1,
        owner: `0xa${i}`,
        locationId: 3 as const,
        netReward: 100,
        penaltyRate: 0.2,
        underHunt: true,
      })),
      cougars: Array.from({ length: 5 }, (_, i) => ({
        tokenId: 100 + i,
        owner: `0xc${i}`,
        locationId: 3 as const,
        huntSuccess: true,
        alpacaCountAtLocation: 3,
        huntPoolShare: 1,
      })),
    };
    const scored = scoreSettlementDay(day);
    const hunter = computeHunterSeason([scored], 1);
    const survivor = computeSurvivorSeason([scored], 1);
    expect(hunter.every((h) => h.owner.startsWith("0xc"))).toBe(true);
    expect(survivor.every((s) => s.owner.startsWith("0xa"))).toBe(true);
    expect(hunter.some((h) => h.owner.startsWith("0xa"))).toBe(false);
  });

  it("Earnings never merges Alpaca and Cougar into one ladder", () => {
    const mixed = [
      { owner: "0xa", side: "Alpaca" as const, gameplayHansome: 1000 },
      { owner: "0xc", side: "Cougar" as const, gameplayHansome: 9000 },
    ];
    const alpacaBoard = rankEarningsWithinRole(mixed, "Alpaca");
    const cougarBoard = rankEarningsWithinRole(mixed, "Cougar");
    expect(alpacaBoard).toHaveLength(1);
    expect(cougarBoard).toHaveLength(1);
    expect(alpacaBoard[0]!.owner).toBe("0xa");
    expect(cougarBoard[0]!.owner).toBe("0xc");
  });
});
