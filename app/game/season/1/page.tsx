import type { Metadata } from "next";
import { SeasonIntro } from "@/components/game/season/SeasonIntro";

export const metadata: Metadata = {
  title: "Season 1 | HANSOME Alpacas",
  description:
    "Season 1 — Alpacas vs Cougars daily commit-reveal loop on Robinhood Chain.",
};

/** Alias for /game/season — same Season 1 intro. */
export default function SeasonOnePage() {
  return <SeasonIntro />;
}
