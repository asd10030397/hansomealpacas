"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { createMockDayState, MOCK_TERRITORY } from "@/data/game/mock";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { syncGameplayDayClientState } from "@/lib/game/commitSecret";
import {
  COMMIT_DURATION_SEC,
  DAY_LENGTH_SEC,
  REVEAL_DURATION_SEC,
} from "@/lib/game/genesisIdentity";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
  isHansomeGameConfigured,
} from "@/lib/game/hansomeGame";
import {
  getTutorialDayState,
  isTutorialCapture,
} from "@/lib/game/tutorialCapture";
import type { GameDayState, GamePhase, TerritoryStats } from "@/types/game";

function derivePhaseFromMock(day: GameDayState, now: number): GamePhase {
  if (day.settled || day.settlementStatus === "Complete") return "CLAIM";
  if (now >= day.revealEndsAt) return "SETTLEMENT";
  if (now >= day.commitEndsAt) return "REVEAL";
  return "COMMIT";
}

/**
 * Same formula as HansomeGame.currentDay() — wall clock is authoritative so the
 * UI cannot linger on Day N Battle after Day N+1 Commit has already opened.
 */
export function computeDayIndex(dayZeroSec: number, dayLengthSec: number, nowMs: number): number {
  const nowSec = Math.floor(nowMs / 1000);
  if (nowSec < dayZeroSec || dayLengthSec <= 0) return 0;
  return Math.floor((nowSec - dayZeroSec) / dayLengthSec);
}

/**
 * Derive wire phases from day windows + settled.
 *
 * Settlement is never delayed for a viewing timer: once the day is settled,
 * phase is CLAIM immediately (rewards claimable). The remaining day window is
 * only a Battle Result viewing period in the UI (countdown / copy).
 */
export function derivePhaseFromWindows(input: {
  nowMs: number;
  commitEndsAt: number;
  revealEndsAt: number;
  dayEndsAt?: number;
  settled: boolean;
}): GamePhase {
  if (input.settled) return "CLAIM";
  if (input.nowMs >= input.revealEndsAt) return "SETTLEMENT";
  if (input.nowMs >= input.commitEndsAt) return "REVEAL";
  return "COMMIT";
}

/**
 * Live HansomeGame clock when configured; otherwise local mock demo clock.
 */
