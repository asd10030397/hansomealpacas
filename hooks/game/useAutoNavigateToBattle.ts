"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameState } from "@/hooks/game/useGameState";
import {
  getAutoNavigatedToBattle,
  isBattleResultPath,
  planAutoNavigateToBattle,
  setAutoNavigatedToBattle,
} from "@/lib/game/autoNavigateToBattle";
import type { GamePhase } from "@/types/game";

/**
 * When Commit ends while the player is on Choose Location (commit/explore),
 * route once to Battle Result for that wallet+day.
 * Transition key: `day{N}:COMMIT->REVEAL` (once per wallet+day).
 */
export function useAutoNavigateToBattle(): void {
  const { phase, day } = useGameState();
  const { address } = useAccount();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const hrefs = useGameHref();
  const prevPhaseRef = useRef<GamePhase | null>(null);

  useEffect(() => {
    const previousPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    // Skip first observation — only act on a real Commit → battle transition.
    if (previousPhase == null) return;

    const wallet = address ?? "anon";
    const dayIndex = day.day;
    const alreadyHandled = getAutoNavigatedToBattle(wallet, dayIndex) != null;

    const plan = planAutoNavigateToBattle({
      previousPhase,
      currentPhase: phase,
      pathname,
      resultPath: hrefs.result,
      choosePaths: [hrefs.commit, hrefs.explore],
      alreadyHandled,
    });

    if (plan.action === "noop") return;

    if (plan.action === "mark_only") {
      // Already on Result: still pending so the page can scroll once to Auto Reveal.
      if (isBattleResultPath(pathname, hrefs.result)) {
        setAutoNavigatedToBattle(wallet, dayIndex, "pending");
      } else {
        setAutoNavigatedToBattle(wallet, dayIndex, "done");
      }
      return;
    }

    setAutoNavigatedToBattle(wallet, dayIndex, "pending");
    router.push(hrefs.result);
  }, [
    phase,
    day.day,
    address,
    pathname,
    router,
    hrefs.result,
    hrefs.commit,
    hrefs.explore,
  ]);
}
