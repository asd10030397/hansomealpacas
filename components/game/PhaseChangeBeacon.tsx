"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { GamePhaseBadge } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import type { GamePhase } from "@/types/game";

/**
 * Brief visual cue when the day phase advances.
 * Visual-only — does not play SFX / change game logic.
 */
export function PhaseChangeBeacon() {
  const { t } = useGameI18n();
  const { phase } = useGameState();
  const reduceMotion = useReducedMotion();
  const prev = useRef<GamePhase | null>(null);
  const [flashPhase, setFlashPhase] = useState<GamePhase | null>(null);

  useEffect(() => {
    if (prev.current == null) {
      prev.current = phase;
      return;
    }
    if (prev.current === phase) return;
    prev.current = phase;
    setFlashPhase(phase);
    const ms = reduceMotion ? 900 : 1150;
    const id = window.setTimeout(() => setFlashPhase(null), ms);
    return () => window.clearTimeout(id);
  }, [phase, reduceMotion]);

  if (!flashPhase) return null;

  return (
    <div className="hg-phase-beacon" role="status" aria-live="polite">
      {!reduceMotion ? <span className="hg-phase-beacon__flash" aria-hidden /> : null}
      <div className="hg-phase-beacon__chip">
        <span className="hg-phase-beacon__label">{t.common.phaseChanged}</span>
        <GamePhaseBadge phase={flashPhase} />
      </div>
    </div>
  );
}
