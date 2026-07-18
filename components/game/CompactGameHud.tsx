"use client";

import { useEffect, useState } from "react";
import { GamePhaseBadge } from "@/components/ui/pixel";
import type { GameDayState } from "@/types/game";

function format(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return [h, m, r].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Compact secondary HUD — Day / Phase / Countdown / Settlement only. */
export function CompactGameHud({
  day,
  now,
  phaseEndsAt,
}: {
  day: GameDayState;
  now: number;
  phaseEndsAt: number;
}) {
  const [clock, setClock] = useState(format(phaseEndsAt - now));

  useEffect(() => {
    setClock(format(phaseEndsAt - now));
  }, [phaseEndsAt, now]);

  return (
    <div className="compact-hud" aria-label="Game status">
      <div className="compact-hud__row">
        <div>
          <p className="compact-hud__label">Day</p>
          <p className="compact-hud__value">{day.day}</p>
        </div>
        <div>
          <p className="compact-hud__label">Phase</p>
          <div className="compact-hud__phase">
            <GamePhaseBadge phase={day.phase} />
          </div>
        </div>
        <div>
          <p className="compact-hud__label">Countdown</p>
          <p className="compact-hud__value" aria-live="polite">
            {clock}
          </p>
        </div>
        <div>
          <p className="compact-hud__label">Settlement</p>
          <p className="compact-hud__value compact-hud__value--sm">{day.settlementStatus}</p>
        </div>
      </div>
    </div>
  );
}
