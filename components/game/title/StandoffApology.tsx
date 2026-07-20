"use client";

import Image from "next/image";
import { useGameI18n } from "@/hooks/game/useGameI18n";

/**
 * Centered mint-postponement notice on the game title screen.
 */
export function StandoffApology() {
  const { t } = useGameI18n();
  const a = t.title.apology;

  return (
    <aside className="standoff__apology" aria-label={a.ariaLabel}>
      <div className="standoff__apology-art">
        <Image
          src="/assets/characters/alpaca-apology-sad.png"
          alt={a.imageAlt}
          width={280}
          height={280}
          className="standoff__apology-img"
          priority
          unoptimized
        />
      </div>
      <div className="standoff__apology-copy">
        <p className="standoff__apology-lead">{a.line1}</p>
        <p className="standoff__apology-body">{a.line2}</p>
        <p className="standoff__apology-body">{a.line3}</p>
        <p className="standoff__apology-body standoff__apology-body--last">{a.line4}</p>
      </div>
    </aside>
  );
}
