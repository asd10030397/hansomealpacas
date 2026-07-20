"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAccount } from "wagmi";
import { UnclaimedRewardsNotice } from "@/components/game/UnclaimedRewardsNotice";
import { useAutoReveal } from "@/hooks/game/useAutoReveal";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useNftDisplayMap } from "@/hooks/game/useNftDisplayMap";
import { useSettlementPresentationQueue } from "@/hooks/game/useSettlementPresentationQueue";
import { useSettlementView } from "@/hooks/game/useSettlementView";
import { parseAbilityEffectId } from "@/lib/game/abilityEffects";
import {
  markAutoNavigateScrollDone,
  shouldScrollAfterAutoNavigate,
} from "@/lib/game/autoNavigateToBattle";
import {
  getBattlePresentationFailsafeNotice,
  isBattlePresentationDataReady,
  isBattleSettlementPreparing,
  markBattlePresentationComplete,
  releasePresentationOwner,
  setPresentationPreparing,
  setPresentationQueueActive,
  subscribeBattlePresentation,
} from "@/lib/game/battlePresentationGate";
import {
  isSettlementBattleReady,
  isSettlementRewardProcessing,
} from "@/lib/game/settlementStatus";
import { formatCountdown } from "@/lib/game/phaseStatus";
import {
  GAME_SECTION_IDS,
  scrollToGameSectionWithRetry,
} from "@/lib/game/scrollToGameSection";
import { parseSettlementResultSfxId } from "@/lib/game/settlementResults";
import { resultSubstep } from "@/lib/game/uiLoopPhase";
import { battleResultViewDay } from "@/lib/game/battleResultViewDay";
import { isTestnetGaslessResolveEnabled } from "@/lib/game/testnetGaslessResolve";
import type { TestnetResolveStage } from "@/lib/game/testnetResolveStages";
import { getTestnetGameplayIdentity } from "@/lib/game/testnetGameplayTraits";

function resolveOutcomeLabel(
  outcome: string,
  t: ReturnType<typeof useGameI18n>["t"],
): string {
  if (outcome === "awaiting_reveal") return t.settlement.awaitingReveal;
  if (outcome === "awaiting_settlement") return t.settlement.awaitingSettlement;
  if (outcome === "missed_reveal") return t.result.missedRevealTitle;
  return outcome;
}

function resolveStageLabel(
  stage: TestnetResolveStage | null | undefined,
  t: ReturnType<typeof useGameI18n>["t"],
): string | null {
  if (!stage || stage === "idle") return null;
  if (stage === "checking") return t.result.resolveStages.checking;
  if (stage === "waiting_seed") return t.result.resolveStages.waiting_seed;
  if (stage === "revealing") return t.result.resolveStages.revealing;
  if (stage === "settling") return t.result.resolveStages.settling;
  if (stage === "finalizing") return t.result.resolveStages.finalizing;
  if (stage === "crediting") return t.result.rewardsFinalizingNote;
  if (stage === "completed") return t.result.resolveStages.completed;
  if (stage === "error") return t.result.resolveStages.error;
  return null;
}

const RESULT_PRESENTATION_OWNER = "result-page";

