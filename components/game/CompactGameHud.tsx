"use client";

import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import type { GameDayState, GamePhase } from "@/types/game";

/**
 * Compact secondary HUD — reuses the clarified phase status panel
 * (Desktop / Mobile exclusive mounts inside GameStatusPanel).
 */
export function CompactGameHud({
  day,
  now,
  phaseEndsAt,
  phase,
}: {
  day: GameDayState;
  now: number;
  phaseEndsAt: number;
  phase?: GamePhase;
}) {
  return (
    <div className="compact-hud" aria-label="Game status">
      <GameStatusPanel
        day={day}
        now={now}
        phaseEndsAt={phaseEndsAt}
        phase={phase ?? day.phase}
      />
    </div>
  );
}
