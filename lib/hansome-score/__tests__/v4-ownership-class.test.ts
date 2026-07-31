import { describe, expect, it, vi } from "vitest";
import { getAddress, zeroAddress } from "viem";
import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import {
  userFacingAggregateLock,
  userFacingV4OwnershipClass,
  v4OwnershipEvidenceLines,
} from "@/lib/hansome-score/lp/presentation";
import {
  AIRLOCK_ADDRESS,
  classifyV4OwnershipClass,
  applyV4OwnershipClassToIntelligence,
  buildV4OwnershipEvidence,
  hasMaterialPosmPositions,
  isDopplerHook,
  isDynamicFee,
  KNOWN_HOOK_NATIVE_POOLS,
  poolIdFromKey,
  V4_DYNAMIC_FEE_FLAG,
  V4_OWNERSHIP_CLASS_DISPLAY,
  V4_OWNERSHIP_NOTE,
  type V4OwnershipClassResult,
} from "@/lib/hansome-score/lp/v4-ownership-class";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

const HANSOME = getAddress("0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875");
const OKC = getAddress("0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3");
const GME = getAddress("0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3");
const DOPPLER = getAddress("0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544");

function posmPos(id: string): V4PositionInfo {
  return {
    positionNftId: id,
    owner: "0x1111111111111111111111111111111111111111",
    ownerLabel: null,
    lockerName: null,
    lockerAddress: null,
    lockState: "UNLOCKED_EOA_CONTROLLED",
    lockStateDisplay: "UNLOCKED / EOA-CONTROLLED",
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1000",
    amount0Raw: null,
    amount1Raw: null,
    poolId: "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d",
    currency0: zeroAddress,
    currency1: HANSOME,
    fee: 500,
    tickSpacing: 10,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: true,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
  };
}

function baseIntel(overrides?: Partial<LpIntelligence>): LpIntelligence {
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: null,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "UNABLE_TO_DETERMINE",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    aggregateState: "UNKNOWN_INCOMPLETE",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    positionCounts: {
      detected: 0,
      material: 0,
      locked: 0,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: {
      available: false,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
      method: null,
      reason: null,
    },
    discoveryComplete: false,
    completenessWarning: null,
    ownershipRiskNote: "test",
    sizeWarning: false,
    positions: [],
    evidenceLevel: "unavailable",
    detail: "test detail",
    uniswapVersions: emptyUniswapVersionCoverage({
      v4Searched: true,
      v4Pools: 1,
    }),
    ...overrides,
  };
}

describe("v4 ownership class — pure classifier", () => {
  it("HANSOME-like PosM path → posm_nft", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 1n,
        hasMaterialPosmPositions: true,
        tokenOwnerIsAirlock: false,
        resolvedHookNativePool: false,
        hooks: zeroAddress,
        fee: 500,
        hookPosmNftBalance: null,
        activeLiquidity: null,
      }),
    ).toBe("posm_nft");
  });

  it("OKC/GME-like Doppler + Airlock + zero hook NFT → hook_native", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 10n ** 18n,
        hasMaterialPosmPositions: false,
        tokenOwnerIsAirlock: true,
        resolvedHookNativePool: true,
        hooks: DOPPLER,
        fee: V4_DYNAMIC_FEE_FLAG,
        hookPosmNftBalance: 0n,
        activeLiquidity: 123n,
      }),
    ).toBe("hook_native");
  });

  it("does NOT classify hook_native from PoolManager balance alone", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 10n ** 24n,
        hasMaterialPosmPositions: false,
        tokenOwnerIsAirlock: false,
        resolvedHookNativePool: false,
        hooks: null,
        fee: null,
        hookPosmNftBalance: null,
        activeLiquidity: null,
      }),
    ).toBe("unknown");
  });

  it("does NOT classify hook_native from Airlock owner alone", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 10n ** 18n,
        hasMaterialPosmPositions: false,
        tokenOwnerIsAirlock: true,
        resolvedHookNativePool: false,
        hooks: null,
        fee: null,
        hookPosmNftBalance: null,
        activeLiquidity: null,
      }),
    ).toBe("unknown");
  });

  it("prefers hook_native over stray PosM dust when Doppler book proven", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 10n ** 18n,
        hasMaterialPosmPositions: true,
        tokenOwnerIsAirlock: true,
        resolvedHookNativePool: true,
        hooks: DOPPLER,
        fee: V4_DYNAMIC_FEE_FLAG,
        hookPosmNftBalance: 0n,
        activeLiquidity: 1n,
      }),
    ).toBe("hook_native");
  });

  it("zero inventory → unknown", () => {
    expect(
      classifyV4OwnershipClass({
        poolManagerBalance: 0n,
        hasMaterialPosmPositions: true,
        tokenOwnerIsAirlock: false,
        resolvedHookNativePool: false,
        hooks: null,
        fee: null,
        hookPosmNftBalance: null,
        activeLiquidity: null,
      }),
    ).toBe("unknown");
  });
});