export default function ResultPhasePage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { address } = useAccount();
  const { day, now, phaseEndsAt, phase, isMock } = useGameState();
  const autoReveal = useAutoReveal();
  const viewDay = battleResultViewDay({ currentDay: day.day, phase });
  const settleView = useSettlementView({ targetDay: viewDay });
  const scrolledRef = useRef(false);
  const walletKey = address ?? "anon";
  const [failsafeNotice, setFailsafeNotice] = useState(false);
  useEffect(() => {
    const sync = () => setFailsafeNotice(getBattlePresentationFailsafeNotice());
    sync();
    return subscribeBattlePresentation(sync);
  }, []);
  const stageLabel =
    resolveStageLabel(autoReveal.resolveStage, t) ??
    resolveStageLabel(settleView.resolveStage, t);
  const showingPreviousDay = viewDay !== day.day;

  const sub = resultSubstep(phase, {
    settled: isSettlementBattleReady(settleView.status),
  });

  const hasPresentableRows = settleView.rows.some(
    (r) =>
      !r.missedReveal &&
      (parseSettlementResultSfxId(r.outcome) ||
        r.activatedAbility ||
        parseAbilityEffectId(r.ability)),
  );
  // Start VFX only when battle-ready (finalized/settled UI). Credits may still batch.
  const showPresentationFx = isBattlePresentationDataReady({
    status: settleView.status,
    hasPresentableRows,
  });
  const {
    currentAbility: abilityCue,
    currentResult: resultCue,
    advance: advancePresentation,
    queueStatus,
  } = useSettlementPresentationQueue(
    settleView.day,
    settleView.rows,
    showPresentationFx,
  );

  // Own preparing/queue signals — never clear presentationComplete on cleanup.
  useEffect(() => {
    const preparing = isBattleSettlementPreparing({
      status: settleView.status,
      revealing: autoReveal.revealing,
    });
    const queueActive = showPresentationFx && queueStatus !== "idle";
    setPresentationPreparing(RESULT_PRESENTATION_OWNER, preparing);
    setPresentationQueueActive(RESULT_PRESENTATION_OWNER, queueActive);

    // Authoritative complete: battle presented + cues idle (do not wait for credits).
    if (
      isSettlementBattleReady(settleView.status) &&
      queueStatus === "idle"
    ) {
      markBattlePresentationComplete(walletKey, settleView.day);
    }

    return () => {
      releasePresentationOwner(RESULT_PRESENTATION_OWNER);
    };
  }, [
    settleView.status,
    settleView.day,
    showPresentationFx,
    queueStatus,
    autoReveal.revealing,
    walletKey,
  ]);

  const settleMsLeft = Math.max(0, phaseEndsAt - now);
  const settleCountdown = formatCountdown(settleMsLeft);
  const showPreparing = isBattleSettlementPreparing({
    status: settleView.status,
    revealing: autoReveal.revealing,
  });

  const settleStatusLabel =
    settleView.status === "waiting_seed"
      ? t.settlement.waitingSeedTitle
      : settleView.statusLabel;

  const missedRows = settleView.rows.filter((r) => r.missedReveal);

  const displaySeeds = useMemo(() => {
    const own = settleView.rows.map((r) => ({
      tokenId: r.tokenId,
      side: r.side,
      gameplayClass: r.gameplayClass,
      image: r.image,
    }));
    const others = settleView.otherParticipants.map((p) => {
      const tn = getTestnetGameplayIdentity(p.tokenId);
      return {
        tokenId: p.tokenId,
        side: p.side ?? tn?.side ?? null,
        gameplayClass: tn?.gameplayClass ?? null,
        image: null as string | null,
      };
    });
    return [...own, ...others];
  }, [settleView.rows, settleView.otherParticipants]);

  const displayMap = useNftDisplayMap(displaySeeds);

  // COMMIT → Battle: scroll once to Auto Reveal (mobile-safe sticky offset + retry).
  useEffect(() => {
    if (scrolledRef.current) return;
    if (!shouldScrollAfterAutoNavigate(walletKey, day.day)) return;
    scrolledRef.current = true;
    markAutoNavigateScrollDone(walletKey, day.day);
    return scrollToGameSectionWithRetry(GAME_SECTION_IDS.autoReveal);
  }, [walletKey, day.day, phase]);

  useEffect(() => {
    scrolledRef.current = false;
  }, [day.day]);

  return (
    <div className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4">
      {isMock ? <p className="mock-chip mb-3">{t.common.demoBanner}</p> : null}
      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a] sm:text-xl">
        {t.result.heading}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hg-muted)]">
        {t.result.blurb}
      </p>
      <p className="mt-1 text-xs text-[#f0c44a]">{t.result.comeBackFeel}</p>

      <div className="mt-4">
        <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} phase={phase} />
      </div>

      <p className="mt-3 text-xs text-[var(--hg-muted)]" data-substep={sub}>
        {sub === "preparing"
          ? t.result.substepPreparing
          : sub === "battle"
            ? t.result.substepBattle
            : t.result.substepClaim}
      </p>

      {/* Resolve status — gasless relayer or legacy local auto-reveal */}
      <div
        id={GAME_SECTION_IDS.autoReveal}
        className="scroll-mt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
      >
      <PixelPanel
        className="mt-4"
        title={t.result.revealSectionTitle}
        eyebrow={
          autoReveal.gasless
            ? t.result.revealQueueEyebrowGasless
            : t.result.revealQueueEyebrow
        }
      >
        {autoReveal.gasless && autoReveal.serviceUnavailable ? (
          <GameFeedback tone="info" label={t.result.settleSectionTitle}>
            {autoReveal.serviceNotice}
          </GameFeedback>
        ) : null}

        {autoReveal.gasless && !autoReveal.serviceUnavailable ? (
          <GameFeedback
            tone={autoReveal.revealing ? "pending" : "success"}
            label={t.result.autoRevealTitle}
          >
            {autoReveal.revealing
              ? t.result.autoRevealBodyGasless
              : t.result.autoRevealWaiting}
            {autoReveal.lastMessage ? (
              <p className="mt-2 text-xs text-[var(--hg-muted)]">
                {autoReveal.lastMessage}
              </p>
            ) : null}
          </GameFeedback>
        ) : null}

        {!autoReveal.gasless && phase === "REVEAL" && autoReveal.noSecrets ? (
          <GameFeedback tone="error" label={t.result.noSecretsTitle}>
            {t.result.noSecretsBody}
            <div className="mt-3">
              <PixelButton href={gameHref.commit} variant="green" size="sm" className="w-auto">
                {t.result.goCommit}
              </PixelButton>
            </div>
          </GameFeedback>
        ) : null}

        {!autoReveal.gasless && phase === "REVEAL" && !autoReveal.noSecrets ? (
          <GameFeedback
            tone={autoReveal.revealing ? "pending" : "success"}
            label={t.result.autoRevealTitle}
          >
            {autoReveal.revealing
              ? t.result.autoRevealBody
              : t.result.autoRevealWaiting}
            <p className="mt-2 text-xs tabular-nums text-[var(--hg-muted)]">
              {autoReveal.revealedCount} revealed
              {autoReveal.pendingCount > 0
                ? ` · ${autoReveal.pendingCount} pending · ${settleCountdown}`
                : ` · ${settleCountdown}`}
            </p>
          </GameFeedback>
        ) : null}

        {!autoReveal.gasless && phase !== "REVEAL" && phase !== "COMMIT" ? (
          <GameFeedback tone="info" label={t.common.phaseChanged}>
            {t.result.revealClosedHint}
          </GameFeedback>
        ) : null}

        {missedRows.length > 0 ? (
          <GameFeedback tone="error" label={t.result.missedRevealTitle}>
            {autoReveal.gasless
              ? t.result.missedRevealBodyGasless
              : t.result.missedRevealBody}
            <ul className="mt-2 space-y-1 text-xs">
              {missedRows.map((r) => (
                <li key={r.tokenId}>#{r.tokenId}</li>
              ))}
            </ul>
          </GameFeedback>
        ) : null}

        {autoReveal.lastError && !autoReveal.serviceUnavailable ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {autoReveal.lastError}
          </GameFeedback>
        ) : null}
        {!autoReveal.gasless &&
        autoReveal.lastMessage &&
        !autoReveal.lastError ? (
          <GameFeedback tone="success" label={t.common.txSuccess}>
            {autoReveal.lastMessage}
          </GameFeedback>
        ) : null}
      </PixelPanel>
      </div>

      {showingPreviousDay ? (
        <div className="mt-4" data-testid="result-previous-day-note">
          <GameFeedback tone="info" label={t.result.previousDayBattleNote(viewDay)}>
            {phase === "COMMIT" ? t.result.backgroundSettleNote : null}
          </GameFeedback>
        </div>
      ) : null}

      {failsafeNotice ? (
        <div className="mt-4" data-testid="result-presentation-recovery">
          <GameFeedback tone="info" label={t.result.presentationRecoveryNote} />
        </div>
      ) : null}

      {isSettlementRewardProcessing(settleView.status) ? (
        <div className="mt-4" data-testid="result-rewards-finalizing">
          <GameFeedback tone="pending" label={t.result.rewardsFinalizingNote} />
        </div>
      ) : null}

      {showPreparing ||
      (stageLabel && !isSettlementBattleReady(settleView.status)) ? (
        <div className="mt-4" data-testid="result-post-reveal-staging">
          <GameFeedback
            tone="pending"
            label={stageLabel ?? t.result.afterRevealTitle}
          >
            {stageLabel ? (
              <>
                <p>{stageLabel}</p>
                {phase === "REVEAL" ? (
                  <p className="mt-1">{t.result.afterRevealBody(settleCountdown)}</p>
                ) : null}
                {phase === "COMMIT" ? (
                  <p className="mt-1">{t.result.backgroundSettleNote}</p>
                ) : null}
              </>
            ) : phase === "REVEAL" ? (
              t.result.afterRevealBody(settleCountdown)
            ) : settleView.status === "waiting_seed" ? (
              t.settlement.waitingSeedBody
            ) : (
              t.result.autoSettleHint
            )}
          </GameFeedback>
        </div>
      ) : null}

      <PixelPanel
        className="mt-4"
        title={t.result.settleSectionTitle}
        eyebrow={settleView.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        <p className="pixel-title text-sm text-[#f0c44a]">
          {stageLabel && !isSettlementBattleReady(settleView.status)
            ? stageLabel
            : settleStatusLabel}
        </p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          Day {settleView.day} · {settleView.phase}
          {phase === "REVEAL" ? ` · ${settleCountdown}` : null}
        </p>

        {settleView.status === "loading" ? (
          <div className="mt-3">
            <GameSkeleton rows={2} />
          </div>
        ) : null}

        {settleView.waitingSeed ? (
          <GameFeedback tone="pending" label={t.settlement.waitingSeedTitle}>
            {t.settlement.waitingSeedBody}
          </GameFeedback>
        ) : null}

        {settleView.error && !autoReveal.serviceUnavailable ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {settleView.error}
          </GameFeedback>
        ) : null}

        {settleView.canSettle &&
        settleView.status === "available" &&
        !isTestnetGaslessResolveEnabled() ? (
          <PixelButton
            className="mt-4"
            variant="gold"
            size="sm"
            disabled={settleView.settlePending}
            aria-busy={settleView.settlePending || undefined}
            onClick={() => void settleView.runSettle()}
          >
            {settleView.settlePending
              ? t.settlement.settling
              : settleView.live
                ? t.settlement.runSettleLive
                : t.settlement.runSettleMock}
          </PixelButton>
        ) : null}

        {settleView.settlePending ? (
          <GameFeedback tone="pending" label={t.common.txPending}>
            {t.settlement.settlePendingBody}
          </GameFeedback>
        ) : null}
      </PixelPanel>

      <div
        id={GAME_SECTION_IDS.battleResults}
        className="scroll-mt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
      >
        <PixelPanel
          className="mt-4"
          title={t.result.battleSectionTitle}
          eyebrow={
            showPreparing ? t.result.arenaEyebrow : `DAY ${settleView.day}`
          }
        >
          {settleView.empty ? (
            <GameEmptyState title={t.common.emptyTitle}>
              {settleView.live
                ? t.settlement.emptyBodyLive
                : t.settlement.emptyBodyMock}
            </GameEmptyState>
          ) : (
            <>
              <div className="hg-settle-section">
                <h3 className="hg-settle-section__title">
                  {t.result.yourNftsTitle}
                </h3>
                <p className="hg-settle-section__hint">{t.result.yourNftsHint}</p>
                <ul className="hg-settle-list">
                  {settleView.rows.map((row, index) => {
                    const display = displayMap.get(row.tokenId);
                    const identity = display
                      ? {
                          tokenId: display.tokenId,
                          title: display.title,
                          image: display.image,
                        }
                      : null;
                    return (
                      <SettlementResultCard
                        key={row.tokenId}
                        highlightOwn
                        row={{
                          ...row,
                          // Settlement / owned inventory Side wins over metadata art enrichment.
                          image: display?.image ?? row.image,
                          side: row.side ?? display?.side ?? null,
                          gameplayClass:
                            row.gameplayClass ?? display?.gameplayClass ?? null,
                          outcome: resolveOutcomeLabel(row.outcome, t),
                        }}
                        index={index}
                        rewardReveal={
                          resultCue?.tokenId === row.tokenId
                            ? {
                                active: true,
                                durationMs: resultCue.durationMs,
                              }
                            : null
                        }
                        overlays={
                          <>
                            {resultCue?.tokenId === row.tokenId ? (
                              <ResultEffectOverlay
                                key={`result-${resultCue.tokenId}-${resultCue.resultId}`}
                                resultId={resultCue.resultId}
                                active
                                identity={identity}
                                onComplete={advancePresentation}
                              />
                            ) : null}
                            {abilityCue?.tokenId === row.tokenId ? (
                              <AbilityEffectOverlay
                                key={`ability-${abilityCue.tokenId}-${abilityCue.abilityId}`}
                                abilityId={abilityCue.abilityId}
                                active
                                identity={identity}
                                onComplete={advancePresentation}
                              />
                            ) : null}
                          </>
                        }
                      />
                    );
                  })}
                </ul>
              </div>

              {settleView.otherParticipants.length > 0 ? (
                <div className="hg-settle-section">
                  <h3 className="hg-settle-section__title">
                    {t.result.otherParticipantsTitle}
                  </h3>
                  <p className="hg-settle-section__hint">
                    {t.result.otherParticipantsHint}
                  </p>
                  <ul className="hg-settle-list hg-settle-list--dense">
                    {settleView.otherParticipants.map((p, index) => {
                      const display = displayMap.get(p.tokenId);
                      return (
                        <SettlementResultCard
                          key={`other-${p.tokenId}`}
                          row={{
                            tokenId: p.tokenId,
                            side: p.side ?? display?.side ?? null,
                            gameplayClass: display?.gameplayClass ?? null,
                            image: display?.image ?? null,
                            ownerAddress: null,
                            isOwn: false,
                            claimStatus: "—",
                            rewardLabel: "—",
                            locationName: p.locationName,
                            outcome: "Participated",
                            ability: null,
                            source: "chain",
                          }}
                          index={index}
                        />
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </PixelPanel>
      </div>

      <div className="mt-4 w-full">
        <UnclaimedRewardsNotice className="mb-3" showAction={false} />
        <nav className="result-footer-nav" aria-label={t.dashboard.alsoAvailable}>
          <PixelButton href={gameHref.commit} variant="slate" size="sm">
            {t.result.goCommit}
          </PixelButton>
          <PixelButton href={gameHref.dashboard} variant="slate" size="sm">
            {t.nav.play}
          </PixelButton>
          <PixelButton href={gameHref.claim} variant="green" size="sm">
            {t.dashboard.goToClaim}
          </PixelButton>
        </nav>
      </div>
    </div>
  );
}
