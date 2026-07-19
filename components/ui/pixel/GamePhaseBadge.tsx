"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase, type UiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<UiLoopPhase, "gold" | "blue" | "danger" | "green"> = {
  COMMIT: "gold",
  REVEAL: "blue",
  BATTLE: "danger",
  CLAIM: "green",
};

const labelKey: Record<UiLoopPhase, "COMMIT" | "REVEAL" | "BATTLE" | "CLAIM"> = {
  COMMIT: "COMMIT",
  REVEAL: "REVEAL",
  BATTLE: "BATTLE",
  CLAIM: "CLAIM",
};

/** Player-facing phase badge — Commit / Reveal / Battle / Claim. */
export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  const loop = toUiLoopPhase(phase);
  return <PixelBadge tone={tone[loop]}>{t.phases[labelKey[loop]]}</PixelBadge>;
}
