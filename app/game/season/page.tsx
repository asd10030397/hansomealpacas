import type { Metadata } from "next";
import { SeasonIntro } from "@/components/game/season/SeasonIntro";

export const metadata: Metadata = {
  title: "Season 1 | HANSOME Alpacas",
  description:
    "Season 1 — Alpacas vs Cougars daily commit-reveal loop on Robinhood Chain. 500 Alpacas, 50 Cougars, five locations, daily Claim.",
};

export default function SeasonPage() {
  return <SeasonIntro />;
}
