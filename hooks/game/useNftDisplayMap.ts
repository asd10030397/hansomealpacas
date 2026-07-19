"use client";

import { useEffect, useMemo, useState } from "react";
import {
  enrichNftDisplayImage,
  resolveNftDisplaySync,
  type NftDisplayIdentity,
} from "@/lib/game/nftDisplay";
import type { GameplayClass, NftSide } from "@/types/game";

export type NftDisplaySeed = {
  tokenId: number;
  side?: NftSide | null;
  gameplayClass?: GameplayClass | null;
  image?: string | null;
};

/**
 * Resolve display identity (image + class title) for a set of token IDs.
 * Prefers provided seeds (owned inventory), then metadata URI, then fallbacks.
 */
export function useNftDisplayMap(seeds: NftDisplaySeed[]): Map<number, NftDisplayIdentity> {
  const key = useMemo(
    () =>
      seeds
        .map(
          (s) =>
            `${s.tokenId}:${s.side ?? ""}:${s.gameplayClass ?? ""}:${s.image ?? ""}`,
        )
        .sort()
        .join("|"),
    [seeds],
  );

  const initial = useMemo(() => {
    const map = new Map<number, NftDisplayIdentity>();
    for (const seed of seeds) {
      map.set(seed.tokenId, resolveNftDisplaySync(seed));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by `key`
  }, [key]);

  const [map, setMap] = useState(initial);

  useEffect(() => {
    setMap(initial);
    let cancelled = false;
    void (async () => {
      const next = new Map(initial);
      await Promise.all(
        [...initial.values()].map(async (base) => {
          const enriched = await enrichNftDisplayImage(base);
          next.set(base.tokenId, enriched);
        }),
      );
      if (!cancelled) setMap(new Map(next));
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return map;
}
