"use client";

import type { PhaseTimelineStep } from "@/lib/game/phaseStatus";
import type { GamePhase } from "@/types/game";

const LABELS_DESKTOP: Record<GamePhase, string> = {
  COMMIT: "Commit",
  REVEAL: "Reveal",
  SETTLEMENT: "Settlement",
  CLAIM: "Claim",
};

/** Shorter labels so the full loop fits small phones without awkward clipping. */
const LABELS_MOBILE: Record<GamePhase, string> = {
  COMMIT: "Commit",
  REVEAL: "Reveal",
  SETTLEMENT: "Settle",
  CLAIM: "Claim",
};

/** Shared timeline meaning; `variant` picks desktop vs mobile CSS hooks. */
export function PhaseTimeline({
  steps,
  variant,
  ariaLabel,
}: {
  steps: PhaseTimelineStep[];
  variant: "desktop" | "mobile";
  ariaLabel: string;
}) {
  const root =
    variant === "desktop" ? "phase-tl phase-tl--desktop" : "phase-tl phase-tl--mobile";
  const labels = variant === "mobile" ? LABELS_MOBILE : LABELS_DESKTOP;

  return (
    <ol className={root} aria-label={ariaLabel}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          className={`phase-tl__step phase-tl__step--${step.state}`}
          data-phase={step.id}
        >
          {i > 0 ? <span className="phase-tl__connector" aria-hidden /> : null}
          <span className="phase-tl__marker" aria-hidden>
            {step.state === "done" ? "✓" : step.state === "active" ? "●" : "○"}
          </span>
          <span className="phase-tl__label">{labels[step.id]}</span>
        </li>
      ))}
    </ol>
  );
}
