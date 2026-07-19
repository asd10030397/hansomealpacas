"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import {
  playSettlementResultSfx,
  SETTLEMENT_RESULT_SFX_CATALOG,
  type SettlementResultSfxId,
} from "@/lib/game/settlementResults";
import {
  ClawSlashIcon,
  CougarBiteIcon,
  HappyAlpacaIcon,
  SadCougarIcon,
} from "@/components/game/result-effects/ResultIcons";
import "./result-effects.css";

type Props = {
  resultId: SettlementResultSfxId;
  active: boolean;
  onComplete?: () => void;
  /** Dev/preview only — force reduced-motion presentation path. */
  forceReducedMotion?: boolean;
  /** When false, skip SFX (caller already played it). Default true. */
  playSfx?: boolean;
  /** Optional NFT identity chip so players know which token is animating. */
  identity?: {
    tokenId: number;
    title: string;
    image: string;
  } | null;
};

const SAFE_SPARKS = [0, 1, 2, 3, 4] as const;
const CLAW_IMPACTS = [0, 1, 2, 3, 4, 5] as const;

function Visual({ id }: { id: SettlementResultSfxId }) {
  const cls = "hg-result-fx__icon";
  switch (id) {
    case "alpaca-hunted":
      return <ClawSlashIcon className={cls} />;
    case "alpaca-safe":
      return <HappyAlpacaIcon className={cls} />;
    case "cougar-hunt-success":
      return <CougarBiteIcon className={cls} />;
    case "cougar-hunt-failed":
      return <SadCougarIcon className={cls} />;
  }
}

/**
 * Non-blocking settlement result VFX + SFX overlay.
 * Plays once when `active` becomes true; parent gates once-per-result.
 */
export function ResultEffectOverlay({
  resultId,
  active,
  onComplete,
  forceReducedMotion = false,
  playSfx = true,
  identity = null,
}: Props) {
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(forceReducedMotion || systemReduceMotion);
  const def = SETTLEMENT_RESULT_SFX_CATALOG[resultId];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (playSfx) playSettlementResultSfx(resultId);
    const ms = reduceMotion ? 900 : def.durationMs;
    const t = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, ms);
    return () => window.clearTimeout(t);
  }, [active, resultId, def.durationMs, reduceMotion, onComplete, playSfx]);

  if (!visible) return null;

  return (
    <div
      className={`hg-result-fx hg-result-fx--${resultId}${reduceMotion ? " hg-result-fx--static-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={
        identity
          ? `${def.banner}: #${identity.tokenId} ${identity.title}`
          : def.banner
      }
    >
      {identity ? (
        <div className="hg-result-fx__identity">
          <div className="hg-result-fx__identity-art">
            <Image
              src={identity.image}
              alt=""
              fill
              className="object-contain p-0.5"
              sizes="34px"
              unoptimized
            />
          </div>
          <div className="hg-result-fx__identity-copy">
            <p className="hg-result-fx__identity-id">#{identity.tokenId}</p>
            <p className="hg-result-fx__identity-class">{identity.title}</p>
          </div>
        </div>
      ) : null}
      <div className="hg-result-fx__stage">
        {resultId === "alpaca-hunted" && !reduceMotion ? (
          <>
            <span className="hg-result-fx__trail-glow" />
            {CLAW_IMPACTS.map((i) => (
              <span
                key={i}
                className="hg-result-fx__spark hg-result-fx__spark--claw"
                style={
                  {
                    left: `${16 + (i % 3) * 26}%`,
                    top: `${20 + Math.floor(i / 3) * 26}%`,
                    animationDelay: `${60 + i * 35}ms`,
                    ["--dx" as string]: `${18 + i * 6}px`,
                    ["--dy" as string]: `${22 + i * 4}px`,
                  } as CSSProperties
                }
              />
            ))}
          </>
        ) : null}
        {resultId === "cougar-hunt-success" && !reduceMotion ? (
          <span className="hg-result-fx__impact" />
        ) : null}
        {resultId === "alpaca-safe" &&
          !reduceMotion &&
          SAFE_SPARKS.map((i) => (
            <span
              key={i}
              className="hg-result-fx__spark"
              style={
                {
                  left: `${22 + (i % 3) * 24}%`,
                  top: `${18 + Math.floor(i / 3) * 28}%`,
                  animationDelay: `${80 + i * 50}ms`,
                  ["--dx" as string]: `${(i % 2 === 0 ? 1 : -1) * (8 + i * 3)}px`,
                  ["--dy" as string]: `${-14 - i * 3}px`,
                } as CSSProperties
              }
            />
          ))}
        <Visual id={resultId} />
        <span className="hg-result-fx__banner">{def.banner}</span>
      </div>
    </div>
  );
}
