"use client";

import { PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { GameDayState, GamePhase } from "@/types/game";
import { PhaseStatusBody, type PhaseStatusCopy } from "./phase-status/PhaseStatusBody";
import "@/styles/game-phase-status-desktop.css";

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
    phaseName: (phase) => t.phases[phase],
    loopPhaseName: (loop) => {
      if (loop === "BATTLE") return t.phases.BATTLE;
      if (loop === "COMMIT") return t.phases.COMMIT_SHORT;
      if (loop === "REVEAL") return t.phases.REVEAL_SHORT;
      return t.phases.CLAIM_SHORT;
    },
  };
}

/** Desktop (≥1024) game status — exclusive mount via GameStatusPanel. */
export function DesktopGameStatusPanel({
  day,
  now,
  phase,
}: {
  day: GameDayState;
  now: number;
  phase: GamePhase;
}) {
  const copy = usePhaseStatusCopy();
  const { t } = useGameI18n();

  return (
    <PixelPanel
      tone="center"
      title={copy.gameStatus}
      eyebrow={t.phaseStatus.eyebrow}
      className="w-full max-w-2xl phase-status-panel phase-status-panel--desktop"
    >
      <PhaseStatusBody
        day={day}
        now={now}
        phase={phase}
        variant="desktop"
        copy={copy}
      />
    </PixelPanel>
  );
}
