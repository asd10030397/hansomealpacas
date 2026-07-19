import type { Metadata } from "next";
import { PlayerGuide } from "@/components/game/player-guide/PlayerGuide";

export const metadata: Metadata = {
  title: "Player Guide | HANSOME Alpacas",
  description:
    "Bilingual Player Guide for HANSOME Alpacas vs Cougars — classes, locations, daily loop, and how to earn HANSOME.",
};

export default function PlayerGuidePage() {
  return <PlayerGuide />;
}
