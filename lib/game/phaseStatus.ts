import type { GameDayState, GamePhase } from "@/types/game";
import {
  toUiLoopPhase,
  UI_LOOP_FLOW,
  type UiLoopPhase,
} from "@/lib/game/uiLoopPhase";

/** Player-facing daily loop — Commit → Reveal → Battle → Claim. */
export const PHASE_FLOW = UI_LOOP_FLOW;

export type PhaseFlowId = UiLoopPhase;

export type TimelineStepState = "done" | "active" | "upcoming";

export type PhaseTimelineStep = {
  id: PhaseFlowId;
  state: TimelineStepState;
};

export type PhaseStatusView = {
  day: number;
  /** Wire phase from chain / mock (REVEAL | SETTLEMENT | CLAIM | COMMIT). */
  phase: GamePhase;
  /** Player-facing loop phase. */
  loopPhase: UiLoopPhase;
  /** Countdown for the active window. */
  phaseEndsAt: number;
  /** When settlement becomes eligible (= reveal window end). */
  settlementAt: number;
  nextPhase: PhaseFlowId | null;
  timeline: PhaseTimelineStep[];
};

function phaseEndsAtFor(day: GameDayState, phase: GamePhase): number {
  if (phase === "COMMIT") return day.commitEndsAt;
  if (phase === "REVEAL") return day.revealEndsAt;
  // Battle / Claim: count down the day pad (or stay at reveal end when pad is 0).
  return day.dayEndsAt ?? day.revealEndsAt;
}

export function buildPhaseStatusView(
  day: GameDayState,
  phase: GamePhase = day.phase,
): PhaseStatusView {
  const loopPhase = toUiLoopPhase(phase);
  const safeIdx = Math.max(0, PHASE_FLOW.indexOf(loopPhase));
  const nextPhase =
    safeIdx < PHASE_FLOW.length - 1 ? PHASE_FLOW[safeIdx + 1]! : null;

  return {
    day: day.day,
    phase,
    loopPhase,
    phaseEndsAt: phaseEndsAtFor(day, phase),
    settlementAt: day.revealEndsAt,
    nextPhase,
    timeline: PHASE_FLOW.map((id, i) => ({
      id,
      state: i < safeIdx ? "done" : i === safeIdx ? "active" : "upcoming",
    })),
  };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((n) => String(n).padStart(2, "0")).join(":");
}
