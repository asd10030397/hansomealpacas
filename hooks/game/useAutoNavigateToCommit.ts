"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useGameHref } from "@/hooks/game/useGameHref";
import { useGameState } from "@/hooks/game/useGameState";
import {
  getAutoNavigatedToCommit,
  isBattleToCommitTransition,
  isChooseLocationPath,
  setAutoNavigatedToCommit,
} from "@/lib/game/autoNavigateToCommit";
import {
  isBattlePresentationBusy,
  setBattlePresentationBusy,
  subscribeBattlePresentation,
} from "@/lib/game/battlePresentationGate";
import type { GamePhase } from "@/types/game";

/** Max wait for result VFX before navigating anyway (settlement already done). */
const PRESENTATION_WAIT_MS = 90_000;

/**
 * After a battle day resolves and the next day opens CommitOpen,
 * route once to Choose Location (smooth-scroll on the commit page).
 *
 * Waits for Battle Result presentation to go idle; never fires on initial
 * COMMIT hydration; once per wallet+day.
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

  // If VFX never clears, unblock after a timeout so the day loop is not stuck.
  useEffect(() => {
    if (pendingDayRef.current == null) return;
    if (!isBattlePresentationBusy()) return;
    const timer = window.setTimeout(() => {
      setBattlePresentationBusy(false);
    }, PRESENTATION_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, day.day, pathname, gateTick]);

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

    // Wait for Battle Result VFX/SFX (and settle preparing) to finish.
    if (isBattlePresentationBusy()) return;

    // Once per new day (`day{N}:REVEAL->COMMIT`). Prefer Commit page section.
    setAutoNavigatedToCommit(wallet, targetDay, "pending");
    pendingDayRef.current = null;

    if (isChooseLocationPath(pathname, [hrefs.commit])) {
      // Already on Commit — pending flag triggers mobile-safe scroll once.
      return;
    }

    router.push(hrefs.commit);
  }, [
    phase,
    day.day,
    address,
    pathname,
    router,
    hrefs.commit,
    hrefs.explore,
    gateTick,
  ]);
}
