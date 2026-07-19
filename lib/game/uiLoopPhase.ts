/**
 * Player-facing daily loop: Choose Location → Battle Result → Claim.
 *
 * Wire GamePhase stays for chain gates (unchanged):
 *   COMMIT | REVEAL | SETTLEMENT | CLAIM
 * Reveal is automatic (no player Reveal button) and collapses into Battle Result.
 */

import type { GamePhase } from "@/types/game";

export type UiLoopPhase = "CHOOSE" | "BATTLE" | "CLAIM";

/** Sub-steps on the Battle Result surface. */
export type ResultSubstep = "preparing" | "battle" | "claim";

export const UI_LOOP_FLOW = ["CHOOSE", "BATTLE", "CLAIM"] as const;

export function toUiLoopPhase(phase: GamePhase): UiLoopPhase {
  if (phase === "COMMIT") return "CHOOSE";
  if (phase === "CLAIM") return "CLAIM";
  // REVEAL + SETTLEMENT → Battle Result (auto-reveal runs during REVEAL).
  return "BATTLE";
}

export function resultSubstep(phase: GamePhase): ResultSubstep {
  if (phase === "REVEAL") return "preparing";
  if (phase === "SETTLEMENT") return "battle";
  if (phase === "CLAIM") return "claim";
  return "preparing";
}

/** True when the player should open the Battle Result surface (not Choose Location). */
export function isResultPhase(phase: GamePhase): boolean {
  return phase !== "COMMIT";
}
