"use client";

import { DesktopGameStatusPanel } from "@/components/game/DesktopGameStatusPanel";
import { MobileGameStatusPanel } from "@/components/game/MobileGameStatusPanel";
import { useGameMobileViewport } from "@/hooks/game/useGameMobileViewport";
import type { GameDayState, GamePhase } from "@/types/game";

/**
 * Exclusive Desktop / Mobile mount for game timing UI.
 * Shared phase meaning via PhaseStatusBody; no dual “both windows active” timers.
 */
export function GameStatusPanel({
  day,
  now,
  phaseEndsAt: _phaseEndsAt,
  phase,
}: {
  day: GameDayState;
  now: number;
  /** Kept for call-site compatibility; active phase end is derived from day + phase. */
  phaseEndsAt?: number;
  phase?: GamePhase;
}) {
  const mobile = useGameMobileViewport();
  const activePhase = phase ?? day.phase;

  if (mobile) {
    return <MobileGameStatusPanel day={day} now={now} phase={activePhase} />;
  }
  return <DesktopGameStatusPanel day={day} now={now} phase={activePhase} />;
}
