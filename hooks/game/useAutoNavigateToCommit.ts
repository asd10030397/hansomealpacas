"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameState } from "@/hooks/game/useGameState";
import {
  battleDayForCommitNav,
  getAutoNavigatedToCommit,
  isBattleToCommitTransition,
  planAutoNavigateToCommit,
  setAutoNavigatedToCommit,
} from "@/lib/game/autoNavigateToCommit";
import {
  canNavigateAfterBattle,
  getBattlePresentationFailsafeNotice,
  isBattlePresentationBusy,
  isBattlePresentationComplete,
  isPresentationQueueIdle,
  setBattlePresentationFailsafeNotice,
  subscribeBattlePresentation,
} from "@/lib/game/battlePresentationGate";
import type { GamePhase } from "@/types/game";

/**
 * Final recovery only — never force-navigate or discard presentation.
 * Shows a non-blocking notice; Battle Result remains reachable.
 */
const PRESENTATION_FAILSAFE_MS = 90_000;

/**
 * After a battle day resolves and the next day opens CommitOpen,
 * route once to Choose Location — only when presentationComplete(day-1)
 * and the presentation queue is idle.
 */
export function useAutoNavigateToCommit(): void {
  const { phase, day } = useGameState();
  const { address } = useAccount();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const hrefs = useGameHref();
  const prevRef = useRef<{ day: number; phase: GamePhase } | null>(null);
  /** Day index we intend to auto-open Commit for (after battle→COMMIT). */
  const pendingDayRef = useRef<number | null>(null);
  const [gateTick, setGateTick] = useState(0);

  useEffect(() => {
    return subscribeBattlePresentation(() => {
      setGateTick((n) => n + 1);
    });
  }, []);

  // Failsafe: recovery notice only — never clear presentationComplete or force-nav.
  useEffect(() => {
    const targetDay = pendingDayRef.current;
    if (targetDay == null) return;
    if (phase !== "COMMIT" || day.day !== targetDay) return;

    const wallet = address ?? "anon";
    const battleDay = battleDayForCommitNav(targetDay);
    if (canNavigateAfterBattle(wallet, battleDay)) return;
    if (getBattlePresentationFailsafeNotice()) return;

    const timer = window.setTimeout(() => {
      // Do not fire while cues are still playing / queue owned.
      if (isBattlePresentationBusy()) return;
      if (isBattlePresentationComplete(wallet, battleDay)) return;
      setBattlePresentationFailsafeNotice(true);
    }, PRESENTATION_FAILSAFE_MS);

    return () => window.clearTimeout(timer);
  }, [phase, day.day, address, pathname, gateTick]);

  useEffect(() => {
    const currentDay = day.day;
    const currentPhase = phase;
    const previous = prevRef.current;

    if (previous == null) {
      prevRef.current = { day: currentDay, phase: currentPhase };
      return;
    }

    if (
      isBattleToCommitTransition({
        previousDay: previous.day,
        currentDay,
        previousPhase: previous.phase,
        currentPhase,
      })
    ) {
      pendingDayRef.current = currentDay;
      setBattlePresentationFailsafeNotice(false);
    }

    prevRef.current = { day: currentDay, phase: currentPhase };

    const targetDay = pendingDayRef.current;
    if (targetDay == null) return;
    if (currentPhase !== "COMMIT" || currentDay !== targetDay) return;

    const wallet = address ?? "anon";
    if (getAutoNavigatedToCommit(wallet, targetDay) != null) {
      pendingDayRef.current = null;
      return;
    }

    const battleDay = battleDayForCommitNav(targetDay);
    const presentationComplete = isBattlePresentationComplete(wallet, battleDay);
    const queueIdle = isPresentationQueueIdle();

    const plan = planAutoNavigateToCommit({
      previousDay: battleDay,
      currentDay: targetDay,
      previousPhase: "CLAIM",
      currentPhase: "COMMIT",
      pathname,
      commitPath: hrefs.commit,
      explorePath: hrefs.explore,
      resultPath: hrefs.result,
      alreadyHandled: false,
      presentationComplete,
      queueIdle,
    });

    // Authoritative gate (belt + suspenders with planner).
    if (!canNavigateAfterBattle(wallet, battleDay)) return;
    if (plan.action === "noop") return;

    setAutoNavigatedToCommit(wallet, targetDay, "pending");
    pendingDayRef.current = null;

    if (plan.action === "mark_only") return;

    router.push(hrefs.commit);
  }, [
    phase,
    day.day,
    address,
    pathname,
    router,
    hrefs.commit,
    hrefs.explore,
    hrefs.result,
    gateTick,
  ]);
}
