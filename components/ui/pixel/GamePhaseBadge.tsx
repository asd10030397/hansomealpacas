import type { GamePhase } from "@/types/game";
import { PixelBadge } from "./PixelBadge";

const tone: Record<GamePhase, "gold" | "green" | "blue" | "danger"> = {
  COMMIT: "gold",
  REVEAL: "blue",
  SETTLEMENT: "danger",
  CLAIM: "green",
};

export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
  return <PixelBadge tone={tone[phase]}>{phase}</PixelBadge>;
}
