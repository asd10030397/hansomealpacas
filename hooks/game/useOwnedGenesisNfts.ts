"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, type Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
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
  GAME_CHAIN_ID,
  HANSOME_GAME_ADDRESS,
  isHansomeGameConfigured,
} from "@/lib/game/hansomeGame";
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

type MetaCache = { image: string; name?: string };

const MAX_SCAN = 550;

async function fetchTokenMeta(tokenId: number, chainUri: string): Promise<MetaCache> {
  const candidates: string[] = [];
  if (chainUri) candidates.push(ipfsToHttps(chainUri));
  // Production metadata CID — used when on-chain URI is still the pre-reveal placeholder.
  if (/placeholder/i.test(chainUri) || !chainUri) {
    candidates.unshift(metadataUrlForToken(tokenId));
  }
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const json = (await res.json()) as { image?: string; name?: string };
      if (json.image) {
        return { image: ipfsToHttps(json.image), name: json.name };
      }
    } catch {
      /* try next */
    }
  }
  return { image: "/pixel/cougar/mint/image/cougar.png" };
}

export function useOwnedGenesisNfts() {
  const { address, isConnected } = useAccount();
  const configured = isGenesisConfigured() && !!GENESIS_NFT_ADDRESS;
  const liveGame = isHansomeGameConfigured();
  const nft = GENESIS_NFT_ADDRESS as Address | undefined;
  const game = HANSOME_GAME_ADDRESS;

  const [metaById, setMetaById] = useState<Record<number, MetaCache>>({});
  const [metaLoading, setMetaLoading] = useState(false);

  const totalMinted = useReadContract({
    address: nft,
    abi: hansomeGenesisInventoryAbi,
    functionName: "totalMinted",
    chainId: GENESIS_CHAIN_ID,
    query: { enabled: configured },
  });

  const balance = useReadContract({
    address: nft,
    abi: hansomeGenesisInventoryAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: GENESIS_CHAIN_ID,
    query: { enabled: configured && !!address },
  });

  const currentDay = useReadContract({
    address: game ?? undefined,
    abi: hansomeGameAbi,
    functionName: "currentDay",
    chainId: GAME_CHAIN_ID,
    query: { enabled: liveGame && !!game },
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
    query: { enabled: configured && !!nft && ownedIds.length > 0 },
  });

  const stride = 4 + (liveGame && game ? 2 : 0) + (distributor ? 1 : 0);

  useEffect(() => {
    if (!detailReads.data || ownedIds.length === 0) return;
    let cancelled = false;
    setMetaLoading(true);
    (async () => {
      const next: Record<number, MetaCache> = {};
      await Promise.all(
        ownedIds.map(async (tokenId, idx) => {
          const base = idx * stride;
          const uri = (detailReads.data?.[base + 3]?.result as string | undefined) ?? "";
          next[tokenId] = await fetchTokenMeta(tokenId, uri);
        }),
      );
      if (!cancelled) {
        setMetaById(next);
        setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailReads.data, ownedIds, stride]);

  const nfts: OwnedGenesisNft[] = useMemo(() => {
    if (!detailReads.data) return [];
    return ownedIds.map((tokenId, idx) => {
      const base = idx * stride;
      const side = mapSide(Number(detailReads.data?.[base]?.result ?? 0));
      const gameplayClass = mapGameplayClass(
        Number(detailReads.data?.[base + 1]?.result ?? 0),
      );
      const revealed = Boolean(detailReads.data?.[base + 2]?.result);
      const uri = (detailReads.data?.[base + 3]?.result as string | undefined) ?? null;
      let locOffset = base + 4;
      let locationId: LocationId | null = null;
      let gameStatus: MockNft["gameStatus"] = "Idle";
      let hash: `0x${string}` | undefined;
      if (liveGame && game) {
        const loc = Number(detailReads.data?.[locOffset]?.result ?? 0);
        hash = detailReads.data?.[locOffset + 1]?.result as `0x${string}` | undefined;
        locOffset += 2;
        if (hash && hash !== zeroHash) {
          // Home is location 0 — after reveal locationOf is still 0, so hash alone
          // means at least Committed; non-zero loc confirms Revealed away from Home.
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
        // Ambiguous Home vs not-yet-revealed: prefer Committed until claimable/settled.
        gameStatus = "Committed";
      }
      const meta = metaById[tokenId];
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
    metaById,
  ]);

  const isLoading =
    configured &&
    isConnected &&
    (totalMinted.isLoading ||
      balance.isLoading ||
      ownerReads.isLoading ||
      detailReads.isLoading ||
      metaLoading);

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
      await Promise.all([
        totalMinted.refetch?.(),
        balance.refetch?.(),
        ownerReads.refetch?.(),
        detailReads.refetch?.(),
      ]);
    },
  };
}

const zeroHash =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
