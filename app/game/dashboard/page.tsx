"use client";

import { DashboardCommand } from "@/components/game/DashboardCommand";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";

export default function GameDashboardPage() {
  const { t } = useGameI18n();
  const { day, now, phaseEndsAt, phase, setDemoPhase, isMock, isLoading, chainDayState } =
    useGameState();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4">
      {isMock ? <p className="mock-chip mb-3">{t.common.demoBanner}</p> : null}
      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a] sm:text-xl">
        {t.dashboard.heading}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--hg-muted)]">
        {t.dashboard.blurb}
      </p>
      {!isMock ? (
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          Live chain · Day {day.day}
          {chainDayState != null ? ` · state ${chainDayState}` : ""}
          {isLoading ? " · syncing…" : ""}
          {day.settled ? " · settled" : ""}
        </p>
      ) : null}

      <div className="mt-5">
        <DashboardCommand
          day={day}
          now={now}
          phaseEndsAt={phaseEndsAt}
          phase={phase}
        />
      </div>

      {isMock ? (
        <PixelPanel
          className="dash-cmd__demo mt-4"
          title={t.dashboard.demoPhaseTitle}
          eyebrow={t.dashboard.demoPhaseEyebrow}
        >
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label={t.dashboard.demoPhaseTitle}
          >
            {(["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"] as const).map((p) => (
              <PixelButton
                key={p}
                size="sm"
                variant={phase === p ? "gold" : "slate"}
                className="w-full"
                aria-pressed={phase === p}
                onClick={() => setDemoPhase(p)}
              >
                {t.phases[p]}
              </PixelButton>
            ))}
          </div>
        </PixelPanel>
      ) : null}
    </div>
  );
}
