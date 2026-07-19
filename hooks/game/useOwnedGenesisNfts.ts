"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatEther, type Address } from "viem";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { hansomeGenesisInventoryAbi } from "@/lib/game/abis/hansomeGenesisInventory";
import { hansomeGameAbi } from "@/lib/game/abis/hansomeGame";
import { rewardDistributorAbi } from "@/lib/game/abis/rewardDistributor";
import {
  abilityLabelFor,
  ipfsToHttps,
  mapGameplayClass,
  mapSide,
  metadataUrlForToken,
} from "@/lib/game/genesisIdentity";
import {
  GENESIS_CHAIN_ID,
  GENESIS_NFT_ADDRESS,
  isGenesisConfigured,
} from "@/lib/game/genesis";
import {
  isImmediateGenesisNftRevealEnabled,
  isOwnedGenesisMetaIncomplete,
  parseGenesisMetadataIdentity,
  resolveOwnedGenesisRevealFlags,
} from "@/lib/game/genesisNftReveal";
import {
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
  isHansomeGameConfigured,
} from "@/lib/game/hansomeGame";
import {
  getOwnedGenesisInventoryRevision,
  getOwnedGenesisMeta,
  getOwnedGenesisMetaEpoch,
  getServerOwnedGenesisInventoryRevision,
  getServerOwnedGenesisMetaEpoch,
  hasFreshOwnedGenesisMeta,
  ownedGenesisMetaSourceKey,
  publishOwnedGenesisMeta,
  refreshOwnedGenesisInventory,
  setOwnedGenesisMeta,
  subscribeOwnedGenesisInventory,
  subscribeOwnedGenesisMeta,
} from "@/lib/game/ownedGenesisMetaCache";
import {
  REWARD_DISTRIBUTOR_ADDRESS,
  isRewardDistributorConfigured,
} from "@/lib/game/rewardDistributor";
import type { LocationId, MockNft } from "@/types/game";

export type OwnedGenesisNft = MockNft & {
  ability: string;
  claimableWei: bigint;
  metadataUri: string | null;
  trait: string;
};

export {
  invalidateOwnedGenesisMeta,
  refreshOwnedGenesisInventory,
} from "@/lib/game/ownedGenesisMetaCache";

const MAX_SCAN = 550;
const immediateNftReveal = isImmediateGenesisNftRevealEnabled();
const VISIBILITY_REFRESH_DEBOUNCE_MS = 400;

async function fetchTokenMeta(
  tokenId: number,
  chainUri: string,
): Promise<{
  image: string;
  name?: string;
  identity: ReturnType<typeof parseGenesisMetadataIdentity>;
}> {
  const candidates: string[] = [];
  if (chainUri) candidates.push(ipfsToHttps(chainUri));
  // Production metadata CID — used when on-chain URI is still the pre-reveal placeholder.
  // On Testnet immediate NFT Reveal, always prefer the reveal metadata package.
  if (immediateNftReveal || /placeholder/i.test(chainUri) || !chainUri) {
    candidates.unshift(metadataUrlForToken(tokenId));
  }
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        image?: string;
        name?: string;
        attributes?: unknown;
      };
      if (json.image) {
        return {
          image: ipfsToHttps(json.image),
          name: json.name,
          identity: parseGenesisMetadataIdentity(json),
        };
      }
    } catch {
      /* try next */
    }
  }
  return { image: "/pixel/cougar/mint/image/cougar.png", identity: null };
}

