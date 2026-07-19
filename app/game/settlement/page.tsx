"use client";

import { AbilityEffectOverlay } from "@/components/game/ability-effects/AbilityEffectOverlay";
import { ResultEffectOverlay } from "@/components/game/result-effects/ResultEffectOverlay";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { SettlementResultCard } from "@/components/game/settlement/SettlementResultCard";
import {
  GameEmptyState,
  GameFeedback,
  GameSkeleton,
} from "@/components/game/ui/GameFeedback";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { useSettlementPresentationQueue } from "@/hooks/game/useSettlementPresentationQueue";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useSettlementView } from "@/hooks/game/useSettlementView";
import { parseAbilityEffectId } from "@/lib/game/abilityEffects";
import { parseSettlementResultSfxId } from "@/lib/game/settlementResults";

export default function SettlementPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { day, now, phaseEndsAt, phase } = useGameState();
  const view = useSettlementView();
  const showPresentationFx =
    view.status === "completed" &&
    view.rows.some(
      (r) => parseSettlementResultSfxId(r.outcome) || parseAbilityEffectId(r.ability),
    );
  const {
    currentAbility: abilityCue,
    currentResult: resultCue,
    advance: advancePresentation,
  } = useSettlementPresentationQueue(view.day, view.rows, showPresentationFx);

  return (
    <div className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4">
      <p className="mock-chip mb-3">
        {view.live
          ? "LIVE MODE — contract / distributor are source of truth"
          : "LOCAL MOCK — not on-chain settlement data"}
      </p>
      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a] sm:text-xl">
        SETTLEMENT
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hg-muted)]">
        Day results after Reveal closes. Rewards are never computed on the client for live mode —
        amounts come from the distributor.
      </p>

      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} phase={phase} />
      </div>

      <PixelPanel
        className="mt-4"
        title="STATUS"
        eyebrow={view.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        <p className="pixel-title text-sm text-[#f0c44a]">{view.statusLabel}</p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          Day {view.day} · phase {view.phase}
        </p>

        {view.status === "loading" ? (
          <div className="mt-3">
            <GameSkeleton rows={3} />
          </div>
        ) : null}

        {view.error ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {view.error}
          </GameFeedback>
        ) : null}

        {view.canSettle ? (
          <PixelButton
            className="mt-4"
            variant="gold"
            size="sm"
            disabled={view.settlePending}
            aria-busy={view.settlePending || undefined}
            onClick={() => void view.runSettle()}
          >
            {view.settlePending
              ? "SETTLING…"
              : view.live
                ? "RUN settleDay()"
                : "RUN LOCAL MOCK SETTLEMENT"}
          </PixelButton>
        ) : null}

        {view.settlePending ? (
          <GameFeedback tone="pending" label={t.common.txPending}>
            Settlement transaction in progress. Please wait…
          </GameFeedback>
        ) : null}

        {view.status === "unavailable" ? (
          <div className="mt-3">
            <GameEmptyState title={t.common.unavailableTitle}>
              Settlement is not available for this day yet.
            </GameEmptyState>
          </div>
        ) : null}
      </PixelPanel>

      <PixelPanel className="mt-4" title="YOUR NFT RESULTS" eyebrow={`DAY ${view.day}`}>
        {view.empty ? (
          <GameEmptyState title={t.common.emptyTitle}>
            No active NFT results for this day.
            {!view.live
              ? " Commit + Reveal on this device, then run local settlement."
              : " Reveal on-chain first, then wait for settleDay."}
          </GameEmptyState>
        ) : (
          <ul className="hg-settle-list">
            {view.rows.map((row, index) => (
              <SettlementResultCard
                key={row.tokenId}
                row={row}
                index={index}
                overlays={
                  <>
                    {resultCue?.tokenId === row.tokenId ? (
                      <ResultEffectOverlay
                        key={`result-${resultCue.tokenId}-${resultCue.resultId}`}
                        resultId={resultCue.resultId}
                        active
                        onComplete={advancePresentation}
                      />
                    ) : null}
                    {abilityCue?.tokenId === row.tokenId ? (
                      <AbilityEffectOverlay
                        key={`ability-${abilityCue.tokenId}-${abilityCue.abilityId}`}
                        abilityId={abilityCue.abilityId}
                        active
                        onComplete={advancePresentation}
                      />
                    ) : null}
                  </>
                }
              />
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <PixelButton href={gameHref.rewards} variant="green" size="sm" className="w-auto min-w-[8rem]">
            GO TO CLAIM
          </PixelButton>
          <PixelButton href={gameHref.reveal} variant="slate" size="sm" className="w-auto min-w-[8rem]">
            REVEAL MOVE
          </PixelButton>
        </div>
      </PixelPanel>

      <p className="mt-3 text-xs text-[var(--hg-muted)]">{t.common.demoBanner}</p>
    </div>
  );
}
