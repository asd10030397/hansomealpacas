/**
 * Local/mock settlement snapshot for frontend testing when game is not deployed.
 * Never presented as on-chain truth.
 */

import type { LocationId, NftSide } from "@/types/game";
import { listCommitSecretsForDay } from "@/lib/game/commitSecret";
import { MOCK_NFTS } from "@/data/game/mock";

const STORAGE_KEY = "hansome-local-settlement-v1";

export type LocalNftSettlementRow = {
  tokenId: number;
  day: number;
  locationId: LocationId;
  side: NftSide;
  /** Human-readable outcome — mock only */
  outcome: string;
  ability: string | null;
  /** Whole HANSOME tokens (not wei) for mock display */
  rewardHansome: number;
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

/** Build mock outcomes from revealed/submitted secrets — deterministic, labeled mock. */
export function buildMockSettlementRows(day: number): LocalNftSettlementRow[] {
  const secrets = listCommitSecretsForDay(day).filter(
    (s) => s.status === "revealed" || s.status === "submitted",
  );
  return secrets.map((s, i) => {
    const nft = MOCK_NFTS.find((n) => n.tokenId === s.tokenId);
    const side = nft?.side ?? "Alpaca";
    const underHunt = s.locationId !== 0 && side === "Alpaca";
    const huntOk = side === "Cougar" && s.locationId !== 0;
    let outcome = "Participated";
    let ability: string | null = null;
    let reward = 800 + (s.tokenId % 7) * 120 + i * 50;

    if (side === "Alpaca") {
      if (!underHunt) {
        outcome = "Safe (Home / no hunt)";
        reward = Math.floor(reward * 0.55);
      } else if (nft?.gameplayClass === "Lucky" && s.tokenId % 5 === 0) {
        outcome = "Survived under hunt";
        ability = "Lucky — immunity (mock)";
        reward = Math.floor(reward * 1.15);
      } else if (nft?.gameplayClass === "Runner" && s.tokenId % 4 === 0) {
        outcome = "Escaped hunt";
        ability = "Runner — escape (mock)";
      } else if (nft?.gameplayClass === "Guardian") {
        outcome = "Survived under hunt";
        ability = "Guardian — mitigation (mock)";
      } else if (s.tokenId % 3 === 0) {
        outcome = "Hunted — penalty applied";
        reward = Math.floor(reward * 0.35);
      } else {
        outcome = "Survived under hunt";
      }

      // Presentation label when Farmer survives (mock harvest cue — no reward math change).
      if (
        !ability &&
        nft?.gameplayClass === "Farmer" &&
        !outcome.startsWith("Hunted")
      ) {
        ability = "Farmer — harvest (mock)";
      }
    } else if (huntOk) {
      outcome = s.tokenId % 2 === 0 ? "Hunt success" : "Hunt miss";
      reward = s.tokenId % 2 === 0 ? reward : Math.floor(reward * 0.2);
    }

    return {
      tokenId: s.tokenId,
      day,
      locationId: s.locationId,
      side,
      outcome,
      ability,
      rewardHansome: reward,
    };
  });
}

export function completeLocalSettlement(day: number): LocalDaySettlement {
  const rows = buildMockSettlementRows(day);
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
