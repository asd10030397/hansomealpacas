"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { createMockDayState, MOCK_TERRITORY } from "@/data/game/mock";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
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
import type { GameDayState, GamePhase, TerritoryStats } from "@/types/game";

/** On-chain GameTypes.DayState */
const DS = {
  Idle: 0,
  CommitOpen: 1,
  CommitClosed: 2,
  RevealOpen: 3,
  RevealClosed: 4,
  Settlement: 5,
  Claimable: 6,
} as const;

function derivePhaseFromMock(day: GameDayState, now: number): GamePhase {
  if (day.settled || day.settlementStatus === "Complete") return "CLAIM";
  if (now >= day.revealEndsAt) return "SETTLEMENT";
  if (now >= day.commitEndsAt) return "REVEAL";
  return "COMMIT";
}

function phaseFromDayState(state: number, settled: boolean): GamePhase {
  if (settled || state === DS.Claimable) return "CLAIM";
  if (state === DS.RevealClosed || state === DS.Settlement) return "SETTLEMENT";
  if (state === DS.RevealOpen || state === DS.CommitClosed) return "REVEAL";
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

  const currentDayRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "currentDay",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 15_000 },
  });

  const dayIndex = Number(currentDayRead.data ?? 0n);

  const dayStateRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayState",
    args: [BigInt(dayIndex)],
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 10_000 },
  });

  const settledRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "isSettled",
    args: [BigInt(dayIndex)],
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game, refetchInterval: 10_000 },
  });

  const liveDay: GameDayState | null = useMemo(() => {
    if (!live || dayZeroRead.data == null || currentDayRead.data == null) return null;
    const dayZero = Number(dayZeroRead.data);
    const day = Number(currentDayRead.data);
    const state = Number(dayStateRead.data ?? DS.Idle);
    const settled = Boolean(settledRead.data);
    // Prefer on-chain immutables (Testnet fast timing); fall back to env/GDS constants.
    const dayLen = Number(dayLengthRead.data ?? DAY_LENGTH_SEC);
    const commitDur = Number(commitDurationRead.data ?? COMMIT_DURATION_SEC);
    const revealDur =
      dayLen > commitDur ? dayLen - commitDur : REVEAL_DURATION_SEC;
    const startSec = dayZero + day * dayLen;
    const commitEndsAt = (startSec + commitDur) * 1000;
    const revealEndsAt = (startSec + commitDur + revealDur) * 1000;
    const phase = phaseFromDayState(state, settled);
    let phaseEndsAt = commitEndsAt;
    if (phase === "REVEAL") phaseEndsAt = revealEndsAt;
    if (phase === "SETTLEMENT" || phase === "CLAIM") phaseEndsAt = revealEndsAt;
    return {
      day,
      phase,
      phaseEndsAt,
      commitEndsAt,
      revealEndsAt,
      settled,
      settlementStatus: settled
        ? "Complete"
        : phase === "SETTLEMENT"
          ? "Ready"
          : "Pending",
    };
  }, [
    live,
    dayZeroRead.data,
    dayLengthRead.data,
    commitDurationRead.data,
    currentDayRead.data,
    dayStateRead.data,
    settledRead.data,
  ]);

  const chainReady = live && liveDay != null;
  const day: GameDayState = chainReady
    ? liveDay
    : live
      ? {
          // Live mode with RPC still hydrating — do not flash mock day numbers.
          day: 0,
          phase: "COMMIT",
          phaseEndsAt: now + 60_000,
          commitEndsAt: now + 60_000,
          revealEndsAt: now + 120_000,
          settled: false,
          settlementStatus: "Pending",
        }
      : { ...mockDay, phase: derivePhaseFromMock(mockDay, now) };
  const phase = day.phase;

  const phaseEndsAt = useMemo(() => {
    if (phase === "COMMIT") return day.commitEndsAt;
    if (phase === "REVEAL") return day.revealEndsAt;
    return day.phaseEndsAt;
  }, [phase, day]);

  const setDemoPhase = useCallback(
    (next: GamePhase) => {
      if (live) return; // live chain clock is authoritative
      const t = Date.now();
      setMockDay((prev) => {
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
    },
    [live],
  );

  return {
    day: { ...day, phase },
    now,
    phase,
    phaseEndsAt,
    territory,
    isMock: !live,
    isLoading: live && !chainReady,
    chainDayState:
      live && dayStateRead.data !== undefined ? Number(dayStateRead.data) : null,
    setDemoPhase,
  };
}
