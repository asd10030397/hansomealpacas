import { describe, expect, it } from "vitest";
import { analyzeCreatorBehaviour } from "@/lib/hansome-score/creator";
import { aggregateLockStates } from "@/lib/hansome-score/lp/detect";
import { computeStructuralScore } from "@/lib/hansome-score/score";
import { LP_LOCK_STATE_DISPLAY, POOL_MANAGER_ADDRESS } from "@/lib/hansome-score/constants";
import type { V4PositionInfo } from "@/lib/hansome-score/types";
import regressionSet from "@/lib/hansome-score/__fixtures__/regression-set.json";

const SUPPLY = 1_000_000_000n * 10n ** 18n;
const DEPLOYER = "0x3333333333333333333333333333333333333333";
const EOA = "0x4444444444444444444444444444444444444444";

function pos(partial: Partial<V4PositionInfo> & { positionNftId: string }): V4PositionInfo {
  return {
    owner: null,
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState: "UNABLE_TO_DETERMINE",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNABLE_TO_DETERMINE,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1",
    amount0Raw: null,
    amount1Raw: null,
    poolId: null,
    currency0: null,
    currency1: null,
    fee: null,
    tickSpacing: null,
    tickLower: null,
    tickUpper: null,
    currentTick: null,
    inRange: null,
    removableByEoa: null,
    evidenceLevel: "unavailable",
    dataSource: "test",
    ...partial,
  };
}

describe("Week 2A creator behaviour indexing", () => {
  it("marks incomplete when pagination is truncated — keeps provisional path", () => {
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [],
      paginationComplete: false,
      pagesFetched: 40,
    });
    expect(r.available).toBe(false);
    expect(r.status).toBe("incomplete");
  });

  it("incomplete index still exposes observed sell counts for UI (Score stays provisional)", () => {
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [
        {
          from: DEPLOYER,
          to: "0x2222222222222222222222222222222222222222",
          valueRaw: (10n ** 18n).toString(),
          blockNumber: 1,
          timestamp: null,
          txHash: "0x1",
          toIsContract: false,
          method: null,
        },
      ],
      paginationComplete: false,
      pagesFetched: 6,
    });
    expect(r.available).toBe(false);
    expect(r.status).toBe("incomplete");
    expect(r.outboundTransferCount).toBe(1);
    expect(r.sellTransferCount).toBe(0);
    expect(r.dumpDetected).toBe(false);
  });

  it("clears provisional when fully indexed with no dumps", () => {
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [
        {
          from: "0x1111111111111111111111111111111111111111",
          to: DEPLOYER,
          valueRaw: (10n ** 18n).toString(),
          blockNumber: 1,
          timestamp: null,
          txHash: "0x1",
          toIsContract: false,
          method: null,
        },
      ],
      paginationComplete: true,
      pagesFetched: 1,
    });
    expect(r.available).toBe(true);
    expect(r.dumpDetected).toBe(false);
    expect(r.transferThenSellDetected).toBe(false);
  });

  it("detects large creator sell >5% supply to PoolManager", () => {
    const sell = (60n * 10n ** 6n) * 10n ** 18n; // 6% of 1B
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [
        {
          from: DEPLOYER,
          to: POOL_MANAGER_ADDRESS,
          valueRaw: sell.toString(),
          blockNumber: 2,
          timestamp: null,
          txHash: "0xdump",
          toIsContract: true,
          method: "swap",
        },
      ],
      paginationComplete: true,
      pagesFetched: 1,
    });
    expect(r.available).toBe(true);
    expect(r.dumpDetected).toBe(true);
    expect(r.creatorSellPctOfSupply).toBeGreaterThan(5);
  });

  it("detects transfer-then-sell pattern", () => {
    const chunk = (30n * 10n ** 6n) * 10n ** 18n; // 3%
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [
        {
          from: DEPLOYER,
          to: EOA,
          valueRaw: chunk.toString(),
          blockNumber: 1,
          timestamp: null,
          txHash: "0xa",
          toIsContract: false,
          method: null,
        },
        {
          from: EOA,
          to: POOL_MANAGER_ADDRESS,
          valueRaw: chunk.toString(),
          blockNumber: 2,
          timestamp: null,
          txHash: "0xb",
          toIsContract: true,
          method: "swap",
        },
      ],
      paginationComplete: true,
      pagesFetched: 1,
    });
    expect(r.available).toBe(true);
    expect(r.dumpDetected).toBe(false);
    expect(r.transferThenSellDetected).toBe(true);
  });

  it("does not invent dumps when fetch failed", () => {
    const r = analyzeCreatorBehaviour({
      deployer: DEPLOYER,
      totalSupply: SUPPLY,
      transfers: [],
      paginationComplete: false,
      fetchFailed: true,
    });
    expect(r.available).toBe(false);
    expect(r.dumpDetected).toBe(false);
  });
});

