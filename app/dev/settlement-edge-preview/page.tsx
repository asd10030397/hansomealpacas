"use client";

/**
 * Dev-only preview for E9 missed-reveal + waiting-seed settlement UI.
 * Not linked from production nav.
 */

import { SettlementResultCard } from "@/components/game/settlement/SettlementResultCard";
import { GameFeedback } from "@/components/game/ui/GameFeedback";
import { PixelPanel } from "@/components/ui/pixel";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { MISSED_REVEAL_OUTCOME } from "@/lib/game/missedReveal";

export default function SettlementEdgePreviewPage() {
  const { t, locale, setLocale } = useGameI18n();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4" data-testid="settlement-edge-preview">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="pixel-btn"
          data-testid="locale-en"
          onClick={() => setLocale("en")}
        >
          EN
        </button>
        <button
          type="button"
          className="pixel-btn"
          data-testid="locale-zh"
          onClick={() => setLocale("zh")}
        >
          中文
        </button>
        <span className="text-xs text-[var(--hg-muted)]">locale: {locale}</span>
      </div>

      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a]">
        {t.settlement.heading} · EDGE PREVIEW
      </h1>

      <PixelPanel className="mt-4" title={t.settlement.statusTitle} eyebrow="SEED">
        <p className="pixel-title text-sm text-[#f0c44a]">
          {t.settlement.waitingSeedTitle}
        </p>
        <GameFeedback tone="pending" label={t.settlement.waitingSeedTitle}>
          {t.settlement.waitingSeedBody}
        </GameFeedback>
      </PixelPanel>

      <PixelPanel className="mt-4" title={t.settlement.resultsTitle} eyebrow="E9">
        <ul className="hg-settle-list">
          <SettlementResultCard
            index={0}
            row={{
              tokenId: 22,
              side: "Alpaca",
              source: "mock",
              rewardLabel: t.settlement.rewardZero,
              locationName: "—",
              outcome: MISSED_REVEAL_OUTCOME,
              ability: null,
              missedReveal: true,
            }}
          />
          <SettlementResultCard
            index={1}
            row={{
              tokenId: 14,
              side: "Alpaca",
              source: "mock",
              rewardLabel: "440 HANSOME",
              locationName: "Grassland",
              outcome: "Safe (no hunt)",
              ability: null,
              missedReveal: false,
            }}
          />
        </ul>
      </PixelPanel>
    </div>
  );
}
