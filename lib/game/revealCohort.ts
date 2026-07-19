/**
 * Day-global reveal cohort for Battle Result presentation (Ad(L) / Cd(L)).
 * Must never invent alpaca counts — empty locations stay 0 (Cougar hunt miss).
 */

import type { LocationId, NftSide } from "@/types/game";

export type RevealLogLike = {
  args?: {
    tokenId?: bigint | number;
    locationId?: number | bigint;
    side?: number | bigint;
  };
};

export type BattleParticipantView = {
  tokenId: number;
  locationId: LocationId;
  locationName: string;
  side: NftSide | null;
};

export type CohortCounts = {
  ad: number[];
  cd: number[];
  alpacaParticipantCount: number;
  revealedTokenIds: Set<number>;
  participants: BattleParticipantView[];
};

const LOC_NAMES = ["Home", "Mountain", "Grassland", "Forest", "River"] as const;

export function emptyCohort(): CohortCounts {
  return {
    ad: [0, 0, 0, 0, 0],
    cd: [0, 0, 0, 0, 0],
    alpacaParticipantCount: 0,
    revealedTokenIds: new Set(),
    participants: [],
  };
}

export function sideFromRevealEnum(side: number): NftSide | null {
  if (side === 1) return "Alpaca";
  if (side === 2) return "Cougar";
  return null;
}

/** Alpaca count at location — never clamped above the real count. */
export function alpacaCountAt(cohort: CohortCounts, locationId: number): number {
  if (locationId < 0 || locationId > 4) return 0;
  return cohort.ad[locationId] ?? 0;
}

export function cougarCountAt(cohort: CohortCounts, locationId: number): number {
  if (locationId < 0 || locationId > 4) return 0;
  return cohort.cd[locationId] ?? 0;
}

/**
 * GDS hunt success: huntable location and Ad(L) ≥ 1.
 * Presentation-only; does not change rewards.
 */
export function isCougarHuntSuccess(
  locationId: number,
  adL: number,
): boolean {
  return locationId !== 0 && adL >= 1;
}

export function parseRevealCohort(logs: RevealLogLike[]): CohortCounts {
  const cohort = emptyCohort();
  const seen = new Set<number>();
  for (const log of logs) {
    const args = log.args;
    if (!args) continue;
    const tokenId = Number(args.tokenId ?? 0);
    const loc = Number(args.locationId ?? 0);
    const side = sideFromRevealEnum(Number(args.side ?? 0));
    if (tokenId > 0) cohort.revealedTokenIds.add(tokenId);
    if (loc < 0 || loc > 4) continue;
    if (side === "Alpaca") {
      cohort.ad[loc] += 1;
      cohort.alpacaParticipantCount += 1;
    } else if (side === "Cougar") {
      cohort.cd[loc] += 1;
    }
    if (tokenId > 0 && !seen.has(tokenId)) {
      seen.add(tokenId);
      cohort.participants.push({
        tokenId,
        locationId: loc as LocationId,
        locationName: LOC_NAMES[loc] ?? `L${loc}`,
        side,
      });
    }
  }
  return cohort;
}

/**
 * Fill gaps when RPC logs lag — only adds owned reveals not already in cohort.
 * Never double-counts tokens already present from chain logs.
 */
export function mergeOwnedRevealsIntoCohort(
  cohort: CohortCounts,
  owned: readonly {
    tokenId: number;
    locationId: number;
    side: NftSide | null;
  }[],
): CohortCounts {
  const next: CohortCounts = {
    ad: [...cohort.ad],
    cd: [...cohort.cd],
    alpacaParticipantCount: cohort.alpacaParticipantCount,
    revealedTokenIds: new Set(cohort.revealedTokenIds),
    participants: [...cohort.participants],
  };

  for (const row of owned) {
    if (row.tokenId <= 0) continue;
    if (next.revealedTokenIds.has(row.tokenId)) continue;
    const loc = row.locationId;
    if (loc < 0 || loc > 4) continue;
    const side = row.side;
    next.revealedTokenIds.add(row.tokenId);
    if (side === "Alpaca") {
      next.ad[loc] += 1;
      next.alpacaParticipantCount += 1;
    } else if (side === "Cougar") {
      next.cd[loc] += 1;
    }
    next.participants.push({
      tokenId: row.tokenId,
      locationId: loc as LocationId,
      locationName: LOC_NAMES[loc] ?? `L${loc}`,
      side,
    });
  }
  return next;
}
