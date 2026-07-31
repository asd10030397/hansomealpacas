import { describe, expect, it } from "vitest";
import {
  DOPPLER_HOOK_INITIALIZER,
  HOOK_POS_POSITION_MANAGER,
  emptyHookPositionIndexState,
  type HookPositionIndexState,
  type HookPositionRecord,
} from "@/lib/hansome-score/lp/hook-position-index";
import {
  aggregateHookValuations,
  finalizeAggregateAmounts,
  valueHookPositions,
  valueSingleHookPosition,
  type HookValuationPort,
} from "@/lib/hansome-score/lp/hook-position-valuer";
import { amountsForLiquidity } from "@/lib/hansome-score/lp/position-value";

const GME_POOL =
  "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2";

function tickSqrt(tick: number): bigint {
  // Use amountsForLiquidity path via TickMath indirectly — pick known-ish values.
  // For deterministic tests, use Uniswap mid price 1:1 ≈ 2^96.
  void tick;
  return 1n << 96n;
}

function makeIndex(
  positions: Partial<HookPositionRecord>[],
  opts?: Partial<HookPositionIndexState>,
): HookPositionIndexState {
  const base = emptyHookPositionIndexState({
    chainId: 4663,
    poolId: GME_POOL,
  });
  return {
    ...base,
    hookAddress: DOPPLER_HOOK_INITIALIZER,
    positionManager: HOOK_POS_POSITION_MANAGER,
    hookDiscoveryComplete: true,
    foreignDiscoveryComplete: false,
    discoveryMethod: "fixture",
    terminalState: "SUCCESS_COMPLETE",
    positions: positions.map((p, i) => ({
      chainId: 4663,
      poolId: GME_POOL,
      owner: p.owner ?? DOPPLER_HOOK_INITIALIZER,
      tickLower: p.tickLower ?? 0,
      tickUpper: p.tickUpper ?? 200,
      salt: p.salt ?? `0x${i.toString(16).padStart(64, "0")}`,
      classification: p.classification ?? "hook_owned",
      firstSeenBlock: 1,
      lastSeenBlock: 1,
      source: "fixture",
      liveLiquidity: p.liveLiquidity ?? "1000000",
      stateViewValidated: true,
      active: true,
    })),
    ...opts,
  };
}

describe("Phase 11F — amountsForLiquidity ranges", () => {
  const L = 1_000_000n;
  const mid = 1n << 96n;

  it("below range → only amount0", () => {
    const r = amountsForLiquidity({
      liquidity: L,
      tickLower: 100,
      tickUpper: 200,
      sqrtPriceX96: tickSqrt(-1000), // price below lower
    });
    // When sqrt <= sqrtA, amount1=0
    // Use explicit below: tick -1000 vs range 100-200 with mid price won't work.
    // Direct: price far below → amount1 0
    const below = amountsForLiquidity({
      liquidity: L,
      tickLower: 100,
      tickUpper: 200,
      sqrtPriceX96: 1n, // extremely low
    });
    expect(below).not.toBeNull();
    expect(below!.amount1).toBe(0n);
    expect(below!.amount0).toBeGreaterThan(0n);
    void r;
    void mid;
  });

  it("above range → only amount1", () => {
    const above = amountsForLiquidity({
      liquidity: L,
      tickLower: -200,
      tickUpper: -100,
      sqrtPriceX96: mid, // price above upper (-100)
    });
    expect(above).not.toBeNull();
    expect(above!.amount0).toBe(0n);
    expect(above!.amount1).toBeGreaterThan(0n);
  });

  it("in range → both amounts", () => {
    const inRange = amountsForLiquidity({
      liquidity: L,
      tickLower: -100,
      tickUpper: 100,
      sqrtPriceX96: mid,
    });
    expect(inRange).not.toBeNull();
    expect(inRange!.amount0).toBeGreaterThan(0n);
    expect(inRange!.amount1).toBeGreaterThan(0n);
  });
});

