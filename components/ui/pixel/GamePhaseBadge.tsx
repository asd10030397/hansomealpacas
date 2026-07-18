"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<GamePhase, "gold" | "green" | "blue" | "danger"> = {
  COMMIT: "gold",
  REVEAL: "blue",
  SETTLEMENT: "danger",
  CLAIM: "green",
};

/** Player-facing phase label — never expose raw contract enum strings in ZH. */
export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  return <PixelBadge tone={tone[phase]}>{t.phases[phase]}</PixelBadge>;
}
