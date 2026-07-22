/**
 * Dev / promo capture — scripted day-cycle walkthrough on real game UI.
 * Active when `?capture=1` or sessionStorage `hansome-tutorial-capture=1`.
 *
 * Seeds commit secrets + local settlement so Commit → Result → Claim can be
 * recorded without waiting for chain phases or MetaMask writes.
 */

import { getTestnetGameplayIdentity } from "@/lib/game/testnetGameplayTraits";
import {
  completeLocalSettlement,
  type LocalNftSettlementRow,
} from "@/lib/game/localSettlement";
import { generateSalt, type CommitSecretRecord } from "@/lib/game/commitSecret";
import { computeCommitHash } from "@/lib/game/commitHash";
import type { GameDayState, GamePhase, MockNft } from "@/types/game";

export const TUTORIAL_WALLET = "0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A";
export const TUTORIAL_TOKEN_IDS = [1, 2, 4, 6, 8, 10, 11, 16] as const;
/** Grassland · W3 — all tutorial NFTs commit here. */
export const TUTORIAL_LOCATION_ID = 2 as const;
/** High day index — avoids colliding with live Testnet day reads in UI copy. */
export const TUTORIAL_DAY = 900_042;

const CAPTURE_FLAG = "hansome-tutorial-capture";
const PHASE_KEY = "hansome-tutorial-phase";
const DAY_KEY = "hansome-tutorial-day";

export function isTutorialCapture(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(CAPTURE_FLAG) === "1") return true;
  return new URLSearchParams(window.location.search).get("capture") === "1";
}

export function getTutorialPhaseOverride(): GamePhase | null {
  if (!isTutorialCapture()) return null;
  const fromUrl = new URLSearchParams(window.location.search).get("tutorialPhase");
  if (fromUrl === "COMMIT" || fromUrl === "REVEAL" || fromUrl === "SETTLEMENT" || fromUrl === "CLAIM") {
    return fromUrl;
  }
  const raw = sessionStorage.getItem(PHASE_KEY);
  if (raw === "COMMIT" || raw === "REVEAL" || raw === "SETTLEMENT" || raw === "CLAIM") {
    return raw;
  }
  return "COMMIT";
}

export function getTutorialDayNumber(): number {
  if (!isTutorialCapture()) return TUTORIAL_DAY;
  const n = Number(sessionStorage.getItem(DAY_KEY));
  return Number.isInteger(n) && n > 0 ? n : TUTORIAL_DAY;
}

/** Build mock clock for capture — phase comes from sessionStorage. */
export function getTutorialDayState(nowMs: number): GameDayState {
  const day = getTutorialDayNumber();
  const phase = getTutorialPhaseOverride() ?? "COMMIT";
  const battlePadMs = 45 * 60 * 1000;
  const t = nowMs;

  if (phase === "COMMIT") {
    return {
      day,
      phase: "COMMIT",
      settled: false,
      settlementStatus: "Pending",
      commitEndsAt: t + 60 * 60 * 1000,
      revealEndsAt: t + 2 * 60 * 60 * 1000,
      dayEndsAt: t + 2 * 60 * 60 * 1000 + battlePadMs,
      phaseEndsAt: t + 60 * 60 * 1000,
    };
  }
  if (phase === "REVEAL") {
    return {
      day,
      phase: "REVEAL",
      settled: false,
      settlementStatus: "Pending",
      commitEndsAt: t - 1000,
      revealEndsAt: t + 60 * 60 * 1000,
      dayEndsAt: t + 60 * 60 * 1000 + battlePadMs,
      phaseEndsAt: t + 60 * 60 * 1000,
    };
  }
  if (phase === "SETTLEMENT") {
    return {
      day,
      phase: "SETTLEMENT",
      settled: false,
      settlementStatus: "Ready",
      commitEndsAt: t - 2000,
      revealEndsAt: t - 1000,
      dayEndsAt: t + battlePadMs,
      phaseEndsAt: t + battlePadMs,
    };
  }
  return {
    day,
    phase: "CLAIM",
    settled: true,
    settlementStatus: "Complete",
    commitEndsAt: t - 3000,
    revealEndsAt: t - 2000,
    dayEndsAt: t + battlePadMs,
    phaseEndsAt: t + battlePadMs,
  };
}

function nftImage(tokenId: number): string {
  return `/pixel/genesis/collection-550/image/${tokenId}.png`;
}