describe("v4 ownership class — helpers + known seeds", () => {
  it("recognizes Doppler hooks and dynamic fee flag", () => {
    expect(isDopplerHook(DOPPLER)).toBe(true);
    expect(isDopplerHook(zeroAddress)).toBe(false);
    expect(isDynamicFee(V4_DYNAMIC_FEE_FLAG)).toBe(true);
    expect(isDynamicFee(500)).toBe(false);
  });

  it("known OKC/GME poolIds match keccak PoolKey", () => {
    for (const row of KNOWN_HOOK_NATIVE_POOLS) {
      expect(poolIdFromKey(row.poolKey).toLowerCase()).toBe(
        row.poolId.toLowerCase(),
      );
    }
    expect(KNOWN_HOOK_NATIVE_POOLS.map((r) => r.token.toLowerCase())).toEqual(
      expect.arrayContaining([OKC.toLowerCase(), GME.toLowerCase()]),
    );
  });

  it("hasMaterialPosmPositions ignores v2/v3 synthetic rows", () => {
    expect(hasMaterialPosmPositions([posmPos("47299")])).toBe(true);
    expect(
      hasMaterialPosmPositions([
        { ...posmPos("v3-pool:x"), positionNftId: "v3-pool:x" },
      ]),
    ).toBe(false);
  });

  it("presentation labels map without uniswap lock semantics change", () => {
    expect(userFacingV4OwnershipClass("posm_nft")).toBe(
      V4_OWNERSHIP_CLASS_DISPLAY.posm_nft,
    );
    expect(userFacingV4OwnershipClass("hook_native")).toBe(
      V4_OWNERSHIP_CLASS_DISPLAY.hook_native,
    );
    expect(userFacingV4OwnershipClass("unknown")).toBeNull();
    expect(userFacingAggregateLock("UNKNOWN_INCOMPLETE")).toBe("UNKNOWN");
    expect(userFacingAggregateLock("MIXED")).toBe("PARTIALLY_LOCKED");
  });
});

describe("v4 ownership class — apply to intelligence", () => {
  it("Class B forces UNKNOWN_INCOMPLETE and disables lock%", () => {
    const intel = baseIntel({
      aggregateState: "ALL_LOCKED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
      lockDistribution: {
        available: true,
        lockedPct: 100,
        unlockedPct: 0,
        unknownPct: 0,
        lockedUsd: 1000,
        unlockedUsd: 0,
        unknownUsd: 0,
        totalPositionUsd: 1000,
        poolLiquidityUsd: 1000,
        reconciledWithPool: true,
        method: "token_amounts",
        reason: null,
      },
      discoveryComplete: true,
    });
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "hook_native",
      poolId: KNOWN_HOOK_NATIVE_POOLS[0]!.poolId,
      poolKey: KNOWN_HOOK_NATIVE_POOLS[0]!.poolKey,
      evidence: ["token_owner_airlock", "hooks_doppler_registry"],
      lockAnalysisComplete: false,
      tokenOwnerIsAirlock: true,
      hookPosmNftBalance: "0",
      activeLiquidity: "1",
    };
    applyV4OwnershipClassToIntelligence(intel, classResult);
    expect(intel.ownershipClass).toBe("hook_native");
    expect(intel.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(intel.discoveryComplete).toBe(false);
    expect(intel.lockDistribution.available).toBe(false);
    expect(intel.uniswapVersions.byVersion.v4.lockAnalysisComplete).toBe(false);
    expect(userFacingAggregateLock(intel.aggregateState)).toBe("UNKNOWN");
    expect(intel.ownershipRiskNote.toLowerCase()).toContain("hook native");
    expect(intel.ownershipRiskNote.toLowerCase()).not.toContain(
      "verified locked",
    );
  });

  it("Class A posm_nft leaves aggregate/lock scoring untouched", () => {
    const intel = baseIntel({
      positions: [posmPos("47299")],
      aggregateState: "MIXED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
      discoveryComplete: false,
    });
    applyV4OwnershipClassToIntelligence(intel, {
      ownershipClass: "posm_nft",
      poolId: null,
      poolKey: null,
      evidence: ["ownership_class=posm_nft"],
      lockAnalysisComplete: true,
      tokenOwnerIsAirlock: false,
      hookPosmNftBalance: null,
      activeLiquidity: null,
    });
    expect(intel.ownershipClass).toBe("posm_nft");
    expect(intel.aggregateState).toBe("MIXED");
    expect(intel.detail).toContain("posm_nft");
    expect(intel.v4OwnershipEvidence?.source).toMatch(/position_nft|titan_lock/);
    expect(intel.v4OwnershipEvidence?.positionIds).toContain("47299");
  });
});

