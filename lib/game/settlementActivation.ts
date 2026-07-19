/**
 * Settlement presentation activation rules (UI only).
 *
 * Hunt-reactive skills (Runner / Lucky / Guardian / King): show only when that
 * skill changed this settlement’s outcome.
 * Farmer: permanent passive class — always show identity/ability on the card;
 * never as a temporary “activated!” proc. Death uses shared alpaca-hunted FX.
 */

import type { GameplayClass, LocationId, NftSide } from "@/types/game";
import type { AbilityEffectId } from "@/lib/game/abilityEffects/catalog";

const MAX_PRE_PENALTY_BPS = 9_000;

/** Candidate A π₀ ladder (bps) — must match SettlementLib.pi0Bps. */
const PI0_BPS: Record<number, number> = {
  0: 0,
  1: 1_500,
  2: 2_500,
  3: 3_500,
  4: 4_500,
};

/** Permanent passive card copy — not an activation banner. */
export const FARMER_PASSIVE_LABEL = "Farmer · Harvest Boost";

export type SettlementActivationFacts = {
  side: NftSide;
  gameplayClass: GameplayClass;
  locationId: LocationId;
  /** Alpacas revealed at this location (including self). */
  adL: number;
  /** Cougars revealed at this location. */
  cdL: number;
  /** Total alpaca participants in the day’s Ra pool. */
  alpacaParticipantCount: number;
  /** On-chain bernoulli for Runner (ignored unless class is Runner). */
  runnerSuccess?: boolean;
  /** On-chain bernoulli for Lucky (ignored unless class is Lucky). */
  luckySuccess?: boolean;
};

export type SettlementActivationResult = {
  /** Authoritative outcome label for result SFX parsing. */
  outcome: string;
  /**
   * Proc FX id for the presentation queue (Runner/Lucky/Guardian/King only).
   * Farmer is never set here — passive identity uses `abilityLabel` only.
   */
  activatedAbility: AbilityEffectId | null;
  /** Card copy for ability row; Farmer always fills this when class is Farmer. */
  abilityLabel: string | null;
};

export function prePenaltyBps(
  locationId: LocationId,
  adL: number,
  cdL: number,
): number {
  if (locationId === 0 || cdL === 0) return 0;
  const pi0 = PI0_BPS[locationId] ?? 0;
  const scaled = Math.floor((pi0 * (adL + cdL)) / (adL + 1));
  return Math.min(scaled, MAX_PRE_PENALTY_BPS);
}

/** True when hunt pressure would apply (pre-penalty > 0). */
export function wasHunted(
  locationId: LocationId,
  adL: number,
  cdL: number,
): boolean {
  return prePenaltyBps(locationId, adL, cdL) > 0;
}

/**
 * Farmer +20% changes Ra shares only when ≥2 alpacas split the pool
 * (sole Farmer still gets 100% either way — GDS E6). Kept for math/docs;
 * presentation no longer gates Farmer visibility on this.
 */
export function farmerWeightInfluenced(alpacaParticipantCount: number): boolean {
  return alpacaParticipantCount >= 2;
}

function resolvePenaltyBps(facts: SettlementActivationFacts): number {
  const { gameplayClass, locationId, adL, cdL } = facts;
  if (gameplayClass === "King") return 0;

  const pre = prePenaltyBps(locationId, adL, cdL);

  if (gameplayClass === "Runner") {
    return facts.runnerSuccess ? 0 : pre;
  }
  if (gameplayClass === "Lucky") {
    return facts.luckySuccess ? 0 : pre;
  }
  if (gameplayClass === "Guardian") {
    return Math.floor(pre / 2);
  }
  return pre;
}

function withFarmerPassive(
  facts: SettlementActivationFacts,
  result: SettlementActivationResult,
): SettlementActivationResult {
  if (facts.gameplayClass !== "Farmer") return result;
  return {
    ...result,
    // Never queue Farmer as a proc overlay.
    activatedAbility:
      result.activatedAbility === "farmer" ? null : result.activatedAbility,
    abilityLabel: FARMER_PASSIVE_LABEL,
  };
}

