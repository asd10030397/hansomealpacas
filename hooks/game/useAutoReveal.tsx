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
import { useHansomeReveal } from "@/hooks/game/useHansomeReveal";
import { useGameState } from "@/hooks/game/useGameState";
import {
  listCommitSecretsForDay,
  upsertCommitSecret,
  type CommitSecretRecord,
} from "@/lib/game/commitSecret";
import {
  isTestnetGaslessResolveEnabled,
  requestTestnetResolve,
} from "@/lib/game/testnetGaslessResolve";
import { playSfx } from "@/lib/game/audio";

export type AutoRevealStatus = {
  /** Wire RevealOpen. */
  active: boolean;
  /** At least one reveal in flight or still pending. */
  revealing: boolean;
  pendingCount: number;
  revealedCount: number;
  /** No local secrets for this day (cannot auto-reveal). */
  noSecrets: boolean;
  lastMessage: string | null;
  lastError: string | null;
  refreshQueue: () => CommitSecretRecord[];
};

const AutoRevealContext = createContext<AutoRevealStatus | null>(null);

function useAutoRevealEngine(): AutoRevealStatus {
  const { day, phase } = useGameState();
  const { revealNft, isPending, lastError } = useHansomeReveal();
  const gasless = isTestnetGaslessResolveEnabled();
  const [queue, setQueue] = useState<CommitSecretRecord[]>(() =>
    listCommitSecretsForDay(day.day),
  );
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [passRunning, setPassRunning] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const runningRef = useRef(false);

  const refreshQueue = useCallback(() => {
    const next = listCommitSecretsForDay(day.day);
    setQueue(next);
    return next;
  }, [day.day]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (phase !== "REVEAL") {
      runningRef.current = false;
      setPassRunning(false);
      return;
    }

    if (runningRef.current) return;

    const pending = listCommitSecretsForDay(day.day).filter(
      (s) => s.status === "submitted" || s.status === "prepared",
    );
    if (pending.length === 0) {
      refreshQueue();
      return;
    }

    let cancelled = false;
    runningRef.current = true;
    setPassRunning(true);
    setRunError(null);

    void (async () => {
      if (gasless) {
        const result = await requestTestnetResolve({
          day: day.day,
          reveals: pending.map((s) => ({
            tokenId: s.tokenId,
            locationId: s.locationId,
            salt: s.salt,
          })),
          fulfillSeed: false,
          settle: false,
        });
        if (cancelled) return;

        if (!result.ok) {
          setRunError(result.error ?? "Gasless reveal failed.");
          runningRef.current = false;
          setPassRunning(false);
          refreshQueue();
          return;
        }

        const n = result.revealed ?? 0;
        if (n >= pending.length && n > 0) {
          for (const secret of pending) {
            upsertCommitSecret({
              ...secret,
              status: "revealed",
              txHash: result.revealTxHash ?? secret.txHash,
            });
          }
          setLastMessage(`Auto-revealed ${n} NFT(s) (gasless).`);
          playSfx("ui-click");
        } else if (n > 0) {
          setLastMessage(`Auto-revealed ${n}/${pending.length}… retrying.`);
        } else {
          setLastMessage("Waiting for gasless reveal…");
        }

        runningRef.current = false;
        setPassRunning(false);
        refreshQueue();
        return;
      }

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
          upsertCommitSecret({ ...secret, status: "revealed" });
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
  }, [phase, day.day, revealNft, refreshQueue, gasless, retryTick]);

  useEffect(() => {
    if (phase !== "REVEAL") return;
    const id = window.setInterval(() => {
      refreshQueue();
      if (!gasless) return;
      const pending = listCommitSecretsForDay(day.day).filter(
        (s) => s.status === "submitted" || s.status === "prepared",
      );
      if (pending.length > 0 && !runningRef.current) {
        setRetryTick((n) => n + 1);
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [phase, refreshQueue, gasless, day.day]);

  const pendingCount = queue.filter(
    (r) => r.status === "submitted" || r.status === "prepared",
  ).length;
  const revealedCount = queue.filter((r) => r.status === "revealed").length;

  return useMemo(
    () => ({
      active: phase === "REVEAL",
      revealing:
        phase === "REVEAL" && (isPending || passRunning || pendingCount > 0),
      pendingCount,
      revealedCount,
      noSecrets: queue.length === 0,
      lastMessage,
      lastError: runError ?? (!gasless ? lastError : null),
      refreshQueue,
    }),
    [
      phase,
      isPending,
      passRunning,
      pendingCount,
      revealedCount,
      queue.length,
      lastMessage,
      runError,
      lastError,
      refreshQueue,
      gasless,
    ],
  );
}

export function AutoRevealProvider({ children }: { children: ReactNode }) {
  const value = useAutoRevealEngine();
  return (
    <AutoRevealContext.Provider value={value}>{children}</AutoRevealContext.Provider>
  );
}

/** Status for Battle Result UI. Must be under AutoRevealProvider. */
export function useAutoReveal(): AutoRevealStatus {
  const ctx = useContext(AutoRevealContext);
  if (!ctx) {
    throw new Error("useAutoReveal must be used within AutoRevealProvider");
  }
  return ctx;
}
