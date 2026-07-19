/**
 * Player-facing loop: Commit → Reveal → Battle → Claim.
 * Wire GamePhase stays for chain gates; SETTLEMENT maps to Battle in the UI.
 */

import type { GamePhase } from "@/types/game";

export type UiLoopPhase = "COMMIT" | "REVEAL" | "BATTLE" | "CLAIM";

/** Sub-steps on the Result surface — still driven by on-chain windows / settle state. */
export type ResultSubstep = "reveal" | "settle" | "claim";

export const UI_LOOP_FLOW = ["COMMIT", "REVEAL", "BATTLE", "CLAIM"] as const;

export function toUiLoopPhase(phase: GamePhase): UiLoopPhase {
  if (phase === "COMMIT") return "COMMIT";
  if (phase === "REVEAL") return "REVEAL";
  if (phase === "SETTLEMENT") return "BATTLE";
  return "CLAIM";
}

export function resultSubstep(phase: GamePhase): ResultSubstep {
  if (phase === "REVEAL") return "reveal";
  if (phase === "SETTLEMENT") return "settle";
  if (phase === "CLAIM") return "claim";
  return "reveal";
}

/** True when the player should open the Result / Battle surface (not Commit). */
export function isResultPhase(phase: GamePhase): boolean {
  return phase !== "COMMIT";
}
