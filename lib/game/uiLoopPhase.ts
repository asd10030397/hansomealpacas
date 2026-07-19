/**
 * Player-facing loop: Commit → Result.
 * Wire GamePhase (REVEAL / SETTLEMENT / CLAIM) stays for chain gates;
 * UI collapses them into one Result experience.
 */

import type { GamePhase } from "@/types/game";

export type UiLoopPhase = "COMMIT" | "RESULT";

/** Sub-steps inside Result — still driven by on-chain windows / settle state. */
export type ResultSubstep = "reveal" | "settle" | "claim";

export const UI_LOOP_FLOW = ["COMMIT", "RESULT"] as const;

export function toUiLoopPhase(phase: GamePhase): UiLoopPhase {
  return phase === "COMMIT" ? "COMMIT" : "RESULT";
}

export function resultSubstep(phase: GamePhase): ResultSubstep {
  if (phase === "REVEAL") return "reveal";
  if (phase === "SETTLEMENT") return "settle";
  if (phase === "CLAIM") return "claim";
  return "reveal";
}

/** True when the player should open the Result surface (not Commit). */
export function isResultPhase(phase: GamePhase): boolean {
  return phase !== "COMMIT";
}
