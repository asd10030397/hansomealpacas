"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase, type UiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<UiLoopPhase, "gold" | "danger"> = {
  CHOOSE: "gold",
  BATTLE: "danger",
};

/** Player-facing phase badge — Choose Location / Battle Result. */
export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  const loop = toUiLoopPhase(phase);
  const label =
    loop === "CHOOSE" ? t.phases.CHOOSE : t.phases.BATTLE_RESULT;
  return <PixelBadge tone={tone[loop]}>{label}</PixelBadge>;
}
