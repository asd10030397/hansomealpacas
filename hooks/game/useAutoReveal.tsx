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
  removeCommitSecret,
  upsertCommitSecret,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import { isNotCommittedWriteError } from "@/lib/game/robinhoodContractWrite";
import { isTestnetGaslessResolveEnabled } from "@/lib/game/testnetGaslessResolve";
import { isTutorialCapture } from "@/lib/game/tutorialCapture";
import { isWalletAutoRevealEnabled } from "@/lib/game/walletAutoSettle";
import {
  getDayResolveSnapshot,
  getTestnetResolveServiceNotice,
  isTestnetResolveServiceUnavailable,
  setTestnetResolveTargets,
  stopTestnetResolveLoop,
  subscribeTestnetResolve,
  type DayResolveSnapshot,
} from "@/lib/game/testnetResolveCoordinator";
import type { TestnetResolveStage } from "@/lib/game/testnetResolveStages";
import { playSfx } from "@/lib/game/audio";
import type { RevealResult } from "@/hooks/game/useHansomeReveal";

export type RevealAllProgress = {
  current: number;
  total: number;
  tokenId: number;
};

function isUserRejectedRevealError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /user rejected|denied|cancelled in wallet|ACTION_REJECTED|4001/i.test(
    message,
  );
}

export type AutoRevealStatus = {
  /** Wire RevealOpen / gasless resolve active (incl. background settle). */
  active: boolean;
  revealing: boolean;
  pendingCount: number;
  revealedCount: number;
  /** Legacy localStorage path only — unused when gasless. */
  noSecrets: boolean;
  /** False on Testnet UI-only sessions — no surprise MetaMask reveal popups. */
  walletAutoRevealEnabled: boolean;
  /** Pending commit secrets (legacy path) for manual reveal buttons. */
  pendingSecrets: CommitSecretRecord[];
  gasless: boolean;
  lastMessage: string | null;
  lastError: string | null;
  /**
   * Single session notice when the Testnet relayer cannot run.
   * Prefer this over lastError — shown once (not per panel).
   */
  serviceNotice: string | null;
  serviceUnavailable: boolean;
  /** Current pipeline stage for the battle day being resolved. */
  resolveStage: TestnetResolveStage;
  /** Day the coordinator is primarily reporting (may be previous day in Commit). */
  resolveDay: number;
  resolveSnapshot: DayResolveSnapshot;
  refreshQueue: () => CommitSecretRecord[];
  /** Sequential reveal for all pending local secrets (Mainnet manual path). */
  revealAll: () => Promise<void>;
  revealAllRunning: boolean;
  revealAllProgress: RevealAllProgress | null;
  /** Single NFT manual reveal — shares mutex with auto-reveal / reveal-all. */
  runManualReveal: (tokenId: number, day: number) => Promise<RevealResult>;
  manualRevealTokenId: number | null;
  /** True while auto, batch, or single manual reveal holds the mutex. */
  isRevealBusy: boolean;
};

const AutoRevealContext = createContext<AutoRevealStatus | null>(null);

