"use client";

import {
  GamePhaseBadge,
  PixelCountdown,
  PixelPanel,
} from "@/components/ui/pixel";
import type { GameDayState } from "@/types/game";

export function GameStatusPanel({
  day,
  now,
  phaseEndsAt,
}: {
  day: GameDayState;
  now: number;
  phaseEndsAt: number;
}) {
  return (
    <PixelPanel
      tone="center"
      title="GAME STATUS"
      eyebrow="DEMO CLOCK"
      className="w-full max-w-xl"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[0.65rem] text-[var(--hg-muted)]">Current Day</p>
          <p className="pixel-title text-sm text-[#f0c44a]">DAY {day.day}</p>
        </div>
        <div>
          <p className="text-[0.65rem] text-[var(--hg-muted)]">Phase</p>
          <div className="mt-1">
            <GamePhaseBadge phase={day.phase} />
          </div>
        </div>
        <PixelCountdown endsAt={phaseEndsAt} now={now} label="Phase ends" />
        <div>
          <p className="text-[0.65rem] text-[var(--hg-muted)]">Settlement</p>
          <p className="pixel-title mt-1 text-[0.65rem]">{day.settlementStatus}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t-2 border-[#2a3348] pt-3">
        <PixelCountdown endsAt={day.commitEndsAt} now={now} label="Commit window" />
        <PixelCountdown endsAt={day.revealEndsAt} now={now} label="Reveal window" />
      </div>
    </PixelPanel>
  );
}