/**
 * Derive presentation outcome + ability for one NFT line.
 * Death / hunted penalty always uses the shared alpaca-hunted path — no
 * per-class death FX (Farmer still shows passive identity on the card).
 */
export function deriveSettlementActivation(
  facts: SettlementActivationFacts,
): SettlementActivationResult {
  if (facts.side === "Cougar") {
    // GDS: success iff huntable L and Ad(L) ≥ 1 (any Alpaca — not owner-scoped).
    // adL must be the real count (0 allowed). Never invent Ad(L)=1.
    const huntOk = facts.locationId !== 0 && facts.adL >= 1;
    return {
      outcome: huntOk ? "Hunt success" : "Hunt miss — no Alpacas here",
      activatedAbility: null,
      abilityLabel: huntOk ? "Hunt landed" : "Empty location",
    };
  }

  if (facts.side !== "Alpaca") {
    return {
      outcome: "Participated",
      activatedAbility: null,
      abilityLabel: null,
    };
  }

  const hunted = wasHunted(facts.locationId, facts.adL, facts.cdL);
  const penalty = resolvePenaltyBps(facts);
  const cls = facts.gameplayClass;

  // ── Death / penalty applied: shared death presentation ──
  if (penalty > 0) {
    if (cls === "Guardian" && hunted) {
      return withFarmerPassive(facts, {
        outcome: "Hunted — penalty applied",
        activatedAbility: "guardian",
        abilityLabel: "Guardian activated!",
      });
    }
    return withFarmerPassive(facts, {
      outcome: "Hunted — penalty applied",
      activatedAbility: null,
      abilityLabel: null,
    });
  }

  // ── Survival (penalty == 0) ──
  const safeOutcome =
    facts.locationId === 0 ? "Safe (Home / no hunt)" : "Safe (no hunt)";

  if (!hunted) {
    // No hunt-reactive FX. Farmer still shows permanent passive identity.
    return withFarmerPassive(facts, {
      outcome: safeOutcome,
      activatedAbility: null,
      abilityLabel: null,
    });
  }

  // Hunted but penalty zeroed by a skill.
  if (cls === "Runner" && facts.runnerSuccess) {
    return {
      outcome: "Escaped hunt",
      activatedAbility: "runner",
      abilityLabel: "Runner activated!",
    };
  }
  if (cls === "Lucky" && facts.luckySuccess) {
    return {
      outcome: "Survived under hunt",
      activatedAbility: "lucky",
      abilityLabel: "Lucky activated!",
    };
  }
  if (cls === "King") {
    return {
      outcome: "Survived under hunt",
      activatedAbility: "king",
      abilityLabel: "King activated!",
    };
  }

  return withFarmerPassive(facts, {
    outcome: "Survived under hunt",
    activatedAbility: null,
    abilityLabel: null,
  });
}

/** Labels that may appear on cards / mock rows → presentation id. */
export function abilityLabelForActivation(
  id: AbilityEffectId | null,
): string | null {
  if (!id) return null;
  switch (id) {
    case "runner":
      return "Runner activated!";
    case "lucky":
      return "Lucky activated!";
    case "guardian":
      return "Guardian activated!";
    case "farmer":
      return FARMER_PASSIVE_LABEL;
    case "king":
      return "King activated!";
    default:
      return null;
  }
}

/** @deprecated Prefer `activatedAbility` on rows; kept for label parsing. */
export function parseActivatedAbilityLabel(
  ability: string | null | undefined,
): AbilityEffectId | null {
  if (!ability) return null;
  const s = ability.toLowerCase();
  // Passive Farmer identity — not a proc id for the FX queue.
  if (s.includes("farmer") && (s.includes("harvest") || s.includes("passive"))) {
    return null;
  }
  // Require activation wording — never match static inventory fluff.
  if (!s.includes("activated") && !s.includes("—")) return null;
  if (s.includes("guardian") && (s.includes("activated") || s.includes("mitigation")))
    return "guardian";
  if (s.includes("runner") && (s.includes("activated") || s.includes("escape")))
    return "runner";
  if (s.includes("lucky") && (s.includes("activated") || s.includes("immunity")))
    return "lucky";
  if (s.includes("king") && s.includes("activated")) return "king";
  return null;
}
