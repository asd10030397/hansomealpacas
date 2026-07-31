/**
 * Transfer-index reuse validation / status (Phase 2 completion).
 *
 * Explicit statuses: complete | incomplete | stale | rebuilding
 * Never claim stale / partial / corrupt data as complete.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { loadTransferIndexMeta } from "@/lib/hansome-score/transfer-index/kv";
import { TRANSFER_INDEX_KV_TTL_SEC } from "@/lib/hansome-score/transfer-index/keys";
import { sanitizeTransferIndexMeta } from "@/lib/hansome-score/transfer-index/sanitize";
import type { TransferIndexMeta } from "@/lib/hansome-score/transfer-index/types";

/** Head is fresh when updated within this window (aligns with scan full TTL). */
export const TRANSFER_INDEX_HEAD_FRESH_MS = 15 * 60 * 1000;

/** Soft staleness for incomplete indexes — nudge resume without claiming complete. */
export const TRANSFER_INDEX_INCOMPLETE_STALE_MS = 5 * 60 * 1000;

/** Max pages for warm head refresh when genesis already complete. */
export const TRANSFER_INDEX_HEAD_REFRESH_MAX_PAGES = 5;

export type TransferIndexReuseStatus =
  | "complete"
  | "incomplete"
  | "stale"
  | "rebuilding";

export type TransferIndexValidation = {
  status: TransferIndexReuseStatus;
  meta: TransferIndexMeta | null;
  /** Indexed rows/meta may be served; never implies UI "complete" if status ≠ complete. */
  reusable: boolean;
  needsBackgroundRefresh: boolean;
  needsHeadRefresh: boolean;
  needsResume: boolean;
  needsRebuild: boolean;
  reason: string;
  ageMs: number | null;
};

export type EvaluateTransferIndexOptions = {
  nowMs?: number;
  headFreshMs?: number;
  /** When true, treat version≠1 / corrupt as rebuild. */
  raw?: unknown;
  chainId?: number;
  tokenAddress?: string;
};

/**
 * Evaluate reuse status for a sanitized meta (or raw → sanitize).
 * Corrupt / version mismatch → rebuilding (ignore payload).
 */
