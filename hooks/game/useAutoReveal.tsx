"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { useHansomeReveal } from "@/hooks/game/useHansomeReveal";
import { useGameState } from "@/hooks/game/useGameState";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import {
  listOwnedCommitSecretsForDay,
  upsertCommitSecret,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import { isTestnetGaslessResolveEnabled } from "@/lib/game/testnetGaslessResolve";
import {
  getDayResolveSnapshot,
  setTestnetResolveTargets,
  stopTestnetResolveLoop,
  subscribeTestnetResolve,
  type DayResolveSnapshot,
} from "@/lib/game/testnetResolveCoordinator";
import type { TestnetResolveStage } from "@/lib/game/testnetResolveStages";
import { playSfx } from "@/lib/game/audio";

export type AutoRevealStatus = {
  /** Wire RevealOpen / gasless resolve active (incl. background settle). */
  active: boolean;
  revealing: boolean;
  pendingCount: number;
  revealedCount: number;
  /** Legacy localStorage path only — unused when gasless. */
  noSecrets: boolean;
  gasless: boolean;
  lastMessage: string | null;
  lastError: string | null;
  /** Current pipeline stage for the battle day being resolved. */
  resolveStage: TestnetResolveStage;
  /** Day the coordinator is primarily reporting (may be previous day in Commit). */
  resolveDay: number;
  resolveSnapshot: DayResolveSnapshot;
  refreshQueue: () => CommitSecretRecord[];
};

const AutoRevealContext = createContext<AutoRevealStatus | null>(null);

function useAutoRevealEngine(): AutoRevealStatus {
  const { address } = useAccount();
  const owned = useOwnedGenesisNfts();
  const { day, phase } = useGameState();
  const { revealNft, isPending, lastError } = useHansomeReveal();
  const gasless = isTestnetGaslessResolveEnabled();
  const ownedTokenIds = useMemo(
    () => owned.nfts.map((n) => n.tokenId),
    [owned.nfts],
  );

  const [queue, setQueue] = useState<CommitSecretRecord[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [passRunning, setPassRunning] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [resolveTick, setResolveTick] = useState(0);
  const runningRef = useRef(false);
  const lastSfxDayRef = useRef<number | null>(null);

  /** Prefer previous day during Commit so background settle stays visible. */
  const resolveDay =
    gasless && phase === "COMMIT" && day.day > 0 ? day.day - 1 : day.day;

  const refreshQueue = useCallback(() => {
    if (gasless) {
      setQueue([]);
      return [];
    }
    const next = listOwnedCommitSecretsForDay(
      day.day,
      address,
      ownedTokenIds,
    );
    setQueue(next);
    return next;
  }, [day.day, address, ownedTokenIds, gasless]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    runningRef.current = false;
    setPassRunning(false);
    setRunError(null);
    setLastMessage(null);
    refreshQueue();
  }, [address, refreshQueue]);

  // —— Testnet gasless: single-flight coordinator (survives Commit) ——
  useEffect(() => {
    if (!gasless) {
      stopTestnetResolveLoop();
      return;
    }

    const targets: number[] = [];
    // Current day while battle window is open / claimable.
    if (
      phase === "REVEAL" ||
      phase === "SETTLEMENT" ||
      phase === "CLAIM"
    ) {
      targets.push(day.day);
    }
    // Always keep previous day settling in the background (never cancel).
    if (day.day > 0) {
      targets.push(day.day - 1);
    }

    setTestnetResolveTargets(targets);
    return () => {
      /* keep loop alive across phase changes; GameShell unmount stops it */
    };
  }, [gasless, phase, day.day]);

  useEffect(() => {
    if (!gasless) return;
    return subscribeTestnetResolve(() => setResolveTick((n) => n + 1));
  }, [gasless]);

  useEffect(() => {
    return () => {
      if (gasless) stopTestnetResolveLoop();
    };
  }, [gasless]);

  const resolveSnapshot = getDayResolveSnapshot(resolveDay);
  // Touch resolveTick so React re-renders on coordinator updates.
  void resolveTick;

  useEffect(() => {
    if (!gasless) return;
    const snap = getDayResolveSnapshot(resolveDay);
    if (snap.lastMessage) setLastMessage(snap.lastMessage);
    if (snap.lastError) setRunError(snap.lastError);
    else if (snap.settled) setRunError(null);
    if (
      snap.settled &&
      snap.stage === "completed" &&
      lastSfxDayRef.current !== resolveDay
    ) {
      lastSfxDayRef.current = resolveDay;
      playSfx("ui-click");
    }
  }, [gasless, resolveDay, resolveTick, resolveSnapshot.updatedAt]);

  // —— Legacy Mainnet / non-gasless: localStorage auto-reveal ——
  useEffect(() => {
    if (gasless) return;
    if (phase !== "REVEAL") {
      runningRef.current = false;
      setPassRunning(false);
      return;
    }
    if (runningRef.current) return;
    if (!address) return;

    const pending = listOwnedCommitSecretsForDay(
      day.day,
      address,
      ownedTokenIds,
    ).filter((s) => s.status === "submitted" || s.status === "prepared");
    if (pending.length === 0) {
      refreshQueue();
      return;
    }

    let cancelled = false;
    runningRef.current = true;
    setPassRunning(true);
    setRunError(null);

    void (async () => {
      for (const secret of pending) {
        if (cancelled) break;
        const result = await revealNft({
          tokenId: secret.tokenId,
          day: secret.day,
        });
        if (cancelled) break;
        if (result.ok) {
          setLastMessage(`Auto-revealed #${secret.tokenId}.`);
          refreshQueue();
          continue;
        }
        if (/already revealed|AlreadyRevealed/i.test(result.error)) {
          upsertCommitSecret({
            ...secret,
            status: "revealed",
            wallet: address,
          });
          refreshQueue();
          continue;
        }
        setRunError(result.error);
        break;
      }
      runningRef.current = false;
      setPassRunning(false);
      refreshQueue();
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [
    gasless,
    phase,
    day.day,
    address,
    ownedTokenIds,
    revealNft,
    refreshQueue,
    retryTick,
  ]);

  useEffect(() => {
    if (gasless) return;
    if (phase !== "REVEAL") return;
    const id = window.setInterval(() => {
      if (!runningRef.current) setRetryTick((n) => n + 1);
    }, 4_000);
    return () => window.clearInterval(id);
  }, [gasless, phase]);

  const pendingCount = gasless
    ? resolveSnapshot.running ||
      (!resolveSnapshot.settled && resolveSnapshot.stage !== "idle")
      ? 1
      : 0
    : queue.filter(
        (r) => r.status === "submitted" || r.status === "prepared",
      ).length;
  const revealedCount = queue.filter((r) => r.status === "revealed").length;

  return useMemo(
    () => ({
      active:
        phase === "REVEAL" ||
        phase === "SETTLEMENT" ||
        (gasless &&
          (resolveSnapshot.running ||
            (!resolveSnapshot.settled &&
              resolveSnapshot.stage !== "idle" &&
              resolveSnapshot.stage !== "completed"))),
      revealing:
        passRunning ||
        isPending ||
        pendingCount > 0 ||
        (gasless && resolveSnapshot.running),
      pendingCount,
      revealedCount,
      noSecrets: gasless ? false : queue.length === 0,
      gasless,
      lastMessage: gasless ? resolveSnapshot.lastMessage ?? lastMessage : lastMessage,
      lastError: gasless
        ? resolveSnapshot.lastError
        : (runError ?? lastError),
      resolveStage: resolveSnapshot.stage,
      resolveDay,
      resolveSnapshot,
      refreshQueue,
    }),
    [
      phase,
      gasless,
      isPending,
      passRunning,
      pendingCount,
      revealedCount,
      queue.length,
      lastMessage,
      runError,
      lastError,
      refreshQueue,
      resolveSnapshot,
      resolveDay,
    ],
  );
}

export function AutoRevealProvider({ children }: { children: ReactNode }) {
  const value = useAutoRevealEngine();
  return (
    <AutoRevealContext.Provider value={value}>{children}</AutoRevealContext.Provider>
  );
}

export function useAutoReveal(): AutoRevealStatus {
  const ctx = useContext(AutoRevealContext);
  if (!ctx) {
    throw new Error("useAutoReveal must be used within AutoRevealProvider");
  }
  return ctx;
}