export function useGameState() {
  const live = isHansomeGameConfigured();
  const game = HANSOME_GAME_ADDRESS;

  const [mockDay, setMockDay] = useState<GameDayState>(() => createMockDayState());
  const [now, setNow] = useState(() => Date.now());
  const territory: TerritoryStats = MOCK_TERRITORY;
  const lastSyncedDayRef = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dayZeroRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayZero",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const dayLengthRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayLength",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const commitDurationRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "commitDuration",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const revealDurationRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "revealDuration",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const timingsReady =
    dayZeroRead.data != null &&
    dayLengthRead.data != null &&
    commitDurationRead.data != null &&
    revealDurationRead.data != null;

  const dayZeroSec = timingsReady ? Number(dayZeroRead.data) : null;
  const dayLenSec = timingsReady
    ? Number(dayLengthRead.data)
    : DAY_LENGTH_SEC;
  const commitDurSec = timingsReady
    ? Number(commitDurationRead.data)
    : COMMIT_DURATION_SEC;
  const revealDurSec = timingsReady
    ? Number(revealDurationRead.data)
    : REVEAL_DURATION_SEC;

  // Clock-derived day index (matches on-chain currentDay); tick every second.
  const clockDay =
    live && dayZeroSec != null && dayLenSec > 0
      ? computeDayIndex(dayZeroSec, dayLenSec, now)
      : null;

  const currentDayRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "currentDay",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 4_000 },
  });

  const dayIndex = clockDay ?? Number(currentDayRead.data ?? 0n);

  const dayStateRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayState",
    args: [BigInt(dayIndex)],
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 4_000 },
  });

  const settledRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "isSettled",
    args: [BigInt(dayIndex)],
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 4_000 },
  });

  const liveDay: GameDayState | null = useMemo(() => {
    if (!live || dayZeroSec == null || dayLenSec <= 0) return null;

    const day = computeDayIndex(dayZeroSec, dayLenSec, now);
    const settled = Boolean(settledRead.data);
    const startSec = dayZeroSec + day * dayLenSec;
    const commitEndsAt = (startSec + commitDurSec) * 1000;
    const revealEndsAt = (startSec + commitDurSec + revealDurSec) * 1000;
    const dayEndsAt = (startSec + dayLenSec) * 1000;
    const phase = derivePhaseFromWindows({
      nowMs: now,
      commitEndsAt,
      revealEndsAt,
      dayEndsAt,
      settled,
    });
    // Battle (REVEAL+SETTLEMENT): countdown is the full viewing pad to dayEndsAt.
    let phaseEndsAt = commitEndsAt;
    if (phase === "REVEAL" || phase === "SETTLEMENT" || phase === "CLAIM") {
      phaseEndsAt = dayEndsAt;
    }

    return {
      day,
      phase,
      phaseEndsAt,
      commitEndsAt,
      revealEndsAt,
      dayEndsAt,
      settled,
      settlementStatus: settled
        ? "Complete"
        : phase === "SETTLEMENT"
          ? "Ready"
          : "Pending",
    };
  }, [
    live,
    dayZeroSec,
    dayLenSec,
    commitDurSec,
    revealDurSec,
    now,
    settledRead.data,
  ]);

  const chainReady = live && liveDay != null;
  const captureActive = isTutorialCapture();
  const chainDay: GameDayState = chainReady
    ? liveDay
    : live
      ? {
          // Live mode with RPC still hydrating — do not flash mock day numbers.
          day: 0,
          phase: "COMMIT",
          phaseEndsAt: now + 60_000,
          commitEndsAt: now + 60_000,
          revealEndsAt: now + 120_000,
          dayEndsAt: now + 180_000,
          settled: false,
          settlementStatus: "Pending",
        }
      : { ...mockDay, phase: derivePhaseFromMock(mockDay, now) };
  const day: GameDayState = captureActive ? getTutorialDayState(now) : chainDay;
  const phase = day.phase;

  // Drop Day N commit secrets / pending location as soon as the clock hits N+1.
  useEffect(() => {
    if (live && !chainReady) return;
    const d = day.day;
    if (!Number.isInteger(d) || d < 0) return;
    if (lastSyncedDayRef.current === d) return;
    lastSyncedDayRef.current = d;
    syncGameplayDayClientState(d);
  }, [live, chainReady, day.day]);

  const phaseEndsAt = useMemo(() => {
    if (phase === "COMMIT") return day.commitEndsAt;
    // Battle viewing pad (reveal window + optional pad) → day end.
    return day.dayEndsAt ?? day.revealEndsAt ?? day.phaseEndsAt;
  }, [phase, day]);

  const setDemoPhase = useCallback(
    (next: GamePhase) => {
      if (live) return; // live chain clock is authoritative
      const t = Date.now();
      const battlePadMs = 2 * 60 * 1000;
      setMockDay((prev) => {
        if (next === "COMMIT") {
          return {
            ...prev,
            phase: "COMMIT",
            settled: false,
            settlementStatus: "Pending",
            commitEndsAt: t + 60 * 60 * 1000,
            revealEndsAt: t + 2 * 60 * 60 * 1000,
            dayEndsAt: t + 2 * 60 * 60 * 1000 + battlePadMs,
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
            dayEndsAt: t + 60 * 60 * 1000 + battlePadMs,
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
            dayEndsAt: t + battlePadMs,
            phaseEndsAt: t + battlePadMs,
          };
        }
        return {
          ...prev,
          phase: "CLAIM",
          settled: true,
          settlementStatus: "Complete",
          commitEndsAt: t - 3000,
          revealEndsAt: t - 2000,
          dayEndsAt: t + battlePadMs,
          phaseEndsAt: t + battlePadMs,
        };
      });
      setNow(Date.now());
    },
    [live],
  );

  return {
    day: { ...day, phase },
    now,
    phase,
    phaseEndsAt,
    territory,
    isMock: !live || captureActive,
    isLoading: live && !chainReady,
    chainDayState:
      live && dayStateRead.data !== undefined ? Number(dayStateRead.data) : null,
    setDemoPhase,
  };
}
