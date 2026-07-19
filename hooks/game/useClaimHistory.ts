"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatEther,
  parseAbiItem,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { MOCK_REWARDS } from "@/data/game/mock";
import { GAME_CHAIN_ID, isHansomeGameConfigured } from "@/lib/game/hansomeGame";
import { REWARD_DISTRIBUTOR_ADDRESS } from "@/lib/game/rewardDistributor";
import { useGameState } from "@/hooks/game/useGameState";
import { useClaimRewards } from "@/hooks/game/useClaimRewards";

const CLAIMED_EVENT = parseAbiItem(
  "event Claimed(uint256 indexed tokenId, address indexed to, uint256 amount)",
);

export type ClaimHistoryRow = {
  tokenId: number;
  amountLabel: string;
  amountWei: bigint;
  txHash: Hash | null;
  blockNumber: bigint | null;
};

/**
 * Lifetime claimed + recent Claimed() history for the connected wallet.
 * Frontend read-only — does not change distributor semantics.
 */
export function useClaimHistory() {
  const live = isHansomeGameConfigured();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: GAME_CHAIN_ID });
  const { day } = useGameState();
  const claim = useClaimRewards();
  const [rows, setRows] = useState<ClaimHistoryRow[]>([]);
  const [lifetimeWei, setLifetimeWei] = useState(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const distributor = REWARD_DISTRIBUTOR_ADDRESS;

  useEffect(() => {
    if (!live) {
      const mockLifetime = BigInt(MOCK_REWARDS.alreadyClaimed);
      setLifetimeWei(mockLifetime);
      setRows(
        MOCK_REWARDS.history.slice(0, 8).map((h) => ({
          tokenId: h.day,
          amountLabel: h.amount.toLocaleString(),
          amountWei: BigInt(h.amount),
          txHash: null,
          blockNumber: null,
        })),
      );
      setError(null);
      setLoading(false);
      return;
    }

    if (!isConnected || !address || !distributor || !publicClient) {
      setRows([]);
      setLifetimeWei(0n);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const logs = (await publicClient.getLogs({
          address: distributor,
          event: CLAIMED_EVENT,
          args: { to: address as Address },
          fromBlock: 0n,
          toBlock: "latest",
        })) as Log<bigint, number, false, typeof CLAIMED_EVENT>[];
        if (cancelled) return;
        let total = 0n;
        const history: ClaimHistoryRow[] = [];
        for (const log of logs) {
          const tokenId = Number(log.args.tokenId ?? 0n);
          const amount = log.args.amount ?? 0n;
          total += amount;
          history.push({
            tokenId,
            amountWei: amount,
            amountLabel: formatEtherLabel(amount),
            txHash: log.transactionHash ?? null,
            blockNumber: log.blockNumber ?? null,
          });
        }
        history.reverse();
        setLifetimeWei(total);
        setRows(history.slice(0, 20));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load claim history");
        setRows([]);
        setLifetimeWei(0n);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    live,
    isConnected,
    address,
    distributor,
    publicClient,
    day.day,
    tick,
    claim.uiState,
  ]);

  const displayLifetime = useMemo(
    () =>
      live
        ? formatEtherLabel(lifetimeWei)
        : MOCK_REWARDS.alreadyClaimed.toLocaleString(),
    [live, lifetimeWei],
  );

  return {
    live,
    isConnected,
    loading,
    error,
    lifetimeWei,
    displayLifetime,
    history: rows,
    refresh: () => setTick((n) => n + 1),
  };
}

function formatEtherLabel(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return wei.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
