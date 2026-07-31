import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearLpDiscoveryCacheTestKv,
  clearPositionCacheForTests,
  getCachedPositionIds,
  setCachedPositionIds,
} from "@/lib/hansome-score/lp/position-cache";
import { HANSOME_KNOWN_POSITION_SEEDS } from "@/lib/hansome-score/constants";
import { knownPositionSeeds } from "@/lib/hansome-score/labels";
import { HANSOME_TOKEN } from "@/lib/hansome-score/constants";

describe("LP known-first / position cache", () => {
  beforeEach(() => {
    clearPositionCacheForTests();
    clearLpDiscoveryCacheTestKv();
  });

  afterEach(() => {
    clearPositionCacheForTests();
    clearLpDiscoveryCacheTestKv();
  });

  it("HANSOME seeds include the three known Position NFTs", () => {
    const seeds = knownPositionSeeds(HANSOME_TOKEN);
    expect(seeds.map(String).sort()).toEqual(
      [...HANSOME_KNOWN_POSITION_SEEDS].map(String).sort(),
    );
    expect(seeds.map(String)).toEqual(
      expect.arrayContaining(["47299", "357867", "142938"]),
    );
  });

  it("caches position IDs for cheap revalidation without implying exhaustive complete", () => {
    setCachedPositionIds(4663, HANSOME_TOKEN, [47299n, 357867n, 142938n], {
      exhaustiveComplete: false,
    });
    const hit = getCachedPositionIds(4663, HANSOME_TOKEN);
    expect(hit).not.toBeNull();
    expect(hit!.positionIds).toEqual(["47299", "142938", "357867"]);
    expect(hit!.exhaustiveComplete).toBe(false);
  });

  it("marks exhaustiveComplete only when set", () => {
    setCachedPositionIds(4663, HANSOME_TOKEN, ["47299"], {
      exhaustiveComplete: true,
    });
    expect(getCachedPositionIds(4663, HANSOME_TOKEN)?.exhaustiveComplete).toBe(
      true,
    );
  });
});
