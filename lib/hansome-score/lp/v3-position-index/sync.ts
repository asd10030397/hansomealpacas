/**
 * Phase 10B — Algorithms A (backfill) and B (incremental).
 * Prototype only; injectable chain port for unit tests + live RPC.
 */

import {
  classifyInRange,
  classifyLiquidityState,
  classifyOwnerTypeAudit,
  classifyOwnerValidation,
  classifyTokenStatus,
} from "@/lib/hansome-score/lp/v3-position-index/classify";
import { resolveTokenIdsFromMintReceipt } from "@/lib/hansome-score/lp/v3-position-index/receipt-resolve";
import {
  emptyV3PosIndexRecord,
  upsertTokenId,
} from "@/lib/hansome-score/lp/v3-position-index/store";
import type {
  DecodedIncreaseLiquidity,
  DecodedNpmTransfer,
  DecodedPoolMint,
  V3PosIndexRecord,
  V3PosSyncMetrics,
  V3PosTokenIdRecord,
  V3PosTokenSource,
} from "@/lib/hansome-score/lp/v3-position-index/types";

export type V3PosChainPort = {
  getBlockNumber(): Promise<number>;
  getBlockHash(blockNumber: number): Promise<string | null>;
  getPoolCreationBlock?(poolAddress: string): Promise<number | null>;
  getLogsMint(params: {
    pool: string;
    fromBlock: number;
    toBlock: number;
  }): Promise<DecodedPoolMint[]>;
  getReceiptNpmEvents(params: {
    txHash: string;
    npm: string;
  }): Promise<{
    transfers: DecodedNpmTransfer[];
    increaseLiquidity: DecodedIncreaseLiquidity[];
    missing?: boolean;
  } | null>;
  readPositions(params: {
    npm: string;
    tokenId: string;
  }): Promise<
    | {
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
      }
    | null
    | "error"
  >;
  readOwnerOf(params: {
    npm: string;
    tokenId: string;
  }): Promise<
    { ok: true; owner: string } | { ok: false; revert: boolean; error?: string }
  >;
  getCodeSize?(address: string): Promise<number | null>;
  readSlot0Tick?(pool: string): Promise<number | null>;
};

export type SyncOptions = {
  chainId: number;
  factory: string;
  npm: string;
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  /** Default 96. */
  reorgOverlapBlocks?: number;
  poolCreationBlock?: number | null;
  /** When false, discoveryComplete stays false even if scan succeeds. */
  markCompleteIfClean?: boolean;
  source?: V3PosTokenSource;
};

function defaultMetrics(
  mode: V3PosSyncMetrics["mode"],
  from: number,
  to: number,
): V3PosSyncMetrics {
  return {
    mode,
    fromBlock: from,
    toBlock: to,
    mintEventCount: 0,
    receiptCount: 0,
    candidateTokenIdCount: 0,
    validMatchingTokenIdCount: 0,
    rpcCalls: 0,
    retries: 0,
    wallMs: 0,
    eventsProcessed: 0,
    idsRevalidated: 0,
  };
}

