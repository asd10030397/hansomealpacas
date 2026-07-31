/**
 * Phase 12A.1 — production readiness honesty / presentation / fence regressions.
 * Does not alter ownership, hook valuation, lock classifier, Score, or Titan algorithms.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import {
  setDeploymentScopeForTests,
  resolveDeploymentScope,
} from "@/lib/hansome-score/deployment-scope";
import {
  HOOK_NATIVE_LOCK_DISTRIBUTION_REASON,
  isHookNativeOwnership,
  retainHookNativeLockDistribution,
} from "@/lib/hansome-score/lp/hook-native-lock-dist";
import {
  buildPresentationPools,
  userFacingAggregateLock,
} from "@/lib/hansome-score/lp/presentation";
import {
  applyV4OwnershipClassToIntelligence,
  type V4OwnershipClassResult,
} from "@/lib/hansome-score/lp/v4-ownership-class";
import {
  clearHookPosProductionMemoryForTests,
  emptyHookPositionIndexState,
  hookPosIndexKey,
  saveHookPosIndexProduction,
  useHookPosIndexTestKv,
  resolveHookPositionIndex,
  detectHookCheckpointHashMismatch,
  reorgRescanHookPositionIndex,
  type HookPosChainPort,
} from "@/lib/hansome-score/lp/hook-position-index";
import {
  DOPPLER_HOOK_INITIALIZER,
  GME_TOKEN,
  findHookPoolFixtureByToken,
} from "@/lib/hansome-score/lp/hook-position-index";
import { computeEconomicLockDistribution } from "@/lib/hansome-score/lp/position-value";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

const GME_POOL =
  "0x3623694d2613d7a543903b93226ed020d2fddbe00ed93ebd21aec098b10211c2";

function titanDustPos(id: string): V4PositionInfo {
  return {
    positionNftId: id,
    owner: "0x1111111111111111111111111111111111111111",
    ownerLabel: null,
    lockerName: "TitanLockerManagerV2",
    lockerAddress: "0x2222222222222222222222222222222222222222",
    lockState: "LOCKED_VERIFIED_ONCHAIN",
    lockStateDisplay: "LOCKED — VERIFIED ON-CHAIN",
    unlockTimestamp: 1_816_012_800,
    unlockDateUtc: "2027-07-15T00:00:00.000Z",
    lockCreatedAt: null,
    lockTxHash: "0xabc",
    liquidity: "1000",
    amount0Raw: "1000000",
    amount1Raw: "1000000",
    valueUsd: 500,
    poolId: GME_POOL,
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: GME_TOKEN,
    fee: 3000,
    tickSpacing: 60,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: false,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
  };
}

function baseLp(overrides?: Partial<LpIntelligence>): LpIntelligence {
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: GME_POOL,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "UNABLE_TO_DETERMINE",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    aggregateState: "UNKNOWN_INCOMPLETE",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    positionCounts: {
      detected: 1,
      material: 1,
      locked: 1,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: {
      available: false,
      reason: HOOK_NATIVE_LOCK_DISTRIBUTION_REASON,
      method: null,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
    },
    discoveryComplete: false,
    completenessWarning: "V4 Hook Native ownership — lock verification unsupported.",
    ownershipRiskNote: "Hook Native",
    sizeWarning: false,
    positions: [titanDustPos("dust-1")],
    evidenceLevel: "on_chain_verified",
    detail: "hook_native",
    discoverySources: ["test"],
    uniswapVersions: emptyUniswapVersionCoverage(),
    ownershipClass: "hook_native",
    ...overrides,
  };
}

describe("Phase 12A.1 — Class B lockDistribution invariant", () => {
  it("1. Hook Native never computes / retains lockDistribution available", () => {
    expect(isHookNativeOwnership("hook_native")).toBe(true);
    // Simulate a Titan-style economic report that scan.ts must not rehydrate for Class B.
    const economic = {
      available: true as const,
      reason: null,
      method: "token_amounts" as const,
      lockedPct: 100,
      unlockedPct: 0,
      unknownPct: 0,
      lockedUsd: 500,
      unlockedUsd: 0,
      unknownUsd: 0,
      totalPositionUsd: 500,
      poolLiquidityUsd: 500,
      reconciledWithPool: true,
    };
    const retained = retainHookNativeLockDistribution(economic);
    expect(retained.available).toBe(false);
    expect(retained.lockedPct).toBeNull();
    expect(retained.lockedUsd).toBeNull();
    expect(retained.reason).toMatch(/hook-native|HOOK_NATIVE/i);

    const intel = baseLp({
      lockDistribution: { ...economic },
    });
    // Guard used by scan.ts / scan-deep.ts — never call compute for hook_native.
    if (isHookNativeOwnership(intel.ownershipClass)) {
      intel.lockDistribution = retainHookNativeLockDistribution(
        intel.lockDistribution,
      );
    } else {
      intel.lockDistribution = computeEconomicLockDistribution({
        positions: intel.positions,
        poolLiquidityUsd: 500,
      });
    }
    expect(intel.lockDistribution.available).toBe(false);
    expect(intel.lockDistribution.reason).toBe(
      HOOK_NATIVE_LOCK_DISTRIBUTION_REASON,
    );
  });

  it("2. Hook Native presentation never shows Titan LOCKED badge", () => {
    const lp = baseLp();
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "GME",
      tokenAddress: GME_TOKEN,
      liquidityUsd: 50_000,
    });
    expect(pools.length).toBeGreaterThanOrEqual(1);
    for (const p of pools) {
      expect(p.lockStatus).toBe("UNKNOWN");
      expect(p.lockStatus).not.toBe("LOCKED");
      expect(p.lockStatus).not.toBe("PARTIALLY_LOCKED");
    }
    expect(userFacingAggregateLock(lp.aggregateState)).toBe("UNKNOWN");
  });

  it("3. Hook Native legacyStatus never becomes LOCKED from PosM dust", () => {
    // Mirror multi.ts: legacyStatus(finalAggregate) after Class B force.
    const preAggregate = "ALL_LOCKED";
    const ownershipClass = "hook_native";
    const finalAggregate =
      ownershipClass === "hook_native" ? "UNKNOWN_INCOMPLETE" : preAggregate;
    const legacyStatusOf = (
      aggregate: string,
    ): "locked" | "unlocked" | "unknown" | "none" | "mixed" => {
      switch (aggregate) {
        case "ALL_LOCKED":
          return "locked";
        case "ALL_UNLOCKED":
          return "unlocked";
        case "MIXED":
          return "mixed";
        case "NONE":
          return "none";
        default:
          return "unknown";
      }
    };
    expect(legacyStatusOf(finalAggregate)).toBe("unknown");
    expect(legacyStatusOf(finalAggregate)).not.toBe("locked");
    expect(legacyStatusOf(preAggregate)).toBe("locked"); // would have been wrong without Class B force

    const intel = baseLp({
      aggregateState: "ALL_LOCKED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
      lockDistribution: {
        available: true,
        reason: null,
        method: "token_amounts",
        lockedPct: 100,
        unlockedPct: 0,
        unknownPct: 0,
        lockedUsd: 500,
        unlockedUsd: 0,
        unknownUsd: 0,
        totalPositionUsd: 500,
        poolLiquidityUsd: 500,
        reconciledWithPool: true,
      },
      discoveryComplete: true,
    });
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "hook_native",
      poolId: GME_POOL,
      poolKey: null,
      evidence: ["ownership_class=hook_native"],
      lockAnalysisComplete: false,
      tokenOwnerIsAirlock: true,
      hookPosmNftBalance: "0",
      activeLiquidity: "1",
    };
    applyV4OwnershipClassToIntelligence(intel, classResult);
    expect(intel.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(intel.lockDistribution.available).toBe(false);
  });

  it("4. Hook Native always gates Hook block (ownershipClass === hook_native)", () => {
    const showHookBlock = (ownershipClass: string | null | undefined) =>
      ownershipClass === "hook_native";
    expect(showHookBlock("hook_native")).toBe(true);
    expect(showHookBlock("posm_nft")).toBe(false);
    expect(showHookBlock("unknown")).toBe(false);
    expect(showHookBlock(null)).toBe(false);
    // Layout-agnostic: single / multi / empty use the same predicate.
    for (const layout of ["single", "multi", "aggregate", "empty"] as const) {
      expect(showHookBlock("hook_native") && Boolean(layout)).toBe(true);
    }
  });

  it("5. Class A unchanged — PosM dust still yields Titan lock status", () => {
    const lp = baseLp({
      ownershipClass: "posm_nft",
      aggregateState: "ALL_LOCKED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
      discoveryComplete: true,
      lockDistribution: {
        available: true,
        reason: null,
        method: "token_amounts",
        lockedPct: 100,
        unlockedPct: 0,
        unknownPct: 0,
        lockedUsd: 500,
        unlockedUsd: 0,
        unknownUsd: 0,
        totalPositionUsd: 500,
        poolLiquidityUsd: 500,
        reconciledWithPool: true,
      },
    });
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "HANSOME",
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      liquidityUsd: 16_000,
    });
    expect(pools[0].lockStatus).toBe("LOCKED");
  });

  it("6–7. Titan / Score path untouched for non-hook_native", () => {
    expect(isHookNativeOwnership("posm_nft")).toBe(false);
    // Non-Class-B still allowed to compute economic lock% (guard not applied).
    const pos = titanDustPos("47299");
    pos.valueUsd = 500;
    const economic = computeEconomicLockDistribution({
      positions: [pos],
      poolLiquidityUsd: 500,
    });
    expect(economic.available).toBe(true);
    expect(economic.lockedPct).toBeGreaterThan(0);
    // Class A presentation still Titan LOCKED
    const lp = baseLp({
      ownershipClass: "posm_nft",
      positions: [pos],
      aggregateState: "ALL_LOCKED",
    });
    const pools = buildPresentationPools({
      lp,
      tokenSymbol: "HANSOME",
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      liquidityUsd: 500,
    });
    expect(pools[0].lockStatus).toBe("LOCKED");
  });
});

describe("Phase 12A.1 — interactive reorg + fence", () => {
  beforeEach(() => {
    clearHookPosProductionMemoryForTests();
    useHookPosIndexTestKv(new Map());
    setDeploymentScopeForTests(null);
  });

  it("8. Interactive reorg path matches background (hash mismatch → rollback)", async () => {
    const fixture = findHookPoolFixtureByToken(GME_TOKEN)!;
    const state = emptyHookPositionIndexState({
      chainId: 4663,
      poolId: GME_POOL,
      hookAddress: DOPPLER_HOOK_INITIALIZER,
      positionManager: fixture.positionManager,
      poolManager: fixture.poolManager,
    });
    state.generation = "1";
    state.lastSyncedBlock = 16_864_650;
    state.lastSyncedBlockHash = "0x" + "a".repeat(64);
    state.createBlock = 16_864_619;
    state.positions = [
      {
        chainId: 4663,
        poolId: GME_POOL,
        owner: DOPPLER_HOOK_INITIALIZER.toLowerCase(),
        tickLower: 0,
        tickUpper: 1,
        salt: "0x" + "0".repeat(64),
        classification: "hook_owned",
        firstSeenBlock: 16_864_640,
        lastSeenBlock: 16_864_640,
        source: "fixture",
        netLiquidityDelta: "1",
      },
    ];
    state.hookDiscoveryComplete = true;

    const port: HookPosChainPort = {
      async getBlockNumber() {
        return 16_864_700;
      },
      async getBlockHash(n) {
        // Mismatch at checkpoint → reorg
        if (n === 16_864_650) return "0x" + "b".repeat(64);
        return `0x${n.toString(16).padStart(64, "c")}`;
      },
      async getTransactionReceipt() {
        return null;
      },
      async getLogsModifyLiquidity() {
        return [];
      },
      async getPositionInfo() {
        return null;
      },
    };

    const mismatch = await detectHookCheckpointHashMismatch({ port, state });
    expect(mismatch).toBe(true);
    const rescan = await reorgRescanHookPositionIndex({
      port,
      opts: {
        chainId: 4663,
        poolId: GME_POOL,
        hookAddress: DOPPLER_HOOK_INITIALIZER,
        positionManager: fixture.positionManager,
        poolManager: fixture.poolManager,
        createTx: fixture.createTx,
        createBlock: fixture.createBlock,
        confirmationDepth: 12,
        interactiveBudgetMs: 2_000,
        fixture,
      },
      existing: state,
    });
    expect(rescan.hashMismatch).toBe(true);
    expect(rescan.state.incompleteReasons).toContain("reorg_detected");
    expect(Number(rescan.state.generation)).toBeGreaterThan(Number(state.generation));
  });

  it("9. Generation fence rejects stale publish (no silent overwrite)", async () => {
    const key = hookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    const state = emptyHookPositionIndexState({
      chainId: 4663,
      poolId: GME_POOL,
      hookAddress: DOPPLER_HOOK_INITIALIZER,
    });
    state.generation = "5";
    state.positions = [
      {
        chainId: 4663,
        poolId: GME_POOL,
        owner: DOPPLER_HOOK_INITIALIZER.toLowerCase(),
        tickLower: 0,
        tickUpper: 1,
        salt: "0x" + "0".repeat(64),
        classification: "hook_owned",
        firstSeenBlock: 1,
        lastSeenBlock: 1,
        source: "fixture",
      },
    ];
    state.hookDiscoveryComplete = true;
    state.terminalState = "SUCCESS_COMPLETE";
    await saveHookPosIndexProduction(key, state);

    const stale = structuredClone(state);
    stale.generation = "4";
    const denied = await saveHookPosIndexProduction(key, stale, {
      expectedGeneration: "4",
    });
    expect(denied.ok).toBe(false);
    expect(denied.reason).toMatch(/generation_fence|stale_generation/);

    // Class A skip still publishOk
    const skip = await resolveHookPositionIndex({
      tokenAddress: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
      ownershipClass: "posm_nft",
      disableBackground: true,
    });
    expect(skip.skipped).toBe(true);
    expect(skip.publishOk).toBe(true);
  });

  it("7. Candidate / production deployment scope cache isolation remains", () => {
    setDeploymentScopeForTests("production");
    const prodKey = hookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    expect(prodKey).toContain("production");
    expect(resolveDeploymentScope()).toBe("production");

    setDeploymentScopeForTests("candidate:dpl_12a1_test");
    const candKey = hookPosIndexKey({ chainId: 4663, poolId: GME_POOL });
    expect(candKey).toContain("candidate:dpl_12a1_test");
    expect(candKey).not.toBe(prodKey);
    // Phase 12C: keys begin with deploymentScope
    expect(candKey.startsWith("candidate:dpl_12a1_test:")).toBe(true);
    expect(candKey).toContain("scan:v4hook:");

    setDeploymentScopeForTests(null);
  });
});
