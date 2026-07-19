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
import { MOCK_NFTS } from "@/data/game/mock";
import { useOwnedGenesisNfts } from "@/hooks/game/useOwnedGenesisNfts";
import { listOwnedCommitSecretsForDay } from "@/lib/game/commitSecret";
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
  isTestnetGaslessResolveEnabled,
  requestTestnetResolve,
} from "@/lib/game/testnetGaslessResolve";
import { selectPersonalBattleTokenIds } from "@/lib/game/personalBattleReport";
import {
  deriveSettlementUiStatus,
  settlementStatusLabel,
  type SettlementUiStatus,
} from "@/lib/game/settlementStatus";
import { deriveSettlementActivation } from "@/lib/game/settlementActivation";
import { interpretLiveSettlementRow } from "@/lib/game/interpretSettlementRow";
import {
  isRevealPhaseClosed,
  isSeedAlreadySetError,
  isSeedMissingError,
  MISSED_REVEAL_OUTCOME,
  SEED_MISSING_UI_MESSAGE,
} from "@/lib/game/missedReveal";
import {
  getTestnetGameplayIdentity,
  isTestnetGameplayTraitsEnabled,
} from "@/lib/game/testnetGameplayTraits";
import { resolveBattleLocationId } from "@/lib/game/resolveBattleLocation";
import { fetchDaySettlementCredits } from "@/lib/game/daySettlementCredits";
import type { AbilityEffectId } from "@/lib/game/abilityEffects/catalog";
import {
  alpacaCountAt,
  cougarCountAt,
  emptyCohort,
  mergeOwnedRevealsIntoCohort,
  parseRevealCohort,
  type BattleParticipantView,
  type CohortCounts,
  type RevealLogLike,
} from "@/lib/game/revealCohort";
import { useGameState } from "@/hooks/game/useGameState";
import type { GameplayClass, LocationId, NftSide } from "@/types/game";

/** Testnet game deploy block — log scan lower bound (UI-only). */
const REVEAL_LOG_FROM_BLOCK = 91_400_000n;

export type SettlementRowView = {
  tokenId: number;
  locationId: LocationId | null;
  locationName: string;
  side: NftSide | null;
  gameplayClass: GameplayClass | null;
  image: string | null;
  ownerAddress: string | null;
  isOwn: boolean;
  claimStatus: string | null;
  outcome: string;
  ability: string | null;
  activatedAbility: AbilityEffectId | null;
  rewardLabel: string;
  rewardWei: bigint | null;
  source: "chain" | "mock";
  missedReveal: boolean;
};

