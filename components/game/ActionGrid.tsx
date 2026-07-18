"use client";

import { ComingSoonButton } from "@/components/game/ComingSoonButton";
import { WalletGateButton } from "@/components/game/WalletGateButton";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { gameHref } from "@/lib/game/paths";
import type { GamePhase } from "@/types/game";

type SecondaryAction = {
  key: string;
  label: string;
  feature: string;
  href?: string;
  comingSoon?: boolean;
  variant?: "gold" | "green" | "slate";
};

/**
 * Phase-scoped secondary actions only.
 * Primary CTA lives in DashboardCommand — this is supporting navigation.
 */
export function ActionGrid({ phase }: { phase: GamePhase }) {
  const { t } = useGameI18n();

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
    SETTLEMENT: [
      {
        key: "nfts",
        label: t.actions.myNfts,
        feature: t.features.myNfts,
        href: gameHref.myNfts,
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
    <div className="dash-cmd__secondary">
      {actions.map((a) =>
        a.comingSoon || !a.href ? (
          <ComingSoonButton
            key={a.key}
            feature={a.feature}
            variant={a.variant ?? "slate"}
            size="sm"
            className="w-auto"
          >
            {a.label}
          </ComingSoonButton>
        ) : (
          <WalletGateButton
            key={a.key}
            feature={a.feature}
            href={a.href}
            variant={a.variant ?? "slate"}
            size="sm"
            className="w-auto"
          >
            {a.label}
          </WalletGateButton>
        ),
      )}
    </div>
  );
}
