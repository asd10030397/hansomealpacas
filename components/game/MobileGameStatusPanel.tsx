"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { GameDayState, GamePhase } from "@/types/game";
import { PhaseStatusBody, type PhaseStatusCopy } from "./phase-status/PhaseStatusBody";
import "@/styles/game-phase-status-mobile.css";

function usePhaseStatusCopy(): PhaseStatusCopy {
  const { t } = useGameI18n();
  return {
    gameStatus: t.phaseStatus.gameStatus,
    dayLabel: t.phaseStatus.dayLabel,
    dayValue: t.phaseStatus.dayValue,
    phaseLabel: t.phaseStatus.phaseLabel,
    timeRemainingLabel: t.phaseStatus.timeRemainingLabel,
    endsInLabel: t.phaseStatus.endsInLabel,
    nextPhaseLabel: t.phaseStatus.nextPhaseLabel,
    settlementInLabel: t.phaseStatus.settlementInLabel,
    settlementReady: t.phaseStatus.settlementReady,
    settlementDone: t.phaseStatus.settlementDone,
    timelineAria: t.phaseStatus.timelineAria,
    help: t.phaseStatus.help,
    phaseName: (p) => t.phases[p],
    loopPhaseName: (loop) => {
      if (loop === "BATTLE") return t.phases.BATTLE;
      if (loop === "COMMIT") return t.phases.COMMIT_SHORT;
      if (loop === "REVEAL") return t.phases.REVEAL_SHORT;
      return t.phases.CLAIM_SHORT;
    },
  };
}

/** Mobile (≤1023) game status — exclusive mount via GameStatusPanel. */
export function MobileGameStatusPanel({
  day,
  now,
  phase,
}: {
  day: GameDayState;
  now: number;
  phase: GamePhase;
}) {
  const copy = usePhaseStatusCopy();

  return (
    <section
      className="phase-status-panel phase-status-panel--mobile"
      aria-label={copy.gameStatus}
    >
      <header className="phase-status-panel__mobile-head">
        <p className="phase-status-panel__mobile-eyebrow">{copy.gameStatus}</p>
      </header>
      <PhaseStatusBody
        day={day}
        now={now}
        phase={phase}
        variant="mobile"
        copy={copy}
      />
    </section>
  );
}
