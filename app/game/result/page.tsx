"use client";

import { useState } from "react";
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
import { GAME_LOCATIONS } from "@/data/game/locations";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useGameState } from "@/hooks/game/useGameState";
import { useHansomeReveal } from "@/hooks/game/useHansomeReveal";
import { useSettlementPresentationQueue } from "@/hooks/game/useSettlementPresentationQueue";
import { useSettlementView } from "@/hooks/game/useSettlementView";
import { parseAbilityEffectId } from "@/lib/game/abilityEffects";
import { listCommitSecretsForDay } from "@/lib/game/commitSecret";
import { parseSettlementResultSfxId } from "@/lib/game/settlementResults";
import { resultSubstep } from "@/lib/game/uiLoopPhase";

function resolveOutcomeLabel(
  outcome: string,
  t: ReturnType<typeof useGameI18n>["t"],
): string {
  if (outcome === "awaiting_reveal") return t.settlement.awaitingReveal;
  if (outcome === "awaiting_settlement") return t.settlement.awaitingSettlement;
  return outcome;
}

export default function ResultPhasePage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const { day, now, phaseEndsAt, phase, isMock } = useGameState();
  const sub = resultSubstep(phase);

  const { revealNft, configured, isPending, lastError } = useHansomeReveal();
  const [queue, setQueue] = useState(() => listCommitSecretsForDay(day.day));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const settleView = useSettlementView();
  const claim = useClaimRewards();

  const showPresentationFx =
    settleView.status === "completed" &&
    settleView.rows.some(
      (r) =>
        !r.missedReveal &&
        (parseSettlementResultSfxId(r.outcome) ||
          r.activatedAbility ||
          parseAbilityEffectId(r.ability)),
    );
  const {
    currentAbility: abilityCue,
    currentResult: resultCue,
    advance: advancePresentation,
  } = useSettlementPresentationQueue(
    settleView.day,
    settleView.rows,
    showPresentationFx,
  );

  const onReveal = async (tokenId: number) => {
    if (phase !== "REVEAL") {
      setStatusMsg(t.result.revealClosedHint);
      return;
    }
    setBusyId(tokenId);
    const result = await revealNft({ tokenId, day: day.day });
    setQueue(listCommitSecretsForDay(day.day));
    setBusyId(null);

    if (!result.ok) {
      setStatusMsg(result.error);
      return;
    }

    const loc = GAME_LOCATIONS[result.record.locationId]?.name ?? "?";
    setStatusMsg(
      result.mode === "chain"
        ? `Reveal Move #${tokenId} on-chain → ${loc}.`
        : `Reveal Move #${tokenId} locally → ${loc}.`,
    );
  };

  const pending = queue.filter(
    (r) => r.status === "submitted" || r.status === "prepared",
  );
  const done = queue.filter((r) => r.status === "revealed");

  const settleStatusLabel =
    settleView.status === "waiting_seed"
      ? t.settlement.waitingSeedTitle
      : settleView.statusLabel;

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
        {sub === "reveal"
          ? t.result.substepReveal
          : sub === "settle"
            ? t.result.substepSettle
            : t.result.substepClaim}
      </p>

      {/* 1 · Reveal (manual — salt stays client-side) */}
      <PixelPanel
        className="mt-4"
        title={t.result.revealSectionTitle}
        eyebrow={t.result.revealQueueEyebrow}
      >
        {phase !== "REVEAL" ? (
          <GameFeedback tone="info" label={t.common.phaseChanged}>
            {t.result.revealClosedHint}
          </GameFeedback>
        ) : null}

        {pending.length === 0 && done.length === 0 ? (
          <GameEmptyState title={t.common.emptyTitle}>
            No commit secrets for day {day.day} on this device.
            <div className="mt-3">
              <PixelButton href={gameHref.commit} variant="green" size="sm" className="w-auto">
                {t.result.goCommit}
              </PixelButton>
            </div>
          </GameEmptyState>
        ) : (
          <ul className="mt-2 space-y-2">
            {[...pending, ...done].map((secret) => {
              const loc = GAME_LOCATIONS[secret.locationId];
              const revealed = secret.status === "revealed";
              const busy = busyId === secret.tokenId && isPending;
              return (
                <li
                  key={`${secret.day}-${secret.tokenId}`}
                  className="hg-list-row"
                >
                  <span>
                    #{secret.tokenId} · {loc?.name ?? `L${secret.locationId}`}
                    <span className="ml-2 text-[0.65rem] text-[var(--hg-muted)]">
                      · {secret.status.toUpperCase()}
                    </span>
                  </span>
                  <PixelButton
                    variant="gold"
                    size="sm"
                    className="w-auto min-w-[7rem]"
                    disabled={
                      revealed ||
                      isPending ||
                      phase !== "REVEAL" ||
                      busyId === secret.tokenId
                    }
                    aria-busy={busy || undefined}
                    onClick={() => void onReveal(secret.tokenId)}
                  >
                    {busy
                      ? t.result.revealing
                      : revealed
                        ? t.result.revealed
                        : t.result.revealAction}
                  </PixelButton>
                </li>
              );
            })}
          </ul>
        )}

        {isPending ? (
          <GameFeedback tone="pending" label={t.common.txPending}>
            Confirm in wallet if prompted, then wait for the transaction.
          </GameFeedback>
        ) : null}
        {statusMsg && !lastError ? (
          <GameFeedback
            tone={
              /fail|closed|missed/i.test(statusMsg) ? "error" : "success"
            }
            label={
              /fail|closed|missed/i.test(statusMsg)
                ? t.common.txError
                : t.common.txSuccess
            }
          >
            {statusMsg}
          </GameFeedback>
        ) : null}
        {lastError ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {lastError}
          </GameFeedback>
        ) : null}
        {!configured && isMock ? (
          <p className="mt-2 text-xs text-[var(--hg-muted)]">
            Local Reveal Move recorded until the game contract is used.
          </p>
        ) : null}
      </PixelPanel>

      {/* 2 · Settlement status */}
      <PixelPanel
        className="mt-4"
        title={t.result.settleSectionTitle}
        eyebrow={settleView.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        <p className="pixel-title text-sm text-[#f0c44a]">{settleStatusLabel}</p>
        <p className="mt-2 text-xs text-[var(--hg-muted)]">
          Day {settleView.day} · {settleView.phase}
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

        {settleView.error ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {settleView.error}
          </GameFeedback>
        ) : null}

        {settleView.canSettle ? (
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

      {/* 3 · Battle results + FX */}
      <PixelPanel
        className="mt-4"
        title={t.result.battleSectionTitle}
        eyebrow={`DAY ${settleView.day}`}
      >
        {settleView.empty ? (
          <GameEmptyState title={t.common.emptyTitle}>
            {settleView.live
              ? t.settlement.emptyBodyLive
              : t.settlement.emptyBodyMock}
          </GameEmptyState>
        ) : (
          <ul className="hg-settle-list">
            {settleView.rows.map((row, index) => (
              <SettlementResultCard
                key={row.tokenId}
                row={{
                  ...row,
                  outcome: resolveOutcomeLabel(row.outcome, t),
                }}
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
      </PixelPanel>

      {/* 4 · Claim */}
      <PixelPanel
        className="mt-4"
        title={t.result.claimSectionTitle}
        eyebrow={claim.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        {claim.isLoading ? (
          <GameSkeleton rows={2} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">{t.result.claimTotal}</dt>
              <dd className="pixel-title text-[#f0c44a]">
                {claim.displayTotal}{" "}
                {claim.live ? "tHANSOME" : "HANSOME"}
              </dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">Day</dt>
              <dd>{claim.day}</dd>
            </div>
          </dl>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <PixelButton
            variant="green"
            size="sm"
            className="w-auto min-w-[8rem]"
            disabled={!claim.canClaim || claim.uiState === "pending"}
            onClick={() => void claim.claimAll()}
          >
            {claim.uiState === "pending" || claim.uiState === "confirm"
              ? t.result.claiming
              : t.result.claimAction}
          </PixelButton>
          <PixelButton
            href={gameHref.rewards}
            variant="slate"
            size="sm"
            className="w-auto min-w-[8rem]"
          >
            {t.actions.rewards}
          </PixelButton>
        </div>

        {!claim.canClaim && !claim.isLoading ? (
          <p className="mt-2 text-xs text-[var(--hg-muted)]">
            {t.result.noClaimable}
          </p>
        ) : null}

        {claim.error ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {claim.error}
          </GameFeedback>
        ) : null}
      </PixelPanel>

      <div className="mt-4 flex flex-wrap gap-2">
        <PixelButton href={gameHref.commit} variant="slate" size="sm" className="w-auto">
          {t.result.goCommit}
        </PixelButton>
        <PixelButton href={gameHref.dashboard} variant="slate" size="sm" className="w-auto">
          {t.nav.play}
        </PixelButton>
      </div>
    </div>
  );
}
