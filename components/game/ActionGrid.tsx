"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { gameHref } from "@/lib/game/paths";
import type { GamePhase } from "@/types/game";

export function ActionGrid({
  phase,
}: {
  phase: GamePhase;
  claimable?: boolean;
}) {
  void phase;
  const { t } = useGameI18n();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <WalletGateButton
        feature={t.features.myAlpacas}
        href={gameHref.myNfts}
        variant="slate"
        size="sm"
      >
        {t.actions.myAlpacas}
      </WalletGateButton>
      <WalletGateButton
        feature={t.features.myCougars}
        href={gameHref.myNfts}
        variant="slate"
        size="sm"
      >
        {t.actions.myCougars}
      </WalletGateButton>
      <WalletGateButton
        feature={t.features.dailyGame}
        href={gameHref.dashboard}
        variant="green"
        size="sm"
      >
        {t.actions.dailyGame}
      </WalletGateButton>
      <WalletGateButton
        feature={t.features.exploreWorld}
        href={gameHref.explore}
        variant="green"
        size="sm"
      >
        {t.actions.explore}
      </WalletGateButton>

      <ComingSoonButton feature={t.features.commit} variant="gold" size="sm">
        {t.actions.commit}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.reveal} variant="gold" size="sm">
        {t.actions.reveal}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.rewards} variant="slate" size="sm">
        {t.actions.rewards}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.claim} variant="green" size="sm">
        {t.actions.claim}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.leaderboard} variant="slate" size="sm">
        {t.actions.leaderboard}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.marketplace} variant="ghost" size="sm">
        {t.actions.marketplace}
      </ComingSoonButton>
      <ComingSoonButton feature={t.features.staking} variant="ghost" size="sm">
        {t.actions.staking}
      </ComingSoonButton>
    </div>
  );
}
