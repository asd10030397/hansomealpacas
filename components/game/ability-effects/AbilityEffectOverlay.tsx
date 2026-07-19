"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ABILITY_EFFECT_CATALOG,
  playAbilitySfx,
  type AbilityEffectId,
} from "@/lib/game/abilityEffects";
import {
  FarmerWheatIcon,
  GuardianShieldIcon,
  KingCrownIcon,
  LuckyCloverIcon,
  RunnerShoesIcon,
} from "@/components/game/ability-effects/AbilityIcons";
import "./ability-effects.css";

type Props = {
  abilityId: AbilityEffectId;
  /** Bump / change to replay is intentionally unsupported — parent gates once. */
  active: boolean;
  onComplete?: () => void;
  /** Dev/preview only — force reduced-motion presentation path. */
  forceReducedMotion?: boolean;
};

const PARTICLE_SLOTS = [0, 1, 2, 3, 4, 5] as const;
/** Sparse wind streaks — shoes stay the focus. */
const RUNNER_WIND_SLOTS = [0, 1, 2, 3] as const;
/** Royal sparkles around the crown. */
const KING_SPARKLE_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function Icon({ id }: { id: AbilityEffectId }) {
  if (id === "runner") {
    return (
      <span className="hg-ability-fx__runner-fly">
        <RunnerShoesIcon className="hg-ability-fx__icon hg-ability-fx__icon--runner" />
      </span>
    );
  }
  if (id === "king") {
    return (
      <span className="hg-ability-fx__king-drop">
        <KingCrownIcon className="hg-ability-fx__icon hg-ability-fx__icon--king" />
      </span>
    );
  }
  const cls = "hg-ability-fx__icon";
  switch (id) {
    case "guardian":
      return <GuardianShieldIcon className={cls} />;
    case "lucky":
      return <LuckyCloverIcon className={cls} />;
    case "farmer":
      return <FarmerWheatIcon className={cls} />;
  }
}

/**
 * Non-blocking ability VFX + SFX overlay. Pointer-events none.
 * Plays when `active` becomes true; parent must ensure once-per-result.
 */
export function AbilityEffectOverlay({
  abilityId,
  active,
  onComplete,
  forceReducedMotion = false,
}: Props) {
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(forceReducedMotion || systemReduceMotion);
  const def = ABILITY_EFFECT_CATALOG[abilityId];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    playAbilitySfx(abilityId);
    const ms = reduceMotion ? 900 : def.durationMs;
    const t = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, ms);
    return () => window.clearTimeout(t);
  }, [active, abilityId, def.durationMs, reduceMotion, onComplete]);

  if (!visible) return null;

  const stageClass =
    abilityId === "runner"
      ? "hg-ability-fx__stage hg-ability-fx__stage--runner"
      : abilityId === "king"
        ? "hg-ability-fx__stage hg-ability-fx__stage--king"
        : "hg-ability-fx__stage";

  return (
    <div
      className={`hg-ability-fx hg-ability-fx--${abilityId}${reduceMotion ? " hg-ability-fx--static-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={def.banner}
      data-testid={`ability-fx-${abilityId}`}
    >
      <div className={stageClass}>
        {(abilityId === "guardian" ||
          abilityId === "farmer" ||
          abilityId === "runner" ||
          abilityId === "king") && (
          <span className="hg-ability-fx__burst" />
        )}
        {abilityId === "king" ? (
          <span className="hg-ability-fx__king-aura" aria-hidden />
        ) : null}
        {abilityId === "runner" && !reduceMotion ? (
          <>
            <span className="hg-ability-fx__trail hg-ability-fx__trail--wide" />
            <span className="hg-ability-fx__trail hg-ability-fx__trail--mid" />
            <span className="hg-ability-fx__ghost" aria-hidden>
              <span className="hg-ability-fx__runner-fly">
                <RunnerShoesIcon className="hg-ability-fx__icon hg-ability-fx__icon--runner" />
              </span>
            </span>
          </>
        ) : null}
        {!reduceMotion &&
          (abilityId === "runner"
            ? RUNNER_WIND_SLOTS
            : abilityId === "king"
              ? KING_SPARKLE_SLOTS
              : PARTICLE_SLOTS
          ).map((i) => (
            <span
              key={i}
              className={
                abilityId === "runner"
                  ? "hg-ability-fx__particle hg-ability-fx__particle--wind"
                  : abilityId === "king"
                    ? "hg-ability-fx__particle hg-ability-fx__particle--royal"
                    : "hg-ability-fx__particle"
              }
              style={
                {
                  left:
                    abilityId === "runner"
                      ? `${6 + (i % 4) * 22}%`
                      : abilityId === "king"
                        ? `${10 + (i % 4) * 22}%`
                        : `${18 + (i % 3) * 28}%`,
                  top:
                    abilityId === "runner"
                      ? `${28 + Math.floor(i / 4) * 22}%`
                      : abilityId === "king"
                        ? `${12 + Math.floor(i / 4) * 28}%`
                        : `${22 + Math.floor(i / 3) * 34}%`,
                  animationDelay: `${i * (abilityId === "runner" ? 40 : abilityId === "king" ? 50 : 55)}ms`,
                  ["--dx" as string]:
                    abilityId === "runner"
                      ? `${48 + i * 10}px`
                      : `${(i % 2 === 0 ? 1 : -1) * (10 + i * 4)}px`,
                  ["--dy" as string]:
                    abilityId === "runner"
                      ? `${(i % 2 === 0 ? -1 : 1) * (4 + i * 2)}px`
                      : abilityId === "king"
                        ? `${-16 - i * 3}px`
                        : `${-12 - i * 3}px`,
                } as CSSProperties
              }
            />
          ))}
        <Icon id={abilityId} />
        <span className="hg-ability-fx__banner">{def.banner}</span>
      </div>
    </div>
  );
}