async function buildTokenRecord(params: {
  tokenId: string;
  firstSeenBlock: number;
  firstSeenTx: string;
  poolToken0: string;
  poolToken1: string;
  poolFee: number;
  pos: {
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: string;
  };
  ownerResult: {
    ok: true;
    owner: string;
  } | { ok: false; revert: boolean; error?: string };
  validateBlock: number;
  currentTick: number | null;
  codeSize: number | null;
  source: V3PosTokenSource;
  lastTransferBlock?: number | null;
  lastTransferTx?: string | null;
}): Promise<V3PosTokenIdRecord> {
  const owner = classifyOwnerValidation(params.ownerResult);
  const liq = classifyLiquidityState(params.pos.liquidity);
  const inRange = classifyInRange({
    tickLower: params.pos.tickLower,
    tickUpper: params.pos.tickUpper,
    currentTick: params.currentTick,
  });
  const burned = owner.burned;
  const status = classifyTokenStatus({
    burned,
    zeroLiquidity: liq.zeroLiquidity,
    inRange,
    liquidity: params.pos.liquidity,
  });
  return {
    tokenId: params.tokenId,
    firstSeenBlock: params.firstSeenBlock,
    firstSeenTx: params.firstSeenTx,
    lastTransferBlock: params.lastTransferBlock ?? null,
    lastTransferTx: params.lastTransferTx ?? null,
    currentOwner: owner.currentOwner,
    ownerValidatedAtBlock: params.validateBlock,
    ownerValidationStatus: owner.ownerValidationStatus,
    token0: params.pos.token0,
    token1: params.pos.token1,
    fee: params.pos.fee,
    tickLower: params.pos.tickLower,
    tickUpper: params.pos.tickUpper,
    liquidity: params.pos.liquidity,
    positionValidatedAtBlock: params.validateBlock,
    status,
    burned,
    zeroLiquidity: liq.zeroLiquidity,
    ownerTypeAudit: classifyOwnerTypeAudit({
      owner: owner.currentOwner,
      codeSize: params.codeSize,
    }),
    materialCandidate: !burned && liq.materialCandidate,
    inRange,
    source: params.source,
    lastError: owner.lastError,
  };
}

async function processMint(
  port: V3PosChainPort,
  mint: DecodedPoolMint,
  opts: SyncOptions,
  metrics: V3PosSyncMetrics,
  validateBlock: number,
  currentTick: number | null,
  source: V3PosTokenSource,
): Promise<{ tokens: V3PosTokenIdRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const receipt = await port.getReceiptNpmEvents({
    txHash: mint.txHash,
    npm: opts.npm,
  });
  metrics.rpcCalls += 1;
  metrics.receiptCount += 1;
  if (!receipt || receipt.missing) {
    errors.push(`missing receipt for ${mint.txHash}`);
    return { tokens: [], errors };
  }

  const candidateIds = new Set<string>([
    ...receipt.transfers.map((t) => t.tokenId),
    ...receipt.increaseLiquidity.map((i) => i.tokenId),
  ]);
  metrics.candidateTokenIdCount += candidateIds.size;

  const positionsById: Record<
    string,
    | {
        token0: string;
        token1: string;
        fee: number;
        tickLower: number;
        tickUpper: number;
        liquidity: string;
      }
    | null
    | "error"
  > = {};

  for (const id of candidateIds) {
    const pos = await port.readPositions({ npm: opts.npm, tokenId: id });
    metrics.rpcCalls += 1;
    positionsById[id] = pos;
  }

  const resolved = resolveTokenIdsFromMintReceipt({
    txHash: mint.txHash,
    blockNumber: mint.blockNumber,
    npm: opts.npm,
    poolToken0: opts.token0,
    poolToken1: opts.token1,
    poolFee: opts.fee,
    transfers: receipt.transfers,
    increaseLiquidity: receipt.increaseLiquidity,
    positionsById,
  });
  errors.push(...resolved.errors);

  const tokens: V3PosTokenIdRecord[] = [];
  for (const tokenId of resolved.matchingTokenIds) {
    const pos = positionsById[tokenId];
    if (!pos || pos === "error") continue;
    const ownerResult = await port.readOwnerOf({
      npm: opts.npm,
      tokenId,
    });
    metrics.rpcCalls += 1;
    metrics.idsRevalidated = (metrics.idsRevalidated ?? 0) + 1;

    let codeSize: number | null = null;
    if (ownerResult.ok && port.getCodeSize) {
      codeSize = await port.getCodeSize(ownerResult.owner);
      metrics.rpcCalls += 1;
    }

    const mintTransfers = receipt.transfers.filter((t) => t.tokenId === tokenId);
    const last = mintTransfers[mintTransfers.length - 1];

    tokens.push(
      await buildTokenRecord({
        tokenId,
        firstSeenBlock: mint.blockNumber,
        firstSeenTx: mint.txHash,
        poolToken0: opts.token0,
        poolToken1: opts.token1,
        poolFee: opts.fee,
        pos,
        ownerResult,
        validateBlock,
        currentTick,
        codeSize,
        source,
        lastTransferBlock: last ? mint.blockNumber : null,
        lastTransferTx: last ? mint.txHash : null,
      }),
    );
  }
  metrics.validMatchingTokenIdCount += tokens.length;
  return { tokens, errors };
}