export function useOwnedGenesisNfts() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const configured = isGenesisConfigured() && !!GENESIS_NFT_ADDRESS;
  const liveGame = isHansomeGameConfigured();
  const nft = GENESIS_NFT_ADDRESS as Address | undefined;
  const game = HANSOME_GAME_ADDRESS;

  const metaEpoch = useSyncExternalStore(
    subscribeOwnedGenesisMeta,
    getOwnedGenesisMetaEpoch,
    getServerOwnedGenesisMetaEpoch,
  );
  const inventoryRevision = useSyncExternalStore(
    subscribeOwnedGenesisInventory,
    getOwnedGenesisInventoryRevision,
    getServerOwnedGenesisInventoryRevision,
  );
  const [metaFetching, setMetaFetching] = useState(false);

  const liveQuery = {
    enabled: configured && !!address,
    refetchInterval: isConnected ? 20_000 : false,
  } as const;

  const totalMinted = useReadContract({
    address: nft,
    abi: hansomeGenesisInventoryAbi,
    functionName: "totalMinted",
    chainId: GENESIS_CHAIN_ID,
    query: {
      enabled: configured,
      refetchInterval: isConnected ? 20_000 : false,
    },
  });

  const balance = useReadContract({
    address: nft,
    abi: hansomeGenesisInventoryAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: GENESIS_CHAIN_ID,
    query: liveQuery,
  });

  const currentDay = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "currentDay",
    chainId: GAME_CHAIN_ID,
    query: { enabled: liveGame && !!game, refetchInterval: isConnected ? 20_000 : false },
  });

  const distributorFromGame = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "distributor",
    chainId: GAME_CHAIN_ID,
    query: { enabled: liveGame && !!game && !isRewardDistributorConfigured() },
  });

  const distributor =
    REWARD_DISTRIBUTOR_ADDRESS ??
    (distributorFromGame.data as Address | undefined) ??
    null;

  const minted = Number(totalMinted.data ?? 0n);
  const scanCount = Math.min(Math.max(minted, 0), MAX_SCAN);

  const ownerReads = useReadContracts({
    contracts: Array.from({ length: scanCount }, (_, i) => ({
      address: nft!,
      abi: hansomeGenesisInventoryAbi,
      functionName: "ownerOf" as const,
      args: [BigInt(i + 1)] as const,
      chainId: GENESIS_CHAIN_ID,
    })),
    query: {
      enabled: configured && !!nft && !!address && scanCount > 0,
      refetchInterval: isConnected ? 20_000 : false,
    },
  });

  const ownedIds = useMemo(() => {
    if (!address || !ownerReads.data) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < ownerReads.data.length; i++) {
      const owner = ownerReads.data[i]?.result as Address | undefined;
      if (owner && owner.toLowerCase() === address.toLowerCase()) {
        out.push(i + 1);
      }
    }
    return out;
  }, [address, ownerReads.data]);

  const day = Number(currentDay.data ?? 0n);

  const detailReads = useReadContracts({
    contracts: ownedIds.flatMap((tokenId) => {
      const id = BigInt(tokenId);
      const base = [
        {
          address: nft!,
          abi: hansomeGenesisInventoryAbi,
          functionName: "side" as const,
          args: [id] as const,
          chainId: GENESIS_CHAIN_ID,
        },
        {
          address: nft!,
          abi: hansomeGenesisInventoryAbi,
          functionName: "gameplayClass" as const,
          args: [id] as const,
          chainId: GENESIS_CHAIN_ID,
        },
        {
          address: nft!,
          abi: hansomeGenesisInventoryAbi,
          functionName: "isRevealed" as const,
          args: [id] as const,
          chainId: GENESIS_CHAIN_ID,
        },
        {
          address: nft!,
          abi: hansomeGenesisInventoryAbi,
          functionName: "tokenURI" as const,
          args: [id] as const,
          chainId: GENESIS_CHAIN_ID,
        },
      ];
      const gameReads =
        liveGame && game
          ? [
              {
                address: game,
                abi: hansomeGameAbi,
                functionName: "locationOf" as const,
                args: [id, BigInt(day)] as const,
                chainId: GAME_CHAIN_ID,
              },
              {
                address: game,
                abi: hansomeGameAbi,
                functionName: "commitHashOf" as const,
                args: [id, BigInt(day)] as const,
                chainId: GAME_CHAIN_ID,
              },
            ]
          : [];
      const claimRead =
        distributor != null
          ? [
              {
                address: distributor,
                abi: rewardDistributorAbi,
                functionName: "claimable" as const,
                args: [id] as const,
                chainId: GAME_CHAIN_ID,
              },
            ]
          : [];
      return [...base, ...gameReads, ...claimRead];
    }),
    query: {
      enabled: configured && !!nft && ownedIds.length > 0,
      refetchInterval: isConnected ? 20_000 : false,
    },
  });

  const stride = 4 + (liveGame && game ? 2 : 0) + (distributor ? 1 : 0);

  const sourceKeyByTokenId = useMemo(() => {
    const map = new Map<number, string>();
    if (!detailReads.data) return map;
    for (let idx = 0; idx < ownedIds.length; idx++) {
      const tokenId = ownedIds[idx]!;
      const base = idx * stride;
      const onChainRevealed = Boolean(detailReads.data?.[base + 2]?.result);
      const uri =
        (detailReads.data?.[base + 3]?.result as string | undefined) ?? "";
      map.set(tokenId, ownedGenesisMetaSourceKey(uri, onChainRevealed));
    }
    return map;
  }, [detailReads.data, ownedIds, stride]);

  const metaIncomplete = isOwnedGenesisMetaIncomplete(ownedIds, (tokenId) => {
    const sourceKey = sourceKeyByTokenId.get(tokenId);
    if (sourceKey == null) return false;
    return hasFreshOwnedGenesisMeta(tokenId, sourceKey);
  });

  const refetchChain = async () => {
    await Promise.all([
      totalMinted.refetch?.(),
      balance.refetch?.(),
      ownerReads.refetch?.(),
      detailReads.refetch?.(),
      currentDay.refetch?.(),
    ]);
  };

  // Account or wallet chain change → drop meta + requery ownership.
  const sessionKey = `${address?.toLowerCase() ?? ""}:${chainId}`;
  const prevSessionKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevSessionKey.current == null) {
      prevSessionKey.current = sessionKey;
      return;
    }
    if (prevSessionKey.current === sessionKey) return;
    prevSessionKey.current = sessionKey;
    refreshOwnedGenesisInventory();
  }, [sessionKey]);

  // Keep latest chain refetch for revision / visibility listeners.
  const refetchChainRef = useRef(refetchChain);
  refetchChainRef.current = refetchChain;

  // External bump (mint success, etc.) → refetch chain reads for mounted pages.
  const prevInventoryRevision = useRef(inventoryRevision);
  useEffect(() => {
    if (prevInventoryRevision.current === inventoryRevision) return;
    prevInventoryRevision.current = inventoryRevision;
    if (!configured || !isConnected) return;
    void refetchChainRef.current();
  }, [inventoryRevision, configured, isConnected]);

  // Returning from MetaMask / tab focus / bfcache restore.
  // Soft refresh: re-read chain; URI/reveal fingerprint drops stale meta automatically.
  useEffect(() => {
    if (!configured) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        void refetchChainRef.current();
      }, VISIBILITY_REFRESH_DEBOUNCE_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("focus", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [configured]);

  useEffect(() => {
    if (!detailReads.data || ownedIds.length === 0) {
      setMetaFetching(false);
      return;
    }
    const stale = ownedIds.filter((tokenId) => {
      const sourceKey = sourceKeyByTokenId.get(tokenId);
      if (sourceKey == null) return true;
      return !hasFreshOwnedGenesisMeta(tokenId, sourceKey);
    });
    if (stale.length === 0) {
      setMetaFetching(false);
      return;
    }

    let cancelled = false;
    setMetaFetching(true);
    (async () => {
      await Promise.all(
        stale.map(async (tokenId) => {
          const idx = ownedIds.indexOf(tokenId);
          const base = idx * stride;
          const onChainRevealed = Boolean(detailReads.data?.[base + 2]?.result);
          const uri =
            (detailReads.data?.[base + 3]?.result as string | undefined) ?? "";
          const sourceKey = ownedGenesisMetaSourceKey(uri, onChainRevealed);
          const meta = await fetchTokenMeta(tokenId, uri);
          // Always cache (including failures) so loading cannot hang.
          setOwnedGenesisMeta(tokenId, { ...meta, sourceKey });
        }),
      );
      publishOwnedGenesisMeta();
      if (!cancelled) setMetaFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [detailReads.data, ownedIds, stride, sourceKeyByTokenId, metaEpoch]);

  const nfts: OwnedGenesisNft[] = useMemo(() => {
    if (!detailReads.data) return [];
    return ownedIds.map((tokenId, idx) => {
      const base = idx * stride;
      const onChainSide = mapSide(Number(detailReads.data?.[base]?.result ?? 0));
      const onChainClass = mapGameplayClass(
        Number(detailReads.data?.[base + 1]?.result ?? 0),
      );
      const onChainRevealed = Boolean(detailReads.data?.[base + 2]?.result);
      const uri = (detailReads.data?.[base + 3]?.result as string | undefined) ?? null;
      const meta = getOwnedGenesisMeta(tokenId);
      const metaIdentity = meta?.identity ?? null;
      const { revealed, useMetaReveal } = resolveOwnedGenesisRevealFlags({
        onChainRevealed,
        metaIdentity,
        immediateNftReveal,
      });
      const side = useMetaReveal && metaIdentity ? metaIdentity.side : onChainSide;
      const gameplayClass =
        useMetaReveal && metaIdentity
          ? metaIdentity.gameplayClass
          : onChainClass;
      let locOffset = base + 4;
      let locationId: LocationId | null = null;
      let gameStatus: MockNft["gameStatus"] = "Idle";
      let hash: `0x${string}` | undefined;
      if (liveGame && game) {
        const loc = Number(detailReads.data?.[locOffset]?.result ?? 0);
        hash = detailReads.data?.[locOffset + 1]?.result as `0x${string}` | undefined;
        locOffset += 2;
        if (hash && hash !== zeroHash) {
          locationId = loc as LocationId;
          gameStatus = "Revealed";
        }
      }
      const claimableWei =
        distributor != null
          ? ((detailReads.data?.[locOffset]?.result as bigint | undefined) ?? 0n)
          : 0n;
      if (claimableWei > 0n) gameStatus = "Settled";
      else if (hash && hash !== zeroHash && locationId === 0) {
        gameStatus = "Committed";
      }
      const trait = side === "Cougar" ? "Cougar" : gameplayClass;
      return {
        tokenId,
        side,
        gameplayClass,
        revealed,
        image: meta?.image ?? "/pixel/cougar/mint/image/cougar.png",
        selectedLocationId: locationId,
        claimableHansome: Number(formatEther(claimableWei)),
        claimableWei,
        gameStatus,
        ability: abilityLabelFor(side, gameplayClass),
        metadataUri: uri,
        trait,
      };
    });
  }, [
    detailReads.data,
    ownedIds,
    stride,
    liveGame,
    game,
    distributor,
    metaEpoch,
  ]);

  const isLoading =
    configured &&
    isConnected &&
    (totalMinted.isLoading ||
      balance.isLoading ||
      ownerReads.isLoading ||
      detailReads.isLoading ||
      metaIncomplete ||
      metaFetching);

  return {
    configured,
    isConnected,
    address: address ?? null,
    balance: Number(balance.data ?? 0n),
    totalMinted: minted,
    nfts,
    isLoading,
    isError: Boolean(ownerReads.isError || detailReads.isError),
    error:
      (ownerReads.error as Error | null)?.message ??
      (detailReads.error as Error | null)?.message ??
      null,
    refetch: async () => {
      refreshOwnedGenesisInventory(ownedIds.length > 0 ? ownedIds : undefined);
      await refetchChain();
    },
  };
}

const zeroHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
