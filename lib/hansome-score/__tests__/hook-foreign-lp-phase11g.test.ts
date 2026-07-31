import { describe, expect, it } from "vitest";
import {
  DOPPLER_HOOK_INITIALIZER,
  HOOK_POS_POSITION_MANAGER,
  emptyHookPositionIndexState,
} from "@/lib/hansome-score/lp/hook-position-index";
import {
  classifyForeignOwner,
  positionOwnerKey,
  separateForeignLp,
} from "@/lib/hansome-score/lp/hook-foreign-lp";
import type { HookPositionValuation } from "@/lib/hansome-score/lp/hook-position-valuer";
import type { HookPositionValuationSummary } from "@/lib/hansome-score/lp/hook-position-valuer/types";

const POOL =
  "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2";
const OTHER = "0x1111111111111111111111111111111111111111";

function val(
  partial: Partial<HookPositionValuation> & {
    owner: string;
    classification: HookPositionValuation["classification"];
    liquidity: string;
  },
): HookPositionValuation {
  return {
    poolId: POOL,
    tickLower: 0,
    tickUpper: 200,
    salt: `0x${"0".repeat(64)}`,
    amount0Raw: "1000",
    amount1Raw: "2000",
    amount0: "0.000000000000001",
    amount1: "0.000000000000002",
    totalValueUsd: 10,
    valuationComplete: true,
    stateViewValidated: true,
    active: BigInt(partial.liquidity) > 0n,
    ...partial,
  };
}

function summary(
  over: Partial<HookPositionValuationSummary> = {},
): HookPositionValuationSummary {
  return {
    poolId: POOL,
    indexedPositionCount: 0,
    activePositionCount: 0,
    hookOwnedPositionCount: 0,
    activeHookOwnedPositionCount: 0,
    hookValuationComplete: true,
    foreignValuationComplete: false,
    priceDataComplete: true,
    hookOwnedAmount0: "1",
    hookOwnedAmount1: "2",
    ...over,
  };
}

describe("Phase 11G — classification by owner", () => {
  it("classifies hook owner", () => {
    expect(
      classifyForeignOwner({
        owner: DOPPLER_HOOK_INITIALIZER,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("hook_owned");
  });

  it("classifies PositionManager as foreign_posm", () => {
    expect(
      classifyForeignOwner({
        owner: HOOK_POS_POSITION_MANAGER,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("foreign_posm");
  });

  it("classifies other direct owners as foreign_other", () => {
    expect(
      classifyForeignOwner({
        owner: OTHER,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: HOOK_POS_POSITION_MANAGER,
      }),
    ).toBe("foreign_other");
  });

  it("keeps identical ticks/salt under different owners separate", () => {
    const k1 = positionOwnerKey({
      poolId: POOL,
      owner: DOPPLER_HOOK_INITIALIZER,
      tickLower: 100,
      tickUpper: 200,
      salt: `0x${"5".padStart(64, "0")}`,
    });
    const k2 = positionOwnerKey({
      poolId: POOL,
      owner: HOOK_POS_POSITION_MANAGER,
      tickLower: 100,
      tickUpper: 200,
      salt: `0x${"5".padStart(64, "0")}`,
    });
    expect(k1).not.toBe(k2);
  });
});

describe("Phase 11G — separation aggregates", () => {
  it("excludes foreign from Hook-owned totals", () => {
    const index = {
      ...emptyHookPositionIndexState({ chainId: 4663, poolId: POOL }),
      hookAddress: DOPPLER_HOOK_INITIALIZER,
      positionManager: HOOK_POS_POSITION_MANAGER,
      hookDiscoveryComplete: true,
      foreignDiscoveryComplete: true,
      positions: [],
    };
    const valuations = [
      val({
        owner: DOPPLER_HOOK_INITIALIZER,
        classification: "hook_owned",
        liquidity: "100",
        totalValueUsd: 100,
      }),
      val({
        owner: HOOK_POS_POSITION_MANAGER,
        classification: "foreign_posm",
        liquidity: "50",
        totalValueUsd: 40,
        salt: `0x${"1".padStart(64, "0")}`,
      }),
      val({
        owner: OTHER,
        classification: "foreign_other",
        liquidity: "25",
        totalValueUsd: 10,
        salt: `0x${"2".padStart(64, "0")}`,
      }),
    ];
    const sep = separateForeignLp({
      index,
      valuations,
      valuationSummary: summary({
        hookValuationComplete: true,
        foreignValuationComplete: true,
        hookOwnedValueUsd: 100,
      }),
    });
    expect(sep.hookOwned.valueUsd).toBe(100);
    expect(sep.foreignPosm.valueUsd).toBe(40);
    expect(sep.foreignOther.valueUsd).toBe(10);
    expect(sep.foreignTotalValueUsd).toBe(50);
    expect(sep.reconstructedPoolValueUsd).toBe(150);
    expect(sep.poolReconstructionComplete).toBe(true);
    expect(sep.hookShareOfReconstructedPool).toBeCloseTo(100 / 150);
  });

  it("pool share unavailable when foreign discovery incomplete", () => {
    const index = {
      ...emptyHookPositionIndexState({ chainId: 4663, poolId: POOL }),
      hookAddress: DOPPLER_HOOK_INITIALIZER,
      positionManager: HOOK_POS_POSITION_MANAGER,
      hookDiscoveryComplete: true,
      foreignDiscoveryComplete: false,
      positions: [],
    };
    const sep = separateForeignLp({
      index,
      valuations: [
        val({
          owner: DOPPLER_HOOK_INITIALIZER,
          classification: "hook_owned",
          liquidity: "100",
          totalValueUsd: 80,
        }),
      ],
      valuationSummary: summary({
        hookValuationComplete: true,
        foreignValuationComplete: false,
      }),
    });
    expect(sep.hookOwned.valueUsd).toBe(80);
    expect(sep.poolReconstructionComplete).toBe(false);
    expect(sep.hookShareOfReconstructedPool).toBeUndefined();
    expect(sep.incompleteReasons).toContain("foreign_discovery_incomplete");
  });

  it("excludes zero-liquidity historical records from economic totals", () => {
    const index = {
      ...emptyHookPositionIndexState({ chainId: 4663, poolId: POOL }),
      hookAddress: DOPPLER_HOOK_INITIALIZER,
      positionManager: HOOK_POS_POSITION_MANAGER,
      hookDiscoveryComplete: true,
      foreignDiscoveryComplete: false,
      positions: [],
    };
    const sep = separateForeignLp({
      index,
      valuations: [
        val({
          owner: DOPPLER_HOOK_INITIALIZER,
          classification: "hook_owned",
          liquidity: "0",
          totalValueUsd: 0,
        }),
        val({
          owner: DOPPLER_HOOK_INITIALIZER,
          classification: "hook_owned",
          liquidity: "10",
          totalValueUsd: 5,
          salt: `0x${"9".padStart(64, "0")}`,
        }),
      ],
      valuationSummary: summary(),
    });
    expect(sep.hookOwned.positionCount).toBe(2);
    expect(sep.hookOwned.activeCount).toBe(1);
    expect(sep.hookOwned.valueUsd).toBe(5);
  });
});
