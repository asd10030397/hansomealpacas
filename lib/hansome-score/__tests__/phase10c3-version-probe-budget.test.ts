/**
 * Phase 10C-3 — hung v4 Quick must not erase finished v3/Pons LOCKED_VERIFIED.
 * Reproduces remote BEER failure class: non-zero PoolManager → v4 Quick hang →
 * Promise.all never returns → liquidity soft-fail with 0 positions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LP_LOCK_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import type { VersionDiscoveryResult } from "@/lib/hansome-score/lp/adapters/types";
import type { DetectLpResult } from "@/lib/hansome-score/lp/detect";
import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import type { V4PositionInfo } from "@/lib/hansome-score/types";

const BEER = "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804";
const PONS = "0x736D76699C26D0d966744cAe304C000d471f7F35";

vi.mock("@/lib/hansome-score/lp/adapters/v2", () => ({
  discoverV2Liquidity: vi.fn(),
}));
vi.mock("@/lib/hansome-score/lp/adapters/v3", () => ({
  discoverV3Liquidity: vi.fn(),
}));
vi.mock("@/lib/hansome-score/lp/adapters/v4", () => ({
  discoverV4Liquidity: vi.fn(),
}));
vi.mock("@/lib/hansome-score/lp/position-cache", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/hansome-score/lp/position-cache")
  >("@/lib/hansome-score/lp/position-cache");
  return {
    ...actual,
    persistLpDiscoveryCache: vi.fn(async () => undefined),
  };
});

import { discoverV2Liquidity } from "@/lib/hansome-score/lp/adapters/v2";
import { discoverV3Liquidity } from "@/lib/hansome-score/lp/adapters/v3";
import { discoverV4Liquidity } from "@/lib/hansome-score/lp/adapters/v4";
import {
  VERSION_PROBE_BUDGET_MS,
  detectMultiVersionLpIntelligence,
} from "@/lib/hansome-score/lp/multi";

function beerLockedV3(): VersionDiscoveryResult {
  const pos: V4PositionInfo = {
    positionNftId: "436637",
    owner: PONS,
    ownerLabel: null,
    lockerName: "PonsLaunchLocker",
    lockerAddress: PONS,
    lockState: "LOCKED_VERIFIED_ONCHAIN",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "36819258015569838458222",
    amount0Raw: null,
    amount1Raw: null,
    poolId: "0xC71E763a0a258f266d1481295115ea4f291D95ED",
    currency0: "0x0bd7d308C1F8422914f85072418eD0DbEad73AD7",
    currency1: BEER,
    fee: 10000,
    tickSpacing: null,
    tickLower: -887200,
    tickUpper: 204200,
    currentTick: null,
    inRange: null,
    removableByEoa: false,
    evidenceLevel: "on_chain_verified",
    dataSource: "test-pons-adapter-pass",
  };
  return {
    version: "v3",
    protocolSupportStatus: "partial",
    searched: true,
    discoveryComplete: true,
    lockAnalysisComplete: true,
    positionDiscoveryComplete: true,
    pools: [
      {
        version: "v3",
        poolOrPair: pos.poolId!,
        quoteToken: pos.currency0,
        fee: 10000,
        tokenBalanceRaw: "1000000",
        materiality: "material",
      },
    ],
    positions: [pos],
    detail: "v3: locker-verified=1 (adapter PASS)",
    evidenceLevel: "on_chain_verified",
  };
}

function emptyV2(): VersionDiscoveryResult {
  return {
    version: "v2",
    protocolSupportStatus: "partial",
    searched: true,
    discoveryComplete: true,
    lockAnalysisComplete: true,
    pools: [],
    positions: [],
    detail: "v2: no pairs",
    evidenceLevel: "on_chain_verified",
  };
}

function neverV4(): Promise<{ version: VersionDiscoveryResult; detect: DetectLpResult }> {
  return new Promise(() => {
    /* hang forever — reproduces Blockscout/PM Quick hang */
  });
}

