import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetOwnedGenesisMetaCacheForTests,
  getOwnedGenesisInventoryRevision,
  getOwnedGenesisMeta,
  getOwnedGenesisMetaEpoch,
  hasFreshOwnedGenesisMeta,
  invalidateOwnedGenesisMeta,
  ownedGenesisMetaSourceKey,
  publishOwnedGenesisMeta,
  refreshOwnedGenesisInventory,
  setOwnedGenesisMeta,
  subscribeOwnedGenesisInventory,
  subscribeOwnedGenesisMeta,
} from "@/lib/game/ownedGenesisMetaCache";

describe("ownedGenesisMetaCache", () => {
  beforeEach(() => {
    __resetOwnedGenesisMetaCacheForTests();
  });

  it("treats URI / reveal changes as stale (NFT Reveal)", () => {
    const placeholder = ownedGenesisMetaSourceKey("ipfs://placeholder/1.json", false);
    const revealed = ownedGenesisMetaSourceKey("ipfs://revealed/1.json", true);

    setOwnedGenesisMeta(11, {
      image: "/a.png",
      identity: { side: "Alpaca", gameplayClass: "Guardian" },
      sourceKey: placeholder,
    });

    expect(hasFreshOwnedGenesisMeta(11, placeholder)).toBe(true);
    expect(hasFreshOwnedGenesisMeta(11, revealed)).toBe(false);
  });

  it("invalidates selected tokens and notifies subscribers", () => {
    setOwnedGenesisMeta(1, {
      image: "/1.png",
      identity: null,
      sourceKey: ownedGenesisMetaSourceKey("u1", false),
    });
    setOwnedGenesisMeta(2, {
      image: "/2.png",
      identity: null,
      sourceKey: ownedGenesisMetaSourceKey("u2", false),
    });

    let ticks = 0;
    const unsub = subscribeOwnedGenesisMeta(() => {
      ticks += 1;
    });
    const epochBefore = getOwnedGenesisMetaEpoch();

    invalidateOwnedGenesisMeta([1]);
    expect(getOwnedGenesisMeta(1)).toBeUndefined();
    expect(getOwnedGenesisMeta(2)).toBeDefined();
    expect(getOwnedGenesisMetaEpoch()).toBe(epochBefore + 1);
    expect(ticks).toBe(1);
    unsub();
  });

  it("refreshOwnedGenesisInventory clears meta and bumps inventory revision", () => {
    setOwnedGenesisMeta(5, {
      image: "/5.png",
      identity: null,
      sourceKey: ownedGenesisMetaSourceKey("u", false),
    });

    let inventoryTicks = 0;
    const unsub = subscribeOwnedGenesisInventory(() => {
      inventoryTicks += 1;
    });
    const revBefore = getOwnedGenesisInventoryRevision();

    refreshOwnedGenesisInventory();
    expect(getOwnedGenesisMeta(5)).toBeUndefined();
    expect(getOwnedGenesisInventoryRevision()).toBe(revBefore + 1);
    expect(inventoryTicks).toBe(1);
    unsub();
  });

  it("publishOwnedGenesisMeta notifies without clearing entries", () => {
    setOwnedGenesisMeta(9, {
      image: "/9.png",
      identity: null,
      sourceKey: ownedGenesisMetaSourceKey("u", true),
    });
    const epochBefore = getOwnedGenesisMetaEpoch();
    publishOwnedGenesisMeta();
    expect(getOwnedGenesisMetaEpoch()).toBe(epochBefore + 1);
    expect(getOwnedGenesisMeta(9)?.image).toBe("/9.png");
  });
});
