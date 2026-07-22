"use client";

import Image from "next/image";
import type { SettlementResultSfxId } from "@/lib/game/settlementResults";

const ALPACA = "/assets/characters/alpaca-hero-ranch.png";
const COUGAR = "/assets/characters/cougar-hero-standoff.png";

/**
 * Pixel hunt vignette for settlement result cards.
 * Presentation only — uses real character art; not a separate battle sim.
 */
export function HuntVignette({ resultId }: { resultId: SettlementResultSfxId }) {
  const hunted = resultId === "alpaca-hunted";
  const success = resultId === "cougar-hunt-success";
  const safe = resultId === "alpaca-safe";
  const missed = resultId === "cougar-hunt-failed";

  return (
    <div
      className={`hg-hunt-vig hg-hunt-vig--${resultId}`}
      aria-hidden
    >
      <div className="hg-hunt-vig__ground" />
      {(hunted || success || missed) && (
        <div className="hg-hunt-vig__cougar">
          <Image
            src={COUGAR}
            alt=""
            width={96}
            height={96}
            className="hg-hunt-vig__sprite"
            unoptimized
          />
        </div>
      )}
      <div
        className={`hg-hunt-vig__alpaca${hunted ? " hg-hunt-vig__alpaca--down" : ""}${safe ? " hg-hunt-vig__alpaca--safe" : ""}`}
      >
        <Image
          src={ALPACA}
          alt=""
          width={88}
          height={88}
          className="hg-hunt-vig__sprite"
          unoptimized
        />
      </div>
      {hunted || success ? <span className="hg-hunt-vig__slash" /> : null}
      {safe ? <span className="hg-hunt-vig__sparkle" /> : null}
    </div>
  );
}
