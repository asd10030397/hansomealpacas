"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase, type UiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<UiLoopPhase, "gold" | "danger" | "green"> = {
  CHOOSE: "gold",
  BATTLE: "danger",
  CLAIM: "green",
};

/** Player-facing phase badge — Choose Location / Battle Result / Claim. */
export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  const loop = toUiLoopPhase(phase);
  const label =
    loop === "CHOOSE"
      ? t.phases.CHOOSE
      : loop === "BATTLE"
        ? t.phases.BATTLE_RESULT
        : t.phases.CLAIM;
  return <PixelBadge tone={tone[loop]}>{label}</PixelBadge>;
}
