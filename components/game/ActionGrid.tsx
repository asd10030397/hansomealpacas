"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import { gameHref } from "@/lib/game/paths";
import type { GamePhase } from "@/types/game";

export function ActionGrid({
  phase,
}: {
  phase: GamePhase;
  claimable?: boolean;
}) {
  void phase;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <WalletGateButton feature="My Alpacas" href={gameHref.myNfts} variant="slate" size="sm">
        MY ALPACAS
      </WalletGateButton>
      <WalletGateButton feature="My Cougars" href={gameHref.myNfts} variant="slate" size="sm">
        MY COUGARS
      </WalletGateButton>
      <WalletGateButton feature="Daily Game" href={gameHref.dashboard} variant="green" size="sm">
        DAILY GAME
      </WalletGateButton>
      <WalletGateButton feature="Explore World" href={gameHref.explore} variant="green" size="sm">
        EXPLORE
      </WalletGateButton>

      <ComingSoonButton feature="Commit" variant="gold" size="sm">
        COMMIT
      </ComingSoonButton>
      <ComingSoonButton feature="Reveal" variant="gold" size="sm">
        REVEAL
      </ComingSoonButton>
      <ComingSoonButton feature="Rewards" variant="slate" size="sm">
        REWARDS
      </ComingSoonButton>
      <ComingSoonButton feature="Claim" variant="green" size="sm">
        CLAIM
      </ComingSoonButton>
      <ComingSoonButton feature="Leaderboard" variant="slate" size="sm">
        LEADERBOARD
      </ComingSoonButton>
      <ComingSoonButton feature="Marketplace" variant="ghost" size="sm">
        MARKETPLACE
      </ComingSoonButton>
      <ComingSoonButton feature="Staking" variant="ghost" size="sm">
        STAKING
      </ComingSoonButton>
    </div>
  );
}
