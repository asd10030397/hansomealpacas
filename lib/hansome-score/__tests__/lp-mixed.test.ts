import { describe, expect, it } from "vitest";
import {
  computeLockDistribution,
  computeTokenAggregate,
  countPositionLocks,
} from "@/lib/hansome-score/lp/aggregate";
import { computeEconomicLockDistribution } from "@/lib/hansome-score/lp/position-value";
import { LP_AGGREGATE_STATE_DISPLAY, LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import type { V4PositionInfo } from "@/lib/hansome-score/types";
import hansomeLp from "@/lib/hansome-score/__fixtures__/hansome-lp-positions.json";

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
    poolId: hansomeLp.poolId,
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: hansomeLp.token,
    fee: 500,
    tickSpacing: 10,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: null,
    evidenceLevel: "unavailable",
    dataSource: "test",
    ...partial,
  };
}

describe("LP aggregate accuracy — one locked ≠ locked liquidity", () => {
  it("HANSOME fixture requires unlocked positions beyond Titan #47299", () => {
    expect(hansomeLp.requiredAggregate).toBe("MIXED");
    expect(hansomeLp.mustFailIfOnly).toContain("47299");
    const unlocked = hansomeLp.positions.filter((p) => p.removableByEoa);
    expect(unlocked.length).toBeGreaterThanOrEqual(2);
    expect(unlocked.map((p) => p.positionNftId)).toEqual(
      expect.arrayContaining(["357867", "142938"]),
    );
  });

  it("single Titan lock alone must NOT aggregate to ALL_LOCKED when discovery incomplete", () => {
    const onlyLocked = [
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        liquidity: "80044131519596909069874",
        tickLower: 195680,
        tickUpper: 210680,
      }),
    ];
    const r = computeTokenAggregate({
      positions: onlyLocked,
      poolDetected: true,
      discoveryComplete: false,
    });
    expect(r.aggregate).toBe("UNKNOWN_INCOMPLETE");
    expect(r.aggregate).not.toBe("ALL_LOCKED");
    expect(r.display).toBe(LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE);
  });

  it("HANSOME locked + removable positions → MIXED", () => {
    const positions = hansomeLp.positions.map((p) =>
      pos({
        positionNftId: p.positionNftId,
        owner: p.owner,
        lockState: p.expectedLock as V4PositionInfo["lockState"],
        lockStateDisplay: LP_LOCK_STATE_DISPLAY[p.expectedLock as keyof typeof LP_LOCK_STATE_DISPLAY],
        removableByEoa: p.removableByEoa,
        tickLower: p.tickLower,
        tickUpper: p.tickUpper,
        liquidity: "1000",
        fee: p.fee,
      }),
    );
    const r = computeTokenAggregate({
      positions,
      poolDetected: true,
      discoveryComplete: true,
    });
    expect(r.aggregate).toBe("MIXED");
    expect(r.display).toContain("MIXED");
    const counts = countPositionLocks(positions);
    expect(counts.locked).toBe(1);
    expect(counts.unlocked).toBe(2);
  });

  it("missing required unlocked seed fails the HANSOME LP regression gate", () => {
    const foundIds = new Set(["47299"]); // Titan only — the bug case
    const requiredUnlocked = hansomeLp.positions
      .filter((p) => p.removableByEoa)
      .map((p) => p.positionNftId);
    const missed = requiredUnlocked.filter((id) => !foundIds.has(id));
    expect(missed.length).toBeGreaterThan(0);
    // Gate: mustFailIfOnly
    expect(hansomeLp.mustFailIfOnly.every((id) => foundIds.has(id))).toBe(true);
    expect(missed).toEqual(expect.arrayContaining(["357867", "142938"]));
  });

  it("lock % unavailable without USD — never uses raw concentrated L", () => {
    const positions = [
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        tickLower: 195680,
        tickUpper: 210680,
        liquidity: "100",
      }),
      pos({
        positionNftId: "357867",
        lockState: "UNLOCKED_EOA_CONTROLLED",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
        removableByEoa: true,
        tickLower: 174810,
        tickUpper: 177620,
        liquidity: "200",
      }),
    ];
    const dist = computeLockDistribution(positions);
    expect(dist.available).toBe(false);
    expect(dist.method).toBeNull();
    expect(dist.lockedPct).toBeNull();
    expect(dist.unlockedPct).toBeNull();
    expect(dist.reason).toMatch(/pending economic valuation|token amounts|never used/i);
    // Must not fall back to L-weighted % (would be ~33% locked if L=100 vs 200)
    expect(dist.lockedPct).not.toBeCloseTo(100 / 3, 0);
  });

  it("economic lock % from token-amount USD when reconciled with pool", () => {
    const positions = [
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        tickLower: 195680,
        tickUpper: 210680,
        liquidity: "100",
        amount0Raw: "1",
        amount1Raw: "1",
        valueUsd: 10_000,
      }),
      pos({
        positionNftId: "357867",
        lockState: "UNLOCKED_EOA_CONTROLLED",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
        removableByEoa: true,
        tickLower: 174810,
        tickUpper: 177620,
        liquidity: "200",
        amount0Raw: "1",
        amount1Raw: "1",
        valueUsd: 4_000,
      }),
      pos({
        positionNftId: "142938",
        lockState: "UNLOCKED_EOA_CONTROLLED",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
        removableByEoa: true,
        tickLower: 180000,
        tickUpper: 190000,
        liquidity: "50",
        amount0Raw: "1",
        amount1Raw: "1",
        valueUsd: 2_000,
      }),
    ];
    const dist = computeEconomicLockDistribution({
      positions,
      poolLiquidityUsd: 16_000,
    });
    expect(dist.available).toBe(true);
    expect(dist.method).toBe("token_amounts");
    expect(dist.reconciledWithPool).toBe(true);
    expect(dist.lockedUsd).toBe(10_000);
    expect(dist.unlockedUsd).toBe(6_000);
    expect(dist.lockedPct).toBeCloseTo(62.5, 5);
    expect(dist.unlockedPct).toBeCloseTo(37.5, 5);
    // Not position-count 1/3 and not raw-L 100/(100+200+50)
    expect(dist.lockedPct).not.toBeCloseTo(100 / 3, 0);
    expect(dist.lockedPct).not.toBeCloseTo((100 / 350) * 100, 0);
  });

  it("ALL_LOCKED only when every material position locked AND discovery complete", () => {
    const r = computeTokenAggregate({
      positions: [
        pos({
          positionNftId: "1",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
          removableByEoa: false,
        }),
        pos({
          positionNftId: "2",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
          removableByEoa: false,
        }),
      ],
      poolDetected: true,
      discoveryComplete: true,
    });
    expect(r.aggregate).toBe("ALL_LOCKED");
  });
});