/**
 * Algorithm A — initial backfill from pool creation to safe head.
 */
export async function backfillV3PosIndex(params: {
  port: V3PosChainPort;
  opts: SyncOptions;
  existing?: V3PosIndexRecord | null;
}): Promise<V3PosIndexRecord> {
  const t0 = Date.now();
  const { port, opts } = params;
  let record =
    params.existing ??
    emptyV3PosIndexRecord({
      chainId: opts.chainId,
      factory: opts.factory,
      npm: opts.npm,
      poolAddress: opts.poolAddress,
      token0: opts.token0,
      token1: opts.token1,
      fee: opts.fee,
    });

  record = {
    ...record,
    generation: record.generation + 1,
    discoveryComplete: false,
    completenessErrors: [],
  };

  const head = await port.getBlockNumber();
  const overlap = opts.reorgOverlapBlocks ?? 96;
  const safeHead = Math.max(0, head - overlap);
  const creation =
    opts.poolCreationBlock ??
    (port.getPoolCreationBlock
      ? await port.getPoolCreationBlock(opts.poolAddress)
      : null) ??
    record.poolCreationBlock;

  const metrics = defaultMetrics("backfill", creation ?? 0, safeHead);
  metrics.rpcCalls += 1;

  if (creation == null) {
    record.completenessErrors.push("pool creation block unknown");
    record.metrics = { ...metrics, wallMs: Date.now() - t0 };
    record.updatedAt = Date.now();
    return record;
  }

  record.poolCreationBlock = creation;
  record.exhaustiveFromBlock = creation;

  const mints = await port.getLogsMint({
    pool: opts.poolAddress,
    fromBlock: creation,
    toBlock: safeHead,
  });
  metrics.rpcCalls += 1;
  metrics.mintEventCount = mints.length;
  metrics.eventsProcessed = mints.length;

  // Deduplicate Mint events by tx (same tx may emit one Mint).
  const byTx = new Map<string, DecodedPoolMint>();
  for (const m of mints) {
    if (!byTx.has(m.txHash.toLowerCase())) byTx.set(m.txHash.toLowerCase(), m);
  }

  const currentTick = port.readSlot0Tick
    ? await port.readSlot0Tick(opts.poolAddress)
    : null;
  if (port.readSlot0Tick) metrics.rpcCalls += 1;

  const source = opts.source ?? "pool_mint_receipt";
  const seenIds = new Set<string>();
  let firstMint: number | null = null;

  for (const mint of [...byTx.values()].sort(
    (a, b) => a.blockNumber - b.blockNumber,
  )) {
    if (firstMint == null || mint.blockNumber < firstMint) {
      firstMint = mint.blockNumber;
    }
    const { tokens, errors } = await processMint(
      port,
      mint,
      opts,
      metrics,
      safeHead,
      currentTick,
      source,
    );
    record.completenessErrors.push(...errors);
    for (const tok of tokens) {
      // Preserve firstSeen if already present
      const prev = record.tokenIds.find((t) => t.tokenId === tok.tokenId);
      const merged = prev
        ? {
            ...tok,
            firstSeenBlock: prev.firstSeenBlock,
            firstSeenTx: prev.firstSeenTx,
            source: prev.source,
          }
        : tok;
      record = upsertTokenId(record, merged);
      seenIds.add(tok.tokenId);
    }
  }

  const headHash = await port.getBlockHash(safeHead);
  metrics.rpcCalls += 1;

  record.firstMintBlock = firstMint;
  record.lastSyncedBlock = safeHead;
  record.lastSyncedBlockHash = headHash;
  record.reorgSafeHead = safeHead;
  record.exhaustiveToBlock = safeHead;

  const mark = opts.markCompleteIfClean !== false;
  const clean =
    mark &&
    record.completenessErrors.length === 0 &&
    record.poolCreationBlock != null &&
    record.exhaustiveFromBlock != null &&
    record.exhaustiveToBlock != null &&
    record.lastSyncedBlockHash != null;

  record.discoveryComplete = clean;
  if (!clean && record.completenessErrors.length === 0) {
    record.completenessErrors.push("completeness prerequisites unmet");
  }

  metrics.validMatchingTokenIdCount = record.tokenIds.length;
  metrics.wallMs = Date.now() - t0;
  record.metrics = metrics;
  record.updatedAt = Date.now();
  return record;
}

