"use client";

import { ActionGrid } from "@/components/game/ActionGrid";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { MOCK_BANNER, MOCK_REWARDS } from "@/data/game/mock";
import { useGameState } from "@/hooks/game/useGameState";

export default function GameDashboardPage() {
  const { day, now, phaseEndsAt, phase, setDemoPhase } = useGameState();

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      <p className="mock-chip mb-3">{MOCK_BANNER}</p>
      <h1 className="pixel-title text-lg text-[#f0c44a]">DAILY GAME</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--hg-muted)]">
        Command deck for Commit → Reveal → Settlement → Claim. Phase-gated actions use the
        demo clock until contracts are wired.
      </p>

      <div className="mt-5">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} />
      </div>

      <PixelPanel className="mt-4" title="ACTIONS" eyebrow="TAP FOR STATUS">
        <ActionGrid phase={phase} claimable={MOCK_REWARDS.claimable > 0} />
        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          Unimplemented actions open the Coming Soon modal (never silent-disabled).
        </p>
      </PixelPanel>

      <PixelPanel className="mt-4" title="DEMO PHASE SWITCH" eyebrow="DEV ONLY">
        <div className="flex flex-wrap gap-2">
          {(["COMMIT", "REVEAL", "SETTLEMENT", "CLAIM"] as const).map((p) => (
            <PixelButton
              key={p}
              size="sm"
              variant={phase === p ? "gold" : "slate"}
              onClick={() => setDemoPhase(p)}
            >
              {p}
            </PixelButton>
          ))}
        </div>
      </PixelPanel>
    </div>
  );
}
