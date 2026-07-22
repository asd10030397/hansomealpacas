"use client";

import { useMemo } from "react";
import type { OwnedGenesisNft } from "@/hooks/game/useOwnedGenesisNfts";
import { useNftDisplayMap, type NftDisplaySeed } from "@/hooks/game/useNftDisplayMap";

/**
 * Resolve Genesis NFT display (image + traits) for forum authors.
 * Owned inventory seeds first; non-owned tokenIds fetch public metadata only when
 * `metadataUrlForToken` allows it (Testnet immediate reveal / post-reveal Mainnet).
 */
export function useForumAuthorDisplayMap(
  tokenIds: readonly number[],
  ownedNfts: readonly OwnedGenesisNft[],
) {
  const seeds = useMemo((): NftDisplaySeed[] => {
    const ownedById = new Map(ownedNfts.map((n) => [n.tokenId, n]));
    const unique = [...new Set(tokenIds.filter((id) => Number.isFinite(id) && id > 0))];
    return unique.map((tokenId) => {
      const nft = ownedById.get(tokenId);
      return {
        tokenId,
        side: nft?.side,
        gameplayClass: nft?.gameplayClass,
        image: nft?.image,
      };
    });
  }, [tokenIds, ownedNfts]);

  return useNftDisplayMap(seeds);
}
