"use client";

import { useState } from "react";
import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import type { LeaderboardBoardId } from "@/data/game/mock";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { isHansomeGameConfigured } from "@/lib/game/hansomeGame";

const BOARD_ORDER: LeaderboardBoardId[] = [
  "season",
  "hunter",
  "survivor",
  "earnings",
];

export default function LeaderboardPage() {
  const { t } = useGameI18n();
  const [board, setBoard] = useState<LeaderboardBoardId>("season");

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      {!isHansomeGameConfigured() ? (
        <p className="mock-chip mb-3">{t.common.demoBanner}</p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="pixel-title text-lg text-[#f0c44a]">{t.leaderboard.heading}</h1>
          <p className="mt-2 text-sm text-[var(--hg-muted)]">{t.leaderboard.blurb}</p>
          <p className="mt-2 text-xs text-[var(--hg-muted)]">{t.leaderboard.walletNote}</p>
        </div>
        <ComingSoonButton feature="Live Leaderboard" size="sm" variant="gold" className="w-auto">
          LIVE BOARD
        </ComingSoonButton>
      </div>

      <PixelPanel
        className="mt-4"
        title={t.leaderboard.scoringReviewTitle}
        eyebrow={t.leaderboard.scoringReviewEyebrow}
      >
        <p className="text-sm text-[var(--hg-muted)]">{t.leaderboard.scoringReviewBody}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--hg-muted)]">
          {t.leaderboard.scoringReviewPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#f0c44a]/90">{t.leaderboard.scoringReviewNotice}</p>
      </PixelPanel>

      <div className="mt-4 flex flex-wrap gap-2">
        {BOARD_ORDER.map((id) => (
          <PixelButton
            key={id}
            size="sm"
            variant={board === id ? "gold" : "slate"}
            onClick={() => setBoard(id)}
          >
            {t.leaderboard.boards[id]}
          </PixelButton>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--hg-muted)]">{t.leaderboard.boardHints[board]}</p>

      <PixelPanel
        className="mt-4"
        title={t.leaderboard.boards[board]}
        eyebrow={t.common.comingSoonTitle}
      >
        <p className="text-sm text-[var(--hg-muted)]">
          {t.leaderboard.boardHints[board]}
        </p>
        <p className="mt-3 text-sm text-[var(--hg-muted)]">
          {t.common.comingSoonBody1}
        </p>
        <div className="mt-4">
          <ComingSoonButton feature="Live Leaderboard" variant="slate">
            {t.common.comingSoonTitle}
          </ComingSoonButton>
        </div>
      </PixelPanel>
    </div>
  );
}
