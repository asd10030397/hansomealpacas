"use client";

import { useEffect, useState } from "react";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { isHansomeGameConfigured } from "@/lib/game/hansomeGame";
import { StandoffMenu } from "./StandoffMenu";
import { StandoffStage } from "./StandoffStage";
import "@/styles/title-standoff.css";

/**
 * Fresh premium indie pixel RPG title screen.
 * Built as a new composition — does not use MainMenuHero / TitleScreenBackdrop layout.
 *
 * Demo banner waits until mount so SSR HTML matches the first client paint when
 * NEXT_PUBLIC_* address inlining drifts between server and browser bundles.
 */
export function StandoffTitleScreen() {
  const { t } = useGameI18n();
  const live = isHansomeGameConfigured();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="standoff">
      {mounted && !live ? (
        <p className="standoff__demo">{t.common.demoBanner}</p>
      ) : null}
      <StandoffStage />
      <StandoffMenu />
    </section>
  );
}
