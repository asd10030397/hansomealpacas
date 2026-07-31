import { describe, expect, it } from "vitest";
import { TickMath } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import {
  amountsForLiquidity,
  computeEconomicLockDistribution,
} from "@/lib/hansome-score/lp/position-value";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

describe("amountsForLiquidity", () => {
  it("returns both sides when in range", () => {
    const sqrt = BigInt(TickMath.getSqrtRatioAtTick(0).toString());
    const r = amountsForLiquidity({
      liquidity: 1_000_000n,
      tickLower: -100,
      tickUpper: 100,
      sqrtPriceX96: sqrt,
    });
    expect(r).not.toBeNull();
    expect(r!.amount0 > 0n).toBe(true);
    expect(r!.amount1 > 0n).toBe(true);
  });

  it("returns only amount0 below range", () => {
    const sqrt = BigInt(TickMath.getSqrtRatioAtTick(-200).toString());
    const r = amountsForLiquidity({
      liquidity: 1_000_000n,
      tickLower: -100,
      tickUpper: 100,
      sqrtPriceX96: sqrt,
    });
    expect(r!.amount0 > 0n).toBe(true);
    expect(r!.amount1).toBe(0n);
  });
});

describe("computeEconomicLockDistribution", () => {
  function pos(
    id: string,
    lock: V4PositionInfo["lockState"],
    valueUsd: number,
  ): V4PositionInfo {
    const locked = lock.startsWith("LOCKED");
    return {
      positionNftId: id,
      owner: "0x1",
      ownerLabel: null,
      lockerName: null,
      lockerAddress: null,
      lockState: lock,
      lockStateDisplay: locked
        ? "LOCKED — VERIFIED ON-CHAIN"
        : "UNLOCKED / EOA-CONTROLLED",
      unlockTimestamp: null,
      unlockDateUtc: null,
      lockCreatedAt: null,
      lockTxHash: null,
      liquidity: "1",
      amount0Raw: "1",
      amount1Raw: "1",
      valueUsd,
      poolId: "0xpool",
      currency0: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      currency1: "0x0000000000000000000000000000000000000000",
      fee: 3000,
      tickSpacing: 60,
      tickLower: 0,
      tickUpper: 100,
      currentTick: 50,
      inRange: true,
      removableByEoa: !locked,
      evidenceLevel: "on_chain_verified",
      dataSource: "test",
    };
  }

  it("never uses position counts — weights by USD", () => {
    const dist = computeEconomicLockDistribution({
      positions: [
        pos("47299", "LOCKED_VERIFIED_ONCHAIN", 10_000),
        pos("357867", "UNLOCKED_EOA_CONTROLLED", 4_000),
        pos("142938", "UNLOCKED_EOA_CONTROLLED", 2_000),
      ],
      poolLiquidityUsd: 16_000,
    });
    expect(dist.available).toBe(true);
    expect(dist.method).toBe("token_amounts");
    expect(dist.lockedPct).toBeCloseTo(62.5, 5);
    expect(dist.unlockedPct).toBeCloseTo(37.5, 5);
    expect(dist.lockedUsd).toBe(10_000);
    expect(dist.unlockedUsd).toBe(6_000);
    // Not 1/3 ≈ 33%
    expect(dist.lockedPct).not.toBeCloseTo(100 / 3, 0);
  });

  it("refuses % when pool TVL does not reconcile", () => {
    const dist = computeEconomicLockDistribution({
      positions: [
        pos("1", "LOCKED_VERIFIED_ONCHAIN", 100),
        pos("2", "UNLOCKED_EOA_CONTROLLED", 100),
      ],
      poolLiquidityUsd: 50_000,
    });
    expect(dist.available).toBe(false);
    expect(dist.lockedUsd).toBe(100);
    expect(dist.unlockedUsd).toBe(100);
    expect(dist.reason ?? "").toMatch(/reconcile/i);
  });

  it("refuses when any material position lacks USD", () => {
    const mixed = pos("1", "LOCKED_VERIFIED_ONCHAIN", 1000);
    const missing = { ...pos("2", "UNLOCKED_EOA_CONTROLLED", 0), valueUsd: null };
    const dist = computeEconomicLockDistribution({
      positions: [mixed, missing],
      poolLiquidityUsd: 1000,
    });
    expect(dist.available).toBe(false);
  });

  it("sanity: JSBI tick math still loads", () => {
    expect(JSBI.toNumber(JSBI.BigInt(3))).toBe(3);
  });
});
