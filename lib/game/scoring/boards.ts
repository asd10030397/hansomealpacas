import { SCORING_CONSTANTS } from "./constants";
import { SCORING_VERSION } from "./version";
import type { DayScoreResult } from "./types";

/**
 * Special boards — Season uses computeSeasonScores.
 * Hunter / Survivor / Earnings helpers for indexer aggregation.
 * Never uses wallet HANSOME balance.
 */

export type HunterSeasonEntry = {
  owner: string;
  hunterScore: number;
  activeDays: number;
};

/** Cougar-only: mean over L of daily wallet means of Cougar NFT scores (zeros if inactive). */
export function computeHunterSeason(
  dayResults: DayScoreResult[],
  L = SCORING_CONSTANTS.L,
): HunterSeasonEntry[] {
  const owners = new Set<string>();
  const byDay = new Map<number, Map<string, number>>();

  for (const day of dayResults) {
    const cougarByOwner = new Map<string, number[]>();
    for (const n of day.nftScores) {
      if (n.side !== "Cougar") continue;
      const list = cougarByOwner.get(n.owner) ?? [];
      list.push(n.score);
      cougarByOwner.set(n.owner, list);
      owners.add(n.owner);
    }
    const dayMap = new Map<string, number>();
    for (const [owner, scores] of cougarByOwner) {
      const sortedTokens = day.nftScores
        .filter((x) => x.side === "Cougar" && x.owner === owner)
        .sort((a, b) => a.tokenId - b.tokenId)
        .slice(0, SCORING_CONSTANTS.K);
      const mean =
        sortedTokens.reduce((s, x) => s + x.score, 0) / sortedTokens.length;
      dayMap.set(owner, mean);
    }
    byDay.set(day.day, dayMap);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const start = days[0] ?? 0;

  return [...owners]
    .sort((a, b) => a.localeCompare(b))
    .map((owner) => {
      let sum = 0;
      let activeDays = 0;
      for (let i = 0; i < L; i++) {
        const s = byDay.get(start + i)?.get(owner);
        if (s != null) {
          sum += s;
          activeDays += 1;
        }
      }
      return { owner, hunterScore: sum / L, activeDays };
    });
}

export type SurvivorSeasonEntry = {
  owner: string;
  survivorScore: number;
  underHuntDays: number;
  eligible: boolean;
};

/**
 * Alpaca-only: mean of survivorDayScore on under-hunt days only.
 * Home never contributes (underHunt false → null).
 */
export function computeSurvivorSeason(
  dayResults: DayScoreResult[],
  D_min = SCORING_CONSTANTS.D_min_survivor,
): SurvivorSeasonEntry[] {
  const acc = new Map<string, number[]>();

  for (const day of dayResults) {
    const byOwner = new Map<string, number[]>();
    for (const n of day.nftScores) {
      if (n.side !== "Alpaca" || n.survivorDayScore == null) continue;
      const list = byOwner.get(n.owner) ?? [];
      list.push(n.survivorDayScore);
      byOwner.set(n.owner, list);
    }
    for (const [owner, scores] of byOwner) {
      const sorted = day.nftScores
        .filter(
          (x) =>
            x.side === "Alpaca" &&
            x.owner === owner &&
            x.survivorDayScore != null,
        )
        .sort((a, b) => a.tokenId - b.tokenId)
        .slice(0, SCORING_CONSTANTS.K);
      const mean =
        sorted.reduce((s, x) => s + (x.survivorDayScore ?? 0), 0) /
        sorted.length;
      const list = acc.get(owner) ?? [];
      list.push(mean);
      acc.set(owner, list);
    }
  }

  return [...acc.entries()]
    .map(([owner, days]) => {
      const underHuntDays = days.length;
      const survivorScore =
        underHuntDays === 0
          ? 0
          : days.reduce((a, b) => a + b, 0) / underHuntDays;
      return {
        owner,
        survivorScore,
        underHuntDays,
        eligible: underHuntDays >= D_min,
      };
    })
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

export type EarningsEntry = {
  owner: string;
  side: "Alpaca" | "Cougar";
  gameplayHansome: number;
};

/**
 * Earnings board input is cumulative gameplay HANSOME credited to tokens.
 * Callers must supply already role-separated totals — never wallet balance.
 */
export function rankEarningsWithinRole(
  entries: EarningsEntry[],
  side: "Alpaca" | "Cougar",
): EarningsEntry[] {
  return entries
    .filter((e) => e.side === side)
    .sort((a, b) => {
      if (b.gameplayHansome !== a.gameplayHansome) {
        return b.gameplayHansome - a.gameplayHansome;
      }
      return a.owner.localeCompare(b.owner);
    });
}

export const BOARDS_META = {
  scoringVersion: SCORING_VERSION,
  boards: ["Season", "Hunter", "Survivor", "Earnings"] as const,
  forbidsWalletHansomeBalance: true,
  forbidsCrossRoleRawEarningsCompare: true,
} as const;
