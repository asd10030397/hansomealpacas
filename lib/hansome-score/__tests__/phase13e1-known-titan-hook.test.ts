/**
 * Phase 13E.1 — Known-Titan / Known-Hook early bootstrap + publish protection.
 */
import { describe, expect, it } from "vitest";
import {
  DEEP_KNOWN_FIRST_PUBLISH_PERSIST_CAP_MS,
  DEEP_PUBLISH_PERSIST_CAP_MS,
  isKnownFirstDurablePublishAction,
} from "@/lib/hansome-score/deep-settlement";
import {
  preferVerifiedLpAgainstIncomplete,
  staticKnownBootstrapSeeds,
  tryVerifyKnownHookBootstrap,
} from "@/lib/hansome-score/lp/known-bootstrap-resolver";
import {
  applyFixtureBootstrap,
  findHookPoolFixtureByToken,
  GME_FIXTURE_POSITIONS,
  type HookSyncOptions,
} from "@/lib/hansome-score/lp/hook-position-index";
import { FORCE_LP_TOKEN_CONTRACTS } from "@/lib/hansome-score/lp/force-lp-recovery";
import { HANSOME_TOKEN, SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import type { LpIntelligence } from "@/lib/hansome-score/types";

const GME = FORCE_LP_TOKEN_CONTRACTS.GME.address;
const OKC = FORCE_LP_TOKEN_CONTRACTS.OKC.address;
const BEER = FORCE_LP_TOKEN_CONTRACTS.BEER.address;

function baseIntel(
  partial: Partial<LpIntelligence> & {
    positions?: LpIntelligence["positions"];
  },
): LpIntelligence {
  return {
    poolDetected: true,
    poolsDetectedCount: 1,
    poolId: null,
    poolManagerBalanceRaw: "1",
    poolManagerBalanceFormatted: "1",
    aggregateLockState: "UNABLE_TO_DETERMINE",
    aggregateLockStateDisplay: "UNKNOWN — INCOMPLETE",
    aggregateState: "UNKNOWN_INCOMPLETE",
    aggregateStateDisplay: "UNKNOWN — INCOMPLETE",
    positionCounts: {
      detected: partial.positions?.length ?? 0,
      material: partial.positions?.length ?? 0,
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
      method: "none",
      reason: "test",
    },
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning: null,
    ownershipRiskNote: "test",
    sizeWarning: false,
    positions: [],
    evidenceLevel: "unavailable",
    detail: "test",
    discoverySources: ["test"],
    uniswapVersions: {
      versionsDetected: [],
      coverageComplete: false,
      incompleteReason: "test",
      byVersion: {
        v2: {
          version: "v2",
          protocolSupportStatus: "unsupported",
          searched: false,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: false,
          lockAnalysisComplete: false,
          detail: "",
        },
        v3: {
          version: "v3",
          protocolSupportStatus: "supported",
          searched: false,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: false,
          lockAnalysisComplete: false,
          detail: "",
        },
        v4: {
          version: "v4",
          protocolSupportStatus: "supported",
          searched: false,
          poolsFound: 0,
          positionsFound: 0,
          discoveryComplete: false,
          lockAnalysisComplete: false,
          detail: "",
        },
      },
    },
    ...partial,
  } as LpIntelligence;
}

describe("Phase 13E.1 Known-Titan / Known-Hook", () => {
  it("1. HANSOME static seeds include Titan position IDs", () => {
    const h = staticKnownBootstrapSeeds(HANSOME_TOKEN);
    expect(h.completeness.knownTitan).toBe(true);
    expect(h.positionIds).toEqual(
      expect.arrayContaining(["47299", "357867", "142938"]),
    );
  });

  it("2. GME fixture has createTx + salts 0–7", () => {
    const fixture = findHookPoolFixtureByToken(GME);
    expect(fixture).not.toBeNull();
    expect(fixture!.createTx).toMatch(/^0x/);
    expect(fixture!.fixturePositions?.length).toBe(8);
    expect(GME_FIXTURE_POSITIONS).toHaveLength(8);
  });

  it("3. OKC fixture is allowlisted but createTx unknown", () => {
    const fixture = findHookPoolFixtureByToken(OKC);
    expect(fixture).not.toBeNull();
    expect(fixture!.createTx).toBeNull();
    expect(fixture!.fixtureComplete).toBe(false);
  });

  it("4. applyFixtureBootstrap seeds GME hook-owned positions without foreign wait", () => {
    const fixture = findHookPoolFixtureByToken(GME)!;
    const opts: HookSyncOptions = {
      chainId: SCAN_CHAIN_ID,
      poolId: fixture.poolId,
      hookAddress: fixture.hookAddress,
      positionManager: fixture.positionManager,
      poolManager: fixture.poolManager,
      createTx: fixture.createTx,
      createBlock: fixture.createBlock,
      fixture,
      indexForeign: false,
    };
    const state = applyFixtureBootstrap(opts, fixture);
    expect(state.positions.filter((p) => p.classification === "hook_owned")).toHaveLength(
      8,
    );
    expect(state.foreignDiscoveryComplete).toBe(false);
    expect(state.incompleteReasons).toContain("foreign_backfill_skipped");
    expect(state.terminalState).toBe("SUCCESS_PARTIAL");
  });

  it("5. tryVerifyKnownHookBootstrap publishes GME hook_native without foreign exhaustive", async () => {
    const hit = await tryVerifyKnownHookBootstrap({
      tokenAddress: GME,
      poolManagerBalance: 1n,
      budgetMs: 4_000, // fixture-only (enrich requires >=10s)
    });
    expect(hit).not.toBeNull();
    expect(hit!.intelligence.ownershipClass).toBe("hook_native");
    expect(hit!.intelligence.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(hit!.intelligence.hookPositionIndex?.hookOwnedCount).toBe(8);
    expect(hit!.intelligence.discoverySources).toContain("known_hook_pre_parallel");
    expect(hit!.intelligence.lockDistribution.available).toBe(false);
  });

  it("6. tryVerifyKnownHookBootstrap publishes OKC honest UNKNOWN_INCOMPLETE terminal", async () => {
    const hit = await tryVerifyKnownHookBootstrap({
      tokenAddress: OKC,
      poolManagerBalance: 1n,
      budgetMs: 4_000,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intelligence.ownershipClass).toBe("hook_native");
    expect(hit!.intelligence.aggregateState).toBe("UNKNOWN_INCOMPLETE");
    expect(hit!.intelligence.completenessWarning).toMatch(/UNKNOWN_INCOMPLETE|createTx/i);
    expect(hit!.legacyStatus).toBe("unknown");
  });

  it("7. Known-Hook evidence wins over empty late/timeout rediscovery", () => {
    const prior = baseIntel({
      ownershipClass: "hook_native",
      poolId: "0xabc",
      ownershipClassEvidence: ["known_hook_fixture_allowlist"],
      hookPositionIndex: {
        poolId: "0xabc",
        hookAddress: "0xhook",
        indexedPositionCount: 8,
        hookOwnedCount: 8,
        foreignPosmCount: 0,
        foreignOtherCount: 0,
        activeHookOwnedCount: 0,
        hookDiscoveryComplete: false,
        foreignDiscoveryComplete: false,
        discoveryMethod: "fixture",
        terminalState: "SUCCESS_PARTIAL",
      },
      detail: "Known-Hook bootstrap (GME)",
      discoverySources: ["known_hook_pre_parallel"],
    });
    const next = baseIntel({
      positions: [],
      ownershipClass: "unknown",
      detail: "v4: probe budget exceeded — timeout soft-fail.",
      discoverySources: ["multi_version_orchestrator"],
    });
    const kept = preferVerifiedLpAgainstIncomplete(prior, next);
    expect(kept.ownershipClass).toBe("hook_native");
    expect(kept.hookPositionIndex?.hookOwnedCount).toBe(8);
    expect(kept.discoverySources).toContain("known_hook_wins_empty_timeout");
  });

  it("8. Known-Pons verified path still never-downgrades (BEER regression safety)", () => {
    const prior = baseIntel({
      aggregateState: "ALL_LOCKED",
      aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
      positions: [
        {
          positionNftId: "436637",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
          poolId: "0xbeer",
          removableByEoa: false,
        } as LpIntelligence["positions"][number],
      ],
      knownPositionsVerified: true,
    });
    const next = baseIntel({
      positions: [],
      detail: "timeout incomplete",
    });
    const kept = preferVerifiedLpAgainstIncomplete(prior, next);
    expect(kept.positions.some((p) => p.positionNftId === "436637")).toBe(true);
    expect(kept.discoverySources).toContain("known_bootstrap_never_downgrade");
  });

  it("9. BEER seeds remain knownPons-only (no Titan/Hook cross-talk)", () => {
    const b = staticKnownBootstrapSeeds(BEER);
    expect(b.completeness.knownPons).toBe(true);
    expect(b.completeness.knownTitan).toBeFalsy();
    expect(b.completeness.knownHook).toBeFalsy();
  });

  it("10. Known-First durable publish actions get extended persist budget", () => {
    expect(isKnownFirstDurablePublishAction("lp_known_first_early_exit")).toBe(
      true,
    );
    expect(isKnownFirstDurablePublishAction("timeout")).toBe(false);
    expect(DEEP_KNOWN_FIRST_PUBLISH_PERSIST_CAP_MS).toBeGreaterThan(
      DEEP_PUBLISH_PERSIST_CAP_MS,
    );
    expect(DEEP_KNOWN_FIRST_PUBLISH_PERSIST_CAP_MS).toBeGreaterThanOrEqual(
      20_000,
    );
  });

  it("11. empty-auth + Locked next retains Locked (cross-fence salvage seed)", () => {
    const prior = baseIntel({ positions: [] });
    const next = baseIntel({
      aggregateState: "ALL_LOCKED",
      aggregateLockState: "LOCKED_VERIFIED_ONCHAIN",
      positions: [
        {
          positionNftId: "436637",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          owner: "0x736D76699C26D0d966744cAe304C000d471f7F35",
          poolId: "0xbeer",
          removableByEoa: false,
        } as LpIntelligence["positions"][number],
      ],
      knownPositionsVerified: true,
    });
    const kept = preferVerifiedLpAgainstIncomplete(prior, next);
    expect(
      kept.positions.some(
        (p) =>
          p.positionNftId === "436637" &&
          p.lockState === "LOCKED_VERIFIED_ONCHAIN",
      ),
    ).toBe(true);
  });

  it("12. useful PosM/Titan body wins over empty late timeout (IDs not erased)", () => {
    const prior = baseIntel({
      ownershipClass: "posm_nft",
      positions: [
        {
          positionNftId: "47299",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          owner: "0xTitanChild",
          poolId: "0xhansome",
          removableByEoa: false,
        } as LpIntelligence["positions"][number],
        {
          positionNftId: "357867",
          lockState: "UNLOCKED_EOA_CONTROLLED",
          owner: "0xEoa",
          poolId: "0xhansome",
          removableByEoa: true,
        } as LpIntelligence["positions"][number],
        {
          positionNftId: "142938",
          lockState: "LOCKED_VERIFIED_ONCHAIN",
          owner: "0xTitanChild2",
          poolId: "0xhansome",
          removableByEoa: false,
        } as LpIntelligence["positions"][number],
      ],
      discoverySources: ["known_bootstrap", "bootstrap:registry_titan", "titan_pre_parallel"],
      detail: "Known-Titan bootstrap verified",
      knownPositionsVerified: true,
    });
    const next = baseIntel({
      positions: [],
      ownershipClass: "unknown",
      detail: "v4: probe budget exceeded — timeout soft-fail.",
      discoverySources: ["multi_version_orchestrator"],
    });
    const kept = preferVerifiedLpAgainstIncomplete(prior, next);
    expect(kept.positions.map((p) => p.positionNftId).sort()).toEqual([
      "142938",
      "357867",
      "47299",
    ]);
    expect(kept.ownershipClass).toBe("posm_nft");
    expect(kept.discoverySources).toContain("known_titan_wins_empty_timeout");
  });
});