describe("v4 ownership evidence (Phase 11A.1)", () => {
  it("HANSOME Class A evidence includes ≥1 position ID; no false lock claim", () => {
    const titanPos: V4PositionInfo = {
      ...posmPos("47299"),
      lockerName: "TitanLockerManagerV2",
      lockState: "LOCKED_VERIFIED_ONCHAIN",
      lockStateDisplay: "LOCKED — VERIFIED ON-CHAIN",
      removableByEoa: false,
    };
    const eoaPos = posmPos("357867");
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "posm_nft",
      poolId: titanPos.poolId,
      poolKey: null,
      evidence: ["ownership_class=posm_nft"],
      lockAnalysisComplete: true,
      tokenOwnerIsAirlock: false,
      hookPosmNftBalance: null,
      activeLiquidity: null,
    };
    const evidence = buildV4OwnershipEvidence({
      classResult,
      positions: [titanPos, eoaPos],
      discoveryComplete: false,
    });
    expect(evidence).not.toBeNull();
    expect(evidence!.source).toBe("titan_lock");
    expect(evidence!.positionIds).toEqual(
      expect.arrayContaining(["47299", "357867"]),
    );
    expect(evidence!.notes).toContain(V4_OWNERSHIP_NOTE.POSITION_NFT_DETECTED);
    expect(evidence!.notes).toContain(V4_OWNERSHIP_NOTE.DISCOVERY_INCOMPLETE);
    expect(evidence!.notes?.join(" ").toLowerCase()).not.toMatch(
      /fully locked|all locked|permanent/,
    );

    const intel = baseIntel({
      positions: [titanPos, eoaPos],
      aggregateState: "MIXED",
      aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
      discoveryComplete: false,
    });
    applyV4OwnershipClassToIntelligence(intel, classResult);
    expect(intel.aggregateState).toBe("MIXED");
    expect(userFacingAggregateLock(intel.aggregateState)).toBe(
      "PARTIALLY_LOCKED",
    );
    expect(intel.lockDistribution.available).toBe(false);
  });

  it("OKC Class B evidence includes Doppler/Airlock + dynamic fee; lock incomplete", () => {
    const okc = KNOWN_HOOK_NATIVE_POOLS.find(
      (p) => p.token.toLowerCase() === OKC.toLowerCase(),
    )!;
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "hook_native",
      poolId: okc.poolId,
      poolKey: okc.poolKey,
      evidence: [
        "token_owner_airlock",
        "hooks_doppler_registry",
        "dynamic_fee_flag",
        "hook_posm_nft_balance=0",
        "ownership_class=hook_native",
        "lock_verification_unsupported",
      ],
      lockAnalysisComplete: false,
      tokenOwnerIsAirlock: true,
      hookPosmNftBalance: "0",
      activeLiquidity: "999",
    };
    const evidence = buildV4OwnershipEvidence({
      classResult,
      positions: [],
    });
    expect(evidence!.source).toBe("doppler_hook");
    expect(evidence!.airlockAddress?.toLowerCase()).toBe(
      AIRLOCK_ADDRESS.toLowerCase(),
    );
    expect(evidence!.hookAddress?.toLowerCase()).toBe(DOPPLER.toLowerCase());
    expect(evidence!.poolIds?.[0]?.toLowerCase()).toBe(okc.poolId.toLowerCase());
    expect(evidence!.notes).toEqual(
      expect.arrayContaining([
        V4_OWNERSHIP_NOTE.AIRLOCK_DOPPLER_POOL,
        V4_OWNERSHIP_NOTE.DYNAMIC_FEE_HOOK_POOL,
        V4_OWNERSHIP_NOTE.HOOK_NO_POSM_NFT,
      ]),
    );
    expect(evidence!.positionIds).toBeUndefined();

    const intel = baseIntel({
      lockDistribution: {
        available: true,
        lockedPct: 100,
        unlockedPct: 0,
        unknownPct: 0,
        lockedUsd: 1,
        unlockedUsd: 0,
        unknownUsd: 0,
        totalPositionUsd: 1,
        poolLiquidityUsd: 1,
        reconciledWithPool: true,
        method: "token_amounts",
        reason: null,
      },
    });
    applyV4OwnershipClassToIntelligence(intel, classResult);
    expect(intel.ownershipClass).toBe("hook_native");
    expect(intel.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(intel.lockDistribution.available).toBe(false);
    // Phase 12A.1 — Class B also clears pct/USD (parity with multi.ts), not only available.
    expect(intel.lockDistribution.lockedPct).toBeNull();
    expect(intel.uniswapVersions.byVersion.v4.lockAnalysisComplete).toBe(false);
    const lines = v4OwnershipEvidenceLines(intel.v4OwnershipEvidence);
    expect(lines.map((l) => l.messageKey)).toEqual(
      expect.arrayContaining([
        "v4EvidenceAirlockDoppler",
        "v4EvidenceDynamicFee",
        "v4EvidenceHookNoPosm",
      ]),
    );
    expect(lines.map((l) => l.messageKey).join(" ")).not.toMatch(/lock%/i);
  });

  it("GME Class B same safety as OKC", () => {
    const gme = KNOWN_HOOK_NATIVE_POOLS.find(
      (p) => p.token.toLowerCase() === GME.toLowerCase(),
    )!;
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "hook_native",
      poolId: gme.poolId,
      poolKey: gme.poolKey,
      evidence: [
        "token_owner_airlock",
        "hooks_doppler_registry",
        "dynamic_fee_flag",
        "hook_posm_nft_balance=0",
      ],
      lockAnalysisComplete: false,
      tokenOwnerIsAirlock: true,
      hookPosmNftBalance: "0",
      activeLiquidity: "50",
    };
    const evidence = buildV4OwnershipEvidence({ classResult, positions: [] });
    expect(evidence!.source).toBe("doppler_hook");
    expect(evidence!.notes).toContain(V4_OWNERSHIP_NOTE.AIRLOCK_DOPPLER_POOL);
    expect(evidence!.notes).toContain(V4_OWNERSHIP_NOTE.DYNAMIC_FEE_HOOK_POOL);

    const intel = baseIntel();
    applyV4OwnershipClassToIntelligence(intel, classResult);
    expect(intel.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(intel.lockDistribution.available).toBe(false);
    expect(userFacingAggregateLock(intel.aggregateState)).toBe("UNKNOWN");
  });

  it("unknown fixture: no false evidence / no lock claim", () => {
    const classResult: V4OwnershipClassResult = {
      ownershipClass: "unknown",
      poolId: null,
      poolKey: null,
      evidence: ["ownership_class=unknown"],
      lockAnalysisComplete: true,
      tokenOwnerIsAirlock: false,
      hookPosmNftBalance: null,
      activeLiquidity: null,
    };
    const evidence = buildV4OwnershipEvidence({
      classResult,
      positions: [],
    });
    expect(evidence!.source).toBe("unknown");
    expect(evidence!.notes).toEqual([V4_OWNERSHIP_NOTE.OWNERSHIP_UNPROVEN]);
    expect(evidence!.positionIds).toBeUndefined();
    expect(evidence!.hookAddress).toBeUndefined();
    expect(evidence!.airlockAddress).toBeUndefined();

    const noInventory = buildV4OwnershipEvidence({
      classResult: {
        ...classResult,
        evidence: ["no_pool_manager_inventory", "ownership_class=unknown"],
      },
      positions: [],
    });
    expect(noInventory).toBeNull();
  });
});

