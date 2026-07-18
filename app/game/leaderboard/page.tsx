"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { PixelBadge, PixelPanel } from "@/components/ui/pixel";
import { MOCK_BANNER, MOCK_LEADERBOARD } from "@/data/game/mock";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <p className="mock-chip mb-3">{MOCK_BANNER}</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="pixel-title text-lg text-[#f0c44a]">LEADERBOARD</h1>
          <p className="mt-2 text-sm text-[var(--hg-muted)]">
            Preview rankings with mock scores. Live competitive board is not connected yet.
          </p>
        </div>
        <ComingSoonButton feature="Live Leaderboard" size="sm" variant="gold" className="w-auto">
          LIVE BOARD
        </ComingSoonButton>
      </div>

      <PixelPanel className="mt-4" title="PREVIEW (MOCK)" eyebrow="NOT LIVE">
        <ol className="space-y-2">
          {MOCK_LEADERBOARD.map((row) => (
            <li
              key={row.rank}
              className="flex items-center justify-between gap-3 border-2 border-[#2a3348] px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="pixel-title text-[#f0c44a]">#{row.rank}</span>
                <div>
                  <p className="pixel-title text-[0.65rem]">{row.label}</p>
                  <PixelBadge tone={row.side === "Cougar" ? "danger" : "green"}>
                    {row.side}
                  </PixelBadge>
                </div>
              </div>
              <div className="text-right text-xs">
                <p>Score {row.score}</p>
                <p className="text-[#f0c44a]">{row.earned} earned (mock)</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <ComingSoonButton feature="Leaderboard sync" variant="slate">
            SYNC ON-CHAIN RANKS
          </ComingSoonButton>
        </div>
      </PixelPanel>
    </div>
  );
}
