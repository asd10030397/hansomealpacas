"use client";

import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { PhaseTimelineStep } from "@/lib/game/phaseStatus";
import type { UiLoopPhase } from "@/lib/game/uiLoopPhase";

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
  const { t } = useGameI18n();
  const root =
    variant === "desktop" ? "phase-tl phase-tl--desktop" : "phase-tl phase-tl--mobile";

  const labels: Record<UiLoopPhase, string> = {
    COMMIT: t.phases.COMMIT_SHORT,
    REVEAL: t.phases.REVEAL_SHORT,
    BATTLE: t.phases.BATTLE,
    CLAIM: t.phases.CLAIM_SHORT,
  };

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
