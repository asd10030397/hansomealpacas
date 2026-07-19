"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { rewardDistributorAbi } from "@/lib/game/abis/rewardDistributor";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { playSfx } from "@/lib/game/audio";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
  isHansomeGameConfigured,
} from "@/lib/game/hansomeGame";
import {
  REWARD_DISTRIBUTOR_ADDRESS,
  isRewardDistributorConfigured,
} from "@/lib/game/rewardDistributor";
import {
  getLocalSettlement,
  localClaimableRows,
  markLocalClaimed,
} from "@/lib/game/localSettlement";
import {
  formatRobinhoodWriteError,
  sendRobinhoodContractWrite,
} from "@/lib/game/robinhoodContractWrite";
import { canSubmitClaim } from "@/lib/game/settlementStatus";
import { useGameState } from "@/hooks/game/useGameState";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";

export type ClaimUiState =
  | "idle"
  | "confirm"
  | "pending"
  | "success"
  | "rejected"
  | "failure";

export function useClaimRewards() {
  const { day } = useGameState();
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient({ chainId: GAME_CHAIN_ID });
  const owned = useOwnedGenesisNfts();
  const live = isHansomeGameConfigured();
  const game = HANSOME_GAME_ADDRESS;

  const [uiState, setUiState] = useState<ClaimUiState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localTick, setLocalTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const distributorFromGame = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "distributor",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game && !isRewardDistributorConfigured() },
  });

  const distributor =
    REWARD_DISTRIBUTOR_ADDRESS ??
    (distributorFromGame.data as `0x${string}` | undefined) ??
    null;

  const mockRows = useMemo(() => {
    void localTick;
    return localClaimableRows(day.day);
  }, [day.day, localTick]);

  const tokenIds = useMemo(() => {
    if (!live) return mockRows.map((r) => r.tokenId);
    return owned.nfts.map((n) => n.tokenId);
  }, [live, mockRows, owned.nfts]);

  const claimableReads = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: distributor!,
      abi: rewardDistributorAbi,
      functionName: "claimable" as const,
      args: [BigInt(tokenId)] as const,
      chainId: GAME_CHAIN_ID,
    })),
    query: { enabled: live && !!distributor && tokenIds.length > 0 },
  });

  const chainRows = useMemo(() => {
    if (!live) return [];
    return tokenIds
      .map((tokenId, i) => {
        const amount =
          (claimableReads.data?.[i]?.result as bigint | undefined) ?? 0n;
        return { tokenId, amount };
      })
      .filter((r) => r.amount > 0n);
  }, [live, tokenIds, claimableReads.data]);

  const claimableTotal = useMemo(() => {
    if (!live) {
      return BigInt(mockRows.reduce((s, r) => s + r.rewardHansome, 0));
    }
    return chainRows.reduce((s, r) => s + r.amount, 0n);
  }, [live, mockRows, chainRows]);

  const {
    writeContractAsync,
    data: txHash,
    isPending: writing,
    reset,
  } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: GAME_CHAIN_ID,
  });

  const hasPendingTx = writing || receipt.isLoading;
  const canClaim = canSubmitClaim({
    claimableTotal,
    isSubmitting: submitting,
    hasPendingTx,
  });

  const claimAll = useCallback(async () => {
    if (!canClaim || submitting) return;
    setSubmitting(true);
    setError(null);
    setUiState("confirm");
    reset();

    if (!live) {
      const settled = getLocalSettlement(day.day);
      if (!settled) {
        setUiState("failure");
        setError("No local settlement to claim. Run settlement first.");
        setSubmitting(false);
        return;
      }
      const ids = localClaimableRows(day.day).map((r) => r.tokenId);
      if (ids.length === 0) {
        setUiState("failure");
        setError("Nothing claimable.");
        setSubmitting(false);
        return;
      }
      setUiState("pending");
      markLocalClaimed(day.day, ids);
      setLocalTick((n) => n + 1);
      setUiState("success");
      playSfx("ui-click");
      setSubmitting(false);
      return;
    }

    if (!distributor) {
      setUiState("failure");
      setError("RewardDistributor address not configured.");
      setSubmitting(false);
      return;
    }
    if (!isConnected || !address) {
      setUiState("failure");
      setError("Connect wallet to claim.");
      setSubmitting(false);
      return;
    }

    if (walletChainId !== GAME_CHAIN_ID) {
      setUiState("failure");
      setError(
        `Wrong network. Switch to chain ${GAME_CHAIN_ID} (Robinhood Testnet).`,
      );
      setSubmitting(false);
      return;
    }

    if (!publicClient) {
      setUiState("failure");
      setError("RPC client unavailable for claim simulation.");
      setSubmitting(false);
      return;
    }

    const ids = chainRows.map((r) => r.tokenId);
    if (ids.length === 0) {
      setUiState("failure");
      setError("Nothing claimable.");
      setSubmitting(false);
      return;
    }

    try {
      setUiState("pending");
      await sendRobinhoodContractWrite({
        label: "hansome-claim",
        publicClient,
        writeContractAsync: writeContractAsync as never,
        request: {
          chainId: GAME_CHAIN_ID,
          address: distributor,
          abi: rewardDistributorAbi,
          functionName: "claimMany",
          args: [ids.map((id) => BigInt(id))],
          account: address,
        },
        extraLog: { tokenIds: ids, day: day.day },
      });
    } catch (e) {
      const msg = formatRobinhoodWriteError(e, "Claim failed");
      const rejected = /user rejected|denied|cancelled in wallet|ACTION_REJECTED|4001/i.test(
        msg,
      );
      setUiState(rejected ? "rejected" : "failure");
      setError(msg);
      setSubmitting(false);
    }
  }, [
    canClaim,
    submitting,
    live,
    day.day,
    distributor,
    isConnected,
    address,
    walletChainId,
    publicClient,
    chainRows,
    reset,
    writeContractAsync,
  ]);

  useEffect(() => {
    if (receipt.isSuccess && uiState === "pending") {
      setUiState("success");
      setSubmitting(false);
      playSfx("ui-click");
      void claimableReads.refetch?.();
    }
    if (receipt.isError && uiState === "pending") {
      setUiState("failure");
      setError(receipt.error?.message ?? "Claim transaction failed");
      setSubmitting(false);
    }
  }, [
    receipt.isSuccess,
    receipt.isError,
    receipt.error,
    uiState,
    claimableReads,
  ]);

  const displayTotal = live
    ? formatEtherLabel(claimableTotal)
    : mockRows.reduce((s, r) => s + r.rewardHansome, 0).toLocaleString();

  return {
    live,
    day: day.day,
    isConnected,
    uiState,
    error,
    canClaim,
    hasPendingTx,
    claimableTotal,
    displayTotal,
    chainRows,
    mockRows,
    txHash,
    claimAll,
    isLoading: live && claimableReads.isLoading,
    refresh: () => {
      setLocalTick((n) => n + 1);
      void claimableReads.refetch?.();
    },
  };
}

function formatEtherLabel(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return wei.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
