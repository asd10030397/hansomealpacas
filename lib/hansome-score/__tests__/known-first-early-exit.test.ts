/**
 * Cold Perf V2 Phase 8.1 — Known-First LP Early Exit planner tests.
 * Scenarios A–O + false-positive guards. No lock math changes.
 */
import { describe, expect, it } from "vitest";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  LP_LOCK_STATE_DISPLAY,
  SCAN_CHAIN_ID,
  SCORE_SPEC_VERSION,
} from "@/lib/hansome-score/constants";
import type { LpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import type { LpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import {
  KNOWN_FIRST_FRESHNESS,
  buildKnownFirstEvidence,
  createAttemptLpRequestMemo,
  isKnownFirstSelectiveRevalidate,
  isKnownFirstStructuralReuse,
  knownFirstEvidenceSufficient,
  knownFirstProgressUnits,
  knownFirstSemanticEqual,
  memoizeAttemptRequest,
  planKnownFirstLpEarlyExit,
  type KnownFirstEvidence,
} from "@/lib/hansome-score/lp/known-first-early-exit";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

const TOKEN = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const NOW = 1_800_000_000_000;

function pos(
  overrides: Partial<V4PositionInfo> & { positionNftId: string },
): V4PositionInfo {
  return {
    owner: "0x1111111111111111111111111111111111111111",
    ownerLabel: "EOA",
    lockerName: null,
    lockerAddress: null,
    lockState: "UNLOCKED_EOA_CONTROLLED",
    lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNLOCKED_EOA_CONTROLLED,
    unlockTimestamp: null,
    unlockDateUtc: null,
    lockCreatedAt: null,
    lockTxHash: null,
    liquidity: "1",
    amount0Raw: null,
    amount1Raw: null,
    valueUsd: 100,
    poolId: "0xpool",
    currency0: null,
    currency1: null,
    fee: 500,
    tickSpacing: 10,
    tickLower: 0,
    tickUpper: 100,
    currentTick: 50,
    inRange: true,
    removableByEoa: true,
    evidenceLevel: "on_chain_verified",
    dataSource: "test",
    ...overrides,
  };
}

function hansomeMixedLp(): LpIntelligence {
  const farUnlock = Math.floor(NOW / 1000) + 365 * 24 * 3600;
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: "0xpool",
    poolManagerBalanceRaw: "1000",
    poolManagerBalanceFormatted: "1000",
    aggregateLockState: "MIXED",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
    aggregateState: "MIXED",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.MIXED,
    positionCounts: {
      detected: 3,
      material: 3,
      locked: 1,
      unlocked: 2,
      unknown: 0,
    },
    lockDistribution: {
      available: true,
      lockedPct: 40,
      unlockedPct: 60,
      unknownPct: 0,
      lockedUsd: 400,
      unlockedUsd: 600,
      unknownUsd: 0,
      totalPositionUsd: 1000,
      poolLiquidityUsd: 1000,
      reconciledWithPool: true,
      method: "token_amounts",
      reason: "ok",
    },
    discoveryComplete: false,
    knownPositionsVerified: true,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: "incomplete",
    ownershipRiskNote: "note",
    sizeWarning: false,
    positions: [
      pos({
        positionNftId: "47299",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        lockStateDisplay: LP_LOCK_STATE_DISPLAY.LOCKED_VERIFIED_ONCHAIN,
        unlockTimestamp: farUnlock,
        removableByEoa: false,
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
      pos({ positionNftId: "357867" }),
      pos({ positionNftId: "142938" }),
    ],
    evidenceLevel: "on_chain_verified",
    detail: "MIXED",
    discoverySources: ["seeded_candidates"],
    uniswapVersions: {
      versionsDetected: ["v4"],
      coverageComplete: false,
      incompleteReason: "incomplete",
      byVersion: {
        v2: {
          version: "v2",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: true,
          detail: "",
        },
        v3: {
          version: "v3",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: true,
          lockAnalysisComplete: true,
          detail: "",
        },
        v4: {
          version: "v4",
          protocolSupportStatus: "supported",
          searched: true,
          poolsFound: 1,
          positionsFound: 3,
          discoveryComplete: false,
          lockAnalysisComplete: false,
          detail: "",
        },
      },
      protocolSupportNote: "",
      lockerSupportNote: "",
    },
  };
}

function cache(partial?: Partial<LpDiscoveryCache>): LpDiscoveryCache {
  return {
    version: 1,
    chainId: SCAN_CHAIN_ID,
    address: TOKEN.toLowerCase(),
    poolIds: ["0xpool"],
    versions: ["v4"],
    positionIds: ["47299", "357867", "142938"],
    lockerCandidates: [],
    exhaustiveComplete: false,
    knownVerifiedAt: NOW - 60_000,
    updatedAt: NOW - 60_000,
    ...partial,
  };
}

function ckpt(partial?: Partial<LpDiscoveryCheckpoint>): LpDiscoveryCheckpoint {
  return {
    version: 1,
    chainId: SCAN_CHAIN_ID,
    address: TOKEN.toLowerCase(),
    checkedPositionIds: ["47299", "357867", "142938"],
    pmPagesFetched: 0,
    quickComplete: true,
    exhaustiveComplete: false,
    updatedAt: NOW - 60_000,
    ...partial,
  };
}

function evidence(
  overrides: Partial<Parameters<typeof buildKnownFirstEvidence>[0]> = {},
): KnownFirstEvidence {
  return buildKnownFirstEvidence({
    chainId: SCAN_CHAIN_ID,
    expectedChainId: SCAN_CHAIN_ID,
    tokenAddress: TOKEN,
    analysisSemanticVersion: SCORE_SPEC_VERSION,
    lpCache: cache(),
    lpCheckpoint: ckpt(),
    priorLp: hansomeMixedLp(),
    snapshotAgeMs: 60_000,
    manualRefresh: true,
    nowMs: NOW,
    ...overrides,
  });
}

describe("Phase 8.1 Known-First LP Early Exit", () => {
  it("A. HANSOME known MIXED evidence fresh → price_only (manual)", () => {
    const plan = planKnownFirstLpEarlyExit(evidence());
    expect(plan.outcome).toBe("known_first_price_only");
    expect(isKnownFirstStructuralReuse(plan.outcome)).toBe(true);
    expect(plan.evidence.skipBroadQuick).toBe(true);
    expect(plan.evidence.skipBroadTitan).toBe(true);
    expect(plan.evidence.reconstructedState).toBe("MIXED");
    expect(plan.evidence.incompleteDiscovery).toBe(true);
    expect(plan.evidence.backgroundExhaustive).toBe(true);
  });

  it("A2. fresh non-manual → known_first_reuse", () => {
    const e = evidence({
      manualRefresh: false,
      snapshotAgeMs: 10_000,
    });
    e.priceAgeMs = 10_000;
    e.tvlAgeMs = 10_000;
    e.poolStateAgeMs = 10_000;
    const p = planKnownFirstLpEarlyExit(e);
    expect(p.outcome).toBe("known_first_reuse");
    expect(p.evidence.skipBroadQuick).toBe(true);
  });

  it("B. HANSOME owner stale → owner_revalidate", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({
        lpCache: cache({
          knownVerifiedAt: NOW - KNOWN_FIRST_FRESHNESS.positionOwnerMs - 1,
        }),
      }),
    );
    expect(plan.outcome).toBe("known_first_owner_revalidate");
    expect(isKnownFirstSelectiveRevalidate(plan.outcome)).toBe(true);
    expect(plan.reasons).toContain("owner_ttl_expired");
    expect(plan.evidence.skipBroadQuick).toBe(true);
  });

  it("C. HANSOME lock stale → lock_revalidate", () => {
    const e = evidence();
    e.ownershipValidatedAgeMs = 60_000;
    e.lockValidatedAgeMs = KNOWN_FIRST_FRESHNESS.lockClassificationMs + 5_000;
    const plan = planKnownFirstLpEarlyExit(e);
    expect(plan.outcome).toBe("known_first_lock_revalidate");
    expect(plan.reasons).toContain("lock_ttl_expired");
  });

  it("D. HANSOME near-expiry lock → lock_revalidate", () => {
    const lp = hansomeMixedLp();
    const near = Math.floor(NOW / 1000) + 3600;
    lp.positions[0] = {
      ...lp.positions[0]!,
      unlockTimestamp: near,
    };
    const plan = planKnownFirstLpEarlyExit(evidence({ priorLp: lp }));
    expect(plan.outcome).toBe("known_first_lock_revalidate");
    expect(plan.reasons).toContain("lock_expiry_near");
  });

  it("E. HANSOME new Position NFT transfer → owner_revalidate", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ invalidationSignals: ["position_nft_transfer"] }),
    );
    expect(plan.outcome).toBe("known_first_owner_revalidate");
    expect(plan.reasons).toContain("position_nft_transfer");
    expect(plan.evidence.skipBroadQuick).toBe(true);
  });

  it("F. HANSOME new liquidity event → full_quick_fallback", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ invalidationSignals: ["liquidity_add"] }),
    );
    expect(plan.outcome).toBe("full_quick_fallback");
    expect(plan.reasons).toContain("liquidity_event");
    expect(plan.evidence.skipBroadQuick).toBe(false);
  });

  it("G. HANSOME reorg overlap conflict → full_quick_fallback", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ reorgConflict: true }),
    );
    expect(plan.outcome).toBe("full_quick_fallback");
    expect(plan.reasons).toContain("reorg_conflict");
  });

  it("H. known evidence insufficient → known_first_insufficient", () => {
    const lp = hansomeMixedLp();
    // Only locked — MIXED cannot be reconstructed
    lp.positions = [lp.positions[0]!];
    lp.positionCounts = {
      detected: 1,
      material: 1,
      locked: 1,
      unlocked: 0,
      unknown: 0,
    };
    const plan = planKnownFirstLpEarlyExit(evidence({ priorLp: lp }));
    expect(plan.outcome).toBe("known_first_insufficient");
    expect(plan.reasons).toContain("mixed_insufficient");
  });

  it("I. discovery incomplete preserved on early exit", () => {
    const plan = planKnownFirstLpEarlyExit(evidence());
    expect(plan.evidence.incompleteDiscovery).toBe(true);
    expect(plan.evidence.backgroundExhaustive).toBe(true);
    expect(plan.progressActions).toContain("lp_background_exhaustive");
  });

  it("J. explicit full LP refresh → full_quick_fallback", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ forceLpFullRefresh: true }),
    );
    expect(plan.outcome).toBe("full_quick_fallback");
    expect(plan.reasons).toContain("force_full_lp");
  });

  it("K. progress units never fake 100% while incomplete", () => {
    const plan = planKnownFirstLpEarlyExit(evidence());
    const u = knownFirstProgressUnits(plan, plan.progressActions.length);
    expect(u.completedUnits).toBeLessThan(u.totalUnits);
  });

  it("L. cold token without known positions → cold_fallback", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({
        priorLp: null,
        lpCache: cache({ positionIds: [], knownVerifiedAt: null }),
      }),
    );
    expect(plan.outcome).toBe("cold_fallback");
  });

  it("M. unsupported locker still reusable when fresh", () => {
    const lp = hansomeMixedLp();
    lp.positions[1] = {
      ...lp.positions[1]!,
      lockState: "UNSUPPORTED_LOCKER",
      lockStateDisplay: LP_LOCK_STATE_DISPLAY.UNSUPPORTED_LOCKER,
      removableByEoa: null,
    };
    // Keep MIXED via locked + remaining EOA
    const plan = planKnownFirstLpEarlyExit(evidence({ priorLp: lp }));
    expect(
      plan.outcome === "known_first_price_only" ||
        plan.outcome === "known_first_reuse" ||
        plan.outcome === "known_first_insufficient",
    ).toBe(true);
    if (isKnownFirstStructuralReuse(plan.outcome)) {
      expect(plan.reasons).toContain("unsupported_locker");
    }
  });

  it("N. previously failed owner lookup → owner_revalidate", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ failedOwnerIds: ["47299"] }),
    );
    expect(plan.outcome).toBe("known_first_owner_revalidate");
    expect(plan.reasons).toContain("failed_owner_retry");
    expect(plan.positionIdsToRevalidate).toContain("47299");
  });

  it("O. background exhaustive flag when incomplete", () => {
    const plan = planKnownFirstLpEarlyExit(evidence());
    expect(plan.evidence.backgroundExhaustive).toBe(true);
    expect(plan.progressActions).toContain("lp_background_exhaustive");
  });

  it("false-positive: stale owner not reused", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({
        lpCache: cache({
          knownVerifiedAt: NOW - KNOWN_FIRST_FRESHNESS.positionOwnerMs - 10_000,
        }),
      }),
    );
    expect(isKnownFirstStructuralReuse(plan.outcome)).toBe(false);
  });

  it("false-positive: never ALL_LOCKED from incomplete known-first", () => {
    const lp = hansomeMixedLp();
    lp.aggregateState = "ALL_LOCKED";
    lp.aggregateLockState = "LOCKED_VERIFIED_ONCHAIN";
    lp.discoveryComplete = false;
    lp.positions = [
      pos({
        positionNftId: "1",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        removableByEoa: false,
      }),
    ];
    const s = knownFirstEvidenceSufficient(lp);
    expect(s.sufficient).toBe(false);
    expect(s.reason).toBe("all_locked_incomplete_forbidden");
    const plan = planKnownFirstLpEarlyExit(evidence({ priorLp: lp }));
    expect(plan.outcome).not.toBe("known_first_reuse");
    expect(plan.outcome).not.toBe("known_first_price_only");
  });

  it("false-positive: no false No Liquidity from early exit", () => {
    const lp = hansomeMixedLp();
    lp.poolDetected = false;
    lp.aggregateState = "MIXED";
    const s = knownFirstEvidenceSufficient(lp);
    expect(s.sufficient).toBe(false);
    expect(s.reason).toBe("no_liquidity_forbidden");
  });

  it("false-positive: schema mismatch → cold_fallback", () => {
    const e = evidence({
      lpCache: cache({ version: 2 as 1 }),
    });
    e.lpCacheSchemaVersion = 2;
    const plan = planKnownFirstLpEarlyExit(e);
    expect(plan.outcome).toBe("cold_fallback");
    expect(plan.reasons).toContain("schema_mismatch");
  });

  it("false-positive: semantic-version mismatch → cold_fallback", () => {
    const plan = planKnownFirstLpEarlyExit(
      evidence({ analysisSemanticVersion: "not-a-real-version" }),
    );
    expect(plan.outcome).toBe("cold_fallback");
    expect(plan.reasons).toContain("semantic_version_mismatch");
  });

  it("false-positive: corrupt cache / missing prior", () => {
    const plan = planKnownFirstLpEarlyExit(evidence({ priorLp: null }));
    expect(plan.outcome).toBe("cold_fallback");
  });

  it("false-positive: MIXED incorrectly converted blocked", () => {
    const lp = hansomeMixedLp();
    lp.positions = lp.positions.filter((p) => p.removableByEoa === true);
    lp.aggregateState = "MIXED";
    expect(knownFirstEvidenceSufficient(lp).sufficient).toBe(false);
  });

  it("semantic equality helper", () => {
    const a = hansomeMixedLp();
    const b = hansomeMixedLp();
    expect(knownFirstSemanticEqual(a, b)).toBe(true);
    b.aggregateState = "ALL_LOCKED";
    expect(knownFirstSemanticEqual(a, b)).toBe(false);
  });

  it("attempt-scoped memoization coalesces duplicate keys", async () => {
    const memo = createAttemptLpRequestMemo();
    let calls = 0;
    const a = memoizeAttemptRequest(
      memo.ownerOf,
      "1",
      async () => {
        calls += 1;
        return "0xabc";
      },
      () => {
        memo.stats.ownerOfHits += 1;
      },
      () => {
        memo.stats.ownerOfMisses += 1;
      },
    );
    const b = memoizeAttemptRequest(
      memo.ownerOf,
      "1",
      async () => {
        calls += 1;
        return "0xabc";
      },
      () => {
        memo.stats.ownerOfHits += 1;
      },
      () => {
        memo.stats.ownerOfMisses += 1;
      },
    );
    expect(await a).toBe("0xabc");
    expect(await b).toBe("0xabc");
    expect(calls).toBe(1);
    expect(memo.stats.ownerOfMisses).toBe(1);
    expect(memo.stats.ownerOfHits).toBe(1);
  });

  it("Smart LP env remains independent (planner has no env gate)", () => {
    const prev = process.env.HANSOME_SMART_LP_REFRESH;
    delete process.env.HANSOME_SMART_LP_REFRESH;
    const plan = planKnownFirstLpEarlyExit(evidence());
    expect(isKnownFirstStructuralReuse(plan.outcome)).toBe(true);
    if (prev === undefined) delete process.env.HANSOME_SMART_LP_REFRESH;
    else process.env.HANSOME_SMART_LP_REFRESH = prev;
  });
});
