"use client";

import { MOCK_BANNER } from "@/data/game/mock";
import { StandoffMenu } from "./StandoffMenu";
import { StandoffStage } from "./StandoffStage";
import "@/styles/title-standoff.css";

/**
 * Fresh premium indie pixel RPG title screen.
 * Built as a new composition — does not use MainMenuHero / TitleScreenBackdrop layout.
 */
export function StandoffTitleScreen() {
  return (
    <section className="standoff">
      <p className="standoff__demo">{MOCK_BANNER}</p>
      <StandoffStage />
      <StandoffMenu />
    </section>
  );
}
