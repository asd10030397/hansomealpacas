import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { HANSOME_TOKEN } from "@/lib/hansome-score/constants";
import {
  clearLpDiscoveryCacheTestKv,
  clearPositionCacheForTests,
  getCachedPositionIds,
  getLpDiscoveryCacheMemory,
  loadLpDiscoveryCache,
  lpDiscoveryCacheContainsLockTruth,
  lpDiscoveryKvKey,
  persistLpDiscoveryCache,
  sanitizeLpDiscoveryCache,
  setCachedPositionIds,
  useLpDiscoveryCacheTestKv,
  type LpDiscoveryCache,
} from "@/lib/hansome-score/lp/position-cache";
import { knownPositionSeeds } from "@/lib/hansome-score/labels";

const CHAIN = 4663;
const FOX = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";

describe("LP discovery cache (persistent)", () => {
  let kv: Map<string, LpDiscoveryCache>;

  beforeEach(() => {
    clearPositionCacheForTests();
    kv = new Map();
    useLpDiscoveryCacheTestKv(kv);
  });

  afterEach(() => {
    clearPositionCacheForTests();
    clearLpDiscoveryCacheTestKv();
  });

  it("writes discovery inputs under scan:lp:{chainId}:{token}", async () => {
    const entry = await persistLpDiscoveryCache(CHAIN, HANSOME_TOKEN, {
      positionIds: [47299n, 357867n, 142938n],
      poolIds: ["0xabc"],
      versions: ["v4"],
      lockerCandidates: ["0x58daec3116aae6D93017bAAea7749052E8a04fA7"],
      exhaustiveComplete: false,
      knownVerifiedAt: 1_700_000_000_000,
    });

    expect(entry.version).toBe(1);
    expect(entry.positionIds).toEqual(["47299", "142938", "357867"]);
    expect(entry.versions).toEqual(["v4"]);
    expect(entry.exhaustiveComplete).toBe(false);
    expect(kv.has(lpDiscoveryKvKey(CHAIN, HANSOME_TOKEN))).toBe(true);

    const raw = kv.get(lpDiscoveryKvKey(CHAIN, HANSOME_TOKEN))!;
    expect(raw).not.toHaveProperty("lockState");
    expect(raw).not.toHaveProperty("lockedPct");
    expect(raw).not.toHaveProperty("aggregateState");
    expect(lpDiscoveryCacheContainsLockTruth(raw)).toBe(false);
  });

  it("hydrates across isolates (memory miss → KV hit)", async () => {
    await persistLpDiscoveryCache(CHAIN, FOX, {
      positionIds: ["111", "222"],
      poolIds: ["0xpool1"],
      versions: ["v3", "v4"],
      lockerCandidates: [],
      exhaustiveComplete: true,
      knownVerifiedAt: Date.now(),
    });

    // Simulate new Vercel isolate: empty memory, shared KV
    clearPositionCacheForTests();
    expect(getCachedPositionIds(CHAIN, FOX)).toBeNull();

    const loaded = await loadLpDiscoveryCache(CHAIN, FOX);
    expect(loaded).not.toBeNull();
    expect(loaded!.positionIds).toEqual(["111", "222"]);
    expect(loaded!.versions).toEqual(["v3", "v4"]);
    expect(loaded!.exhaustiveComplete).toBe(true);
    // Hydrated into memory for sync hot path
    expect(getCachedPositionIds(CHAIN, FOX)?.positionIds).toEqual([
      "111",
      "222",
    ]);
  });

  it("replaces position IDs on revalidation (drops stale)", async () => {
    await persistLpDiscoveryCache(CHAIN, HANSOME_TOKEN, {
      positionIds: ["47299", "999999", "357867"],
      replacePositionIds: true,
    });

    await persistLpDiscoveryCache(CHAIN, HANSOME_TOKEN, {
      positionIds: ["47299", "357867", "142938"],
      replacePositionIds: true,
    });

    const hit = await loadLpDiscoveryCache(CHAIN, HANSOME_TOKEN);
    expect(hit!.positionIds).toEqual(["47299", "142938", "357867"]);
    expect(hit!.positionIds).not.toContain("999999");
  });

  it("unions poolIds/versions/lockerCandidates without restoring dropped IDs", async () => {
    await persistLpDiscoveryCache(CHAIN, FOX, {
      positionIds: ["1", "2"],
      poolIds: ["0xaa"],
      versions: ["v4"],
      lockerCandidates: ["0x1111111111111111111111111111111111111111"],
    });

    await persistLpDiscoveryCache(CHAIN, FOX, {
      positionIds: ["2"],
      replacePositionIds: true,
      poolIds: ["0xbb"],
      versions: ["v2"],
      lockerCandidates: ["0x2222222222222222222222222222222222222222"],
    });

    const hit = getLpDiscoveryCacheMemory(CHAIN, FOX)!;
    expect(hit.positionIds).toEqual(["2"]);
    expect(hit.poolIds).toEqual(["0xaa", "0xbb"]);
    expect(hit.versions).toEqual(["v2", "v4"]);
    expect(hit.lockerCandidates).toHaveLength(2);
  });

  it("sanitize strips lock-classification payloads; never treats them as truth", () => {
    expect(
      lpDiscoveryCacheContainsLockTruth({
        positionIds: ["1"],
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockedPct: 100,
      }),
    ).toBe(true);

    const cleaned = sanitizeLpDiscoveryCache(
      {
        version: 1,
        positionIds: ["47299"],
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockedPct: 88,
        aggregateState: "ALL_LOCKED",
        poolIds: ["0xpool"],
        versions: ["v4"],
        lockerCandidates: [],
        exhaustiveComplete: false,
        knownVerifiedAt: null,
        updatedAt: Date.now(),
      },
      CHAIN,
      HANSOME_TOKEN,
    );

    expect(cleaned).not.toBeNull();
    expect(cleaned!.positionIds).toEqual(["47299"]);
    expect(cleaned!.poolIds).toEqual(["0xpool"]);
    expect(cleaned as object).not.toHaveProperty("lockState");
    expect(cleaned as object).not.toHaveProperty("lockedPct");
    expect(cleaned as object).not.toHaveProperty("aggregateState");
  });

  it("HANSOME seeds remain bootstrap only — FOX has no token-specific seeds", () => {
    expect(knownPositionSeeds(HANSOME_TOKEN).map(String).sort()).toEqual([
      "142938",
      "357867",
      "47299",
    ]);
    expect(knownPositionSeeds(FOX)).toEqual([]);
  });

  it("sync setCachedPositionIds still works for in-process tests", () => {
    setCachedPositionIds(CHAIN, HANSOME_TOKEN, [47299n], {
      exhaustiveComplete: false,
    });
    expect(getCachedPositionIds(CHAIN, HANSOME_TOKEN)?.positionIds).toEqual([
      "47299",
    ]);
  });

  it("exhaustive-style replace keeps only proven IDs (no unproven candidates)", async () => {
    await persistLpDiscoveryCache(CHAIN, FOX, {
      positionIds: ["111", "222", "333"],
      replacePositionIds: true,
    });
    // Simulate post-revalidation: only 222 still involves the token
    await persistLpDiscoveryCache(CHAIN, FOX, {
      positionIds: ["222"],
      replacePositionIds: true,
      exhaustiveComplete: true,
    });
    const hit = await loadLpDiscoveryCache(CHAIN, FOX);
    expect(hit!.positionIds).toEqual(["222"]);
    expect(hit!.exhaustiveComplete).toBe(true);
  });
});
