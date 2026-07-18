"use client";

import { DashboardCommand } from "@/components/game/DashboardCommand";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";

export default function GameDashboardPage() {
  const { t } = useGameI18n();
  const { day, now, phaseEndsAt, phase, setDemoPhase } = useGameState();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">{t.dashboard.heading}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--hg-muted)]">{t.dashboard.blurb}</p>

      <div className="mt-5">
        <DashboardCommand
          day={day}
          now={now}
          phaseEndsAt={phaseEndsAt}
          phase={phase}
        />
      </div>

      <PixelPanel
        className="dash-cmd__demo mt-4"
        title={t.dashboard.demoPhaseTitle}
        eyebrow={t.dashboard.demoPhaseEyebrow}
      >
        <div className="flex flex-wrap gap-2">
          {(["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"] as const).map((p) => (
            <PixelButton
              key={p}
              size="sm"
              variant={phase === p ? "gold" : "slate"}
              onClick={() => setDemoPhase(p)}
            >
              {t.phases[p]}
            </PixelButton>
          ))}
        </div>
      </PixelPanel>
    </div>
  );
}
