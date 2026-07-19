"use client";

import { formatEther } from "viem";
import {
  GameEmptyState,
  GameFeedback,
  GameSkeleton,
} from "@/components/game/ui/GameFeedback";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { useClaimHistory } from "@/hooks/game/useClaimHistory";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { useSettlementView } from "@/hooks/game/useSettlementView";

function claimTone(
  state: string,
): "pending" | "success" | "error" | "info" {
  switch (state) {
    case "confirm":
    case "pending":
      return "pending";
    case "success":
      return "success";
    case "rejected":
    case "failure":
      return "error";
    default:
      return "info";
  }
}

function claimStateLabel(state: string): string {
  switch (state) {
    case "confirm":
      return "Confirm in wallet…";
    case "pending":
      return "Transaction pending…";
    case "success":
      return "Claim succeeded";
    case "rejected":
      return "Rejected in wallet";
    case "failure":
      return "Claim failed";
    default:
      return "";
  }
}

export default function ClaimPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const claim = useClaimRewards();
  const history = useClaimHistory();
  const settleView = useSettlementView();

  const settlementPending =
    settleView.status === "pending" ||
    settleView.status === "available" ||
    settleView.status === "waiting_seed" ||
    settleView.status === "processing" ||
    settleView.status === "loading";

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4">
      <p className="mock-chip mb-3">
        {claim.live
          ? "LIVE — permanently claimable on RewardDistributor"
          : "LOCAL MOCK — claimable from local settlement only"}
      </p>
      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a] sm:text-xl">
        {t.rewards.heading}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hg-muted)]">
        {t.rewards.blurb}
      </p>
      <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--hg-muted)]">
        {t.rewards.noDeadlineNote}
      </p>

      <PixelPanel
        className="mt-4"
        title={t.rewards.heading}
        eyebrow={claim.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        {claim.isLoading || history.loading ? (
          <GameSkeleton rows={4} />
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">{t.rewards.totalClaimable}</dt>
              <dd className="pixel-title text-xl text-[#f0c44a]">
                {claim.displayTotal} HANSOME
              </dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">{t.rewards.lifetimeClaimed}</dt>
              <dd className="pixel-title text-xl text-[#c8c4b8]">
                {history.displayLifetime} HANSOME
              </dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1 sm:col-span-2">
              <dt className="text-[var(--hg-muted)]">{t.rewards.pendingSettlement}</dt>
              <dd>
                {settlementPending
                  ? t.rewards.pendingSettlementYes
                  : t.rewards.pendingSettlementNo}
                {settleView.statusLabel ? (
                  <span className="ml-2 text-xs text-[var(--hg-muted)]">
                    ({settleView.statusLabel})
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-5">
          <PixelButton
            variant="green"
            size="lg"
            disabled={!claim.canClaim}
            aria-busy={claim.hasPendingTx || undefined}
            onClick={() => void claim.claimAll()}
          >
            {claim.hasPendingTx ? "CLAIMING…" : t.actions.claim}
          </PixelButton>
        </div>

        {claim.uiState !== "idle" ? (
          <GameFeedback
            tone={claimTone(claim.uiState)}
            label={
              claimTone(claim.uiState) === "pending"
                ? t.common.txPending
                : claimTone(claim.uiState) === "success"
                  ? t.common.txSuccess
                  : t.common.txError
            }
            meta={claim.txHash ? `Tx: ${claim.txHash}` : undefined}
          >
            {claimStateLabel(claim.uiState)}
          </GameFeedback>
        ) : null}

        {claim.error ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {claim.error}
          </GameFeedback>
        ) : null}
      </PixelPanel>

      <PixelPanel className="mt-4" title={t.rewards.perNftTitle}>
        {claim.live ? (
          claim.chainRows.length === 0 ? (
            <GameEmptyState title={t.common.emptyTitle}>
              No claimable token balances.
            </GameEmptyState>
          ) : (
            <ul className="space-y-2 text-sm">
              {claim.chainRows.map((r) => (
                <li key={r.tokenId} className="hg-list-row">
                  <span>#{r.tokenId}</span>
                  <span className="pixel-title text-[0.7rem] text-[#f0c44a]">
                    {Number(formatEther(r.amount)).toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{" "}
                    HANSOME
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : claim.mockRows.length === 0 ? (
          <GameEmptyState title={t.common.emptyTitle}>
            Nothing claimable locally. Complete Commit → Battle Result first.
          </GameEmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {claim.mockRows.map((r) => (
              <li key={r.tokenId} className="hg-list-row">
                <span>
                  #{r.tokenId} · {GAME_LOCATIONS[r.locationId]?.name}{" "}
                  <span className="text-[0.65rem] text-[var(--hg-muted)]">MOCK</span>
                </span>
                <span className="pixel-title text-[0.7rem] text-[#f0c44a]">
                  {r.rewardHansome} HANSOME
                </span>
              </li>
            ))}
          </ul>
        )}
      </PixelPanel>

      <PixelPanel className="mt-4" title={t.rewards.claimHistory}>
        {history.error ? (
          <GameFeedback tone="error" label={t.common.txError}>
            {history.error}
          </GameFeedback>
        ) : null}
        {history.loading ? (
          <GameSkeleton rows={3} />
        ) : history.history.length === 0 ? (
          <p className="text-sm text-[var(--hg-muted)]">{t.rewards.claimHistoryEmpty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.history.map((row, i) => (
              <li
                key={`${row.tokenId}-${row.txHash ?? i}`}
                className="hg-list-row"
              >
                <span>
                  #{row.tokenId}
                  {row.txHash ? (
                    <span className="ml-2 text-[0.65rem] text-[var(--hg-muted)]">
                      {row.txHash.slice(0, 10)}…
                    </span>
                  ) : null}
                </span>
                <span className="pixel-title text-[0.7rem] text-[#c8c4b8]">
                  {row.amountLabel} HANSOME
                </span>
              </li>
            ))}
          </ul>
        )}
      </PixelPanel>

      <div className="mt-4">
        <PixelButton
          href={gameHref.result}
          variant="slate"
          size="sm"
          className="w-auto min-w-[10rem]"
        >
          {t.rewards.goBattleResult}
        </PixelButton>
      </div>
    </div>
  );
}
