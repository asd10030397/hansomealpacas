"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther, type Address, type Log, zeroHash } from "viem";
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
import {
  gameRandomnessAbi,
  P_LUCKY_BPS,
  P_RUNNER_BPS,
  PURPOSE_LUCKY,
  PURPOSE_RUNNER,
} from "@/lib/game/abis/gameRandomness";
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
import { deriveSettlementActivation } from "@/lib/game/settlementActivation";
import { interpretLiveSettlementRow } from "@/lib/game/interpretSettlementRow";
import {
  isRevealPhaseClosed,
  isSeedMissingError,
  MISSED_REVEAL_OUTCOME,
  SEED_MISSING_UI_MESSAGE,
} from "@/lib/game/missedReveal";
import type { AbilityEffectId } from "@/lib/game/abilityEffects/catalog";
import { useGameState } from "@/hooks/game/useGameState";
import type { GameplayClass, LocationId, NftSide } from "@/types/game";

/** Testnet game deploy block — log scan lower bound (UI-only). */
const REVEAL_LOG_FROM_BLOCK = 91_400_000n;

export type SettlementRowView = {
  tokenId: number;
  locationId: LocationId | null;
  locationName: string;
  side: NftSide | null;
  outcome: string;
  ability: string | null;
  activatedAbility: AbilityEffectId | null;
  rewardLabel: string;
  rewardWei: bigint | null;
  source: "chain" | "mock";
  missedReveal: boolean;
};

type CohortCounts = {
  ad: number[];
  cd: number[];
  alpacaParticipantCount: number;
  revealedTokenIds: Set<number>;
};

function emptyCohort(): CohortCounts {
  return {
    ad: [0, 0, 0, 0, 0],
    cd: [0, 0, 0, 0, 0],
    alpacaParticipantCount: 0,
    revealedTokenIds: new Set(),
  };
}

function sideFromEnum(side: number): NftSide | null {
  if (side === 1) return "Alpaca";
  if (side === 2) return "Cougar";
  return null;
}