/** Ensure tutorial wallet inventory includes the story token IDs. */
export function mergeTutorialOwnedNfts(nfts: MockNft[]): MockNft[] {
  if (!isTutorialCapture()) return nfts;
  const byId = new Map(nfts.map((n) => [n.tokenId, n]));
  for (const tokenId of TUTORIAL_TOKEN_IDS) {
    if (byId.has(tokenId)) continue;
    const deck = getTestnetGameplayIdentity(tokenId);
    const side = deck?.side ?? "Alpaca";
    const gameplayClass = deck?.gameplayClass ?? "Common";
    byId.set(tokenId, {
      tokenId,
      side,
      gameplayClass,
      revealed: true,
      image: nftImage(tokenId),
      selectedLocationId: TUTORIAL_LOCATION_ID,
      claimableHansome: 600 + tokenId * 40,
      gameStatus: "Idle",
    });
  }
  return TUTORIAL_TOKEN_IDS.map((id) => byId.get(id)!)
    .concat(nfts.filter((n) => !TUTORIAL_TOKEN_IDS.includes(n.tokenId as (typeof TUTORIAL_TOKEN_IDS)[number])));
}

function clearPresentationOnceGuards(day: number): void {
  if (typeof sessionStorage === "undefined") return;
  const prefixes = ["hansome-settlement-result-sfx:", "hansome-ability-effect:"];
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (!k) continue;
    if (prefixes.some((p) => k.startsWith(p)) && k.includes(String(day))) {
      keys.push(k);
    }
  }
  for (const k of keys) sessionStorage.removeItem(k);
}

function writeCommitSecrets(
  day: number,
  wallet: string,
  revealed: boolean,
): CommitSecretRecord[] {
  const w = wallet.toLowerCase();
  const now = Date.now();
  const status = revealed ? "revealed" : "submitted";
  const existingRaw = localStorage.getItem("hansome-commit-secrets-v2");
  const existing: CommitSecretRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
  const others = existing.filter(
    (r) => !(r.day === day && r.wallet === w && TUTORIAL_TOKEN_IDS.includes(r.tokenId as (typeof TUTORIAL_TOKEN_IDS)[number])),
  );
  const rows: CommitSecretRecord[] = TUTORIAL_TOKEN_IDS.map((tokenId) => {
    const salt = generateSalt();
    const locationId = TUTORIAL_LOCATION_ID;
    const commitHash = computeCommitHash(tokenId, day, locationId, salt);
    return {
      tokenId,
      day,
      locationId,
      salt,
      commitHash,
      wallet: w,
      status,
      updatedAt: now,
    };
  });
  localStorage.setItem("hansome-commit-secrets-v2", JSON.stringify([...others, ...rows]));
  localStorage.setItem("hansome-pending-location-v1", JSON.stringify({ day, locationId: TUTORIAL_LOCATION_ID }));
  return rows;
}

/** Browser-only — call before navigating to /game/*?capture=1 */
export function seedTutorialCapture(phase?: GamePhase): void {
  if (typeof window === "undefined") return;
  const resolved =
    phase ??
    getTutorialPhaseOverride() ??
    "COMMIT";
  sessionStorage.setItem(CAPTURE_FLAG, "1");
  sessionStorage.setItem(PHASE_KEY, resolved);
  sessionStorage.setItem(DAY_KEY, String(TUTORIAL_DAY));

  const revealed = resolved !== "COMMIT";
  const secrets = writeCommitSecrets(TUTORIAL_DAY, TUTORIAL_WALLET, revealed);

  if (resolved === "SETTLEMENT" || resolved === "CLAIM") {
    clearPresentationOnceGuards(TUTORIAL_DAY);
    completeLocalSettlement(TUTORIAL_DAY, secrets);
    if (resolved === "CLAIM") {
      localStorage.removeItem("hansome-local-claimed-v1");
    }
  } else {
    localStorage.removeItem("hansome-local-settlement-v1");
    if (resolved === "COMMIT") {
      clearPresentationOnceGuards(TUTORIAL_DAY);
    }
  }
}

export function installTutorialCaptureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("tutorial-capture-css")) return;
  const style = document.createElement("style");
  style.id = "tutorial-capture-css";
  style.textContent = `
    .mock-chip, .standoff__demo, nextjs-portal, [data-nextjs-toast],
    [data-testid="result-dont-wait-notice"], [data-testid="result-previous-day-note"],
    [data-testid="result-presentation-recovery"], [data-testid="result-post-reveal-staging"] {
      display: none !important;
    }
    body.tutorial-capture { overflow-x: hidden; }
  `;
  document.head.appendChild(style);
  document.body.classList.add("tutorial-capture");
}

/** Typed helper for tests / docs */
export type TutorialCaptureSeedSummary = {
  day: number;
  phase: GamePhase;
  tokenIds: readonly number[];
  locationId: number;
  wallet: string;
  settlementRows: LocalNftSettlementRow[] | null;
};

export function describeTutorialSeed(phase: GamePhase): TutorialCaptureSeedSummary {
  return {
    day: TUTORIAL_DAY,
    phase,
    tokenIds: TUTORIAL_TOKEN_IDS,
    locationId: TUTORIAL_LOCATION_ID,
    wallet: TUTORIAL_WALLET,
    settlementRows: phase === "COMMIT" ? null : [],
  };
}
