"use client";

import { useEffect, useState } from "react";
import { GamePhaseBadge } from "@/components/ui/pixel";
import {
  buildPhaseStatusView,
  formatCountdown,
} from "@/lib/game/phaseStatus";
import { toUiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GameDayState, GamePhase } from "@/types/game";
import { PhaseTimeline } from "./PhaseTimeline";

export type PhaseStatusCopy = {
  gameStatus: string;
  dayLabel: string;
  dayValue: (day: number) => string;
  phaseLabel: string;
  timeRemainingLabel: string;
  /** Phase-specific remaining label, e.g. "Commit ends in". */
  endsInLabel: (phase: GamePhase) => string;
  nextPhaseLabel: string;
  settlementInLabel: string;
  settlementReady: string;
  settlementDone: string;
  timelineAria: string;
  help: Record<GamePhase, string>;
  phaseName: (phase: GamePhase) => string;
  resultPhaseName: string;
};

/** Shared timing meaning for Desktop + Mobile shells. */
export function PhaseStatusBody({
  day,
  now,
  phase,
  variant,
  copy,
}: {
  day: GameDayState;
  now: number;
  phase: GamePhase;
  variant: "desktop" | "mobile";
  copy: PhaseStatusCopy;
}) {
  const view = buildPhaseStatusView(day, phase);
  const loop = toUiLoopPhase(phase);
  const [remain, setRemain] = useState(formatCountdown(view.phaseEndsAt - now));
  const [settle, setSettle] = useState(formatCountdown(view.settlementAt - now));

  useEffect(() => {
    setRemain(formatCountdown(view.phaseEndsAt - now));
    setSettle(formatCountdown(view.settlementAt - now));
  }, [view.phaseEndsAt, view.settlementAt, now]);

  const root =
    variant === "desktop"
      ? "phase-status phase-status--desktop"
      : "phase-status phase-status--mobile";

  const settlementDisplay =
    phase === "SETTLEMENT"
      ? copy.settlementReady
      : phase === "CLAIM"
        ? copy.settlementDone
        : settle;

  const showPhaseCountdown = phase === "COMMIT" || phase === "REVEAL";

  return (
    <div className={root} data-phase={loop} data-wire-phase={phase}>
      <PhaseTimeline
        steps={view.timeline}
        variant={variant}
        ariaLabel={copy.timelineAria}
      />

      <div className="phase-status__grid">
        <div className="phase-status__cell">
          <p className="phase-status__label">{copy.dayLabel}</p>
          <p className="phase-status__value phase-status__value--gold">
            {copy.dayValue(view.day)}
          </p>
        </div>
        <div className="phase-status__cell">
          <p className="phase-status__label">{copy.phaseLabel}</p>
          <div className="phase-status__badge">
            <GamePhaseBadge phase={phase} />
          </div>
        </div>
        <div className="phase-status__cell phase-status__cell--timer">
          <p className="phase-status__label">
            {showPhaseCountdown ? copy.endsInLabel(phase) : copy.timeRemainingLabel}
          </p>
          <p
            className="phase-status__value phase-status__value--timer"
            aria-live="polite"
          >
            {showPhaseCountdown ? remain : "—"}
          </p>
        </div>
        <div className="phase-status__cell">
          <p className="phase-status__label">{copy.nextPhaseLabel}</p>
          <p className="phase-status__value">
            {view.nextPhase === "RESULT"
              ? copy.resultPhaseName
              : view.nextPhase === "COMMIT"
                ? copy.phaseName("COMMIT")
                : "—"}
          </p>
        </div>
        <div className="phase-status__cell phase-status__cell--wide">
          <p className="phase-status__label">{copy.settlementInLabel}</p>
          <p
            className="phase-status__value phase-status__value--timer"
            aria-live="polite"
          >
            {settlementDisplay}
          </p>
        </div>
      </div>

      <p className="phase-status__help">{copy.help[phase]}</p>
    </div>
  );
}
