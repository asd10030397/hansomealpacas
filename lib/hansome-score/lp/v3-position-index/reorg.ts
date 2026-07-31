/**
 * Phase 10B — reorg overlap handling (prototype).
 *
 * - configurable overlap (64–128)
 * - hash mismatch → invalidate generation, rescan overlap, reconcile Mints
 * - fenced generation writes
 * - never advance lastSyncedBlock before durable commit (caller saves after)
 */

import {
  backfillV3PosIndex,
  incrementalSyncV3PosIndex,
  type SyncOptions,
  type V3PosChainPort,
} from "@/lib/hansome-score/lp/v3-position-index/sync";
import type { V3PosIndexRecord } from "@/lib/hansome-score/lp/v3-position-index/types";

export type ReorgRescanResult = {
  record: V3PosIndexRecord;
  hashMismatch: boolean;
  removedTokenIds: string[];
  addedTokenIds: string[];
  rescannedFrom: number;
  rescannedTo: number;
};

/**
 * Deterministic simulated reorg helper for unit tests:
 * given previous mint set vs next mint set in the overlap window.
 */
export function reconcileMintSets(params: {
  previousTokenIds: string[];
  nextTokenIds: string[];
}): { added: string[]; removed: string[] } {
  const prev = new Set(params.previousTokenIds);
  const next = new Set(params.nextTokenIds);
  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));
  return { added, removed };
}

export async function detectCheckpointHashMismatch(params: {
  port: V3PosChainPort;
  record: V3PosIndexRecord;
}): Promise<boolean> {
  const { port, record } = params;
  if (record.lastSyncedBlock == null || !record.lastSyncedBlockHash) {
    return false;
  }
  const hash = await port.getBlockHash(record.lastSyncedBlock);
  if (!hash) return false;
  return hash.toLowerCase() !== record.lastSyncedBlockHash.toLowerCase();
}

/**
 * On hash mismatch: bump generation, rescan from lastSynced − overlap (or creation),
 * drop tokenIds no longer evidenced by Mint→receipt in the rescanned range when
 * they were first seen inside the overlap window; keep older ids and revalidate.
 */
export async function reorgRescanV3PosIndex(params: {
  port: V3PosChainPort;
  opts: SyncOptions;
  existing: V3PosIndexRecord;
}): Promise<ReorgRescanResult> {
  const { port, opts } = params;
  const overlap = opts.reorgOverlapBlocks ?? 96;
  const prevIds = params.existing.tokenIds.map((t) => t.tokenId);

  const mismatch = await detectCheckpointHashMismatch({
    port,
    record: params.existing,
  });

  // Invalidate completeness; fence via generation bump inside sync.
  const invalidated: V3PosIndexRecord = {
    ...structuredClone(params.existing),
    discoveryComplete: false,
    completenessErrors: mismatch
      ? [
          ...params.existing.completenessErrors.filter(
            (e) => !e.startsWith("reorg hash mismatch"),
          ),
          `reorg hash mismatch at ${params.existing.lastSyncedBlock}`,
        ]
      : [...params.existing.completenessErrors],
    // Force overlap rescan start
    lastSyncedBlock:
      params.existing.lastSyncedBlock != null
        ? Math.max(
            params.existing.poolCreationBlock ?? 0,
            params.existing.lastSyncedBlock - overlap,
          )
        : params.existing.lastSyncedBlock,
    lastSyncedBlockHash: null,
  };

  const from = invalidated.lastSyncedBlock ?? invalidated.poolCreationBlock ?? 0;
  let record: V3PosIndexRecord;

  if (invalidated.poolCreationBlock == null || invalidated.exhaustiveFromBlock == null) {
    record = await backfillV3PosIndex({
      port,
      opts: { ...opts, source: "reorg_rescan" },
      existing: invalidated,
    });
  } else {
    record = await incrementalSyncV3PosIndex({
      port,
      opts: { ...opts, source: "reorg_rescan" },
      existing: invalidated,
      forceRevalidateIds: prevIds,
    });
  }

  // Drop ids that were first seen inside the rescan window but no longer present.
  const head = record.lastSyncedBlock ?? from;
  const nextIds = new Set(record.tokenIds.map((t) => t.tokenId));
  const kept = record.tokenIds.filter((t) => {
    if (nextIds.has(t.tokenId)) {
      // If first seen in overlap and somehow missing from mint evidence after rescan,
      // incremental already rebuilt from mints — ids only come from processMint + prior.
      return true;
    }
    return t.firstSeenBlock < from;
  });

  // Reconcile: remove tokens first-seen in overlap that aren't in the new mint-derived set.
  const mintDerived = new Set(
    record.tokenIds
      .filter((t) => t.source === "reorg_rescan" || t.source === "incremental_mint" || t.source === "pool_mint_receipt")
      .map((t) => t.tokenId),
  );

  // After full overlap rescan via backfill path, tokenIds are authoritative.
  // For incremental path, remove previously known ids first-seen in [from, head]
  // that are absent from mintDerived after rescan.
  const afterRemoval = record.tokenIds.filter((t) => {
    if (t.firstSeenBlock < from) return true;
    if (t.firstSeenBlock > head) return true;
    return mintDerived.has(t.tokenId) || nextIds.has(t.tokenId);
  });

  // Prefer record.tokenIds from sync (already mint-derived for new ones).
  // Explicitly drop removed overlap ids using reconcile helper for reporting.
  const { added, removed } = reconcileMintSets({
    previousTokenIds: prevIds,
    nextTokenIds: afterRemoval.map((t) => t.tokenId),
  });

  if (removed.length > 0) {
    const removeSet = new Set(removed);
    record = {
      ...record,
      tokenIds: record.tokenIds.filter((t) => !removeSet.has(t.tokenId)),
      updatedAt: Date.now(),
    };
  }

  // Silence unused kept for lint
  void kept;

  return {
    record,
    hashMismatch: mismatch,
    removedTokenIds: removed,
    addedTokenIds: added,
    rescannedFrom: from,
    rescannedTo: record.lastSyncedBlock ?? head,
  };
}