describe("v4 ownership class — Airlock constant", () => {
  it("Airlock address matches research canonical", () => {
    expect(AIRLOCK_ADDRESS.toLowerCase()).toBe(
      "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862",
    );
  });
});

describe("v4 ownership class — detect with mocked client", () => {
  it("OKC fixture resolves hook_native via known pool + Airlock owner", async () => {
    const { detectV4OwnershipClass } = await import(
      "@/lib/hansome-score/lp/v4-ownership-class"
    );
    const okcPool = KNOWN_HOOK_NATIVE_POOLS.find(
      (p) => p.token.toLowerCase() === OKC.toLowerCase(),
    )!;
    const client = {
      readContract: vi.fn(async (args: { functionName: string; args?: unknown[] }) => {
        if (args.functionName === "owner") return AIRLOCK_ADDRESS;
        if (args.functionName === "getSlot0") {
          return [1n << 96n, 0, 0, 0];
        }
        if (args.functionName === "getLiquidity") return 999n;
        if (args.functionName === "balanceOf") return 0n;
        throw new Error(`unexpected ${args.functionName}`);
      }),
    };
    const result = await detectV4OwnershipClass({
      tokenAddress: OKC,
      poolManagerBalance: 10n ** 22n,
      positions: [],
      client: client as never,
    });
    expect(result.ownershipClass).toBe("hook_native");
    expect(result.poolId?.toLowerCase()).toBe(okcPool.poolId.toLowerCase());
    expect(result.lockAnalysisComplete).toBe(false);
    expect(result.tokenOwnerIsAirlock).toBe(true);
    expect(result.v4OwnershipEvidence?.source).toBe("doppler_hook");
    expect(result.v4OwnershipEvidence?.notes).toEqual(
      expect.arrayContaining([
        V4_OWNERSHIP_NOTE.AIRLOCK_DOPPLER_POOL,
        V4_OWNERSHIP_NOTE.DYNAMIC_FEE_HOOK_POOL,
        V4_OWNERSHIP_NOTE.HOOK_NO_POSM_NFT,
      ]),
    );
  });

  it("GME fixture resolves hook_native", async () => {
    const { detectV4OwnershipClass } = await import(
      "@/lib/hansome-score/lp/v4-ownership-class"
    );
    const client = {
      readContract: vi.fn(async (args: { functionName: string }) => {
        if (args.functionName === "owner") return AIRLOCK_ADDRESS;
        if (args.functionName === "getSlot0") return [1n << 96n, 0, 0, 0];
        if (args.functionName === "getLiquidity") return 50n;
        if (args.functionName === "balanceOf") return 0n;
        throw new Error(`unexpected ${args.functionName}`);
      }),
    };
    const result = await detectV4OwnershipClass({
      tokenAddress: GME,
      poolManagerBalance: 10n ** 20n,
      positions: [],
      client: client as never,
    });
    expect(result.ownershipClass).toBe("hook_native");
    expect(result.lockAnalysisComplete).toBe(false);
  });

  it("HANSOME with PosM positions → posm_nft (non-Airlock, no Doppler)", async () => {
    const { detectV4OwnershipClass } = await import(
      "@/lib/hansome-score/lp/v4-ownership-class"
    );
    const client = {
      readContract: vi.fn(async (args: { functionName: string }) => {
        if (args.functionName === "owner") {
          return getAddress("0x1111111111111111111111111111111111111111");
        }
        // Doppler template slot0 fails → no Class B
        if (args.functionName === "getSlot0") throw new Error("no pool");
        if (args.functionName === "getLiquidity") throw new Error("no pool");
        if (args.functionName === "balanceOf") return 0n;
        throw new Error(`unexpected ${args.functionName}`);
      }),
    };
    const result = await detectV4OwnershipClass({
      tokenAddress: HANSOME,
      poolManagerBalance: 10n ** 18n,
      positions: [posmPos("47299"), posmPos("357867")],
      client: client as never,
    });
    expect(result.ownershipClass).toBe("posm_nft");
    expect(result.tokenOwnerIsAirlock).toBe(false);
    expect(result.v4OwnershipEvidence?.positionIds).toEqual(
      expect.arrayContaining(["47299", "357867"]),
    );
    expect(result.v4OwnershipEvidence?.source).toBe("position_nft");
  });
});
