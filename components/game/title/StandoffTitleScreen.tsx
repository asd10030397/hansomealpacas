"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import { StandoffMenu } from "./StandoffMenu";
import { StandoffStage } from "./StandoffStage";
import "@/styles/title-standoff.css";

/**
 * Fresh premium indie pixel RPG title screen.
 * Built as a new composition — does not use MainMenuHero / TitleScreenBackdrop layout.
 */
export function StandoffTitleScreen() {
  const { t } = useGameI18n();

  return (
    <section className="standoff">
      <p className="standoff__demo">{t.common.demoBanner}</p>
      <StandoffStage />
      <StandoffMenu />
    </section>
  );
}
