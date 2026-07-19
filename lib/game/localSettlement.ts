/**
 * Local/mock settlement snapshot for frontend testing when game is not deployed.
 * Never presented as on-chain truth.
 *
 * E9: commit without reveal → reward 0, excluded from location denominators.
 */

import type { GameplayClass, LocationId, NftSide } from "@/types/game";
import {
  listCommitSecretsForDay,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import { MOCK_NFTS } from "@/data/game/mock";
import { deriveSettlementActivation } from "@/lib/game/settlementActivation";
import {
  e9ZeroReward,
  MISSED_REVEAL_OUTCOME,
} from "@/lib/game/missedReveal";
import type { AbilityEffectId } from "@/lib/game/abilityEffects/catalog";

const STORAGE_KEY = "hansome-local-settlement-v1";

export type LocalNftSettlementRow = {
  tokenId: number;
  day: number;
  locationId: LocationId;
  side: NftSide;
  /** Human-readable outcome — mock only */
  outcome: string;
  /** Set only when a skill actually influenced this settlement line. */
  ability: string | null;
  /** Presentation id when activated; null otherwise. */
  activatedAbility: AbilityEffectId | null;
  /** Whole HANSOME tokens (not wei) for mock display */
  rewardHansome: number;
  /** GDS E9 — committed but never revealed. */
  missedReveal?: boolean;
};

export type LocalDaySettlement = {
  day: number;
  status: "pending" | "completed";
  rows: LocalNftSettlementRow[];
  updatedAt: number;
};

function readAll(): LocalDaySettlement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalDaySettlement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: LocalDaySettlement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function getLocalSettlement(day: number): LocalDaySettlement | null {
  return readAll().find((d) => d.day === day) ?? null;
}

function isCommittedSecret(s: CommitSecretRecord): boolean {
  return (
    s.status === "prepared" ||
    s.status === "submitted" ||
    s.status === "revealed"
  );
}

function isRevealedSecret(s: CommitSecretRecord): boolean {
  return s.status === "revealed";
}

/**
 * Build mock outcomes from commit secrets for a day.
 * - Revealed tokens: participate in settlement math (may earn rewards).
 * - Commit-only (E9): shown with 0 reward, excluded from adL/cdL denominators.
 */
export function buildMockSettlementRows(
  day: number,
  secretsInput?: CommitSecretRecord[],
): LocalNftSettlementRow[] {
  const secrets = (
    secretsInput ?? listCommitSecretsForDay(day)
  ).filter(isCommittedSecret);

  const revealed = secrets.filter(isRevealedSecret);

  const ad = [0, 0, 0, 0, 0];
  const cd = [0, 0, 0, 0, 0];
  let alpacaParticipantCount = 0;

  const enrich = (s: CommitSecretRecord) => {
    const nft = MOCK_NFTS.find((n) => n.tokenId === s.tokenId);
    const side: NftSide = nft?.side ?? "Alpaca";
    const gameplayClass: GameplayClass = nft?.gameplayClass ?? "Common";
    return { s, nft, side, gameplayClass };
  };

  const revealedEnriched = revealed.map(enrich);
  for (const row of revealedEnriched) {
    const loc = row.s.locationId;
    if (row.side === "Alpaca") {
      ad[loc] += 1;
      alpacaParticipantCount += 1;
    } else if (row.side === "Cougar") {
      cd[loc] += 1;
    }
  }

  let rewardIndex = 0;
  return secrets.map((s) => {
    const { side, gameplayClass } = enrich(s);
    const loc = s.locationId;

    // E9 — commit without reveal
    if (!isRevealedSecret(s)) {
      return {
        tokenId: s.tokenId,
        day,
        locationId: loc,
        side,
        outcome: MISSED_REVEAL_OUTCOME,
        ability: null,
        activatedAbility: null,
        rewardHansome: e9ZeroReward(),
        missedReveal: true,
      };
    }

    const runnerSuccess = s.tokenId % 4 === 0;
    const luckySuccess = s.tokenId % 5 === 0;
    const i = rewardIndex++;

    const activation = deriveSettlementActivation({
      side,
      gameplayClass,
      locationId: loc,
      adL: ad[loc] ?? 0,
      cdL: cd[loc] ?? 0,
      alpacaParticipantCount,
      runnerSuccess,
      luckySuccess,
    });

    let reward = 800 + (s.tokenId % 7) * 120 + i * 50;
    if (activation.outcome.startsWith("Safe")) {
      reward = Math.floor(reward * 0.55);
    } else if (activation.outcome.startsWith("Hunted")) {
      reward = Math.floor(reward * 0.35);
    } else if (activation.activatedAbility === "lucky") {
      reward = Math.floor(reward * 1.15);
    } else if (side === "Cougar" && /hunt miss/i.test(activation.outcome)) {
      reward = Math.floor(reward * 0.2);
    }

    return {
      tokenId: s.tokenId,
      day,
      locationId: loc,
      side,
      outcome: activation.outcome,
      ability: activation.abilityLabel,
      activatedAbility: activation.activatedAbility,
      rewardHansome: reward,
      missedReveal: false,
    };
  });
}

export function completeLocalSettlement(
  day: number,
  secretsInput?: CommitSecretRecord[],
): LocalDaySettlement {
  const rows = buildMockSettlementRows(day, secretsInput);
  const next: LocalDaySettlement = {
    day,
    status: "completed",
    rows,
    updatedAt: Date.now(),
  };
  const others = readAll().filter((d) => d.day !== day);
  writeAll([...others, next]);
  return next;
}

/** Sum mock claimable = settlement rewards not yet locally claimed. */
const CLAIMED_KEY = "hansome-local-claimed-v1";

export function getLocalClaimed(day: number): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLAIMED_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, number[]>;
    return map[String(day)] ?? [];
  } catch {
    return [];
  }
}

export function markLocalClaimed(day: number, tokenIds: number[]): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(CLAIMED_KEY);
  const map = (raw ? JSON.parse(raw) : {}) as Record<string, number[]>;
  const prev = new Set(map[String(day)] ?? []);
  for (const id of tokenIds) prev.add(id);
  map[String(day)] = [...prev];
  localStorage.setItem(CLAIMED_KEY, JSON.stringify(map));
}

export function localClaimableRows(day: number): LocalNftSettlementRow[] {
  const settled = getLocalSettlement(day);
  if (!settled || settled.status !== "completed") return [];
  const claimed = new Set(getLocalClaimed(day));
  return settled.rows.filter((r) => !claimed.has(r.tokenId) && r.rewardHansome > 0);
}
