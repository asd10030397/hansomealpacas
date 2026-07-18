"use client";

import { useEffect, useRef, useState } from "react";
import { ActionGrid } from "@/components/game/ActionGrid";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import {
  GamePhaseBadge,
  PixelCountdown,
  PixelPanel,
} from "@/components/ui/pixel";
import { MOCK_DASHBOARD } from "@/data/game/mock";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { GameDayState, GamePhase } from "@/types/game";
import "@/styles/dashboard-command.css";

function mainActionForPhase(
  phase: GamePhase,
  t: ReturnType<typeof useGameI18n>["t"],
  hrefs: ReturnType<typeof useGameHref>,
) {
  switch (phase) {
    case "COMMIT":
      return {
        kind: "link" as const,
        href: hrefs.explore,
        label: t.dashboard.mainCommit,
        feature: t.features.commit,
        variant: "gold" as const,
      };
    case "REVEAL":
      return {
        kind: "link" as const,
        href: hrefs.reveal,
        label: t.dashboard.mainReveal,
        feature: t.features.reveal,
        variant: "gold" as const,
      };
    case "SETTLEMENT":
      return {
        kind: "link" as const,
        // Settlement presentation page ships separately; rewards reads live claimable.
        href: hrefs.rewards,
        label: t.dashboard.mainSettlement,
        feature: t.features.settlementStatus,
        variant: "gold" as const,
      };
    case "CLAIM":
      return {
        kind: "link" as const,
        href: hrefs.rewards,
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
  const gameHref = useGameHref();
  const claim = useClaimRewards();
  const main = mainActionForPhase(phase, t, gameHref);
  const nextSettlementLabel =
    phase === "SETTLEMENT"
      ? t.dashboard.settlementNow
      : phase === "CLAIM"
        ? t.dashboard.settlementDone
        : t.dashboard.nextSettlementAfterReveal;
  const prevPhase = useRef<GamePhase | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevPhase.current == null) {
      prevPhase.current = phase;
      return;
    }
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 700);
    return () => window.clearTimeout(id);
  }, [phase]);

  return (
    <div className="dash-cmd">
      <div
        className={`dash-cmd__prompt dash-cmd__prompt--${phase}${pulse ? " dash-cmd__phase-pulse" : ""}`}
      >
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
            {claim.live ? (
              <span className="text-[0.75rem] text-[var(--hg-muted)]">—</span>
            ) : (
              <>
                #{MOCK_DASHBOARD.seasonRank}{" "}
                <span className="text-[0.65rem] text-[var(--hg-muted)]">
                  / {MOCK_DASHBOARD.seasonRankOf}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <p className="dash-cmd__phase-explain">{t.dashboard.phaseExplain[phase]}</p>

      <div className="dash-cmd__main">
        <p className="dash-cmd__main-label">{t.dashboard.mainActionLabel}</p>
        <WalletGateButton
          feature={main.feature}
          href={main.href}
          variant={main.variant}
          size="lg"
        >
          {main.label}
        </WalletGateButton>

        <dl className="dash-cmd__rewards mt-2">
          <div className="dash-cmd__reward-cell">
            <dt>{t.dashboard.pendingRewards}</dt>
            <dd>
              {claim.displayTotal} {claim.live ? "tHANSOME" : "HANSOME"}
              {!claim.live ? " · MOCK" : ""}
            </dd>
          </div>
          <div className="dash-cmd__reward-cell">
            <dt>{t.dashboard.claimableRewards}</dt>
            <dd>
              {claim.displayTotal} {claim.live ? "tHANSOME" : "HANSOME"}
              {!claim.live ? " · MOCK" : claim.canClaim ? " · CLAIMABLE" : " · NONE"}
            </dd>
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
