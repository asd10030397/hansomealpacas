/**
 * Phase 10B/10C shared validation + in-memory helpers (Edge/Next-safe).
 * JSON file I/O lives in store-json.ts (Node scripts only).
 * Production durable writes use production-kv.ts (scan:v3pos:* only).
 */

import {
  assertNotTransferIndexNamespace,
  buildV3PosIndexKey,
} from "@/lib/hansome-score/lp/v3-position-index/key";
import {
  V3_POS_INDEX_SCHEMA_VERSION,
  V3_POS_INDEX_SEMANTIC_VERSION,
  type V3PosIndexRecord,
  type V3PosPoolKey,
  type V3PosTokenIdRecord,
} from "@/lib/hansome-score/lp/v3-position-index/types";

export class V3PosStoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | "SCHEMA_MISMATCH"
      | "CORRUPTED"
      | "GENERATION_FENCE"
      | "NAMESPACE",
  ) {
    super(message);
    this.name = "V3PosStoreError";
  }
}

const memory = new Map<string, V3PosIndexRecord>();

export function clearV3PosStoreMemoryForTests(): void {
  memory.clear();
}

export function emptyV3PosIndexRecord(
  key: V3PosPoolKey & { factory: string; poolAddress: string },
): V3PosIndexRecord {
  return {
    schemaVersion: V3_POS_INDEX_SCHEMA_VERSION,
    semanticVersion: V3_POS_INDEX_SEMANTIC_VERSION,
    chainId: key.chainId,
    factory: key.factory,
    npm: key.npm,
    poolAddress: key.poolAddress,
    token0: key.token0,
    token1: key.token1,
    fee: key.fee,
    poolCreationBlock: null,
    firstMintBlock: null,
    lastSyncedBlock: null,
    lastSyncedBlockHash: null,
    reorgSafeHead: null,
    generation: 0,
    exhaustiveFromBlock: null,
    exhaustiveToBlock: null,
    discoveryComplete: false,
    completenessErrors: [],
    tokenIds: [],
    updatedAt: Date.now(),
  };
}

export function validateV3PosIndexRecord(raw: unknown): V3PosIndexRecord {
  if (raw == null || typeof raw !== "object") {
    throw new V3PosStoreError("record is not an object", "CORRUPTED");
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== V3_POS_INDEX_SCHEMA_VERSION) {
    throw new V3PosStoreError(
      `schemaVersion mismatch: expected ${V3_POS_INDEX_SCHEMA_VERSION}, got ${String(r.schemaVersion)}`,
      "SCHEMA_MISMATCH",
    );
  }
  if (typeof r.semanticVersion !== "string") {
    throw new V3PosStoreError("semanticVersion missing", "CORRUPTED");
  }
  if (typeof r.chainId !== "number" || !Number.isFinite(r.chainId)) {
    throw new V3PosStoreError("chainId invalid", "CORRUPTED");
  }
  if (typeof r.npm !== "string" || typeof r.token0 !== "string") {
    throw new V3PosStoreError("npm/token0 missing", "CORRUPTED");
  }
  if (typeof r.token1 !== "string" || typeof r.fee !== "number") {
    throw new V3PosStoreError("token1/fee missing", "CORRUPTED");
  }
  if (!Array.isArray(r.tokenIds)) {
    throw new V3PosStoreError("tokenIds must be an array", "CORRUPTED");
  }
  for (const t of r.tokenIds) {
    if (t == null || typeof t !== "object") {
      throw new V3PosStoreError("corrupted tokenId record", "CORRUPTED");
    }
    const tr = t as Record<string, unknown>;
    if (typeof tr.tokenId !== "string" || tr.tokenId.length === 0) {
      throw new V3PosStoreError("corrupted tokenId field", "CORRUPTED");
    }
    if (typeof tr.liquidity !== "string") {
      throw new V3PosStoreError(
        `corrupted liquidity for tokenId ${tr.tokenId}`,
        "CORRUPTED",
      );
    }
  }
  return raw as V3PosIndexRecord;
}

export function loadV3PosIndexMemory(key: string): V3PosIndexRecord | null {
  assertNotTransferIndexNamespace(key);
  const v = memory.get(key);
  return v ? structuredClone(v) : null;
}

export function saveV3PosIndexMemory(
  key: string,
  record: V3PosIndexRecord,
  opts?: { expectedGeneration?: number },
): void {
  assertNotTransferIndexNamespace(key);
  validateV3PosIndexRecord(record);
  const existing = memory.get(key);
  if (
    opts?.expectedGeneration != null &&
    existing &&
    existing.generation !== opts.expectedGeneration
  ) {
    throw new V3PosStoreError(
      `generation fence: expected ${opts.expectedGeneration}, have ${existing.generation}`,
      "GENERATION_FENCE",
    );
  }
  memory.set(key, structuredClone(record));
}

export function upsertTokenId(
  record: V3PosIndexRecord,
  token: V3PosTokenIdRecord,
): V3PosIndexRecord {
  const idx = record.tokenIds.findIndex((t) => t.tokenId === token.tokenId);
  const next = structuredClone(record);
  if (idx >= 0) next.tokenIds[idx] = token;
  else next.tokenIds.push(token);
  next.tokenIds.sort((a, b) =>
    BigInt(a.tokenId) < BigInt(b.tokenId)
      ? -1
      : BigInt(a.tokenId) > BigInt(b.tokenId)
        ? 1
        : 0,
  );
  next.updatedAt = Date.now();
  return next;
}

export function removeTokenIdsNotIn(
  record: V3PosIndexRecord,
  keep: Set<string>,
): V3PosIndexRecord {
  const next = structuredClone(record);
  next.tokenIds = next.tokenIds.filter((t) => keep.has(t.tokenId));
  next.updatedAt = Date.now();
  return next;
}

export function indexKeyForRecord(record: V3PosIndexRecord): string {
  return buildV3PosIndexKey({
    chainId: record.chainId,
    npm: record.npm,
    token0: record.token0,
    token1: record.token1,
    fee: record.fee,
  });
}