function useAutoRevealEngine(): AutoRevealStatus {
  const { address } = useAccount();
  const owned = useOwnedGenesisNfts();
  const { day, phase } = useGameState();
  const { revealNft, isPending, lastError } = useHansomeReveal();
  const gasless = isTestnetGaslessResolveEnabled() && !isTutorialCapture();
  const walletAutoRevealEnabled = isWalletAutoRevealEnabled();
  const ownedTokenIds = useMemo(
    () => owned.nfts.map((n) => n.tokenId),
    [owned.nfts],
  );

  const [queue, setQueue] = useState<CommitSecretRecord[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [passRunning, setPassRunning] = useState(false);
  const [revealAllRunning, setRevealAllRunning] = useState(false);
  const [revealAllProgress, setRevealAllProgress] =
    useState<RevealAllProgress | null>(null);
  const [manualRevealTokenId, setManualRevealTokenId] = useState<number | null>(
    null,
  );
  const [retryTick, setRetryTick] = useState(0);
  const [resolveTick, setResolveTick] = useState(0);
  const runningRef = useRef(false);
  const revealBusyRef = useRef(false);
  const revealOpIdRef = useRef(0);
  const lastSfxDayRef = useRef<number | null>(null);

  const beginRevealOp = () => {
    revealOpIdRef.current += 1;
    const opId = revealOpIdRef.current;
    revealBusyRef.current = true;
    runningRef.current = true;
    return opId;
  };

  const endRevealOp = (opId: number) => {
    if (revealOpIdRef.current !== opId) return;
    revealBusyRef.current = false;
    runningRef.current = false;
  };

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
    // Relayer-unavailable is surfaced via serviceNotice only (one panel).
    if (isTestnetResolveServiceUnavailable()) {
      setRunError(null);
    } else if (snap.lastError) {
      setRunError(snap.lastError);
    } else if (snap.settled) {
      setRunError(null);
    }
    if (
      snap.settled &&
      snap.stage === "completed" &&
      lastSfxDayRef.current !== resolveDay
    ) {
      lastSfxDayRef.current = resolveDay;
      playSfx("ui-click");
    }
  }, [gasless, resolveDay, resolveTick, resolveSnapshot.updatedAt]);

  type RevealStepOutcome = "ok" | "skip" | "stop";

  const handleRevealResult = useCallback(
    (
      secret: CommitSecretRecord,
      result: RevealResult,
    ): RevealStepOutcome => {
      if (!address) return "stop";
      if (result.ok) {
        setLastMessage(`Revealed #${secret.tokenId}.`);
        refreshQueue();
        return "ok";
      }
      if (/already revealed|AlreadyRevealed/i.test(result.error)) {
        upsertCommitSecret({
          ...secret,
          status: "revealed",
          wallet: address,
        });
        refreshQueue();
        return "ok";
      }
      if (isNotCommittedWriteError(result.error)) {
        removeCommitSecret(secret.tokenId, secret.day, address);
        setLastMessage(
          `Skipped #${secret.tokenId} — no on-chain commit for this day.`,
        );
        refreshQueue();
        return "skip";
      }
      if (isUserRejectedRevealError(result.error)) {
        setRunError(result.error);
        return "stop";
      }
      setRunError(result.error);
      return "stop";
    },
    [address, refreshQueue],
  );

  const runManualReveal = useCallback(
    async (tokenId: number, dayNum: number): Promise<RevealResult> => {
      if (gasless) {
        return { ok: false, error: "Manual reveal unavailable in gasless mode." };
      }
      if (!address) {
        return { ok: false, error: "Connect wallet to reveal." };
      }
      if (revealBusyRef.current) {
        return { ok: false, error: "Another reveal is in progress." };
      }

      const opId = beginRevealOp();
      setManualRevealTokenId(tokenId);
      setRunError(null);

      const result = await revealNft({ tokenId, day: dayNum });
      const secret = listOwnedCommitSecretsForDay(dayNum, address, ownedTokenIds).find(
        (s) => s.tokenId === tokenId,
      );
      if (secret) {
        handleRevealResult(secret, result);
      } else if (
        !result.ok &&
        isNotCommittedWriteError(result.error)
      ) {
        removeCommitSecret(tokenId, dayNum, address);
        refreshQueue();
      }

      endRevealOp(opId);
      setManualRevealTokenId(null);
      refreshQueue();
      return result;
    },
    [gasless, address, ownedTokenIds, revealNft, handleRevealResult, refreshQueue],
  );

  const revealAll = useCallback(async () => {
    if (gasless || !address) return;
    if (revealBusyRef.current) return;

    const pending = listOwnedCommitSecretsForDay(
      day.day,
      address,
      ownedTokenIds,
    ).filter((s) => s.status === "submitted" || s.status === "prepared");
    if (pending.length === 0) {
      refreshQueue();
      return;
    }

    const opId = beginRevealOp();
    setRevealAllRunning(true);
    setRunError(null);

    try {
      for (let i = 0; i < pending.length; i++) {
        const secret = pending[i]!;
        setRevealAllProgress({
          current: i + 1,
          total: pending.length,
          tokenId: secret.tokenId,
        });
        const result = await revealNft({
          tokenId: secret.tokenId,
          day: secret.day,
        });
        const outcome = handleRevealResult(secret, result);
        if (outcome === "stop") break;
      }
    } finally {
      setRevealAllProgress(null);
      setRevealAllRunning(false);
      endRevealOp(opId);
      refreshQueue();
    }
  }, [
    gasless,
    address,
    day.day,
    ownedTokenIds,
    revealNft,
    handleRevealResult,
    refreshQueue,
  ]);

  // —— Legacy Mainnet / non-gasless: localStorage auto-reveal ——
  useEffect(() => {
    if (gasless) return;
    // UI-only / Railway-settlement sessions: never auto-open MetaMask for reveals.
    if (!isWalletAutoRevealEnabled()) {
      runningRef.current = false;
      setPassRunning(false);
      return;
    }
    if (phase !== "REVEAL") {
      runningRef.current = false;
      setPassRunning(false);
      return;
    }
    if (runningRef.current || revealBusyRef.current) return;
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
    const opId = beginRevealOp();
    setPassRunning(true);
    setRunError(null);

    void (async () => {
      try {
        for (const secret of pending) {
          if (cancelled) break;
          const result = await revealNft({
            tokenId: secret.tokenId,
            day: secret.day,
          });
          if (cancelled) break;
          const outcome = handleRevealResult(secret, result);
          if (outcome === "stop") break;
        }
      } finally {
        endRevealOp(opId);
        setPassRunning(false);
        refreshQueue();
      }
    })();

    return () => {
      cancelled = true;
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
    handleRevealResult,
  ]);

  useEffect(() => {
    if (gasless) return;
    if (!walletAutoRevealEnabled) return;
    if (phase !== "REVEAL") return;
    const id = window.setInterval(() => {
      if (!runningRef.current) setRetryTick((n) => n + 1);
    }, 4_000);
    return () => window.clearInterval(id);
  }, [gasless, walletAutoRevealEnabled, phase]);

  const serviceUnavailable = gasless && isTestnetResolveServiceUnavailable();
  const serviceNotice = gasless ? getTestnetResolveServiceNotice() : null;

  const pendingSecrets = gasless
    ? []
    : queue.filter(
        (r) => r.status === "submitted" || r.status === "prepared",
      );
  const pendingCount = gasless
    ? serviceUnavailable
      ? 0
      : resolveSnapshot.running ||
          (!resolveSnapshot.settled && resolveSnapshot.stage !== "idle")
        ? 1
        : 0
    : pendingSecrets.length;
  const revealedCount = queue.filter((r) => r.status === "revealed").length;
  const isRevealBusy =
    passRunning ||
    revealAllRunning ||
    manualRevealTokenId !== null ||
    isPending;

  return useMemo(
    () => ({
      active:
        !serviceUnavailable &&
        (phase === "REVEAL" ||
          phase === "SETTLEMENT" ||
          (gasless &&
            (resolveSnapshot.running ||
              (!resolveSnapshot.settled &&
                resolveSnapshot.stage !== "idle" &&
                resolveSnapshot.stage !== "completed")))),
      revealing:
        !serviceUnavailable &&
        (passRunning ||
          isPending ||
          pendingCount > 0 ||
          (gasless && resolveSnapshot.running)),
      pendingCount,
      revealedCount,
      noSecrets: gasless ? false : queue.length === 0,
      walletAutoRevealEnabled,
      pendingSecrets,
      gasless,
      lastMessage: gasless ? resolveSnapshot.lastMessage ?? lastMessage : lastMessage,
      // Suppress per-panel errors when the shared service notice is shown.
      lastError: serviceUnavailable
        ? null
        : gasless
          ? resolveSnapshot.lastError
          : isNotCommittedWriteError(runError ?? lastError)
            ? null
            : (runError ?? lastError),
      serviceNotice,
      serviceUnavailable,
      resolveStage: resolveSnapshot.stage,
      resolveDay,
      resolveSnapshot,
      refreshQueue,
      revealAll,
      revealAllRunning,
      revealAllProgress,
      runManualReveal,
      manualRevealTokenId,
      isRevealBusy,
    }),
    [
      phase,
      gasless,
      isPending,
      passRunning,
      revealAllRunning,
      revealAllProgress,
      manualRevealTokenId,
      isRevealBusy,
      pendingCount,
      revealedCount,
      walletAutoRevealEnabled,
      pendingSecrets,
      queue.length,
      lastMessage,
      runError,
      lastError,
      refreshQueue,
      resolveSnapshot,
      resolveDay,
      serviceNotice,
      serviceUnavailable,
      resolveTick,
      revealAll,
      runManualReveal,
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
