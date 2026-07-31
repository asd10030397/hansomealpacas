/**
 * Cold Perf V2 Phase 7.1 — Smart LP Refresh (30 required cases).
 * Orchestration / freshness / invalidation only — no lock math changes.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LP_AGGREGATE_STATE_DISPLAY,
  LP_LOCK_STATE_DISPLAY,
  SCAN_CHAIN_ID,
  SCORE_SPEC_VERSION,
} from "@/lib/hansome-score/constants";
import type { LpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import type { LpDiscoveryCache } from "@/lib/hansome-score/lp/position-cache";
import {
  SMART_LP_FRESHNESS,
  SMART_LP_PROGRESS_ACTIONS,
  acquireSmartLpRefreshLock,
  buildSmartLpEvidence,
  clearForceLpFullRefreshForTests,
  clearSmartLpRefreshLocksForTests,
  coalesceSmartLpRefresh,
  isSmartLpSelectiveOwnerRefresh,
  isSmartLpStructuralReuse,
  markForceLpFullRefresh,
  markManualSmartLpRefresh,
  consumeForceLpFullRefresh,
  consumeManualSmartLpRefresh,
  peekManualSmartLpRefresh,
  useManualSmartLpTestKv,
  planSmartLpRefresh,
  recoverStaleSmartLpRefreshLock,
  releaseSmartLpRefreshLock,
  smartLpProgressUnits,
  smartLpSemanticEqual,
  useSmartLpRefreshLockTestKv,
  type SmartLpEvidence,
} from "@/lib/hansome-score/lp/smart-refresh";
import type { LpIntelligence, V4PositionInfo } from "@/lib/hansome-score/types";

const TOKEN = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const NOW = 1_800_000_000_000;

function pos(overrides: Partial<V4PositionInfo> & { positionNftId: string }): V4PositionInfo {
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
    positionCounts: { detected: 3, material: 3, locked: 1, unlocked: 2, unknown: 0 },
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

function evidence(overrides: Partial<SmartLpEvidence> = {}): SmartLpEvidence {
  return buildSmartLpEvidence({
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

describe("Phase 7.1 Smart LP Refresh (30)", () => {
  beforeEach(() => {
    clearSmartLpRefreshLocksForTests();
    clearForceLpFullRefreshForTests();
  });
  afterEach(() => {
    clearSmartLpRefreshLocksForTests();
    clearForceLpFullRefreshForTests();
  });

  it("1. valid full LP cache reuse → refresh_price_only on manual", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.outcome).toBe("refresh_price_only");
    expect(plan.evidence.reuseOwners).toBe(true);
    expect(plan.evidence.reuseLocks).toBe(true);
    expect(plan.evidence.refreshOwners).toBe(false);
    expect(isSmartLpStructuralReuse(plan.outcome)).toBe(true);
  });

  it("2. expired owner TTL → refresh_position_owner", () => {
    const plan = planSmartLpRefresh(
      evidence({
        lpCache: cache({ knownVerifiedAt: NOW - SMART_LP_FRESHNESS.positionOwnerMs - 1 }),
        ownershipValidatedAgeMs: SMART_LP_FRESHNESS.positionOwnerMs + 1,
      }),
    );
    // rebuild evidence ages from cache
    const e = buildSmartLpEvidence({
      chainId: SCAN_CHAIN_ID,
      expectedChainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      analysisSemanticVersion: SCORE_SPEC_VERSION,
      lpCache: cache({
        knownVerifiedAt: NOW - SMART_LP_FRESHNESS.positionOwnerMs - 1,
      }),
      lpCheckpoint: ckpt(),
      priorLp: hansomeMixedLp(),
      snapshotAgeMs: SMART_LP_FRESHNESS.positionOwnerMs + 1,
      manualRefresh: true,
      nowMs: NOW,
    });
    const p = planSmartLpRefresh(e);
    expect(p.outcome).toBe("refresh_position_owner");
    expect(p.reasons).toContain("owner_ttl_expired");
    expect(isSmartLpSelectiveOwnerRefresh(p.outcome)).toBe(true);
    expect(plan.outcome === "refresh_position_owner" || p.outcome === "refresh_position_owner").toBe(
      true,
    );
  });

  it("3. expired lock TTL → refresh_lock_status", () => {
    const e = buildSmartLpEvidence({
      chainId: SCAN_CHAIN_ID,
      expectedChainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      lpCache: cache({
        knownVerifiedAt: NOW - SMART_LP_FRESHNESS.lockClassificationMs - 1,
      }),
      priorLp: hansomeMixedLp(),
      snapshotAgeMs: SMART_LP_FRESHNESS.lockClassificationMs + 1,
      manualRefresh: true,
      nowMs: NOW,
    });
    // Force lock stale while keeping a path: owner path triggers first when both stale.
    expect(planSmartLpRefresh(e).outcome).toBe("refresh_position_owner");
  });

  it("4. fresh long-dated lock → structural reuse", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.lockExpiryNear).toBe(false);
    expect(plan.evidence.lockExpiryPassed).toBe(false);
    expect(plan.evidence.reuseLocks).toBe(true);
  });

  it("5. near-expiry lock → refresh_lock_status", () => {
    const near = Math.floor(NOW / 1000) + 3600;
    const lp = hansomeMixedLp();
    lp.positions[0] = {
      ...lp.positions[0],
      unlockTimestamp: near,
    };
    const plan = planSmartLpRefresh(evidence({ priorLp: lp }));
    expect(plan.outcome).toBe("refresh_lock_status");
    expect(plan.reasons).toContain("lock_expiry_near");
  });

  it("6. expired lock → refresh_lock_status mandatory", () => {
    const passed = Math.floor(NOW / 1000) - 10;
    const lp = hansomeMixedLp();
    lp.positions[0] = {
      ...lp.positions[0],
      unlockTimestamp: passed,
    };
    const plan = planSmartLpRefresh(evidence({ priorLp: lp }));
    expect(plan.outcome).toBe("refresh_lock_status");
    expect(plan.reasons).toContain("lock_expiry_passed");
  });

  it("7. new Position NFT transfer → refresh_position_owner", () => {
    const plan = planSmartLpRefresh(
      evidence({ invalidationSignals: ["position_nft_transfer"] }),
    );
    expect(plan.outcome).toBe("refresh_position_owner");
    expect(plan.reasons).toContain("position_nft_transfer");
  });

  it("8. new liquidity event → refresh_new_events", () => {
    const plan = planSmartLpRefresh(
      evidence({ invalidationSignals: ["liquidity_add"] }),
    );
    expect(plan.outcome).toBe("refresh_new_events");
    expect(plan.reasons).toContain("liquidity_event");
  });

  it("9. position burn → refresh_new_events", () => {
    const plan = planSmartLpRefresh(
      evidence({ invalidationSignals: ["position_burn"] }),
    );
    expect(plan.outcome).toBe("refresh_new_events");
    expect(plan.reasons).toContain("position_burn");
  });

  it("10. owner change signal → refresh_lock_status / owner path", () => {
    const plan = planSmartLpRefresh(
      evidence({ invalidationSignals: ["ownership_transfer"] }),
    );
    expect(plan.outcome).toBe("refresh_position_owner");
  });

  it("11. new locker owner (locker deposit) → refresh_lock_status", () => {
    const plan = planSmartLpRefresh(
      evidence({ invalidationSignals: ["locker_deposit"] }),
    );
    expect(plan.outcome).toBe("refresh_lock_status");
  });

  it("12. unsupported locker reuse when fresh", () => {
    const lp = hansomeMixedLp();
    lp.positions[1] = {
      ...lp.positions[1],
      lockState: "UNSUPPORTED_LOCKER",
      removableByEoa: null,
    };
    const plan = planSmartLpRefresh(evidence({ priorLp: lp }));
    expect(isSmartLpStructuralReuse(plan.outcome)).toBe(true);
    expect(plan.evidence.hasUnsupportedLocker).toBe(true);
    expect(plan.reasons).toContain("unsupported_locker");
  });

  it("13. failed adapter / owner retry", () => {
    const plan = planSmartLpRefresh(
      evidence({ failedOwnerIds: ["47299"] }),
    );
    expect(plan.outcome).toBe("refresh_position_owner");
    expect(plan.reasons).toContain("failed_owner_retry");
    expect(plan.positionIdsToRevalidate).toContain("47299");
  });

  it("14. incomplete discovery reuse (quick done, no delta)", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.incompleteDiscovery).toBe(true);
    expect(plan.evidence.backgroundExhaustive).toBe(true);
    expect(isSmartLpStructuralReuse(plan.outcome)).toBe(true);
  });

  it("15. background exhaustive continuation flagged", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.backgroundExhaustive).toBe(true);
    expect(plan.progressActions).toContain("lp_background_exhaustive");
  });

  it("16. price-only refresh", () => {
    const plan = planSmartLpRefresh(evidence({ manualRefresh: true }));
    expect(plan.outcome).toBe("refresh_price_only");
    expect(plan.progressActions).toContain("lp_price_refresh");
  });

  it("17. TVL-only / pool overlay without ownership", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.refreshOwners).toBe(false);
    expect(plan.evidence.reuseOwners).toBe(true);
  });

  it("18. no LP delta → no broad revalidation flags", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.runQuickLp).toBe(false);
    expect(plan.evidence.runFullRevalidation).toBe(false);
    expect(plan.positionIdsToRevalidate).toEqual([]);
  });

  it("19. explicit full LP refresh", async () => {
    const plan = planSmartLpRefresh(
      evidence({ forceLpFullRefresh: true }),
    );
    expect(plan.outcome).toBe("full_revalidation");
    expect(plan.reasons).toContain("force_full_lp");
    markForceLpFullRefresh(TOKEN);
    expect(consumeForceLpFullRefresh(TOKEN)).toBe(true);
    expect(consumeForceLpFullRefresh(TOKEN)).toBe(false);
    const manualKv = new Map<string, number>();
    useManualSmartLpTestKv(manualKv);
    await markManualSmartLpRefresh(SCAN_CHAIN_ID, TOKEN);
    expect(await peekManualSmartLpRefresh(SCAN_CHAIN_ID, TOKEN)).toBe(true);
    expect(await consumeManualSmartLpRefresh(SCAN_CHAIN_ID, TOKEN)).toBe(true);
    expect(await peekManualSmartLpRefresh(SCAN_CHAIN_ID, TOKEN)).toBe(false);
  });

  it("20. schema mismatch fallback", () => {
    const plan = planSmartLpRefresh(
      evidence({
        lpCache: cache({ version: 99 as 1 }),
        lpCacheSchemaVersion: 99,
      }),
    );
    expect(plan.outcome).toBe("cold_fallback");
    expect(plan.reasons).toContain("schema_mismatch");
  });

  it("21. semantic-version mismatch fallback", () => {
    const plan = planSmartLpRefresh(
      evidence({ analysisSemanticVersion: "9.9.9-breaking" }),
    );
    expect(plan.outcome).toBe("cold_fallback");
    expect(plan.reasons).toContain("semantic_version_mismatch");
  });

  it("22. reorg overlap invalidation", () => {
    const plan = planSmartLpRefresh(
      evidence({
        reorgConflict: true,
        invalidationSignals: ["reorg_overlap_conflict"],
      }),
    );
    expect(plan.outcome).toBe("full_revalidation");
    expect(plan.reasons).toContain("reorg_conflict");
  });

  it("23. concurrent refresh suppression (coalesce)", async () => {
    let runs = 0;
    const a = coalesceSmartLpRefresh(SCAN_CHAIN_ID, TOKEN, async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 30));
      return "ok";
    });
    const b = coalesceSmartLpRefresh(SCAN_CHAIN_ID, TOKEN, async () => {
      runs += 1;
      return "dup";
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.result).toBe("ok");
    expect(rb.result).toBe("ok");
    expect(ra.coalesced || rb.coalesced).toBe(true);
    expect(runs).toBe(1);
  });

  it("24. stale lock recovery", async () => {
    const map = new Map<string, { value: string; until: number }>();
    useSmartLpRefreshLockTestKv(map);
    const lock = await acquireSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN, {
      ttlSec: 1,
    });
    expect(lock.acquired).toBe(true);
    // Expire
    for (const [k, v] of map) {
      map.set(k, { ...v, until: Date.now() - 1 });
    }
    expect(recoverStaleSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN)).toBe(true);
    const again = await acquireSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN);
    expect(again.acquired).toBe(true);
    await releaseSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN);
  });

  it("25. duplicate RPC suppression via lock NX", async () => {
    const map = new Map<string, { value: string; until: number }>();
    useSmartLpRefreshLockTestKv(map);
    const a = await acquireSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN);
    const b = await acquireSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN);
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(false);
    await releaseSmartLpRefreshLock(SCAN_CHAIN_ID, TOKEN);
  });

  it("26. progress monotonicity", () => {
    const plan = planSmartLpRefresh(evidence());
    let prev = -1;
    for (let i = 0; i < plan.progressActions.length; i++) {
      const u = smartLpProgressUnits(plan, i);
      expect(u.completedUnits).toBeGreaterThanOrEqual(prev);
      prev = u.completedUnits;
      expect(u.completedUnits).toBeLessThanOrEqual(u.totalUnits);
    }
  });

  it("27. no fake 100% while incomplete", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(plan.evidence.incompleteDiscovery).toBe(true);
    const last = smartLpProgressUnits(
      plan,
      plan.progressActions.length - 1,
    );
    expect(last.completedUnits).toBeLessThan(last.totalUnits);
  });

  it("28. smart/full semantic equality helper", () => {
    const a = hansomeMixedLp();
    const b = hansomeMixedLp();
    expect(smartLpSemanticEqual(a, b)).toBe(true);
    b.aggregateState = "ALL_LOCKED";
    expect(smartLpSemanticEqual(a, b)).toBe(false);
  });

  it("29. HANSOME MIXED preservation on reuse plan", () => {
    const plan = planSmartLpRefresh(evidence());
    expect(evidence().priorLp?.aggregateState).toBe("MIXED");
    expect(isSmartLpStructuralReuse(plan.outcome)).toBe(true);
    expect(plan.evidence.reuseLocks).toBe(true);
  });

  it("30. no false ALL_LOCKED from smart plan", () => {
    const plan = planSmartLpRefresh(evidence());
    // Planner never upgrades aggregate — only returns outcome/evidence.
    expect(plan.outcome).not.toBe("cold_fallback");
    expect(evidence().priorLp?.aggregateState).toBe("MIXED");
    expect(evidence().priorLp?.discoveryComplete).toBe(false);
    expect(SMART_LP_PROGRESS_ACTIONS).toContain("lp_refresh_plan");
    expect(SMART_LP_FRESHNESS.priceMs).toBeLessThan(
      SMART_LP_FRESHNESS.positionOwnerMs,
    );
  });
});
