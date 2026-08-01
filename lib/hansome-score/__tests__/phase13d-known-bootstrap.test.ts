/**
 * Phase 13D / 13D.1 / 13D.2 — Known-First Bootstrap + Snapshot + Adaptive Budget.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  mergeKnownBootstrapInputs,
  preferVerifiedLpAgainstIncomplete,
  resolveKnownBootstrap,
  staticKnownBootstrapSeeds,
} from "@/lib/hansome-score/lp/known-bootstrap-resolver";
import {
  clearLpBootstrapCacheForTests,
  clearLpBootstrapCacheTestKv,
  useLpBootstrapCacheTestKv,
} from "@/lib/hansome-score/lp/lp-bootstrap-cache";
import {
  buildLpPersistentSnapshot,
  clearLpPersistentSnapshotForTests,
  clearLpPersistentSnapshotTestKv,
  loadSnapshotForForceRefresh,
  persistLpPersistentSnapshot,
  useLpPersistentSnapshotTestKv,
} from "@/lib/hansome-score/lp/lp-persistent-snapshot";
import {
  AdaptiveDiscoveryBudget,
  ADAPTIVE_LIQUIDITY_BUDGET,
  computeAdaptiveHardBoundMs,
} from "@/lib/hansome-score/lp/adaptive-discovery-budget";
import { FORCE_LP_TOKEN_CONTRACTS } from "@/lib/hansome-score/lp/force-lp-recovery";
import { HANSOME_TOKEN } from "@/lib/hansome-score/constants";
import { setDeploymentScopeForTests } from "@/lib/hansome-score/deployment-scope";
import type { LpIntelligence } from "@/lib/hansome-score/types";

const BEER = FORCE_LP_TOKEN_CONTRACTS.BEER.address;
const GME = FORCE_LP_TOKEN_CONTRACTS.GME.address;
const OKC = FORCE_LP_TOKEN_CONTRACTS.OKC.address;

function baseIntel(positions: LpIntelligence["positions"]): LpIntelligence {
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: null,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
    aggregateLockStateDisplay: "ALL LOCKED — VERIFIED ON-CHAIN",
    aggregateState: "ALL_LOCKED",
    aggregateStateDisplay: "ALL LOCKED — VERIFIED ON-CHAIN",
    positionCounts: {
      detected: positions.length,
      material: positions.length,
      locked: positions.filter((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")
        .length,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: {
      available: true,
      lockedPct: 100,
      unlockedPct: 0,
      unknownPct: 0,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
      method: "token_amounts",
      reason: "test",
    },
    discoveryComplete: true,
    knownPositionsVerified: true,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: null,
    ownershipRiskNote: "test",
    sizeWarning: false,
    positions,
    evidenceLevel: "on_chain_verified",
    detail: "verified",
    discoverySources: ["test"],
  } as unknown as LpIntelligence;
}

afterEach(() => {
  clearLpBootstrapCacheForTests();
  clearLpBootstrapCacheTestKv();
  clearLpPersistentSnapshotForTests();
  clearLpPersistentSnapshotTestKv();
  setDeploymentScopeForTests(null);
});

describe("Phase 13D KnownBootstrapResolver", () => {
  it("priority seeds: HANSOME Titan → BEER Pons → GME/OKC Hook", () => {
    const h = staticKnownBootstrapSeeds(HANSOME_TOKEN);
    expect(h.stages).toContain("known_titan");
    expect(h.positionIds).toContain("47299");
    expect(h.completeness.knownTitan).toBe(true);

    const b = staticKnownBootstrapSeeds(BEER);
    expect(b.stages).toContain("known_pons");
    expect(b.positionIds).toContain("436637");
    expect(b.completeness.knownPons).toBe(true);

    const g = staticKnownBootstrapSeeds(GME);
    expect(g.stages).toContain("known_hook");
    expect(g.poolIds.length).toBeGreaterThan(0);
    expect(g.completeness.knownHook).toBe(true);

    const o = staticKnownBootstrapSeeds(OKC);
    expect(o.stages).toContain("known_hook");
    expect(o.completeness.knownHook).toBe(true);
  });

  it("merge is idempotent for same inputs", () => {
    const a = mergeKnownBootstrapInputs({ tokenAddress: BEER });
    const b = mergeKnownBootstrapInputs({ tokenAddress: BEER });
    expect(a.diagnostics.idempotentKey).toBe(b.diagnostics.idempotentKey);
    expect(a.positionIds).toEqual(b.positionIds);
    expect(a.advisory).toBe(true);
  });

  it("bootstrap remains advisory with completeness flags", async () => {
    setDeploymentScopeForTests("candidate:test13d");
    useLpBootstrapCacheTestKv(new Map());
    const pack = await resolveKnownBootstrap({ tokenAddress: BEER });
    expect(pack.advisory).toBe(true);
    expect(pack.completeness.knownPons).toBe(true);
    expect(pack.completeness.genericReady).toBe(true);
    expect(pack.stagesHit[0]).toBe("known_pons");
    expect(pack.nextStage).toBe("historical_position_index");
  });

  it("never downgrades verified LP against incomplete rediscovery", () => {
    const prior = baseIntel([
      {
        positionNftId: "436637",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
        poolId: "0xabc",
        removableByEoa: false,
      } as LpIntelligence["positions"][number],
    ]);
    const next = baseIntel([]);
    next.aggregateState = "UNKNOWN_INCOMPLETE";
    next.aggregateLockState = "UNABLE_TO_DETERMINE";
    next.knownPositionsVerified = false;
    next.discoveryComplete = false;
    next.detail = "v3: probe budget exceeded — incomplete.";
    next.positions = [];

    const kept = preferVerifiedLpAgainstIncomplete(prior, next);
    expect(kept.positions.some((p) => p.positionNftId === "436637")).toBe(true);
    expect(kept.positions[0]?.lockState).toBe("LOCKED_VERIFIED_ONCHAIN");
    expect(kept.discoverySources).toContain("known_bootstrap_never_downgrade");
  });

  it("historical cache unions into bootstrap pack", () => {
    const pack = mergeKnownBootstrapInputs({
      tokenAddress: BEER,
      lpCache: {
        version: 1,
        chainId: 4663,
        address: BEER.toLowerCase(),
        poolIds: ["0xpool"],
        versions: ["v3"],
        positionIds: ["436637", "999"],
        lockerCandidates: [],
        exhaustiveComplete: false,
        knownVerifiedAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
    expect(pack.positionIds).toContain("999");
    expect(pack.stagesHit).toContain("historical_position_index");
    expect(pack.completeness.historicalIndex).toBe(true);
  });
});

describe("Phase 13D.1 Persistent LP Snapshot", () => {
  it("persists IDs + evidence refs and requires revalidation on force load", async () => {
    setDeploymentScopeForTests("candidate:test13d1");
    useLpPersistentSnapshotTestKv(new Map());
    const intel = baseIntel([
      {
        positionNftId: "436637",
        lockState: "LOCKED_VERIFIED_ONCHAIN",
        owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
        poolId: "0xabc",
        removableByEoa: false,
      } as LpIntelligence["positions"][number],
    ]);
    const built = buildLpPersistentSnapshot({
      chainId: 4663,
      tokenAddress: BEER,
      intelligence: intel,
      discoveryGeneration: "d_test",
      publishGeneration: "lp_gen_1",
    });
    expect(built.requiresRevalidation).toBe(true);
    expect(built.positionIds).toEqual(["436637"]);
    expect(built.ownershipEvidenceRefs[0]?.lockStateHint).toBe(
      "LOCKED_VERIFIED_ONCHAIN",
    );
    await persistLpPersistentSnapshot(built);
    const forceLoad = await loadSnapshotForForceRefresh(4663, BEER);
    expect(forceLoad?.requiresRevalidation).toBe(true);
    expect(forceLoad?.publishGeneration).toBe("lp_gen_1");
    // Snapshot must not be usable as lock truth without revalidation flag.
    expect(forceLoad?.requiresRevalidation).not.toBe(false);
  });

  it("sanitize rejects full positions blobs", async () => {
    setDeploymentScopeForTests("candidate:test13d1b");
    const map = new Map<string, unknown>();
    useLpPersistentSnapshotTestKv(map as never);
    // Directly poke a forbidden blob via map — load must reject.
    const { lpPersistentSnapshotKvKey } = await import(
      "@/lib/hansome-score/lp/lp-persistent-snapshot"
    );
    map.set(lpPersistentSnapshotKvKey(4663, BEER), {
      version: 1,
      chainId: 4663,
      address: BEER.toLowerCase(),
      positions: [{ lockState: "LOCKED_VERIFIED_ONCHAIN" }],
      positionIds: ["436637"],
      updatedAt: Date.now(),
    });
    const loaded = await loadSnapshotForForceRefresh(4663, BEER);
    expect(loaded).toBeNull();
  });
});

describe("Phase 13D.2 Adaptive Discovery Budget", () => {
  it("expands while progress; terminates on stall", () => {
    let now = 1_000;
    const budget = new AdaptiveDiscoveryBudget({
      baseBudgetMs: 10_000,
      maxBudgetMs: 30_000,
      stallMs: 5_000,
      expansionStepMs: 10_000,
      maxExpansions: 2,
      now: () => now,
    });
    budget.noteProgress(1);
    expect(budget.shouldContinue()).toBe(true);
    now += 9_000;
    budget.noteProgress(1);
    expect(budget.currentStageBudgetMs()).toBeGreaterThanOrEqual(10_000);
    now += 6_000;
    expect(budget.shouldContinue()).toBe(false);
    expect(budget.diagnostics().terminationReason).toBe("no_forward_progress");
  });

  it("marks success / honest partial terminal reasons", () => {
    const budget = new AdaptiveDiscoveryBudget({
      ...ADAPTIVE_LIQUIDITY_BUDGET,
    });
    budget.noteHeartbeat();
    budget.markSuccess();
    expect(budget.diagnostics().terminationReason).toBe("success");
    const b2 = new AdaptiveDiscoveryBudget({ ...ADAPTIVE_LIQUIDITY_BUDGET });
    b2.markHonestPartial();
    expect(b2.diagnostics().terminationReason).toBe("honest_partial");
  });

  it("computeAdaptiveHardBoundMs respects ceiling", () => {
    const ms = computeAdaptiveHardBoundMs({
      remainingDeadlineMs: 500_000,
      adaptiveLiquidityMaxMs: ADAPTIVE_LIQUIDITY_BUDGET.maxBudgetMs + 5_000,
    });
    expect(ms).toBeLessThanOrEqual(260_000);
    expect(ms).toBeGreaterThan(180_000);
  });
});
