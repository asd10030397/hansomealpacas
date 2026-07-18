"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createMockDayState, MOCK_TERRITORY } from "@/data/game/mock";
import type { GameDayState, GamePhase, TerritoryStats } from "@/types/game";

function derivePhase(day: GameDayState, now: number): GamePhase {
  if (day.settled || day.settlementStatus === "Complete") return "CLAIM";
  if (now >= day.revealEndsAt) return "SETTLEMENT";
  if (now >= day.commitEndsAt) return "REVEAL";
  return "COMMIT";
}

/**
 * Mock game clock. TODO(contract): replace with HansomeGame dayState / timestamps.
 */
export function useGameState() {
  const [day, setDay] = useState<GameDayState>(() => createMockDayState());
  const [now, setNow] = useState(() => Date.now());
  const territory: TerritoryStats = MOCK_TERRITORY;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const phase = useMemo(() => derivePhase(day, now), [day, now]);

  const phaseEndsAt = useMemo(() => {
    if (phase === "COMMIT") return day.commitEndsAt;
    if (phase === "REVEAL") return day.revealEndsAt;
    return day.phaseEndsAt;
  }, [phase, day]);

  const setDemoPhase = useCallback((next: GamePhase) => {
    const t = Date.now();
    setDay((prev) => {
      if (next === "COMMIT") {
        return {
          ...prev,
          phase: "COMMIT",
          settled: false,
          settlementStatus: "Pending",
          commitEndsAt: t + 60 * 60 * 1000,
          revealEndsAt: t + 2 * 60 * 60 * 1000,
          phaseEndsAt: t + 60 * 60 * 1000,
        };
      }
      if (next === "REVEAL") {
        return {
          ...prev,
          phase: "REVEAL",
          settled: false,
          settlementStatus: "Pending",
          commitEndsAt: t - 1000,
          revealEndsAt: t + 60 * 60 * 1000,
          phaseEndsAt: t + 60 * 60 * 1000,
        };
      }
      if (next === "SETTLEMENT") {
        return {
          ...prev,
          phase: "SETTLEMENT",
          settled: false,
          settlementStatus: "Ready",
          commitEndsAt: t - 2000,
          revealEndsAt: t - 1000,
          phaseEndsAt: t,
        };
      }
      return {
        ...prev,
        phase: "CLAIM",
        settled: true,
        settlementStatus: "Complete",
        commitEndsAt: t - 3000,
        revealEndsAt: t - 2000,
        phaseEndsAt: t,
      };
    });
    setNow(Date.now());
  }, []);

  return {
    day: { ...day, phase },
    now,
    phase,
    phaseEndsAt,
    territory,
    isMock: true as const,
    setDemoPhase,
  };
}
