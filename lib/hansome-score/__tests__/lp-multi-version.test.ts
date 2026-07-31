import { describe, expect, it } from "vitest";
import { LP_AGGREGATE_STATE_DISPLAY, LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { computeTokenAggregate } from "@/lib/hansome-score/lp/aggregate";
import { syntheticUnknownPosition } from "@/lib/hansome-score/lp/adapters/types";
import {
  emptyUniswapVersionCoverage,
  testCompleteVersionCoverage,
} from "@/lib/hansome-score/lp/coverage";
import {
  buildUniswapVersionCoverage,
  computeMultiVersionAggregate,
} from "@/lib/hansome-score/lp/multi";
import { scoreLiquidityCoverage } from "@/lib/hansome-score/confidence";
import type { TokenOverview, V4PositionInfo } from "@/lib/hansome-score/types";
import type { VersionDiscoveryResult } from "@/lib/hansome-score/lp/adapters/types";
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

function versionResult(
  version: "v2" | "v3" | "v4",
  overrides: Partial<VersionDiscoveryResult> = {},
): VersionDiscoveryResult {
  return {
    version,
    protocolSupportStatus: "partial",
    searched: true,
    discoveryComplete: true,
    lockAnalysisComplete: true,
    pools: [],
    positions: [],
    detail: `${version} test`,
    evidenceLevel: "on_chain_verified",
    ...overrides,
  };
}

describe("multi-version LP aggregate", () => {
  it("HANSOME locked + removable still MIXED when v2/v3 probes empty and coverage complete", () => {
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
    const coverage = testCompleteVersionCoverage(["v4"]);
    const r = computeMultiVersionAggregate({
      positions,
      poolDetected: true,
      versionCoverage: coverage,
      v4DiscoveryComplete: true,
    });
    expect(r.aggregate).toBe("MIXED");
    expect(r.discoveryComplete).toBe(true);
  });

  it("single-version verified lock ≠ ALL_LOCKED when multi-version coverage incomplete", () => {
    const onlyLocked = [
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
        liquidity: "1000",
      }),
    ];
    // v4-only path marks v2/v3 unsearched
    const incomplete = emptyUniswapVersionCoverage({
      v4Searched: true,
      v4Pools: 1,
      v4Positions: 1,
      v4DiscoveryComplete: true,
      v4LockComplete: true,
    });
    expect(incomplete.coverageComplete).toBe(false);

    const r = computeMultiVersionAggregate({
      positions: onlyLocked,
      poolDetected: true,
      versionCoverage: incomplete,
      v4DiscoveryComplete: true,
    });
    expect(r.aggregate).not.toBe("ALL_LOCKED");
    expect(r.aggregate).toBe("UNKNOWN_INCOMPLETE");
    expect(r.discoveryComplete).toBe(false);
  });

  it("v2 undecoded pair blocks ALL_LOCKED even if v4 positions look fully locked", () => {
    const v4Locked = [
      pos({
        positionNftId: "1",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        removableByEoa: false,
      }),
    ];
    const v2Unknown = syntheticUnknownPosition({
      id: "v2-pair:0xpair",
      version: "v2",
      poolOrPair: "0xpair",
      dataSource: "test",
    });
    const coverage = buildUniswapVersionCoverage([
      versionResult("v2", {
        lockAnalysisComplete: false,
        pools: [
          {
            version: "v2",
            poolOrPair: "0xpair",
            quoteToken: "0xquote",
            fee: null,
            tokenBalanceRaw: "1",
          },
        ],
        positions: [v2Unknown],
        detail: "v2 pair found — lock incomplete",
      }),
      versionResult("v3"),
      versionResult("v4", {
        pools: [
          {
            version: "v4",
            poolOrPair: hansomeLp.poolId,
            quoteToken: null,
            fee: null,
            tokenBalanceRaw: "1",
          },
        ],
        positions: v4Locked,
        lockAnalysisComplete: true,
      }),
    ]);
    expect(coverage.coverageComplete).toBe(false);
    expect(coverage.incompleteReason).toMatch(/INCOMPLETE COVERAGE/i);

    const r = computeMultiVersionAggregate({
      positions: [...v4Locked, v2Unknown],
      poolDetected: true,
      versionCoverage: coverage,
      v4DiscoveryComplete: true,
    });
    expect(r.aggregate).not.toBe("ALL_LOCKED");
    expect(r.aggregate).toBe("UNKNOWN_INCOMPLETE");
  });

  it("incomplete multi-version discovery reduces Data Confidence liquidity dimension", () => {
    const overview = {
      lpLockStatus: "unknown" as const,
      lpIntelligence: {
        poolDetected: true,
        poolsDetectedCount: 1,
        poolId: "0xpool",
        poolManagerBalanceRaw: "1",
        poolManagerBalanceFormatted: "1",
        aggregateLockState: "LOCKED_VERIFIED_ONCHAIN" as const,
        aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
        aggregateState: "ALL_LOCKED" as const,
        aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.ALL_LOCKED,
        positionCounts: { detected: 1, material: 1, locked: 1, unlocked: 0, unknown: 0 },
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
          reason: "n/a",
        },
        discoveryComplete: true,
        completenessWarning: null,
        ownershipRiskNote: "ok",
        sizeWarning: false,
        positions: [
          pos({
            positionNftId: "1",
            lockState: "LOCKED_VERIFIED_ONCHAIN",
            lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
            removableByEoa: false,
          }),
        ],
        evidenceLevel: "on_chain_verified" as const,
        detail: "ok",
        uniswapVersions: emptyUniswapVersionCoverage({
          v4Searched: true,
          v4Pools: 1,
          v4Positions: 1,
          v4DiscoveryComplete: true,
          v4LockComplete: true,
        }),
      },
    } as unknown as TokenOverview;

    const dim = scoreLiquidityCoverage(overview);
    expect(dim.incomplete).toBe(true);
    expect(dim.score).toBeLessThanOrEqual(45);
    expect(dim.evidence.some((e) => e.includes("multi_version_coverage_incomplete"))).toBe(
      true,
    );
  });

  it("token-level ALL_LOCKED still requires discoveryComplete (single position regression)", () => {
    const r = computeTokenAggregate({
      positions: [
        pos({
          positionNftId: "1",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
          removableByEoa: false,
        }),
      ],
      poolDetected: true,
      discoveryComplete: false,
    });
    expect(r.aggregate).toBe("UNKNOWN_INCOMPLETE");
  });
});