function parseRevealCohort(logs: Log[]): CohortCounts {
  const cohort = emptyCohort();
  for (const log of logs) {
    const args = (
      log as {
        args?: { tokenId?: bigint; locationId?: number; side?: number };
      }
    ).args;
    if (!args) continue;
    const tokenId = Number(args.tokenId ?? 0);
    const loc = Number(args.locationId ?? 0);
    const side = sideFromEnum(Number(args.side ?? 0));
    if (tokenId > 0) cohort.revealedTokenIds.add(tokenId);
    if (loc < 0 || loc > 4) continue;
    if (side === "Alpaca") {
      cohort.ad[loc] += 1;
      cohort.alpacaParticipantCount += 1;
    } else if (side === "Cougar") {
      cohort.cd[loc] += 1;
    }
  }
  return cohort;
}

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
  const [cohort, setCohort] = useState<CohortCounts>(emptyCohort);
  const [rollByToken, setRollByToken] = useState<
    Record<number, { runnerSuccess: boolean; luckySuccess: boolean }>
  >({});

  const dayStateRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "dayState",
    args: game ? [BigInt(day.day)] : undefined,
    chainId: GAME_CHAIN_ID,
    query: {
      enabled: live && !!game,
      // Detect RevealClosed quickly so battle can resolve without a long idle gap.
      refetchInterval: 4_000,
    },
  });

  const settledRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "isSettled",
    args: game ? [BigInt(day.day)] : undefined,
    chainId: GAME_CHAIN_ID,
    query: {
      enabled: live && !!game,
      refetchInterval: 4_000,
    },
  });

  const distributorRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "distributor",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game && !isRewardDistributorConfigured() },
  });

  const randomnessRead = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "randomness",
    chainId: GAME_CHAIN_ID,
    query: { enabled: live && !!game },
  });

  const distributorAddress =
    REWARD_DISTRIBUTOR_ADDRESS ??
    (distributorRead.data as `0x${string}` | undefined) ??
    null;

  const randomnessAddress = (randomnessRead.data as Address | undefined) ?? null;

  const hasDaySeedRead = useReadContract({
    address: randomnessAddress ?? undefined,
    abi: gameRandomnessAbi,
    functionName: "hasDaySeed",
    args: randomnessAddress ? [BigInt(day.day)] : undefined,
    chainId: GAME_CHAIN_ID,
    query: {
      enabled: live && !!randomnessAddress,
      refetchInterval: 4_000,
    },
  });

  /** One auto-settle attempt per day after Reveal closes (retry after seed arrives). */
  const autoSettleArmedRef = useRef(true);
  useEffect(() => {
    autoSettleArmedRef.current = true;
  }, [day.day]);

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

  const commitHashContracts = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: game!,
      abi: hansomeGameAbi,
      functionName: "commitHashOf" as const,
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

  const settled = Boolean(settledRead.data);
  const dayStateNum =
    dayStateRead.data !== undefined ? Number(dayStateRead.data) : null;
  const revealClosed = isRevealPhaseClosed({
    phase,
    dayState: dayStateNum,
    settled,
  });

  // Index Revealed(day) once Reveal is closed (missed-reveal + activation cohort).
  useEffect(() => {
    if (!live || !game || !publicClient || !revealClosed) {
      setCohort(emptyCohort());
      setRollByToken({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: game,
          event: {
            type: "event",
            name: "Revealed",
            inputs: [
              { name: "tokenId", type: "uint256", indexed: true },
              { name: "day", type: "uint256", indexed: true },
              { name: "locationId", type: "uint8", indexed: false },
              { name: "side", type: "uint8", indexed: false },
            ],
          },
          args: { day: BigInt(day.day) },
          fromBlock: REVEAL_LOG_FROM_BLOCK,
          toBlock: "latest",
        });
        if (cancelled) return;
        const nextCohort = parseRevealCohort(logs as Log[]);
        setCohort(nextCohort);

        if (!settled || !randomnessAddress || tokenIds.length === 0) {
          setRollByToken({});
          return;
        }

        const rolls: Record<
          number,
          { runnerSuccess: boolean; luckySuccess: boolean }
        > = {};
        await Promise.all(
          tokenIds.map(async (tokenId) => {
            const nft = owned.nfts.find((n) => n.tokenId === tokenId);
            const cls = nft?.gameplayClass;
            let runnerSuccess = false;
            let luckySuccess = false;
            try {
              if (cls === "Runner") {
                runnerSuccess = Boolean(
                  await publicClient.readContract({
                    address: randomnessAddress,
                    abi: gameRandomnessAbi,
                    functionName: "bernoulli",
                    args: [
                      BigInt(day.day),
                      BigInt(tokenId),
                      PURPOSE_RUNNER,
                      P_RUNNER_BPS,
                    ],
                  }),
                );
              } else if (cls === "Lucky") {
                luckySuccess = Boolean(
                  await publicClient.readContract({
                    address: randomnessAddress,
                    abi: gameRandomnessAbi,
                    functionName: "bernoulli",
                    args: [
                      BigInt(day.day),
                      BigInt(tokenId),
                      PURPOSE_LUCKY,
                      P_LUCKY_BPS,
                    ],
                  }),
                );
              }
            } catch {
              /* seed missing / RPC — leave false (no false-positive FX) */
            }
            rolls[tokenId] = { runnerSuccess, luckySuccess };
          }),
        );
        if (!cancelled) setRollByToken(rolls);
      } catch {
        if (!cancelled) {
          setCohort(emptyCohort());
          setRollByToken({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    live,
    game,
    publicClient,
    revealClosed,
    settled,
    day.day,
    randomnessAddress,
    tokenIds,
    owned.nfts,
  ]);

  const chainLoading =
    live &&
    (dayStateRead.isLoading ||
      settledRead.isLoading ||
      locationContracts.isLoading ||
      claimableContracts.isLoading);

  const settleFormattedError = settleWriteError
    ? formatRobinhoodWriteError(settleWriteError, "settleDay failed")
    : null;

  const chainError =
    dayStateRead.error?.message ||
    settledRead.error?.message ||
    settleFormattedError ||
    localError;

  const hasDaySeed =
    hasDaySeedRead.data !== undefined ? Boolean(hasDaySeedRead.data) : null;

  const status: SettlementUiStatus = live
    ? deriveSettlementUiStatus({
        dayState: dayStateNum,
        isSettled:
          settledRead.data !== undefined ? Boolean(settledRead.data) : null,
        settleTxPending: settleWriting || settleReceipt.isLoading,
        error: chainError,
        loading: chainLoading,
        hasDaySeed,
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
      const hashRaw = commitHashContracts.data?.[i]?.result as
        | `0x${string}`
        | undefined;
      const nft = owned.nfts.find((n) => n.tokenId === tokenId);
      const side = nft?.side ?? null;
      const gameplayClass: GameplayClass = nft?.gameplayClass ?? "Common";

      const committedOnChain = Boolean(hashRaw && hashRaw !== zeroHash);
      const committed =
        committedOnChain ||
        secret?.status === "prepared" ||
        secret?.status === "submitted" ||
        secret?.status === "revealed";
      const revealed =
        cohort.revealedTokenIds.has(tokenId) || secret?.status === "revealed";

      const interpretation = interpretLiveSettlementRow({
        phase,
        dayState: dayStateNum,
        settled,
        committed,
        revealed,
      });

      let outcome: string;
      let ability: string | null = null;
      let activatedAbility: AbilityEffectId | null = null;
      let missedReveal = interpretation.missedReveal;

      if (missedReveal) {
        outcome = MISSED_REVEAL_OUTCOME;
      } else if (!settled) {
        outcome =
          interpretation.outcomeKey === "awaiting_settlement"
            ? "awaiting_settlement"
            : "awaiting_reveal";
      } else if (locationId == null || side == null) {
        outcome = "Settled on-chain (detail fields not exposed by contract)";
      } else if (!interpretation.suppressActivation) {
        const loc = locationId;
        const rolls = rollByToken[tokenId];
        const activation = deriveSettlementActivation({
          side,
          gameplayClass,
          locationId: loc,
          adL: Math.max(1, cohort.ad[loc] ?? 1),
          cdL: cohort.cd[loc] ?? 0,
          alpacaParticipantCount: Math.max(
            side === "Alpaca" ? 1 : 0,
            cohort.alpacaParticipantCount,
          ),
          runnerSuccess: rolls?.runnerSuccess,
          luckySuccess: rolls?.luckySuccess,
        });
        outcome = activation.outcome;
        ability = activation.abilityLabel;
        activatedAbility = activation.activatedAbility;
      } else {
        outcome = "Settled on-chain (detail fields not exposed by contract)";
      }

      const rewardLabel = missedReveal
        ? "0"
        : rewardWei != null
          ? `${formatHansome(rewardWei)} tHANSOME`
          : settled
            ? "0 / unread"
            : "—";

      return {
        tokenId,
        locationId: missedReveal ? null : locationId,
        locationName:
          missedReveal || locationId == null
            ? "—"
            : (GAME_LOCATIONS[locationId]?.name ?? `L${locationId}`),
        side,
        outcome,
        ability,
        activatedAbility,
        rewardLabel,
        rewardWei: missedReveal ? 0n : rewardWei,
        source: "chain" as const,
        missedReveal,
      };
    });
  }, [
    live,
    day.day,
    phase,
    dayStateNum,
    status,
    tokenIds,
    secrets,
    locationContracts.data,
    claimableContracts.data,
    commitHashContracts.data,
    settled,
    localTick,
    owned.nfts,
    cohort,
    rollByToken,
  ]);

  const runSettle = useCallback(async () => {
    setLocalError(null);
    if (!live) {
      const built = completeLocalSettlement(day.day);
      if (built.rows.length === 0) {
        setLocalError("No committed NFTs for this day to settle locally.");
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
      const msg = formatRobinhoodWriteError(e, "settleDay failed");
      setLocalError(isSeedMissingError(msg) ? SEED_MISSING_UI_MESSAGE : msg);
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
      void hasDaySeedRead.refetch?.();
    }
  }, [settleReceipt.isSuccess]);

  // Re-arm auto-settle when seed becomes the blocker (retry once seed is ready).
  useEffect(() => {
    if (status === "waiting_seed") {
      autoSettleArmedRef.current = true;
    }
  }, [status]);

  /**
   * After Reveal closes + seed ready: run settleDay automatically.
   * Timing windows stay unchanged — this only removes the extra manual wait.
   */
  useEffect(() => {
    if (status !== "available") return;
    if (!autoSettleArmedRef.current) return;
    if (settleWriting || settleReceipt.isLoading) return;
    if (settled) return;
    autoSettleArmedRef.current = false;
    void runSettle();
  }, [
    status,
    settleWriting,
    settleReceipt.isLoading,
    settled,
    runSettle,
  ]);

  /** Surface SeedMissing as waiting_seed, not a generic error banner. */
  const displayError =
    status === "waiting_seed" || isSeedMissingError(chainError)
      ? null
      : chainError;

  return {
    day: day.day,
    phase,
    live,
    status,
    statusLabel:
      status === "waiting_seed"
        ? SEED_MISSING_UI_MESSAGE
        : settlementStatusLabel(status),
    rows,
    empty: rows.length === 0,
    isConnected,
    canSettle: status === "available" || status === "waiting_seed",
    settlePending: settleWriting || settleReceipt.isLoading,
    settleHash,
    error: displayError,
    waitingSeed: status === "waiting_seed",
    /** True while revealed and still waiting for RevealClosed / settle / seed. */
    battlePending:
      !settled &&
      (status === "pending" ||
        status === "available" ||
        status === "waiting_seed" ||
        status === "processing"),
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
  const missed = Boolean(r.missedReveal);
  return {
    tokenId: r.tokenId,
    locationId: missed ? null : r.locationId,
    locationName: missed
      ? "—"
      : (GAME_LOCATIONS[r.locationId]?.name ?? `L${r.locationId}`),
    side: r.side,
    outcome: r.outcome,
    ability: r.ability,
    activatedAbility: r.activatedAbility ?? null,
    rewardLabel: missed
      ? "0"
      : `${r.rewardHansome.toLocaleString()} HANSOME`,
    rewardWei: null,
    source: "mock",
    missedReveal: missed,
  };
}

function formatHansome(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return wei.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