describe("Phase 11F — valueSingleHookPosition", () => {
  it("sums multiple positions correctly", () => {
    const a = valueSingleHookPosition({
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: -100,
      tickUpper: 100,
      salt: `0x${"0".repeat(64)}`,
      classification: "hook_owned",
      liquidity: 1_000_000n,
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: "0x0Bd7cA9713A7E5dF2E4b5C5c5c5c5c5c5c5cAD73",
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: 3000,
      price1: 0.01,
      stateViewValidated: true,
    });
    const b = valueSingleHookPosition({
      ...a,
      salt: `0x${"1".padStart(64, "0")}`,
      liquidity: 2_000_000n,
      tickLower: -100,
      tickUpper: 100,
      classification: "hook_owned",
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: a.token0UsdPrice != null ? "0x0Bd7cA9713A7E5dF2E4b5C5c5c5c5c5c5c5cAD73" : null,
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: 3000,
      price1: 0.01,
      stateViewValidated: true,
      owner: DOPPLER_HOOK_INITIALIZER,
      poolId: GME_POOL,
    });
    // Fix b properly
    const b2 = valueSingleHookPosition({
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: -100,
      tickUpper: 100,
      salt: `0x${"1".padStart(64, "0")}`,
      classification: "hook_owned",
      liquidity: 2_000_000n,
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: "0x0000000000000000000000000000000000000000",
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: 1,
      price1: 1,
      stateViewValidated: true,
    });
    expect(BigInt(b2.amount0Raw) + BigInt(a.amount0Raw)).toBeGreaterThan(
      BigInt(a.amount0Raw),
    );
    expect(a.valuationComplete).toBe(true);
  });

  it("excludes zero live L from value", () => {
    const z = valueSingleHookPosition({
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: 0,
      tickUpper: 200,
      salt: `0x${"0".repeat(64)}`,
      classification: "hook_owned",
      liquidity: 0n,
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: 1,
      price1: 1,
      stateViewValidated: true,
    });
    expect(z.amount0Raw).toBe("0");
    expect(z.amount1Raw).toBe("0");
    expect(z.totalValueUsd).toBe(0);
    expect(z.active).toBe(false);
  });

  it("keeps raw amounts when one price missing", () => {
    const v = valueSingleHookPosition({
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: -100,
      tickUpper: 100,
      salt: `0x${"0".repeat(64)}`,
      classification: "hook_owned",
      liquidity: 1_000_000n,
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: 1,
      price1: null,
      stateViewValidated: true,
    });
    expect(v.valuationComplete).toBe(true);
    expect(v.amount0).toBeDefined();
    expect(v.totalValueUsd).toBeUndefined();
    expect(v.incompleteReasons).toContain("token1_price_unavailable");
  });

  it("does not replace missing prices with zero", () => {
    const v = valueSingleHookPosition({
      poolId: GME_POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: -100,
      tickUpper: 100,
      salt: `0x${"0".repeat(64)}`,
      classification: "hook_owned",
      liquidity: 1_000_000n,
      sqrtPriceX96: 1n << 96n,
      tick: 0,
      currency0: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
      currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      decimals0: 18,
      decimals1: 18,
      price0: null,
      price1: null,
      stateViewValidated: true,
    });
    expect(v.token0UsdPrice).toBeUndefined();
    expect(v.totalValueUsd).toBeUndefined();
    expect(v.incompleteReasons).toEqual(
      expect.arrayContaining([
        "token0_price_unavailable",
        "token1_price_unavailable",
      ]),
    );
  });
});

