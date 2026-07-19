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
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { rewardDistributorAbi } from "@/lib/game/abis/rewardDistributor";
import { GAME_LOCATIONS } from "@/data/game/locations";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import { listCommitSecretsForDay } from "@/lib/game/commitSecret";
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
  completeLocalSettlement,
  getLocalSettlement,
  type LocalNftSettlementRow,
} from "@/lib/game/localSettlement";
import {
  formatRobinhoodWriteError,
  sendRobinhoodContractWrite,
} from "@/lib/game/robinhoodContractWrite";
import {
  deriveSettlementUiStatus,
  settlementStatusLabel,
  type SettlementUiStatus,
} from "@/lib/game/settlementStatus";
import { useGameState } from "@/hooks/game/useGameState";
import type { LocationId, NftSide } from "@/types/game";

export type SettlementRowView = {
  tokenId: number;
  locationId: LocationId | null;
  locationName: string;
  side: NftSide | null;
  outcome: string;
  ability: string | null;
  rewardLabel: string;
  rewardWei: bigint | null;
  source: "chain" | "mock";
};

export function useSettlementView() {
  const { day, phase } = useGameState();
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient({ chainId: GAME_CHAIN_ID });
  const owned = useOwnedGenesisNfts();
  const live = isHansomeGameConfigured();
  const game = HANSOME_GAME_ADDRESS;

  const [localTick, setLocalTick] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const dayStateRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayState",
    args: game ? [BigInt(day.day)] : undefined,
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const settledRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "isSettled",
    args: game ? [BigInt(day.day)] : undefined,
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const distributorRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "distributor",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game && !isRewardDistributorConfigured() },
  });

  const distributorAddress =
    REWARD_DISTRIBUTOR_ADDRESS ??
    (distributorRead.data as `0x${string}` | undefined) ??
    null;

  const {
    writeContractAsync,
    data: settleHash,
    isPending: settleWriting,
    error: settleWriteError,
    reset: resetSettle,
  } = useWriteContract();
  const settleReceipt = useWaitForTransactionReceipt({
    hash: settleHash,
    chainId: GAME_CHAIN_ID,
  });

  const secrets = listCommitSecretsForDay(day.day);
  const tokenIds = useMemo(
    () => secrets.map((s) => s.tokenId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh via localTick / day
    [day.day, localTick, secrets.length],
  );

  const locationContracts = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: game!,
      abi: hansomeGameAbi,
      functionName: "locationOf" as const,
      args: [BigInt(tokenId), BigInt(day.day)] as const,
      chainId: GAME_CHAIN_ID,
    })),
    query: { enabled: live && !!game && tokenIds.length > 0 },
  });

  const claimableContracts = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: distributorAddress!,
      abi: rewardDistributorAbi,
      functionName: "claimable" as const,
      args: [BigInt(tokenId)] as const,
      chainId: GAME_CHAIN_ID,
    })),
    query: {
      enabled: live && !!distributorAddress && tokenIds.length > 0,
    },
  });

  const chainLoading =
    live &&
    (dayStateRead.isLoading ||
      settledRead.isLoading ||
      locationContracts.isLoading ||
      claimableContracts.isLoading);

  const chainError =
    dayStateRead.error?.message ||
    settledRead.error?.message ||
    settleWriteError?.message ||
    localError;

  const status: SettlementUiStatus = live
    ? deriveSettlementUiStatus({
        dayState:
          dayStateRead.data !== undefined ? Number(dayStateRead.data) : null,
        isSettled:
          settledRead.data !== undefined ? Boolean(settledRead.data) : null,
        settleTxPending: settleWriting || settleReceipt.isLoading,
        error: chainError,
        loading: chainLoading,
      })
    : deriveLocalStatus(day.day, phase, localTick);

  const rows: SettlementRowView[] = useMemo(() => {
    if (!live) {
      const local = getLocalSettlement(day.day);
      if (local?.status === "completed") {
        return local.rows.map(mapLocalRow);
      }
      return [];
    }

    return tokenIds.map((tokenId, i) => {
      const secret = secrets.find((s) => s.tokenId === tokenId);
      const locRaw = locationContracts.data?.[i]?.result;
      const locationId =
        locRaw !== undefined
          ? (Number(locRaw) as LocationId)
          : (secret?.locationId ?? null);
      const claimRaw = claimableContracts.data?.[i]?.result;
      const rewardWei = claimRaw !== undefined ? (claimRaw as bigint) : null;
      const nft = owned.nfts.find((n) => n.tokenId === tokenId);
      const settled = Boolean(settledRead.data);

      return {
        tokenId,
        locationId,
        locationName:
          locationId != null
            ? (GAME_LOCATIONS[locationId]?.name ?? `L${locationId}`)
            : "—",
        side: nft?.side ?? null,
        outcome: settled
          ? "Settled on-chain (detail fields not exposed by contract)"
          : secret?.status === "revealed"
            ? "Revealed — awaiting settlement"
            : "Committed — awaiting reveal/settlement",
        ability: nft?.ability ?? null,
        rewardLabel:
          rewardWei != null
            ? `${formatHansome(rewardWei)} tHANSOME`
            : settled
              ? "0 / unread"
              : "—",
        rewardWei,
        source: "chain" as const,
      };
    });
  }, [
    live,
    day.day,
    status,
    tokenIds,
    secrets,
    locationContracts.data,
    claimableContracts.data,
    settledRead.data,
    localTick,
    owned.nfts,
  ]);

  const runSettle = useCallback(async () => {
    setLocalError(null);
    if (!live) {
      const built = completeLocalSettlement(day.day);
      if (built.rows.length === 0) {
        setLocalError("No revealed/submitted commits for this day to settle locally.");
        return;
      }
      setLocalTick((n) => n + 1);
      return;
    }
    if (!game) return;
    if (!isConnected || !address) {
      setLocalError("Connect wallet to settle on-chain.");
      return;
    }
    if (walletChainId !== GAME_CHAIN_ID) {
      setLocalError(
        `Wrong network. Switch to chain ${GAME_CHAIN_ID} (Robinhood Testnet).`,
      );
      return;
    }
    if (!publicClient) {
      setLocalError("RPC client unavailable for settle simulation.");
      return;
    }
    resetSettle();
    try {
      await sendRobinhoodContractWrite({
        label: "hansome-settle",
        publicClient,
        writeContractAsync: writeContractAsync as never,
        request: {
          chainId: GAME_CHAIN_ID,
          address: game,
          abi: hansomeGameAbi,
          functionName: "settleDay",
          args: [BigInt(day.day)],
          account: address,
        },
        extraLog: { day: day.day },
      });
    } catch (e) {
      setLocalError(formatRobinhoodWriteError(e, "settleDay failed"));
    }
  }, [
    live,
    day.day,
    game,
    isConnected,
    address,
    walletChainId,
    publicClient,
    resetSettle,
    writeContractAsync,
  ]);

  useEffect(() => {
    if (settleReceipt.isSuccess) {
      void dayStateRead.refetch?.();
      void settledRead.refetch?.();
      void claimableContracts.refetch?.();
    }
  }, [settleReceipt.isSuccess]);

  return {
    day: day.day,
    phase,
    live,
    status,
    statusLabel: settlementStatusLabel(status),
    rows,
    empty: rows.length === 0,
    isConnected,
    canSettle: status === "available",
    settlePending: settleWriting || settleReceipt.isLoading,
    settleHash,
    error: chainError,
    runSettle,
    refreshLocal: () => setLocalTick((n) => n + 1),
  };
}

function deriveLocalStatus(
  day: number,
  phase: string,
  _tick: number,
): SettlementUiStatus {
  const local = getLocalSettlement(day);
  if (local?.status === "completed") return "completed";
  if (phase === "SETTLEMENT") return "available";
  if (phase === "CLAIM") return "available";
  if (phase === "COMMIT" || phase === "REVEAL") return "pending";
  return "unavailable";
}

function mapLocalRow(r: LocalNftSettlementRow): SettlementRowView {
  return {
    tokenId: r.tokenId,
    locationId: r.locationId,
    locationName: GAME_LOCATIONS[r.locationId]?.name ?? `L${r.locationId}`,
    side: r.side,
    outcome: r.outcome,
    ability: r.ability,
    rewardLabel: `${r.rewardHansome.toLocaleString()} HANSOME`,
    rewardWei: null,
    source: "mock",
  };
}

function formatHansome(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return wei.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
