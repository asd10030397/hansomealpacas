"use client";

import { WalletGateButton } from "@/components/game/WalletGateButton";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import type { GamePhase } from "@/types/game";

type SecondaryAction = {
  key: string;
  label: string;
  feature: string;
  href: string;
  variant?: "gold" | "green" | "slate";
};

/**
 * Phase-scoped secondary actions only.
 * Primary CTA lives in DashboardCommand — this is supporting navigation.
 */
export function ActionGrid({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();
  const gameHref = useGameHref();

  const byPhase: Record<GamePhase, SecondaryAction[]> = {
    COMMIT: [
      {
        key: "nfts",
        label: t.actions.myNfts,
        feature: t.features.myNfts,
        href: gameHref.myNfts,
        variant: "slate",
      },
      {
        key: "rewards",
        label: t.actions.rewards,
        feature: t.features.rewards,
        href: gameHref.rewards,
        variant: "slate",
      },
    ],
    REVEAL: [
      {
        key: "nfts",
        label: t.actions.myNfts,
        feature: t.features.myNfts,
        href: gameHref.myNfts,
        variant: "slate",
      },
      {
        key: "settlement",
        label: "SETTLEMENT",
        feature: t.features.settlementStatus,
        href: gameHref.rewards,
        variant: "slate",
      },
      {
        key: "board",
        label: t.actions.leaderboard,
        feature: t.features.leaderboard,
        href: gameHref.leaderboard,
        variant: "slate",
      },
    ],
    SETTLEMENT: [
      {
        key: "settlement",
        label: "SETTLEMENT",
        feature: t.features.settlementStatus,
        href: gameHref.rewards,
        variant: "gold",
      },
      {
        key: "rewards",
        label: t.actions.rewards,
        feature: t.features.rewards,
        href: gameHref.rewards,
        variant: "slate",
      },
      {
        key: "board",
        label: t.actions.leaderboard,
        feature: t.features.leaderboard,
        href: gameHref.leaderboard,
        variant: "slate",
      },
    ],
    CLAIM: [
      {
        key: "rewards",
        label: t.actions.claim,
        feature: t.features.claim,
        href: gameHref.rewards,
        variant: "green",
      },
      {
        key: "settlement",
        label: "SETTLEMENT",
        feature: t.features.settlementStatus,
        href: gameHref.rewards,
        variant: "slate",
      },
      {
        key: "board",
        label: t.actions.leaderboard,
        feature: t.features.leaderboard,
        href: gameHref.leaderboard,
        variant: "slate",
      },
    ],
  };

  const actions = byPhase[phase];

  return (
    <div className="dash-cmd__secondary" role="navigation" aria-label={t.dashboard.alsoAvailable}>
      {actions.map((a) => (
        <WalletGateButton
          key={a.key}
          feature={a.feature}
          href={a.href}
          variant={a.variant ?? "slate"}
          size="md"
          className="w-full"
        >
          {a.label}
        </WalletGateButton>
      ))}
    </div>
  );
}
