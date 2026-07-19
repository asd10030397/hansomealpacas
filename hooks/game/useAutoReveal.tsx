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
import {
  isTestnetGaslessResolveEnabled,
  requestTestnetResolve,
} from "@/lib/game/testnetGaslessResolve";
import { isSeedAlreadySetError } from "@/lib/game/missedReveal";
import { playSfx } from "@/lib/game/audio";

export type AutoRevealStatus = {
  /** Wire RevealOpen / gasless resolve active. */
  active: boolean;
  revealing: boolean;
  pendingCount: number;
  revealedCount: number;
  /** Legacy localStorage path only — unused when gasless. */
  noSecrets: boolean;
  gasless: boolean;
  lastMessage: string | null;
  lastError: string | null;
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
  const runningRef = useRef(false);

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

  // —— Testnet gasless: server vault + /api/game/testnet-resolve (no localStorage) ——
  useEffect(() => {
    if (!gasless) return;
    if (phase !== "REVEAL" && phase !== "SETTLEMENT") {
      runningRef.current = false;
      setPassRunning(false);
      return;
    }
    if (runningRef.current) return;

    let cancelled = false;
    runningRef.current = true;
    setPassRunning(true);
    setRunError(null);

    void (async () => {
      const result = await requestTestnetResolve({
        day: day.day,
        // Vault is source of truth — do not send localStorage salts.
        reveals: [],
        fulfillSeed: true,
        settle: true,
      });
      if (cancelled) return;

      if (!result.ok) {
        const msg = result.error ?? "Gasless resolve failed.";
        // Seed already on-chain is not a player-facing failure.
        if (
          !isSeedAlreadySetError(msg) &&
          !/AlreadySettled/i.test(msg)
        ) {
          setRunError(msg);
          runningRef.current = false;
          setPassRunning(false);
          return;
        }
        setRunError(null);
      }

      if (result.alreadySettled || result.seedSkipped) {
        setLastMessage(
          result.alreadySettled
            ? "Battle already settled — showing results."
            : "Day seed ready — settling…",
        );
      } else if (result.settleTxHash) {
        setLastMessage(
          `Battle resolved (revealed ${result.revealed ?? 0}, vault ${result.vaultCount ?? 0}).`,
        );
        playSfx("ui-click");
      } else if ((result.revealed ?? 0) > 0) {
        setLastMessage(`Relayer revealed ${result.revealed} NFT(s)…`);
        playSfx("ui-click");
      } else {
        setLastMessage(
          `Relayer resolving… (vault ${result.vaultCount ?? 0} commit(s))`,
        );
      }

      runningRef.current = false;
      setPassRunning(false);
    })();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [gasless, phase, day.day, retryTick]);

  useEffect(() => {
    if (!gasless) return;
    if (phase !== "REVEAL" && phase !== "SETTLEMENT") return;
    const id = window.setInterval(() => {
      if (!runningRef.current) setRetryTick((n) => n + 1);
    }, 4_000);
    return () => window.clearInterval(id);
  }, [gasless, phase]);

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

  const pendingCount = gasless
    ? passRunning
      ? 1
      : 0
    : queue.filter(
        (r) => r.status === "submitted" || r.status === "prepared",
      ).length;
  const revealedCount = queue.filter((r) => r.status === "revealed").length;

  return useMemo(
    () => ({
      active: phase === "REVEAL" || (gasless && phase === "SETTLEMENT"),
      revealing: passRunning || isPending || pendingCount > 0,
      pendingCount,
      revealedCount,
      noSecrets: gasless ? false : queue.length === 0,
      gasless,
      lastMessage,
      lastError: runError ?? (!gasless ? lastError : null),
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