describe("Phase 10C-3 version probe budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(discoverV2Liquidity).mockReset();
    vi.mocked(discoverV3Liquidity).mockReset();
    vi.mocked(discoverV4Liquidity).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports v4 budget above Quick LP soft wall but below liquidity stage", () => {
    expect(VERSION_PROBE_BUDGET_MS.v4).toBeGreaterThanOrEqual(45_000);
    expect(VERSION_PROBE_BUDGET_MS.v4).toBeLessThan(180_000);
    expect(VERSION_PROBE_BUDGET_MS.v3).toBeLessThan(180_000);
  });

  it("hung v4 Quick still returns BEER v3 LOCKED_VERIFIED_ONCHAIN (adapter PASS)", async () => {
    vi.mocked(discoverV2Liquidity).mockResolvedValue(emptyV2());
    vi.mocked(discoverV3Liquidity).mockResolvedValue(beerLockedV3());
    vi.mocked(discoverV4Liquidity).mockImplementation(() => neverV4());

    const pending = detectMultiVersionLpIntelligence({
      tokenAddress: BEER,
      poolManagerBalance: 33216026443105789601183n,
      decimals: 18,
      hintAddresses: [],
      candidatePositionIds: [],
      quickDiscovery: true,
      exhaustiveDiscovery: false,
    });

    // Advance past v4 budget; v2/v3 already resolved.
    await vi.advanceTimersByTimeAsync(VERSION_PROBE_BUDGET_MS.v4 + 50);
    const result = await pending;

    const locked = result.intelligence.positions.filter(
      (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
    );
    expect(locked.length).toBe(1);
    expect(locked[0]?.positionNftId).toBe("436637");
    expect(locked[0]?.owner?.toLowerCase()).toBe(PONS.toLowerCase());
    expect(locked[0]?.lockerName).toBe("PonsLaunchLocker");
    expect(locked[0]?.removableByEoa).toBe(false);

    // v4 must be marked searched-but-incomplete (not "v3 not searched")
    expect(result.intelligence.uniswapVersions?.byVersion.v3.searched).toBe(
      true,
    );
    expect(result.intelligence.uniswapVersions?.byVersion.v4.searched).toBe(
      true,
    );
    expect(
      result.intelligence.uniswapVersions?.byVersion.v4.lockAnalysisComplete,
    ).toBe(false);
    expect(result.intelligence.discoverySources).toContain(
      "v4_probe_budget_timeout",
    );
    // Serialization contract: exact production lock enum (not LOCKED_VERIFIED alone).
    const json = JSON.parse(JSON.stringify(locked[0]));
    expect(json.lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
    expect(json.lockStateDisplay).toBe(
      LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
    );
  });

  it("v3 timeout yields searched incomplete without inventing Locked", async () => {
    vi.mocked(discoverV2Liquidity).mockResolvedValue(emptyV2());
    vi.mocked(discoverV3Liquidity).mockImplementation(
      () => new Promise(() => {}),
    );
    vi.mocked(discoverV4Liquidity).mockResolvedValue({
      version: {
        version: "v4",
        protocolSupportStatus: "partial",
        searched: true,
        discoveryComplete: true,
        lockAnalysisComplete: true,
        pools: [],
        positions: [],
        detail: "v4 empty",
        evidenceLevel: "on_chain_verified",
      },
      detect: {
        intelligence: {
          poolDetected: false,
          poolsDetectedCount: 0,
          poolId: null,
          poolManagerBalanceRaw: "0",
          poolManagerBalanceFormatted: "0",
          aggregateLockState: "NONE",
          aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.NONE,
          aggregateState: "NONE",
          aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.NONE,
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
          discoveryComplete: true,
          completenessWarning: null,
          ownershipRiskNote: "none",
          sizeWarning: true,
          positions: [],
          evidenceLevel: "on_chain_verified",
          detail: "no pm",
          discoverySources: [],
          uniswapVersions: emptyUniswapVersionCoverage({
            v4Searched: true,
            v4DiscoveryComplete: true,
            v4LockComplete: true,
          }),
        },
        legacyStatus: "none",
      },
    });

    const pending = detectMultiVersionLpIntelligence({
      tokenAddress: BEER,
      poolManagerBalance: 0n,
      decimals: 18,
      hintAddresses: [],
      candidatePositionIds: [],
    });
    await vi.advanceTimersByTimeAsync(VERSION_PROBE_BUDGET_MS.v3 + 50);
    const result = await pending;
    expect(
      result.intelligence.positions.some(
        (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
      ),
    ).toBe(false);
    expect(result.intelligence.uniswapVersions?.byVersion.v3.searched).toBe(
      true,
    );
    expect(
      result.intelligence.uniswapVersions?.byVersion.v3.lockAnalysisComplete,
    ).toBe(false);
  });
});
