"use client";

import { useEffect, useRef, useState } from "react";
import { ActionGrid } from "@/components/game/ActionGrid";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import { GameStatusPanel } from "@/components/game/GameStatusPanel";
import { PixelPanel } from "@/components/ui/pixel";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase } from "@/lib/game/uiLoopPhase";
import type { GameDayState, GamePhase } from "@/types/game";
import "@/styles/dashboard-command.css";

function mainActionForPhase(
  phase: GamePhase,
  t: ReturnType<typeof useGameI18n>["t"],
  hrefs: ReturnType<typeof useGameHref>,
) {
  if (phase === "COMMIT") {
    return {
      kind: "link" as const,
      href: hrefs.explore,
      label: t.dashboard.mainCommit,
      feature: t.features.commit,
      variant: "gold" as const,
    };
  }
  if (phase === "REVEAL" || phase === "SETTLEMENT") {
    return {
      kind: "link" as const,
      href: hrefs.result,
      label: t.dashboard.mainSettlement,
      feature: t.phases.BATTLE_RESULT,
      variant: "gold" as const,
    };
  }
  return {
    kind: "link" as const,
    href: hrefs.result,
    label: t.dashboard.mainClaim,
    feature: t.phases.CLAIM,
    variant: "green" as const,
  };
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
  const loop = toUiLoopPhase(phase);
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
        className={`dash-cmd__prompt dash-cmd__prompt--${loop}${pulse ? " dash-cmd__phase-pulse" : ""}`}
      >
        <p className="dash-cmd__prompt-label">{t.dashboard.doNowLabel}</p>
        <p className="dash-cmd__prompt-text">{t.dashboard.doNow[phase]}</p>
      </div>

      <GameStatusPanel day={day} now={now} phaseEndsAt={phaseEndsAt} phase={phase} />

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
