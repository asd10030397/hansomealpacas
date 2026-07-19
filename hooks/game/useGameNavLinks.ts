"use client";

import { useMemo } from "react";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { GAME_NAV_ITEMS } from "@/lib/game/navConfig";

export function useGameNavLinks() {
  const gameHref = useGameHref();
  const { t } = useGameI18n();

  return useMemo(
    () =>
      GAME_NAV_ITEMS.map((item) => ({
        ...item,
        href: gameHref[item.hrefKey],
        label: t.nav[item.labelKey],
        feature:
          item.id === "myNfts"
            ? t.nav.featureMyNfts
            : item.id === "rewards"
              ? t.nav.featureRewards
              : item.id === "leaderboard"
                ? t.nav.featureLeaderboard
                : "",
      })),
    [t, gameHref],
  );
}
