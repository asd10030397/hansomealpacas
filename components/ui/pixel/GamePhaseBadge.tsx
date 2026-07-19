"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<"COMMIT" | "RESULT", "gold" | "blue"> = {
  COMMIT: "gold",
  RESULT: "blue",
};

/** Player-facing phase label — Commit or Result (wire phases collapsed). */
export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  const loop = toUiLoopPhase(phase);
  return (
    <PixelBadge tone={tone[loop]}>
      {loop === "COMMIT" ? t.phases.COMMIT : t.phases.RESULT}
    </PixelBadge>
  );
}
