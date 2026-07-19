"use client";

import { formatEther } from "viem";
import {
  GameEmptyState,
  GameFeedback,
  GameSkeleton,
} from "@/components/game/ui/GameFeedback";
import { PixelButton, PixelPanel } from "@/components/ui/pixel";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { GAME_LOCATIONS } from "@/data/game/locations";

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

export default function RewardsPage() {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const claim = useClaimRewards();

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4">
      <p className="mock-chip mb-3">
        {claim.live
          ? "LIVE MODE — claimable from RewardDistributor"
          : "LOCAL MOCK — claimable from local settlement only"}
      </p>
      <h1 className="pixel-title pixel-title-display text-lg text-[#f0c44a] sm:text-xl">
        {t.rewards.heading}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--hg-muted)]">
        {t.rewards.blurb}
      </p>

      <PixelPanel
        className="mt-4"
        title="CLAIMABLE"
        eyebrow={claim.live ? "ON-CHAIN" : "MOCK / LOCAL"}
      >
        {claim.isLoading ? (
          <GameSkeleton rows={4} />
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">Claimable total</dt>
              <dd className="pixel-title text-[#f0c44a]">
                {claim.displayTotal} HANSOME
              </dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">Day</dt>
              <dd>{claim.day}</dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">Wallet</dt>
              <dd>{claim.isConnected ? "Connected" : "Not connected"}</dd>
            </div>
            <div className="hg-list-row flex-col !items-start gap-1">
              <dt className="text-[var(--hg-muted)]">Mode</dt>
              <dd>{claim.live ? "Live" : "Local mock"}</dd>
            </div>
          </dl>
        )}

        <div className="mt-4">
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

        <p className="mt-3 text-xs text-[var(--hg-muted)]">
          Button disables when nothing is claimable or a claim is already in flight.
        </p>
      </PixelPanel>

      <PixelPanel className="mt-4" title="PER-NFT CLAIMABLE">
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
            Nothing claimable locally. Complete Commit Move → Reveal Move → Settlement first.
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

        <PixelButton
          href={gameHref.settlement}
          variant="slate"
          size="sm"
          className="mt-4 w-auto min-w-[10rem]"
        >
          SETTLEMENT RESULTS
        </PixelButton>
      </PixelPanel>
    </div>
  );
}