export function evaluateTransferIndexStatus(
  metaOrRaw: TransferIndexMeta | unknown | null,
  opts: EvaluateTransferIndexOptions = {},
): TransferIndexValidation {
  const now = opts.nowMs ?? Date.now();
  const headFreshMs = opts.headFreshMs ?? TRANSFER_INDEX_HEAD_FRESH_MS;
  const chainId = opts.chainId ?? SCAN_CHAIN_ID;
  const tokenAddress = opts.tokenAddress ?? "";

  let meta: TransferIndexMeta | null = null;
  if (metaOrRaw && typeof metaOrRaw === "object" && !Array.isArray(metaOrRaw)) {
    const o = metaOrRaw as Record<string, unknown>;
    if ("version" in o && "address" in o && "generation" in o) {
      // Already-shaped meta — still refuse wrong version.
      if (o.version !== 1) {
        return {
          status: "rebuilding",
          meta: null,
          reusable: false,
          needsBackgroundRefresh: true,
          needsHeadRefresh: false,
          needsResume: false,
          needsRebuild: true,
          reason: "version_mismatch",
          ageMs: null,
        };
      }
      meta = metaOrRaw as TransferIndexMeta;
    } else if (tokenAddress) {
      meta = sanitizeTransferIndexMeta(metaOrRaw, chainId, tokenAddress);
      if (!meta && metaOrRaw != null) {
        return {
          status: "rebuilding",
          meta: null,
          reusable: false,
          needsBackgroundRefresh: true,
          needsHeadRefresh: false,
          needsResume: false,
          needsRebuild: true,
          reason: "corrupt",
          ageMs: null,
        };
      }
    } else {
      meta = null;
    }
  } else if (metaOrRaw != null) {
    return {
      status: "rebuilding",
      meta: null,
      reusable: false,
      needsBackgroundRefresh: true,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: true,
      reason: "corrupt",
      ageMs: null,
    };
  }

  if (!meta) {
    return {
      status: "rebuilding",
      meta: null,
      reusable: false,
      needsBackgroundRefresh: true,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: true,
      reason: "missing",
      ageMs: null,
    };
  }

  if (meta.version !== 1) {
    return {
      status: "rebuilding",
      meta: null,
      reusable: false,
      needsBackgroundRefresh: true,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: true,
      reason: "version_mismatch",
      ageMs: null,
    };
  }

  const ageMs = Math.max(0, now - meta.updatedAt);

  // Absurdly old soft TTL — treat as rebuild (sanitize/load also drops 2× TTL).
  if (ageMs > TRANSFER_INDEX_KV_TTL_SEC * 1000 * 2) {
    return {
      status: "rebuilding",
      meta: null,
      reusable: false,
      needsBackgroundRefresh: true,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: true,
      reason: "expired",
      ageMs,
    };
  }

  // Writer in progress with no usable pages yet.
  if (
    meta.indexState === "indexing" &&
    meta.pagesFetchedTotal <= 0 &&
    !meta.paginationComplete
  ) {
    return {
      status: "rebuilding",
      meta,
      reusable: false,
      needsBackgroundRefresh: false,
      needsHeadRefresh: false,
      needsResume: false,
      needsRebuild: false,
      reason: "indexing_empty",
      ageMs,
    };
  }

  if (meta.paginationComplete === true && meta.indexState === "complete") {
    if (ageMs <= headFreshMs) {
      return {
        status: "complete",
        meta,
        reusable: true,
        needsBackgroundRefresh: false,
        needsHeadRefresh: false,
        needsResume: false,
        needsRebuild: false,
        reason: "genesis_complete_fresh",
        ageMs,
      };
    }
    // Genesis exhausted but head is stale — reusable for analysis, NOT "complete" status.
    return {
      status: "stale",
      meta,
      reusable: true,
      needsBackgroundRefresh: true,
      needsHeadRefresh: true,
      needsResume: false,
      needsRebuild: false,
      reason: "genesis_complete_stale_head",
      ageMs,
    };
  }

  // Partial / failed / incomplete progress — never claim complete.
  const hasProgress =
    meta.pagesFetchedTotal > 0 ||
    meta.transfersIndexed > 0 ||
    meta.recentChunkCount > 0 ||
    meta.nextPageParams != null;

  if (hasProgress) {
    const resume =
      !meta.paginationComplete && meta.nextPageParams != null;
    const nudge =
      ageMs > TRANSFER_INDEX_INCOMPLETE_STALE_MS || meta.indexState === "failed";
    return {
      status: "incomplete",
      meta,
      reusable: true,
      needsBackgroundRefresh: nudge || resume,
      needsHeadRefresh: false,
      needsResume: resume,
      needsRebuild: false,
      reason:
        meta.indexState === "failed"
          ? "failed_partial"
          : resume
            ? "resume_cursor"
            : "partial_progress",
      ageMs,
    };
  }

  return {
    status: "rebuilding",
    meta,
    reusable: false,
    needsBackgroundRefresh: true,
    needsHeadRefresh: false,
    needsResume: false,
    needsRebuild: true,
    reason: "empty_meta",
    ageMs,
  };
}

/** Load + validate transfer-index for Fast/Deep reuse decisions. */
export async function peekTransferIndexValidation(
  tokenAddress: string,
  chainId: number = SCAN_CHAIN_ID,
): Promise<TransferIndexValidation> {
  const meta = await loadTransferIndexMeta(chainId, tokenAddress);
  return evaluateTransferIndexStatus(meta, { chainId, tokenAddress });
}

/**
 * True when Deep may skip Blockscout paging and reuse persisted chunks
 * (complete + fresh only). Stale must head-refresh; incomplete must resume.
 */
export function canReuseTransferIndexWithoutFetch(
  v: TransferIndexValidation,
): boolean {
  return v.status === "complete" && v.reusable && !v.needsHeadRefresh;
}