/**
 * Algorithm B — incremental sync from lastSyncedBlock − overlap.
 */
export async function incrementalSyncV3PosIndex(params: {
  port: V3PosChainPort;
  opts: SyncOptions;
  existing: V3PosIndexRecord;
  /** Extra tokenIds to revalidate (e.g. transfer touch set). */
  forceRevalidateIds?: string[];
}): Promise<V3PosIndexRecord> {
  const t0 = Date.now();
  const { port, opts } = params;
  let record = {
    ...structuredClone(params.existing),
    generation: params.existing.generation + 1,
  };

  const head = await port.getBlockNumber();
  const overlap = opts.reorgOverlapBlocks ?? 96;
  const safeHead = Math.max(0, head - overlap);
  const from = Math.max(
    record.poolCreationBlock ?? 0,
    (record.lastSyncedBlock ?? 0) - overlap,
  );

  const metrics = defaultMetrics("incremental", from, safeHead);
  metrics.rpcCalls += 1;

  if (safeHead < from) {
    metrics.wallMs = Date.now() - t0;
    record.metrics = metrics;
    record.updatedAt = Date.now();
    return record;
  }

  // Reorg hash check at previous tip
  if (record.lastSyncedBlock != null && record.lastSyncedBlockHash) {
    const tip = Math.min(record.lastSyncedBlock, safeHead);
    const hash = await port.getBlockHash(tip);
    metrics.rpcCalls += 1;
    if (hash && hash.toLowerCase() !== record.lastSyncedBlockHash.toLowerCase()) {
      record.completenessErrors = [
        ...(record.completenessErrors ?? []),
        `reorg hash mismatch at ${tip}`,
      ];
      record.discoveryComplete = false;
      // Caller should run reorgRescan; still continue overlap rescan here.
    }
  }

  const mints = await port.getLogsMint({
    pool: opts.poolAddress,
    fromBlock: from,
    toBlock: safeHead,
  });
  metrics.rpcCalls += 1;
  metrics.mintEventCount = mints.length;
  metrics.eventsProcessed = mints.length;

  const byTx = new Map<string, DecodedPoolMint>();
  for (const m of mints) {
    if (!byTx.has(m.txHash.toLowerCase())) byTx.set(m.txHash.toLowerCase(), m);
  }

  const currentTick = port.readSlot0Tick
    ? await port.readSlot0Tick(opts.poolAddress)
    : null;
  if (port.readSlot0Tick) metrics.rpcCalls += 1;

  const known = new Set(record.tokenIds.map((t) => t.tokenId));
  for (const mint of byTx.values()) {
    const { tokens, errors } = await processMint(
      port,
      mint,
      opts,
      metrics,
      safeHead,
      currentTick,
      "incremental_mint",
    );
    record.completenessErrors.push(...errors);
    for (const tok of tokens) {
      const prev = record.tokenIds.find((t) => t.tokenId === tok.tokenId);
      const merged = prev
        ? {
            ...tok,
            firstSeenBlock: prev.firstSeenBlock,
            firstSeenTx: prev.firstSeenTx,
            source: prev.source === "fixture" ? prev.source : tok.source,
          }
        : tok;
      record = upsertTokenId(record, merged);
      known.add(tok.tokenId);
    }
  }

  // Revalidate existing + forced ids (owner/positions) — bounded to indexed set.
  const revalidate = new Set<string>([
    ...known,
    ...(params.forceRevalidateIds ?? []),
  ]);
  for (const tokenId of revalidate) {
    const prev = record.tokenIds.find((t) => t.tokenId === tokenId);
    if (!prev) continue;
    const pos = await port.readPositions({ npm: opts.npm, tokenId });
    metrics.rpcCalls += 1;
    if (pos === "error") {
      record.completenessErrors.push(`positions transient error ${tokenId}`);
      record.discoveryComplete = false;
      continue;
    }
    if (pos === null) {
      // May be burned — check ownerOf
      const ownerResult = await port.readOwnerOf({ npm: opts.npm, tokenId });
      metrics.rpcCalls += 1;
      metrics.idsRevalidated = (metrics.idsRevalidated ?? 0) + 1;
      const owner = classifyOwnerValidation(ownerResult);
      record = upsertTokenId(record, {
        ...prev,
        currentOwner: owner.currentOwner,
        ownerValidatedAtBlock: safeHead,
        ownerValidationStatus: owner.ownerValidationStatus,
        burned: owner.burned,
        zeroLiquidity: true,
        materialCandidate: false,
        status: owner.burned ? "burned" : "unknown",
        lastError: owner.lastError,
        positionValidatedAtBlock: safeHead,
      });
      continue;
    }

    // Pool key drift → drop from this index
    if (
      pos.token0.toLowerCase() !== opts.token0.toLowerCase() ||
      pos.token1.toLowerCase() !== opts.token1.toLowerCase() ||
      pos.fee !== opts.fee
    ) {
      continue;
    }

    const ownerResult = await port.readOwnerOf({ npm: opts.npm, tokenId });
    metrics.rpcCalls += 1;
    metrics.idsRevalidated = (metrics.idsRevalidated ?? 0) + 1;
    let codeSize: number | null = null;
    if (ownerResult.ok && port.getCodeSize) {
      codeSize = await port.getCodeSize(ownerResult.owner);
      metrics.rpcCalls += 1;
    }
    const tok = await buildTokenRecord({
      tokenId,
      firstSeenBlock: prev.firstSeenBlock,
      firstSeenTx: prev.firstSeenTx,
      poolToken0: opts.token0,
      poolToken1: opts.token1,
      poolFee: opts.fee,
      pos,
      ownerResult,
      validateBlock: safeHead,
      currentTick,
      codeSize,
      source: prev.source,
      lastTransferBlock: prev.lastTransferBlock,
      lastTransferTx: prev.lastTransferTx,
    });
    record = upsertTokenId(record, tok);
  }

  const headHash = await port.getBlockHash(safeHead);
  metrics.rpcCalls += 1;

  // Only advance checkpoint after successful processing
  if (record.completenessErrors.filter((e) => e.startsWith("missing receipt")).length === 0) {
    record.lastSyncedBlock = safeHead;
    record.lastSyncedBlockHash = headHash;
    record.reorgSafeHead = safeHead;
    record.exhaustiveToBlock = safeHead;
  }

  const clean =
    (opts.markCompleteIfClean !== false) &&
    record.completenessErrors.length === 0 &&
    record.poolCreationBlock != null &&
    record.exhaustiveFromBlock != null &&
    record.lastSyncedBlockHash != null;

  record.discoveryComplete = clean;
  metrics.validMatchingTokenIdCount = record.tokenIds.length;
  metrics.wallMs = Date.now() - t0;
  record.metrics = metrics;
  record.updatedAt = Date.now();
  return record;
}

/**
 * Idempotent resync: backfill then incremental should not duplicate tokenIds.
 */
export function tokenIdSet(record: V3PosIndexRecord): string[] {
  return record.tokenIds.map((t) => t.tokenId).sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
  );
}
