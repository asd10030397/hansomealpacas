/**
 * Player-facing daily loop: Choose Location → Battle Result.
 *
 * Battle Result = resolved outcomes + viewing window (animations, history, claim).
 * Claim is an action inside Battle Result — not a separate waiting phase.
 *
 * Wire GamePhase stays for chain gates (unchanged):
 *   COMMIT | REVEAL | SETTLEMENT | CLAIM
 */

import type { GamePhase } from "@/types/game";

export type UiLoopPhase = "CHOOSE" | "BATTLE";

/** Sub-steps on the Battle Result surface. */
export type ResultSubstep = "preparing" | "battle" | "claim";

export const UI_LOOP_FLOW = ["CHOOSE", "BATTLE"] as const;

export function toUiLoopPhase(phase: GamePhase): UiLoopPhase {
  if (phase === "COMMIT") return "CHOOSE";
  // REVEAL / SETTLEMENT / CLAIM → Battle Result (resolve ASAP, then view + claim).
  return "BATTLE";
}

export function resultSubstep(
  phase: GamePhase,
  opts?: { settled?: boolean },
): ResultSubstep {
  // After resolution: results + claim are available together (viewing window).
  if (opts?.settled || phase === "CLAIM") return "battle";
  if (phase === "SETTLEMENT") return "battle";
  if (phase === "REVEAL") return "preparing";
  return "preparing";
}

/** True when the player should open the Battle Result surface (not Choose Location). */
export function isResultPhase(phase: GamePhase): boolean {
  return phase !== "COMMIT";
}
