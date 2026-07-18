"use client";

import { ActionGrid } from "@/components/game/ActionGrid";
import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import {
  GamePhaseBadge,
  PixelCountdown,
  PixelPanel,
} from "@/components/ui/pixel";
import { MOCK_DASHBOARD, MOCK_REWARDS } from "@/data/game/mock";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { gameHref } from "@/lib/game/paths";
import type { GameDayState, GamePhase } from "@/types/game";
import "@/styles/dashboard-command.css";

function mainActionForPhase(phase: GamePhase, t: ReturnType<typeof useGameI18n>["t"]) {
  switch (phase) {
    case "COMMIT":
      return {
        kind: "link" as const,
        /** Location selection first — commit() comes after confirm. */
        href: gameHref.explore,
        label: t.dashboard.mainCommit,
        feature: t.features.commit,
        variant: "gold" as const,
      };
    case "REVEAL":
      return {
        kind: "link" as const,
        href: gameHref.reveal,
        label: t.dashboard.mainReveal,
        feature: t.features.reveal,
        variant: "gold" as const,
      };
    case "SETTLEMENT":
      return {
        kind: "status" as const,
        label: t.dashboard.mainSettlement,
        feature: t.features.settlementStatus,
      };
    case "CLAIM":
      return {
        kind: "soon" as const,
        label: t.dashboard.mainClaim,
        feature: t.features.claim,
        variant: "green" as const,
      };
  }
}

export function DashboardCommand({
  day,
  now,
  phaseEndsAt,
  phase,
}: {
  day: GameDayState;
  now: number;
  phaseEndsAt: number;
  phase: GamePhase;
}) {
  const { t } = useGameI18n();
  const main = mainActionForPhase(phase, t);
  const nextSettlementLabel =
    phase === "SETTLEMENT"
      ? t.dashboard.settlementNow
      : phase === "CLAIM"
        ? t.dashboard.settlementDone
        : t.dashboard.nextSettlementAfterReveal;

  return (
    <div className="dash-cmd">
      <div className="dash-cmd__prompt">
        <p className="dash-cmd__prompt-label">{t.dashboard.doNowLabel}</p>
        <p className="dash-cmd__prompt-text">{t.dashboard.doNow[phase]}</p>
      </div>

      <div className="dash-cmd__status">
        <div className="dash-cmd__stat">
          <p className="dash-cmd__stat-label">{t.dashboard.phaseLabel}</p>
          <div className="mt-1">
            <GamePhaseBadge phase={phase} />
          </div>
        </div>
        <div className="dash-cmd__stat">
          <PixelCountdown
            endsAt={phaseEndsAt}
            now={now}
            label={t.dashboard.countdownLabel}
          />
        </div>
        <div className="dash-cmd__stat">
          <p className="dash-cmd__stat-label">{t.dashboard.dayLabel}</p>
          <p className="dash-cmd__stat-value dash-cmd__stat-value--gold">
            {t.dashboard.dayValue(day.day)}
          </p>
        </div>
        <div className="dash-cmd__stat">
          <p className="dash-cmd__stat-label">{t.dashboard.rankLabel}</p>
          <p className="dash-cmd__stat-value dash-cmd__stat-value--gold">
            #{MOCK_DASHBOARD.seasonRank}{" "}
            <span className="text-[0.65rem] text-[var(--hg-muted)]">
              / {MOCK_DASHBOARD.seasonRankOf}
            </span>
          </p>
        </div>
      </div>
      <p className="dash-cmd__phase-explain">{t.dashboard.phaseExplain[phase]}</p>

      <div className="dash-cmd__main">
        <p className="dash-cmd__main-label">{t.dashboard.mainActionLabel}</p>
        {main.kind === "link" ? (
          <WalletGateButton
            feature={main.feature}
            href={main.href}
            variant={main.variant}
            size="lg"
          >
            {main.label}
          </WalletGateButton>
        ) : main.kind === "soon" ? (
          <ComingSoonButton feature={main.feature} variant={main.variant} size="lg">
            {main.label}
          </ComingSoonButton>
        ) : (
          <div className="border-2 border-[#0d1018] bg-[#121826] px-4 py-4 text-center">
            <p className="pixel-title text-sm text-[#f0c44a]">{main.label}</p>
            <p className="mt-2 text-xs text-[var(--hg-muted)]">
              {t.dashboard.settlementStatusLine(day.settlementStatus)}
            </p>
          </div>
        )}

        <dl className="dash-cmd__rewards mt-2">
          <div className="dash-cmd__reward-cell">
            <dt>{t.dashboard.pendingRewards}</dt>
            <dd>{MOCK_REWARDS.totalPending.toLocaleString()} HANSOME</dd>
          </div>
          <div className="dash-cmd__reward-cell">
            <dt>{t.dashboard.claimableRewards}</dt>
            <dd>{MOCK_REWARDS.claimable.toLocaleString()} HANSOME</dd>
          </div>
          <div className="dash-cmd__reward-cell">
            <dt>{t.dashboard.nextSettlement}</dt>
            <dd>{nextSettlementLabel}</dd>
          </div>
        </dl>
      </div>

      <PixelPanel title={t.dashboard.alsoAvailable} eyebrow={t.dashboard.phaseScoped}>
        <ActionGrid phase={phase} />
      </PixelPanel>
    </div>
  );
}
