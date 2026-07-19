import type { GameDayState, GamePhase } from "@/types/game";

/** Daily loop order — UI timeline only (does not change on-chain timing). */
export const PHASE_FLOW = ["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"] as const;

export type PhaseFlowId = (typeof PHASE_FLOW)[number];

export type TimelineStepState = "done" | "active" | "upcoming";

export type PhaseTimelineStep = {
  id: PhaseFlowId;
  state: TimelineStepState;
};

export type PhaseStatusView = {
  day: number;
  phase: GamePhase;
  /** Countdown for the active phase window (commit end or reveal end). */
  phaseEndsAt: number;
  /** When settlement becomes eligible (= reveal window end). */
  settlementAt: number;
  nextPhase: PhaseFlowId | null;
  timeline: PhaseTimelineStep[];
};

export function buildPhaseStatusView(
  day: GameDayState,
  phase: GamePhase = day.phase,
): PhaseStatusView {
  const idx = PHASE_FLOW.indexOf(phase as PhaseFlowId);
  const safeIdx = idx < 0 ? 0 : idx;
  const nextPhase =
    safeIdx < PHASE_FLOW.length - 1 ? PHASE_FLOW[safeIdx + 1]! : null;

  const phaseEndsAt =
    phase === "COMMIT"
      ? day.commitEndsAt
      : phase === "REVEAL"
        ? day.revealEndsAt
        : day.revealEndsAt;

  return {
    day: day.day,
    phase,
    phaseEndsAt,
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
