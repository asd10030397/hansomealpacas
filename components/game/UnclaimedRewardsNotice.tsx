"use client";

import { PixelButton } from "@/components/ui/pixel";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";

/** Compact Play/Result notice — claiming lives on the global Claim page. */
export function UnclaimedRewardsNotice({
  className = "",
  /** When false, only the text notice is shown (parent owns the CTA). */
  showAction = true,
}: {
  className?: string;
  showAction?: boolean;
}) {
  const { t } = useGameI18n();
  const gameHref = useGameHref();
  const claim = useClaimRewards();

  if (claim.isLoading) return null;
  if (!claim.canClaim && claim.claimableTotal === 0n) return null;

  // Mock mode: claimableTotal may be number-like bigint from integer rewards.
  const hasBalance =
    claim.claimableTotal > 0n ||
    (!claim.live && claim.mockRows.length > 0);

  if (!hasBalance) return null;

  return (
    <div
      className={`unclaimed-rewards-notice flex w-full flex-wrap items-center gap-x-3 gap-y-2 text-sm ${className}`}
      data-testid="unclaimed-rewards-notice"
    >
      <p className="m-0 min-w-0 flex-1 text-left text-[var(--hg-muted)]">
        {t.dashboard.unclaimedNotice}
      </p>
      {showAction ? (
        <PixelButton
          href={gameHref.claim}
          variant="green"
          size="sm"
          className="!flex w-auto min-w-[8rem] shrink-0"
        >
          {t.dashboard.goToClaim}
        </PixelButton>
      ) : null}
    </div>
  );
}
