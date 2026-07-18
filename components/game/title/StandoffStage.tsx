"use client";

import Image from "next/image";
import { useGameI18n } from "@/hooks/game/useGameI18n";

/**
 * Full-bleed dual-world stage + large facing heroes.
 * Fresh composition — not the previous territory-scene layout.
 */
export function StandoffStage() {
  const { t } = useGameI18n();

  return (
    <div className="standoff__stage" aria-hidden>
      <div className="standoff__world standoff__world--west">
        <div className="standoff__plate">
          <Image
            src="/assets/backgrounds/cougar-mountain-world.png"
            alt=""
            fill
            priority
            sizes="50vw"
            className="standoff__plate-img"
            unoptimized
          />
        </div>
        <div className="standoff__grade" />
      </div>

      <div className="standoff__world standoff__world--east">
        <div className="standoff__plate">
          <Image
            src="/assets/backgrounds/alpaca-ranch-lush.png"
            alt=""
            fill
            priority
            sizes="50vw"
            className="standoff__plate-img"
            unoptimized
          />
        </div>
        <div className="standoff__grade" />
      </div>

      <div className="standoff__seam-glow" />
      <div className="standoff__seam" />

      <div className="standoff__heroes">
        <div className="standoff__hero standoff__hero--cougar">
          <div className="standoff__hero-shadow" />
          <Image
            src="/assets/characters/cougar-hero-standoff.png"
            alt=""
            width={1024}
            height={1024}
            priority
            className="standoff__hero-img"
            unoptimized
          />
        </div>

        <div className="standoff__hero standoff__hero--alpaca">
          <div className="standoff__hero-shadow" />
          <Image
            src="/assets/characters/alpaca-hero-ranch.png"
            alt=""
            width={1024}
            height={1024}
            priority
            className="standoff__hero-img"
            unoptimized
          />
        </div>
      </div>

      <p className="standoff__whisper standoff__whisper--west">
        {t.title.cougarTerritory}
        <span>{t.title.cougarTag}</span>
      </p>
      <p className="standoff__whisper standoff__whisper--east">
        {t.title.alpacaRanch}
        <span>{t.title.alpacaTag}</span>
      </p>

      <div className="standoff__vignette" />
    </div>
  );
}