export type { BattleParticipantView };

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
  const [gaslessSettlePending, setGaslessSettlePending] = useState(false);
  const gaslessSettleInFlightRef = useRef(false);

  const [cohort, setCohort] = useState<CohortCounts>(emptyCohort);
  const [rollByToken, setRollByToken] = useState<
    Record<number, { runnerSuccess: boolean; luckySuccess: boolean }>
  >({});
  /** Per-token credits from this day's DaySettled tx (not cumulative claimable). */
  const [dayCreditsByToken, setDayCreditsByToken] = useState<
    Record<number, bigint>
  >({});
  const [dayCreditsLoaded, setDayCreditsLoaded] = useState(false);

  // Drop previous wallet / day battle UI (prevents stale SeedAlreadySet errors).
  useEffect(() => {
    setLocalError(null);
    setLocalTick((n) => n + 1);
    gaslessSettleInFlightRef.current = false;
    setGaslessSettlePending(false);
    setCohort(emptyCohort());
    setRollByToken({});
    setDayCreditsByToken({});
    setDayCreditsLoaded(false);
  }, [address, day.day]);

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

  const gasless = isTestnetGaslessResolveEnabled();
  const ownedTokenIds = useMemo(
    () => owned.nfts.map((n) => n.tokenId),
    [owned.nfts],
  );
  // Client commit secrets (location + salt). Still written on gasless commit;
  // resolve itself uses the server vault, but Battle Result needs local
  // locationId before reveal because on-chain locationOf defaults to 0 (Home).
  const secrets = useMemo(
    () => listOwnedCommitSecretsForDay(day.day, address, ownedTokenIds),
    [day.day, address, ownedTokenIds, localTick],
  );

  // Read today's commit hashes for every owned NFT, then keep only participants.
  // Do NOT use leftover claimableWei / prior-day Settled status (that leaked
  // unrelated NFTs into Battle Result).
  const ownedCommitHashContracts = useReadContracts({
    contracts: ownedTokenIds.map((tokenId) => ({
      address: game!,
      abi: hansomeGameAbi,
      functionName: "commitHashOf" as const,
      args: [BigInt(tokenId), BigInt(day.day)] as const,
      chainId: GAME_CHAIN_ID,
    })),
    query: {
      enabled: live && !!game && ownedTokenIds.length > 0 && !!address,
      refetchInterval: isConnected ? 4_000 : false,
    },
  });

  const tokenIds = useMemo(() => {
    if (!address) return [] as number[];
    const commitHashes = ownedTokenIds.map(
      (_, i) =>
        ownedCommitHashContracts.data?.[i]?.result as
          | `0x${string}`
          | undefined,
    );
    return selectPersonalBattleTokenIds({
      ownedTokenIds,
      commitHashes,
      secretTokenIds: secrets.map((s) => s.tokenId),
    });
  }, [
    address,
    ownedTokenIds,
    ownedCommitHashContracts.data,
    secrets,
  ]);

  const locationContracts = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: game!,
      abi: hansomeGameAbi,
      functionName: "locationOf" as const,
      args: [BigInt(tokenId), BigInt(day.day)] as const,
      chainId: GAME_CHAIN_ID,
    })),
    query: {
      enabled: live && !!game && tokenIds.length > 0,
      // Reveal writes locationOf — must not keep the pre-reveal default 0 (Home).
      refetchInterval: isConnected ? 4_000 : false,
    },
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

  // Load this day's Credited amounts from the settle tx (UI reward = day reward).
  useEffect(() => {
    if (!live || !game || !publicClient || !distributorAddress || !settled) {
      setDayCreditsByToken({});
      setDayCreditsLoaded(false);
      return;
    }
    let cancelled = false;
    setDayCreditsLoaded(false);
    void (async () => {
      try {
        const { credits } = await fetchDaySettlementCredits({
          publicClient,
          game,
          distributor: distributorAddress,
          day: day.day,
          fromBlock: REVEAL_LOG_FROM_BLOCK,
        });
        if (cancelled) return;
        const next: Record<number, bigint> = {};
        for (const [tokenId, amount] of credits) next[tokenId] = amount;
        setDayCreditsByToken(next);
        setDayCreditsLoaded(true);
      } catch {
        if (!cancelled) {
          setDayCreditsByToken({});
          setDayCreditsLoaded(false);
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
    distributorAddress,
    settled,
    day.day,
    localTick,
  ]);

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
        const nextCohort = parseRevealCohort(logs as unknown as RevealLogLike[]);
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

  const rawChainError =
    dayStateRead.error?.message ||
    settledRead.error?.message ||
    settleFormattedError ||
    localError;
  // Never surface SeedAlreadySet / already-settled as a settlement Error panel.
  const chainError =
    rawChainError &&
    !isSeedAlreadySetError(rawChainError) &&
    !/AlreadySettled/i.test(rawChainError)
      ? rawChainError
      : null;

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
        phase,
      })
    : deriveLocalStatus(day.day, phase, localTick);

  const rows: SettlementRowView[] = useMemo(() => {
    if (!live) {
      const local = getLocalSettlement(day.day);
      if (local?.status === "completed") {
        return local.rows.map((r) => mapLocalRow(r, address ?? null));
      }
      return [];
    }

    // Effective cohort: chain Revealed logs + any owned reveals missing from RPC.
    const ownedRevealSeed = tokenIds.map((tokenId) => {
      const secret = secrets.find((s) => s.tokenId === tokenId);
      const nft = owned.nfts.find((n) => n.tokenId === tokenId);
      const testnetId = isTestnetGameplayTraitsEnabled()
        ? getTestnetGameplayIdentity(tokenId)
        : null;
      const side: NftSide | null =
        testnetId?.side ?? nft?.side ?? null;
      const cohortLocationId =
        cohort.participants.find((p) => p.tokenId === tokenId)?.locationId ??
        null;
      const loc =
        cohortLocationId ??
        (secret &&
        (secret.status === "revealed" || secret.status === "submitted")
          ? secret.locationId
          : null);
      return {
        tokenId,
        locationId: loc ?? -1,
        side,
      };
    }).filter((r) => r.locationId >= 0);
    const effectiveCohort = mergeOwnedRevealsIntoCohort(cohort, ownedRevealSeed);

    return tokenIds.map((tokenId, i) => {
      const secret = secrets.find((s) => s.tokenId === tokenId);
      const locRaw = locationContracts.data?.[i]?.result;
      const claimRaw = claimableContracts.data?.[i]?.result;
      const rewardWei = claimRaw !== undefined ? (claimRaw as bigint) : null;
      const hashRaw = commitHashContracts.data?.[i]?.result as
        | `0x${string}`
        | undefined;
      const nft = owned.nfts.find((n) => n.tokenId === tokenId);
      const testnetId = isTestnetGameplayTraitsEnabled()
        ? getTestnetGameplayIdentity(tokenId)
        : null;
      // Prefer Testnet FY deck over stale metadata Side (#16 Cougar / #29 Alpaca).
      const side: NftSide | null =
        testnetId?.side ?? nft?.side ?? null;
      const gameplayClass: GameplayClass =
        testnetId?.gameplayClass ?? nft?.gameplayClass ?? "Common";
      const image =
        side === "Cougar" && nft?.side !== "Cougar"
          ? "/pixel/cougar/mint/image/cougar.png"
          : (nft?.image ?? null);

      const committedOnChain = Boolean(hashRaw && hashRaw !== zeroHash);
      const committed =
        committedOnChain ||
        secret?.status === "prepared" ||
        secret?.status === "submitted" ||
        secret?.status === "revealed";
      const revealed =
        cohort.revealedTokenIds.has(tokenId) || secret?.status === "revealed";
      const cohortLocationId =
        cohort.participants.find((p) => p.tokenId === tokenId)?.locationId ??
        null;

      // Prefer Revealed logs / same-day secret over stale locationOf===0 (Home).
      const locationId = resolveBattleLocationId({
        committed,
        revealed,
        settled,
        locationOf: locRaw !== undefined ? Number(locRaw) : null,
        secretLocationId: secret?.locationId,
        cohortLocationId,
        side,
      });

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
        // adL/cdL from day-global cohort (0 is valid — empty location = hunt miss).
        const activation = deriveSettlementActivation({
          side,
          gameplayClass,
          locationId: loc,
          adL: alpacaCountAt(effectiveCohort, loc),
          cdL: cougarCountAt(effectiveCohort, loc),
          alpacaParticipantCount: Math.max(
            side === "Alpaca" ? 1 : 0,
            effectiveCohort.alpacaParticipantCount,
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

      // Battle Reward = this day's Credited amount (not cumulative claimable).
      const dayRewardWei = missedReveal
        ? 0n
        : !settled
          ? null
          : dayCreditsLoaded
            ? (dayCreditsByToken[tokenId] ?? 0n)
            : null;

      const rewardLabel = missedReveal
        ? "0"
        : !settled
          ? "Pending"
          : dayRewardWei != null
            ? `${formatHansome(dayRewardWei)} tHANSOME`
            : "…";

      // Claim row still reflects pull-claim balance (may include prior days).
      const claimStatus = missedReveal
        ? "No claim"
        : !settled
          ? "Pending settle"
          : rewardWei != null && rewardWei > 0n
            ? "Claimable"
            : "No claim";

      return {
        tokenId,
        locationId: missedReveal ? null : locationId,
        locationName:
          missedReveal || locationId == null
            ? "—"
            : (GAME_LOCATIONS[locationId]?.name ?? `L${locationId}`),
        side,
        gameplayClass,
        image,
        ownerAddress: address ?? null,
        isOwn: true,
        claimStatus,
        outcome,
        ability,
        activatedAbility,
        rewardLabel,
        rewardWei: dayRewardWei,
        source: "chain" as const,
        missedReveal,
      };
    });
  }, [
    address,
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
    dayCreditsByToken,
    dayCreditsLoaded,
  ]);

  const runSettle = useCallback(async () => {
    setLocalError(null);
    if (!live) {
      const built = completeLocalSettlement(
        day.day,
        listOwnedCommitSecretsForDay(day.day, address, ownedTokenIds),
      );
      if (built.rows.length === 0) {
        setLocalError("No committed NFTs for this day to settle locally.");
        return;
      }
      setLocalTick((n) => n + 1);
      return;
    }
    if (!game) return;

    // Testnet gasless: server vault + relayer (no localStorage salts).
    if (isTestnetGaslessResolveEnabled()) {
      if (gaslessSettleInFlightRef.current) return;
      resetSettle();
      gaslessSettleInFlightRef.current = true;
      setGaslessSettlePending(true);
      try {
        const result = await requestTestnetResolve({
          day: day.day,
          reveals: [],
          fulfillSeed: true,
          settle: true,
        });
        if (!result.ok) {
          const msg = result.error ?? "Gasless settle failed.";
          // AlreadySettled / SeedAlreadySet are success — continue to Battle Result.
          if (
            /AlreadySettled/i.test(msg) ||
            isSeedAlreadySetError(msg)
          ) {
            /* soft-ok */
          } else {
            setLocalError(
              isSeedMissingError(msg) ? SEED_MISSING_UI_MESSAGE : msg,
            );
            return;
          }
        } else {
          setLocalError(null);
        }
        void dayStateRead.refetch?.();
        void settledRead.refetch?.();
        void locationContracts.refetch?.();
        void commitHashContracts.refetch?.();
        void claimableContracts.refetch?.();
        void hasDaySeedRead.refetch?.();
        void owned.refetch?.();
        setLocalTick((n) => n + 1);
      } finally {
        gaslessSettleInFlightRef.current = false;
        setGaslessSettlePending(false);
      }
      return;
    }

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
    owned,
    walletChainId,
    publicClient,
    resetSettle,
    writeContractAsync,
    dayStateRead,
    settledRead,
    locationContracts,
    commitHashContracts,
    claimableContracts,
    hasDaySeedRead,
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
    if (settled) return;
    if (settleWriting || settleReceipt.isLoading || gaslessSettlePending) return;

    // Testnet gasless: resolve as soon as Battle/Reveal opens (no wallet).
    if (isTestnetGaslessResolveEnabled()) {
      const ready =
        status === "available" ||
        status === "waiting_seed" ||
        (status === "pending" && phase === "REVEAL");
      if (!ready) return;
      const kick = () => {
        if (gaslessSettleInFlightRef.current) return;
        void runSettle();
      };
      kick();
      const id = window.setInterval(kick, 5_000);
      return () => window.clearInterval(id);
    }

    if (status !== "available") return;
    if (!autoSettleArmedRef.current) return;
    autoSettleArmedRef.current = false;
    void runSettle();
  }, [
    status,
    phase,
    settleWriting,
    settleReceipt.isLoading,
    gaslessSettlePending,
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
    /** Revealed day participants not in the personal battle list. */
    otherParticipants: (() => {
      const own = new Set(rows.map((r) => r.tokenId));
      return cohort.participants.filter((p) => !own.has(p.tokenId));
    })(),
    empty: rows.length === 0,
    isConnected,
    canSettle: status === "available" || status === "waiting_seed",
    settlePending:
      settleWriting || settleReceipt.isLoading || gaslessSettlePending,
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

function mapLocalRow(
  r: LocalNftSettlementRow,
  ownerAddress: string | null,
): SettlementRowView {
  const missed = Boolean(r.missedReveal);
  const mock = ownedNftLookup(r.tokenId);
  return {
    tokenId: r.tokenId,
    locationId: missed ? null : r.locationId,
    locationName: missed
      ? "—"
      : (GAME_LOCATIONS[r.locationId]?.name ?? `L${r.locationId}`),
    side: r.side,
    gameplayClass: mock?.gameplayClass ?? null,
    image: mock?.image ?? null,
    ownerAddress,
    isOwn: true,
    claimStatus: missed
      ? "No claim"
      : r.rewardHansome > 0
        ? "Claimable"
        : "No claim",
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

function ownedNftLookup(tokenId: number) {
  return MOCK_NFTS.find((n) => n.tokenId === tokenId) ?? null;
}

function formatHansome(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return wei.toString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