describe("Week 2A multi-position aggregate", () => {
  it("never reports fully LOCKED when locked + EOA-removable coexist", () => {
    const aggregate = aggregateLockStates([
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        liquidity: "1000",
      }),
      pos({
        positionNftId: "357867",
        lockState: "UNLOCKED_EOA_CONTROLLED",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
        removableByEoa: true,
        liquidity: "500",
      }),
    ]);
    expect(aggregate).toBe("MIXED");
  });

  it("stays LOCKED when only verified locked positions have liquidity", () => {
    const aggregate = aggregateLockStates([
      pos({
        positionNftId: "1",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        liquidity: "1000",
      }),
      pos({
        positionNftId: "2",
        lockState: "UNLOCKED_EOA_CONTROLLED",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
        removableByEoa: true,
        liquidity: "0",
      }),
    ]);
    expect(aggregate).toBe("LOCKED_VERIFIED_ONCHAIN");
  });

  it("MIXED LP applies −8 in Score (not full unlocked −20)", () => {
    const result = computeStructuralScore({
      totalSupply: SUPPLY,
      topHolders: [],
      deployer: DEPLOYER,
      deployerBalance: 0n,
      contractVerified: true,
      lpLockState: "MIXED",
      poolManagerBalance: 100n,
      contractRisk: {
        status: "analyzed",
        mintable: false,
        honeypot: false,
        buyTaxBps: 0,
        sellTaxBps: 0,
        transferTaxBps: 0,
        modifiableTax: false,
        pausable: false,
        blacklistOrWhitelist: false,
        isProxy: false,
        hasOwnerAdmin: false,
        privilegedBurn: false,
        findings: [],
        goplusSupplement: null,
        detail: "clean",
      },
      relationship: {
        equalBalanceClusterSize: 0,
        equalBalanceClusterAddresses: [],
        deployerInEqualBalanceCluster: false,
        sharedFundingCount: 0,
        sharedFundingAddresses: [],
        sharedFundingFunder: null,
        deployerFundedCount: 0,
        deployerFundedAddresses: [],
        sameBlockEarlyBuyCount: 0,
        sameBlockEarlyBuyAddresses: [],
      },
      creatorBehaviourAvailable: true,
      creatorDumpDetected: false,
      creatorTransferThenSellDetected: false,
    });
    expect(result.categoryTotals.liquidity_ownership).toBe(8);
    expect(result.incompleteCategories).not.toContain("creator_behaviour");
  });
});

describe("Week 2A regression fixture", () => {
  it("includes HANSOME and at least 10 tokens", () => {
    expect(regressionSet.version).toBeTruthy();
    expect(regressionSet.tokens.length).toBeGreaterThanOrEqual(10);
    const hansome = regressionSet.tokens.find(
      (t) =>
        t.address.toLowerCase() ===
        "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875".toLowerCase(),
    );
    expect(hansome).toBeTruthy();
    expect(hansome!.required).toBe(true);
  });

  it("documents expected category behaviours for HANSOME", () => {
    const hansome = regressionSet.tokens.find(
      (t) =>
        t.address.toLowerCase() ===
        "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875".toLowerCase(),
    )!;
    expect(hansome.expect.creatorMayClearProvisional).toBe(true);
    expect(hansome.expect.lockAggregate).toBe("MIXED");
    expect(hansome.expect.requiredPositionIds).toEqual(
      expect.arrayContaining(["47299", "357867", "142938"]),
    );
    expect(hansome.expect.mustFailIfOnlyTitan47299).toBe(true);
  });
});