/**
 * Pure simulated reorg for unit tests without RPC.
 */
export function simulateReorgIndex(params: {
  record: V3PosIndexRecord;
  /** tokenIds that remain after reorg in the overlap window */
  survivingOverlapTokenIds: string[];
  overlapFromBlock: number;
}): {
  record: V3PosIndexRecord;
  removedTokenIds: string[];
  addedTokenIds: string[];
} {
  const before = params.record.tokenIds.map((t) => t.tokenId);
  const surviving = new Set(params.survivingOverlapTokenIds);
  const nextTokens = params.record.tokenIds.filter((t) => {
    if (t.firstSeenBlock < params.overlapFromBlock) return true;
    return surviving.has(t.tokenId);
  });
  // Add any surviving ids not previously present (replacement Mint)
  for (const id of params.survivingOverlapTokenIds) {
    if (!nextTokens.some((t) => t.tokenId === id)) {
      const template = params.record.tokenIds[0];
      nextTokens.push({
        ...(template ?? {
          tokenId: id,
          firstSeenBlock: params.overlapFromBlock,
          firstSeenTx: "0xreorg",
          lastTransferBlock: null,
          lastTransferTx: null,
          currentOwner: null,
          ownerValidatedAtBlock: null,
          ownerValidationStatus: "unchecked" as const,
          token0: params.record.token0,
          token1: params.record.token1,
          fee: params.record.fee,
          tickLower: null,
          tickUpper: null,
          liquidity: "0",
          positionValidatedAtBlock: null,
          status: "unknown" as const,
          burned: false,
          zeroLiquidity: true,
          ownerTypeAudit: null,
          materialCandidate: false,
          inRange: null,
          source: "reorg_rescan" as const,
          lastError: null,
        }),
        tokenId: id,
        firstSeenBlock: params.overlapFromBlock,
        firstSeenTx: "0xreorg_replacement",
        source: "reorg_rescan",
      });
    }
  }
  const after = nextTokens.map((t) => t.tokenId);
  const { added, removed } = reconcileMintSets({
    previousTokenIds: before,
    nextTokenIds: after,
  });
  return {
    record: {
      ...params.record,
      generation: params.record.generation + 1,
      tokenIds: nextTokens,
      discoveryComplete: false,
      lastSyncedBlockHash: null,
      completenessErrors: [
        ...params.record.completenessErrors,
        "simulated reorg",
      ],
      updatedAt: Date.now(),
    },
    removedTokenIds: removed,
    addedTokenIds: added,
  };
}
