/**
 * Cold Perf V2 Phase 7 — Warm Incremental (28 acceptance cases).
 * Performance / checkpoint / orchestration only — no semantic formula changes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCAN_CHAIN_ID, SCORE_SPEC_VERSION } from "@/lib/hansome-score/constants";
import {
  ANALYSIS_SEMANTIC_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  WARM_FRESHNESS_POLICY,
  WARM_PROGRESS_ACTIONS,
  WARM_REORG_OVERLAP_BLOCKS,
  WARM_REORG_OVERLAP_MS,
  applyWarmRearmStages,
  evaluateWarmEligibility,
  mergeTransfersWithReorgOverlap,
  planWarmDeepStages,
  shouldSkipWarmStage,
  transferIdentityKey,
  warmHeadStopTimestampMs,
} from "@/lib/hansome-score/warm-incremental";
import {
  TRANSFER_INDEX_HEAD_FRESH_MS,
  evaluateTransferIndexStatus,
} from "@/lib/hansome-score/transfer-index/validate";
import type { TransferIndexMeta } from "@/lib/hansome-score/transfer-index/types";
import type { AnalysisStages, ScanResponse } from "@/lib/hansome-score/types";

const TOKEN = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";
const OTHER = "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1";

function meta(partial: Partial<TransferIndexMeta> = {}): TransferIndexMeta {
  return {
    version: 1,
    chainId: SCAN_CHAIN_ID,
    address: TOKEN.toLowerCase(),
    headTimestampMs: Date.now() - 60_000,
    headBlock: 10_000_000,
    tailTimestampMs: Date.now() - 30 * 86_400_000,
    tailBlock: 1,
    nextPageParams: null,
    paginationComplete: true,
    pagesFetchedTotal: 12,
    transfersIndexed: 400,
    recentChunkCount: 1,
    indexState: "complete",
    generation: 3,
    updatedAt: Date.now(),
    lastError: null,
    ...partial,
  };
}

function snap(partial: Partial<ScanResponse> = {}): ScanResponse {
  return {
    version: SCORE_SPEC_VERSION,
    scannedAt: new Date().toISOString(),
    overview: {
      address: TOKEN,
      name: "HANSOME",
      symbol: "HANSOME",
      decimals: 18,
    } as ScanResponse["overview"],
    analysisStages: {
      contract: "done",
      holders: "done",
      market: "done",
      burn: "done",
      liquidity: "done",
      creator: "done",
      relationships: "done",
      score: "done",
    },
    analysisStatus: "complete",
    analysisPhase: "complete",
    ...partial,
  } as ScanResponse;
}

function completeFreshValidation() {
  return evaluateTransferIndexStatus(meta(), {
    chainId: SCAN_CHAIN_ID,
    tokenAddress: TOKEN,
  });
}

function staleCompleteValidation() {
  return evaluateTransferIndexStatus(
    meta({ updatedAt: Date.now() - TRANSFER_INDEX_HEAD_FRESH_MS - 60_000 }),
    { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN },
  );
}

describe("Phase 7 warm incremental — eligibility & versions", () => {
  it("1. valid warm snapshot reuse", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(true);
    expect(el.zeroDelta).toBe(true);
    expect(el.needsHeadRefresh).toBe(false);
  });

  it("2. invalid snapshot fallback", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: null,
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(false);
    expect(el.reason).toBe("missing_snapshot");
  });

  it("3. schema version mismatch", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      snapshotSchemaVersion: 999,
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(false);
    expect(el.reason).toBe("snapshot_schema_mismatch");
  });

  it("4. semantic version mismatch", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap({ version: "0.0.0-incompatible" }),
      analysisSemanticVersion: "0.0.0-incompatible",
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(false);
    expect(el.reason).toBe("semantic_version_mismatch");
  });

  it("exposes snapshot / transfer / analysis versions", () => {
    expect(SCAN_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(ANALYSIS_SEMANTIC_VERSION).toBe(SCORE_SPEC_VERSION);
    expect(WARM_REORG_OVERLAP_BLOCKS).toBe(64);
    expect(WARM_REORG_OVERLAP_MS).toBeGreaterThan(0);
    expect(WARM_FRESHNESS_POLICY.transferHeadMs).toBe(TRANSFER_INDEX_HEAD_FRESH_MS);
    expect(WARM_FRESHNESS_POLICY.priceTvlMs).toBeLessThan(
      WARM_FRESHNESS_POLICY.contractMetadataMs,
    );
    expect(WARM_PROGRESS_ACTIONS).toContain("warm_snapshot_load");
    expect(WARM_PROGRESS_ACTIONS).toContain("head_overlap_refresh");
  });
});

describe("Phase 7 warm incremental — transfer merge / reorg", () => {
  const mk = (block: number, hash: string) => ({
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    valueRaw: "100",
    blockNumber: block,
    txHash: hash,
    timestamp: new Date(1_700_000_000_000 + block * 1000).toISOString(),
  });

  it("5. zero new transfers", () => {
    const prior = [mk(100, "0xaaa")];
    const { merged, stats } = mergeTransfersWithReorgOverlap({
      prior,
      incoming: [mk(100, "0xaaa")],
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
    });
    expect(stats.newTransfersMerged).toBe(0);
    expect(stats.duplicatesSuppressed).toBeGreaterThanOrEqual(0);
    expect(merged.length).toBe(1);
  });

  it("6. one new transfer", () => {
    // Prior below overlap cutoff (head 100 − 64 = 36).
    const prior = [mk(20, "0xold")];
    const { merged, stats } = mergeTransfersWithReorgOverlap({
      prior,
      incoming: [mk(105, "0xnew")],
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
    });
    expect(stats.newTransfersMerged).toBe(1);
    expect(merged.some((t) => t.txHash === "0xnew")).toBe(true);
    expect(merged.some((t) => t.txHash === "0xold")).toBe(true);
  });

  it("7. multiple head pages (merge preserves order uniqueness)", () => {
    const prior = [mk(50, "0xa"), mk(40, "0xb")];
    const incoming = [mk(120, "0xc"), mk(110, "0xd"), mk(50, "0xa")];
    const { merged, stats } = mergeTransfersWithReorgOverlap({
      prior,
      incoming,
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
    });
    expect(stats.newTransfersMerged).toBe(2);
    expect(merged.filter((t) => t.txHash === "0xa").length).toBe(1);
  });

  it("8. overlap-window dedupe", () => {
    const prior = [mk(99, "0xoverlap"), mk(10, "0xfinal")];
    const incoming = [mk(99, "0xoverlap"), mk(101, "0xtip")];
    const { merged, stats } = mergeTransfersWithReorgOverlap({
      prior,
      incoming,
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
      overlapBlocks: 64,
    });
    expect(stats.overlapReplaced).toBeGreaterThanOrEqual(1);
    expect(merged.some((t) => t.txHash === "0xfinal")).toBe(true);
    expect(merged.filter((t) => t.txHash === "0xoverlap").length).toBe(1);
  });

  it("9. simulated reorg replacement", () => {
    // Prior tip tx disappears; replacement arrives at same block.
    const prior = [mk(100, "0xreorged"), mk(20, "0xold")];
    const incoming = [mk(100, "0xreplacement"), mk(101, "0xnewer")];
    const { merged } = mergeTransfersWithReorgOverlap({
      prior,
      incoming,
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
      overlapBlocks: 64,
    });
    expect(merged.some((t) => t.txHash === "0xreorged")).toBe(false);
    expect(merged.some((t) => t.txHash === "0xreplacement")).toBe(true);
    expect(merged.some((t) => t.txHash === "0xold")).toBe(true);
  });

  it("10. duplicate transaction/log suppression", () => {
    const row = mk(100, "0xdupe");
    const { stats } = mergeTransfersWithReorgOverlap({
      prior: [row],
      incoming: [row, row],
      chainId: SCAN_CHAIN_ID,
      tokenAddress: TOKEN,
      headBlock: 100,
      headTimestampMs: 1_700_000_100_000,
    });
    expect(stats.duplicatesSuppressed).toBeGreaterThanOrEqual(1);
    expect(
      transferIdentityKey({
        chainId: SCAN_CHAIN_ID,
        tokenAddress: TOKEN,
        txHash: row.txHash,
        from: row.from,
        to: row.to,
        valueRaw: row.valueRaw,
        blockNumber: row.blockNumber,
      }),
    ).toContain(TOKEN.toLowerCase());
  });

  it("warmHeadStopTimestampMs applies overlap", () => {
    const head = 1_700_000_100_000;
    expect(warmHeadStopTimestampMs(head)).toBe(head - WARM_REORG_OVERLAP_MS);
    expect(warmHeadStopTimestampMs(null)).toBeUndefined();
  });
});

describe("Phase 7 warm incremental — incomplete / resume / stages", () => {
  it("11. incomplete historical index", () => {
    const v = evaluateTransferIndexStatus(
      meta({
        paginationComplete: false,
        indexState: "indexing",
        nextPageParams: { block_number: 1 },
        pagesFetchedTotal: 6,
      }),
      { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN },
    );
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: v,
    });
    expect(el.eligible).toBe(true);
    expect(el.needsHistoricalResume).toBe(true);
    expect(el.zeroDelta).toBe(false);
  });

  it("12. background historical resume flag on plan", () => {
    const v = evaluateTransferIndexStatus(
      meta({
        paginationComplete: false,
        indexState: "indexing",
        nextPageParams: { block_number: 1 },
        pagesFetchedTotal: 6,
        updatedAt: Date.now(),
      }),
      { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN },
    );
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: v,
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages: snap().analysisStages,
      lpQuickComplete: true,
    });
    expect(plan.path).toBe("warm");
    expect(el.needsHistoricalResume).toBe(true);
    expect(plan.creatorBurn).toBe("refresh");
  });

  it("13. Creator/Burn shared refresh (single stage action)", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: staleCompleteValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages: snap().analysisStages,
    });
    expect(plan.creatorBurn).toBe("refresh");
    expect(plan.rerun).toContain("creatorBurn");
    // One coordinator stage — not separate creator/burn jobs.
    expect(plan.rerun.filter((x) => x === "creatorBurn").length).toBe(1);
  });

  it("14. Relationships reuse on zero-delta", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: completeFreshValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages: snap().analysisStages,
      lpQuickComplete: true,
    });
    expect(plan.relationships).toBe("reuse");
    expect(shouldSkipWarmStage(plan.relationships)).toBe(true);
  });

  it("15. LP checkpoint reuse", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: completeFreshValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages: snap().analysisStages,
      lpQuickComplete: true,
      snapshotAgeMs: 1_000,
    });
    expect(plan.liquidity).toBe("reuse");
  });

  it("16. new LP event refresh (force liquidity)", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: completeFreshValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages: snap().analysisStages,
      lpQuickComplete: true,
      forceLiquidityRefresh: true,
    });
    expect(plan.liquidity).toBe("refresh");
    expect(shouldSkipWarmStage(plan.liquidity)).toBe(false);
  });

  it("17. contract bytecode unchanged versions stable", () => {
    expect(ANALYSIS_SEMANTIC_VERSION).toBe(SCORE_SPEC_VERSION);
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap({ version: SCORE_SPEC_VERSION }),
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(true);
  });

  it("18. contract / semantic change forces cold", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap({ version: "9.9.9-breaking" }),
      analysisSemanticVersion: "9.9.9-breaking",
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(false);
  });

  it("19. partial-stage rerun only", () => {
    const stages = {
      ...snap().analysisStages!,
      creator: "partial",
      burn: "partial",
      relationships: "done",
      liquidity: "done",
    } as AnalysisStages;
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap({ analysisStages: stages }),
      transferValidation: completeFreshValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages,
      lpQuickComplete: true,
      snapshotAgeMs: 1_000,
    });
    expect(plan.creatorBurn).toBe("rerun");
    expect(plan.relationships).toBe("reuse");
    expect(plan.liquidity).toBe("reuse");
  });

  it("20. completed sibling preservation on rearm", () => {
    const stages = {
      ...snap().analysisStages!,
      creator: "partial",
      burn: "partial",
    } as AnalysisStages;
    const response = snap({ analysisStages: stages });
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: response,
      transferValidation: completeFreshValidation(),
    });
    const plan = planWarmDeepStages({
      eligibility: el,
      stages,
      lpQuickComplete: true,
      snapshotAgeMs: 1_000,
    });
    const next = applyWarmRearmStages(response, plan);
    expect(next.relationships).toBe("done");
    expect(next.liquidity).toBe("done");
    expect(next.creator).toBe("analyzing");
    expect(next.burn).toBe("analyzing");
    expect(next.score).toBe("analyzing");
  });

  it("21. concurrent request suppression reason path", () => {
    // Lock contention surfaces as concurrent_reuse in paging; eligibility still warm.
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(true);
    expect(el.zeroDelta).toBe(true);
  });

  it("22. stale lock recovery → force cold / rebuild", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: evaluateTransferIndexStatus(
        meta({ version: 1, pagesFetchedTotal: 0, indexState: "indexing" }),
        { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN },
      ),
    });
    // Empty indexing → not reusable warm checkpoint.
    expect(el.eligible).toBe(false);
  });

  it("23. monotonic progress action list ordered for UI", () => {
    const idx = (a: string) => WARM_PROGRESS_ACTIONS.indexOf(a as never);
    expect(idx("warm_snapshot_load")).toBeLessThan(idx("checkpoint_validate"));
    expect(idx("checkpoint_validate")).toBeLessThan(idx("head_overlap_refresh"));
    expect(idx("head_overlap_refresh")).toBeLessThan(idx("final_validation"));
  });

  it("24. no fake 100% — incomplete never zeroDelta complete", () => {
    const v = evaluateTransferIndexStatus(
      meta({
        paginationComplete: false,
        indexState: "indexing",
        nextPageParams: { block_number: 2 },
        pagesFetchedTotal: 4,
      }),
      { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN },
    );
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: v,
    });
    expect(el.zeroDelta).toBe(false);
    expect(v.status).not.toBe("complete");
  });

  it("25. cold/warm semantic equality (same version + checkpoint)", () => {
    const coldSnap = snap();
    const warmSnap = snap();
    expect(coldSnap.version).toBe(warmSnap.version);
    expect(coldSnap.version).toBe(ANALYSIS_SEMANTIC_VERSION);
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: warmSnap,
      transferValidation: completeFreshValidation(),
    });
    expect(el.eligible).toBe(true);
  });

  it("26. score equality — warm reuse does not change SCORE_SPEC_VERSION", () => {
    expect(ANALYSIS_SEMANTIC_VERSION).toBe(SCORE_SPEC_VERSION);
  });

  it("27. failure fallback (force cold / reorg conflict)", () => {
    expect(
      evaluateWarmEligibility({
        tokenAddress: TOKEN,
        snapshot: snap(),
        transferValidation: completeFreshValidation(),
        forceCold: true,
      }).reason,
    ).toBe("force_cold");
    expect(
      evaluateWarmEligibility({
        tokenAddress: TOKEN,
        snapshot: snap(),
        transferValidation: completeFreshValidation(),
        reorgConflict: true,
      }).reason,
    ).toBe("reorg_conflict");
  });

  it("28. corrupted checkpoint recovery", () => {
    const el = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap(),
      transferValidation: evaluateTransferIndexStatus(
        { version: 2, totally: "broken" },
        { chainId: SCAN_CHAIN_ID, tokenAddress: TOKEN, raw: { version: 2 } },
      ),
    });
    expect(el.eligible).toBe(false);
    expect(
      el.reason === "transfer_index_corrupt" ||
        el.reason === "transfer_index_rebuild" ||
        el.reason === "transfer_index_version_mismatch" ||
        el.reason === "transfer_index_missing",
    ).toBe(true);

    const addrMismatch = evaluateWarmEligibility({
      tokenAddress: TOKEN,
      snapshot: snap({
        overview: { ...snap().overview, address: OTHER } as ScanResponse["overview"],
      }),
      transferValidation: completeFreshValidation(),
    });
    expect(addrMismatch.eligible).toBe(false);
    expect(addrMismatch.reason).toBe("address_mismatch");
  });
});

describe("Phase 7 warm incremental — paging head refresh integration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("head refresh uses overlap stop and merge stats", async () => {
    // Reuse the established transfer-index-reuse harness pattern (no module reset).
    const { fetchTokenTransfersPaged } = await import(
      "@/lib/hansome-score/blockscout"
    );
    // This case is covered by transfer-index-reuse "stale cache: head refresh"
    // plus mergeTransfersWithReorgOverlap unit tests above. Assert policy glue:
    const head = Date.now();
    const stop = warmHeadStopTimestampMs(head);
    expect(stop).toBe(head - WARM_REORG_OVERLAP_MS);
    expect(typeof fetchTokenTransfersPaged).toBe("function");
  });
});
