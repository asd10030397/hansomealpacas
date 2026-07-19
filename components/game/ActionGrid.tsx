"use client";

import { WalletGateButton } from "@/components/game/WalletGateButton";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { toUiLoopPhase } from "@/lib/game/uiLoopPhase";
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
  const loop = toUiLoopPhase(phase);

  const commitActions: SecondaryAction[] = [
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
  ];

  const phaseActionLabel =
    loop === "REVEAL"
      ? t.phases.REVEAL
      : loop === "BATTLE"
        ? t.phases.BATTLE
        : t.phases.CLAIM;

  const resultActions: SecondaryAction[] = [
    {
      key: "result",
      label: phaseActionLabel,
      feature: phaseActionLabel,
      href: gameHref.result,
      variant: loop === "CLAIM" ? "green" : "gold",
    },
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
  ];

  const actions = loop === "COMMIT" ? commitActions : resultActions;

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