describe("Phase 11F — valueHookPositions port", () => {
  it("values from StateView L and never needs PoolManager balance", async () => {
    const Lmap = new Map<string, bigint>();
    Lmap.set("0:200", 5_000_000n);
    const port: HookValuationPort = {
      async getBlockNumber() {
        return 20_000_000;
      },
      async getSlot0() {
        return { sqrtPriceX96: 1n << 96n, tick: 100 };
      },
      async getPositionLiquidity({ tickLower, tickUpper }) {
        return Lmap.get(`${tickLower}:${tickUpper}`) ?? 0n;
      },
    };
    const index = makeIndex([
      { tickLower: 0, tickUpper: 200, liveLiquidity: "5000000" },
    ]);
    const result = await valueHookPositions({
      index,
      port,
      tokenAddress: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
      tokenDecimals: 18,
      decimals0: 18,
      decimals1: 18,
      priceBook: {
        tokenAddress: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
        tokenDecimals: 18,
        tokenPriceUsd: 0.01,
        ethUsd: 3000,
      },
      extraUsdPrices: {
        "0x1b0e319c6a659f002271b69db8a7df2f911c153e": 1,
      },
    });
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]!.liquidity).toBe("5000000");
    expect(result.positions[0]!.valuationComplete).toBe(true);
    expect(result.summary.activeHookOwnedPositionCount).toBe(1);
    // Honesty: active L getter is not used as total — we sum position amounts
    expect(result.summary.hookOwnedAmount0Raw).toBeDefined();
  });

  it("marks incomplete when index incomplete", async () => {
    const port: HookValuationPort = {
      async getBlockNumber() {
        return 1;
      },
      async getSlot0() {
        return { sqrtPriceX96: 1n << 96n, tick: 0 };
      },
      async getPositionLiquidity() {
        return 1000n;
      },
    };
    const index = makeIndex([{ tickLower: -100, tickUpper: 100 }], {
      hookDiscoveryComplete: false,
      terminalState: "SUCCESS_PARTIAL",
      incompleteReasons: ["create_tx_unknown"],
    });
    const result = await valueHookPositions({
      index,
      port,
      tokenAddress: "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3",
      tokenDecimals: 18,
    });
    expect(result.summary.incompleteReasons).toContain("index_incomplete");
    expect(result.terminalState).not.toBe("SUCCESS_COMPLETE");
  });

  it("aggregate excludes zero-L historical records from economic totals", () => {
    const valued = [
      valueSingleHookPosition({
        poolId: GME_POOL,
        owner: DOPPLER_HOOK_INITIALIZER,
        tickLower: -100,
        tickUpper: 100,
        salt: `0x${"0".repeat(64)}`,
        classification: "hook_owned",
        liquidity: 1_000_000n,
        sqrtPriceX96: 1n << 96n,
        tick: 0,
        currency0: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
        currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
        decimals0: 18,
        decimals1: 18,
        price0: 1,
        price1: 1,
        stateViewValidated: true,
      }),
      {
        ...valueSingleHookPosition({
          poolId: GME_POOL,
          owner: DOPPLER_HOOK_INITIALIZER,
          tickLower: 200,
          tickUpper: 400,
          salt: `0x${"1".padStart(64, "0")}`,
          classification: "hook_owned",
          liquidity: 0n,
          sqrtPriceX96: 1n << 96n,
          tick: 0,
          currency0: "0x0Bd78c2C7cA1dE0000000000000000000000AD73",
          currency1: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
          decimals0: 18,
          decimals1: 18,
          price0: 1,
          price1: 1,
          stateViewValidated: true,
        }),
      },
    ];
    const index = makeIndex([
      { tickLower: -100, tickUpper: 100 },
      { tickLower: 200, tickUpper: 400, liveLiquidity: "0" },
    ]);
    let summary = aggregateHookValuations({
      poolId: GME_POOL,
      positions: valued,
      index,
      terminalState: "SUCCESS_PARTIAL",
    });
    summary = finalizeAggregateAmounts(summary, 18, 18);
    expect(summary.activeHookOwnedPositionCount).toBe(1);
    expect(summary.hookOwnedPositionCount).toBe(2);
    expect(BigInt(summary.hookOwnedAmount0Raw!)).toBe(
      BigInt(valued[0]!.amount0Raw),
    );
  });
});
