/**
 * Server Scan cache (API routes / RSC only — do not import from Client Components).
 * `server-only` omitted so Node harnesses (tsx measure) can import; Next client
 * code must continue importing types from `types.ts`, not this module.
 */
import { computeActivity } from "@/lib/hansome-score/activity";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { hansomeLevelFromActivity } from "@/lib/hansome-score/hansome-level";
import {
  assertValidTokenAddress,
  fetchOptionalGeckoActivity,
  scanToken,
} from "@/lib/hansome-score/scan";
import {
  DEEP_PROGRESS_STALL_MS,
  isDeepProgressStalled,
  isDeepStageTerminal,
  stampDeepProgress,
} from "@/lib/hansome-score/deep-progress";
import {
  DEEP_INTERACTIVE_STALE_MS,
  cancelActiveDeepAttempt,
} from "@/lib/hansome-score/deep-settlement";
import {
  annotateFenceAccepted,
  annotateFenceRejection,
  clearDeepLease,
  heartbeatDeepLease,
  isOrphanAnalyzing,
  recoverOrphanAnalyzing,
  stampDeepRuntime,
  toDeepRuntimeDiagnostics,
  withRegisteredDeepJob,
} from "@/lib/hansome-score/deep-runtime";
import {
  beginLpTerminal,
  hasVerifiedLockedResult,
  isLpForceRefreshActive,
  isLpHardTerminal,
  LP_FORCE_PROGRESS_STALL_MS,
  markLpTerminalRunning,
  mayLpForceRecover,
  resolveLpInterruptOutcome,
  settleLpFailedTerminal,
  applyLpHardTerminal,
} from "@/lib/hansome-score/lp/lp-terminal-contract";
import {
  DEEP_SCAN_MAX_EXECUTION_MS,
  DEEP_STALE_THRESHOLD_MS,
  DeepScanTimeoutError,
  enrichScanDeep,
  isDeepInteractivelyStale,
  isDeepStale,
  markScanPartial,
} from "@/lib/hansome-score/scan-deep";
import {
  isDeepInProgress,
  isScanComplete,
  markScanComplete,
  scanTokenFast,
} from "@/lib/hansome-score/scan-fast";
import {
  MAX_DEEP_AUTO_RETRIES,
  assignDeepAttempt,
  bumpDeepRetryCount,
  isDeepRetryable,
  lpEvidenceNeedsFullRefresh,
  mergeMonotonicAnalysisStages,
  mergeMonotonicDeepRetryCount,
  needsDeepWork,
  preferAuthoritativeDeepResponse,
  rearmPartialForDeepRetry,
  retireDeepAttempt,
  shouldAcceptDeepProgress,
  shouldAcceptDeepSettle,
  shouldRejectUnfencedDeepWrite,
} from "@/lib/hansome-score/scan-progress";
import {
  attachBurnHistoryToSupplyBurn,
  hasSupplyReducingAbiPath,
  isBurnHistoryFresh,
  peekBurnHistoryBundle,
  scheduleBurnHistoryBackgroundRefresh,
} from "@/lib/hansome-score/supply-burn";
import {
  peekTransferIndexValidation,
  scheduleTransferIndexBackgroundRefresh,
} from "@/lib/hansome-score/transfer-index";
import {
  ANALYSIS_SEMANTIC_VERSION,
  SCAN_SNAPSHOT_SCHEMA_VERSION,
  applyWarmRearmStages,
  evaluateWarmEligibility,
  planWarmDeepStages,
} from "@/lib/hansome-score/warm-incremental";
import {
  resolveDeploymentScope,
  scanLockKvKey,
  scanMetaKvKey,
  scanRlAddrKvKey,
  scanRlIpKvKey,
  scanSnapshotKvKey,
  scopedTokenKey,
} from "@/lib/hansome-score/deployment-scope";
import { loadLpDiscoveryCheckpoint } from "@/lib/hansome-score/lp/discovery-checkpoint";
import {
  attachPublishedLp,
  clearStaleLpEvidence,
  deleteLpPublishedBody,
  extractLpPublishMeta,
  loadLpPublishedBody,
  persistLpPublishedBody,
  publishDeepLpResult,
  readLpContract,
  shouldPublishLpBody,
  type LpPublishMeta,
} from "@/lib/hansome-score/lp/lp-result-publish";
import {
  markForceLpFullRefresh,
  markManualSmartLpRefresh,
} from "@/lib/hansome-score/lp/smart-refresh";
import type {
  DeepRuntimeDiagnostics,
  ScanCacheMeta,
  ScanResponse,
} from "@/lib/hansome-score/types";

export { resolveDeploymentScope } from "@/lib/hansome-score/deployment-scope";
export {
  clearStaleLpEvidence,
  publishDeepLpResult,
  readLpContract,
} from "@/lib/hansome-score/lp/lp-result-publish";

export {
  DEEP_SCAN_MAX_EXECUTION_MS,
  DEEP_STALE_THRESHOLD_MS,
  isDeepInteractivelyStale,
  isDeepStale,
  markScanPartial,
} from "@/lib/hansome-score/scan-deep";
export { DEEP_INTERACTIVE_STALE_MS } from "@/lib/hansome-score/deep-settlement";
export {
  MAX_DEEP_AUTO_RETRIES,
  assignDeepAttempt,
  isDeepRetryable,
  isDeepCollecting,
  mergeMonotonicAnalysisStages,
  mergeMonotonicDeepRetryCount,
  needsDeepWork,
  preferAuthoritativeDeepResponse,
  rearmPartialForDeepRetry,
  retireDeepAttempt,
  shouldAcceptDeepProgress,
  shouldAcceptDeepSettle,
  shouldRejectUnfencedDeepWrite,
} from "@/lib/hansome-score/scan-progress";

/** Fresh full Overall/Structural Score window. */
export const SCAN_FULL_TTL_MS = 15 * 60 * 1000;
/** Serve stale snapshot + background refresh. */
export const SCAN_STALE_TTL_MS = 60 * 60 * 1000;
/** Activity/price overlay TTL (architecture: 30–60s). */
export const SCAN_ACTIVITY_TTL_MS = 45 * 1000;
/** KV soft retention for snapshot blob. */
export const SCAN_KV_TTL_SEC = 24 * 60 * 60;
/** Manual refresh per-address cooldown. */
export const SCAN_REFRESH_ADDR_COOLDOWN_MS = 60 * 1000;
/** Manual refresh per-IP cooldown. */
export const SCAN_REFRESH_IP_COOLDOWN_MS = 120 * 1000;
/** KV refresh lock TTL (short ops / waiters). */
export const SCAN_LOCK_TTL_SEC = 90;
/** Deep analysis lock — must cover DEEP_SCAN_MAX_EXECUTION_MS. */
export const SCAN_DEEP_LOCK_TTL_SEC = Math.ceil(DEEP_SCAN_MAX_EXECUTION_MS / 1000) + 30;
/** How long lock waiters poll before falling back to stale. */
export const SCAN_LOCK_WAIT_MS = 4_000;

export type { ScanCacheMeta };
export type CachedScanResponse = ScanResponse & {
  cache: ScanCacheMeta;
};

type StoredSnapshot = {
  scoreComputedAt: string;
  activityUpdatedAt: string;
  storedAt: number;
  activityStoredAt: number;
  response: ScanResponse;
};

const memory = new Map<string, StoredSnapshot>();
/** Deep / full scanToken inflight (same-CA coalesce). */
const inflight = new Map<string, Promise<ScanResponse>>();
/** Fast Scan inflight (same-CA coalesce). */
const fastInflight = new Map<string, Promise<ScanResponse>>();
const memoryLocks = new Map<string, number>();
const memoryRlAddr = new Map<string, number>();
const memoryRlIp = new Map<string, number>();
const backgroundRefresh = new Set<string>();

/**
 * Phase 10C-4 scoped cache key: {deploymentScope}:{chainId}:{token}
 * Candidates never share Production snapshot / LP result / deep attempt state.
 */
function cacheKey(address: string): string {
  const token = assertValidTokenAddress(address).toLowerCase();
  return scopedTokenKey(resolveDeploymentScope(), SCAN_CHAIN_ID, token);
}

/** Address-only segment for rate limits (full key is deployment-scoped). */
function rlAddrKey(address: string): string {
  return `${SCAN_CHAIN_ID}:${assertValidTokenAddress(address).toLowerCase()}`;
}

const SCAN_KEYS = {
  snapshot: (k: string) => scanSnapshotKvKey(k),
  meta: (k: string) => scanMetaKvKey(k),
  lock: (k: string) => scanLockKvKey(k),
  rlAddr: (k: string) => scanRlAddrKvKey(k),
  rlIp: (hash: string) => scanRlIpKvKey(hash),
};

export function isScanKvConfigured(): boolean {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return Boolean(url && token);
}

/**
 * FOX-only / address-scoped scan cache delete for post-deploy recompute.
 * Deletes snapshot + meta + lock keys and clears this isolate's memory entry.
 * Does NOT touch `scan:xfer:*` (transfer-index) or other tokens.
 */
export async function invalidateScanSnapshotKeysForAddress(
  address: string,
): Promise<{
  key: string;
  deleted: Array<{ key: string; result: unknown }>;
  memoryCleared: boolean;
}> {
  const normalized = assertValidTokenAddress(address.trim());
  const key = cacheKey(normalized);
  const keys = [
    SCAN_KEYS.snapshot(key),
    SCAN_KEYS.meta(key),
    SCAN_KEYS.lock(key),
  ];
  const deleted: Array<{ key: string; result: unknown }> = [];
  const kv = await getKv();
  if (kv) {
    for (const k of keys) {
      const result = await kv.del(k);
      deleted.push({ key: k, result });
    }
  } else {
    for (const k of keys) deleted.push({ key: k, result: "kv_not_configured" });
  }
  await deleteLpPublishedBody(resolveDeploymentScope(), normalized, SCAN_CHAIN_ID);
  const memoryCleared = memory.delete(key);
  memoryLocks.delete(key);
  inflight.delete(key);
  fastInflight.delete(key);
  backgroundRefresh.delete(key);
  return { key, deleted, memoryCleared };
}

async function getKv() {
  if (!isScanKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

async function kvGetSnapshot(key: string): Promise<StoredSnapshot | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<StoredSnapshot>(SCAN_KEYS.snapshot(key))) ?? null;
  } catch (err) {
    console.warn("[scan-cache] KV get failed:", err);
    return null;
  }
}

async function kvSetSnapshot(key: string, snap: StoredSnapshot): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.set(SCAN_KEYS.snapshot(key), snap, { ex: SCAN_KV_TTL_SEC });
    await kv.set(
      SCAN_KEYS.meta(key),
      {
        scoreComputedAt: snap.scoreComputedAt,
        activityUpdatedAt: snap.activityUpdatedAt,
        version: snap.response.version,
        storedAt: snap.storedAt,
      },
      { ex: SCAN_KV_TTL_SEC },
    );
  } catch (err) {
    console.warn("[scan-cache] KV set failed:", err);
  }
}

/** Acquire refresh/deep lock. Returns true if this caller owns the lock. */
async function acquireRefreshLock(
  key: string,
  ttlSec = SCAN_LOCK_TTL_SEC,
): Promise<boolean> {
  const kv = await getKv();
  if (kv) {
    try {
      const ok = await kv.set(SCAN_KEYS.lock(key), "1", {
        nx: true,
        ex: ttlSec,
      });
      // Upstash/Vercel KV: "OK" on success, null when NX fails
      return ok != null;
    } catch (err) {
      console.warn("[scan-cache] KV lock failed, using memory lock:", err);
    }
  }
  const now = Date.now();
  const until = memoryLocks.get(key) ?? 0;
  if (until > now) return false;
  memoryLocks.set(key, now + ttlSec * 1000);
  return true;
}

async function releaseRefreshLock(key: string): Promise<void> {
  memoryLocks.delete(key);
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.del(SCAN_KEYS.lock(key));
  } catch {
    /* ignore */
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Wait briefly for another worker's lock to publish a snapshot.
 * Falls back to null so caller can serve prior stale or start carefully.
 */
async function waitForSnapshotAfterLock(
  key: string,
  maxWaitMs = SCAN_LOCK_WAIT_MS,
): Promise<StoredSnapshot | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const mem = memory.get(key);
    if (mem) return mem;
    const fromKv = await kvGetSnapshot(key);
    if (fromKv) {
      memory.set(key, fromKv);
      return fromKv;
    }
    await sleep(250);
  }
  return null;
}

function ageMs(snap: StoredSnapshot): number {
  return Date.now() - snap.storedAt;
}

function isScoreFresh(snap: StoredSnapshot): boolean {
  return ageMs(snap) < SCAN_FULL_TTL_MS;
}

function isUsableStale(snap: StoredSnapshot): boolean {
  return ageMs(snap) < SCAN_STALE_TTL_MS;
}

function activityAgeMs(snap: StoredSnapshot): number {
  return Date.now() - snap.activityStoredAt;
}

function isActivityFresh(snap: StoredSnapshot): boolean {
  return activityAgeMs(snap) < SCAN_ACTIVITY_TTL_MS;
}

function assertCacheable(result: ScanResponse): void {
  if (!result?.scannedAt || !result?.overview?.address) {
    throw new Error("Refusing to cache incomplete scan response");
  }
}

function stampResponse(
  response: ScanResponse,
  scoreComputedAt: string,
  activityUpdatedAt: string,
): ScanResponse {
  const scannedAt =
    Date.parse(activityUpdatedAt) > Date.parse(scoreComputedAt)
      ? activityUpdatedAt
      : scoreComputedAt;
  return {
    ...response,
    scannedAt,
    scoreComputedAt,
    activityUpdatedAt,
  };
}

function withMeta(
  response: ScanResponse,
  meta: Omit<ScanCacheMeta, "fullScoreTtlSec" | "activityTtlSec" | "kvConfigured">,
): CachedScanResponse {
  return {
    ...response,
    cache: {
      ...meta,
      fullScoreTtlSec: Math.floor(SCAN_FULL_TTL_MS / 1000),
      activityTtlSec: Math.floor(SCAN_ACTIVITY_TTL_MS / 1000),
      kvConfigured: isScanKvConfigured(),
      deploymentScope: resolveDeploymentScope(),
    },
  };
}

async function withMetaReconciled(
  response: ScanResponse,
  meta: Omit<ScanCacheMeta, "fullScoreTtlSec" | "activityTtlSec" | "kvConfigured">,
): Promise<CachedScanResponse> {
  const reconciled = await reconcilePublishedLpOnRead(response);
  return withMeta(reconciled, meta);
}

function toStored(result: ScanResponse): StoredSnapshot {
  assertCacheable(result);
  const nowIso = result.scannedAt || new Date().toISOString();
  const scoreComputedAt = result.scoreComputedAt ?? nowIso;
  const activityUpdatedAt = result.activityUpdatedAt ?? nowIso;
  const stamped = stampResponse(result, scoreComputedAt, activityUpdatedAt);
  const now = Date.now();
  return {
    scoreComputedAt,
    activityUpdatedAt,
    storedAt: now,
    activityStoredAt: now,
    response: stamped,
  };
}

async function persistSnapshot(key: string, snap: StoredSnapshot): Promise<void> {
  memory.set(key, snap);
  await kvSetSnapshot(key, snap);
}

/**
 * Refresh Activity/price/liquidity only — does NOT recompute Structural or Overall Score.
 * Failures keep prior snapshot (stale fallback).
 */
async function applyActivityOverlay(
  address: string,
  snap: StoredSnapshot,
): Promise<StoredSnapshot> {
  if (isActivityFresh(snap)) return snap;
  try {
    const gecko = await fetchOptionalGeckoActivity(address);
    // If gecko completely failed, keep prior activity (do not blank to Unknown-as-empty)
    if (gecko.source == null && gecko.volume24hUsd == null && gecko.liquidityUsd == null) {
      return snap;
    }
    const transfersCount = snap.response.overview.transfersCount;
    const activity = computeActivity({
      volume24hUsd: gecko.volume24hUsd,
      transactions24h: gecko.transactions24h,
      transfersCount,
      volumeSource: gecko.source,
    });
    const hansomeLevel = hansomeLevelFromActivity(activity.level);
    const activityUpdatedAt = new Date().toISOString();
    const next: StoredSnapshot = {
      ...snap,
      activityUpdatedAt,
      activityStoredAt: Date.now(),
      response: stampResponse(
        {
          ...snap.response,
          activity,
          hansomeLevel,
          liquidityUsd:
            gecko.liquidityUsd != null
              ? gecko.liquidityUsd
              : snap.response.liquidityUsd,
          // Overall / Structural / Supply&Burn / confidence stay at scoreComputedAt
        },
        snap.scoreComputedAt,
        activityUpdatedAt,
      ),
    };
    await persistSnapshot(cacheKey(address), next);
    return next;
  } catch (err) {
    console.warn("[scan-cache] activity overlay failed; serving prior:", err);
    return snap;
  }
}

/**
 * Memory-first is wrong under multi-instance: another isolate may have written
 * a higher deepRetryCount / exhausted terminal to KV. Always reconcile.
 */
async function loadAuthoritativeSnap(
  key: string,
): Promise<StoredSnapshot | null> {
  const mem = memory.get(key);
  const fromKv = await kvGetSnapshot(key);
  if (!mem && !fromKv) return null;
  if (!fromKv) return mem && isUsableStale(mem) ? mem : null;
  if (!mem) {
    if (isUsableStale(fromKv)) memory.set(key, fromKv);
    return isUsableStale(fromKv) ? fromKv : null;
  }
  if (!isUsableStale(mem) && isUsableStale(fromKv)) {
    memory.set(key, fromKv);
    return fromKv;
  }
  if (!isUsableStale(fromKv)) {
    return isUsableStale(mem) ? mem : null;
  }
  const preferred = preferAuthoritativeDeepResponse(
    mem.response,
    fromKv.response,
  );
  if (preferred === fromKv.response) {
    memory.set(key, fromKv);
    return fromKv;
  }
  return mem;
}

async function persistProgressResponse(
  key: string,
  response: ScanResponse,
): Promise<ScanResponse> {
  const current = await loadAuthoritativeSnap(key);
  const auth = current?.response;
  if (shouldRejectUnfencedDeepWrite(auth, response)) {
    return auth ?? response;
  }
  const sameAttempt =
    !!auth?.deepAttemptId &&
    !!response.deepAttemptId &&
    auth.deepAttemptId === response.deepAttemptId;
  const merged: ScanResponse = {
    ...response,
    deepRetryCount: mergeMonotonicDeepRetryCount(
      auth?.deepRetryCount,
      response.deepRetryCount,
    ),
    // Same generation: never let a lagging writer regress completed stages.
    // New generation (re-arm): accept incoming stages as stamped.
    analysisStages: sameAttempt
      ? mergeMonotonicAnalysisStages(auth?.analysisStages, response.analysisStages)
      : response.analysisStages,
  };
  const nowIso = new Date().toISOString();
  const scoreComputedAt = merged.scoreComputedAt ?? nowIso;
  const activityUpdatedAt = merged.activityUpdatedAt ?? nowIso;
  const stamped = stampResponse(merged, scoreComputedAt, activityUpdatedAt);
  await persistSnapshot(key, toStored(stamped));
  return stamped;
}

/**
 * Phase 10C-4 publish contract for terminal liquidity writes.
 * Dual-write LP body then scan aggregate; reject stale generations.
 */
async function persistWithLpPublishContract(
  key: string,
  incoming: ScanResponse,
  mode: "progress" | "settle",
): Promise<{ accepted: boolean; response: ScanResponse }> {
  const current = await loadAuthoritativeSnap(key);
  const auth = current?.response;
  if (mode === "progress") {
    if (!shouldAcceptDeepProgress(auth, incoming)) {
      return { accepted: false, response: auth ?? incoming };
    }
  } else if (!shouldAcceptDeepSettle(auth, incoming)) {
    console.warn(
      JSON.stringify({
        tag: "stale_publish_rejected",
        mode,
        incomingGeneration: incoming.deepAttemptId ?? null,
        authGeneration: auth?.deepAttemptId ?? null,
      }),
    );
    const annotated = auth
      ? annotateFenceRejection(auth, incoming.deepAttemptId)
      : incoming;
    return { accepted: false, response: annotated };
  }
  if (shouldRejectUnfencedDeepWrite(auth, incoming)) {
    return { accepted: false, response: auth ?? incoming };
  }

  const sameAttempt =
    !!auth?.deepAttemptId &&
    !!incoming.deepAttemptId &&
    auth.deepAttemptId === incoming.deepAttemptId;
  // Phase 10C-5: never regress SUCCESS/FAILED terminal via mid-flight progress.
  const authTerm = auth?.lpTerminal;
  const inTerm = incoming.lpTerminal;
  let mergedLpTerminal = inTerm ?? authTerm;
  if (
    authTerm &&
    isLpHardTerminal(authTerm) &&
    sameAttempt &&
    (!inTerm || !isLpHardTerminal(inTerm))
  ) {
    mergedLpTerminal = authTerm;
  }
  let merged: ScanResponse = {
    ...incoming,
    deepRetryCount: mergeMonotonicDeepRetryCount(
      auth?.deepRetryCount,
      incoming.deepRetryCount,
    ),
    analysisStages:
      mode === "settle" && sameAttempt
        ? mergeMonotonicAnalysisStages(
            auth?.analysisStages,
            incoming.analysisStages,
          )
        : mode === "progress" && sameAttempt
          ? mergeMonotonicAnalysisStages(
              auth?.analysisStages,
              incoming.analysisStages,
            )
          : incoming.analysisStages,
    lpTerminal: mergedLpTerminal,
  };

  if (shouldPublishLpBody(merged)) {
    const scope = resolveDeploymentScope();
    const generation = merged.deepAttemptId ?? "";
    const token = merged.overview.address;
    const intel = merged.overview.lpIntelligence;
    const pub = await publishDeepLpResult({
      attemptId: generation,
      generation,
      deploymentScope: scope,
      tokenAddress: token,
      chainId: SCAN_CHAIN_ID,
      authoritativeGeneration: auth?.deepAttemptId ?? generation,
      intelligence: intel,
      lpLockStatus: merged.overview.lpLockStatus,
      lpLockDetail: merged.overview.lpLockDetail,
      poolId: merged.overview.poolId,
      liquidityUsd: merged.liquidityUsd,
      persistLpBody: persistLpPublishedBody,
      persistScanAggregate: async (meta: LpPublishMeta) => {
        merged = attachPublishedLp(merged, meta, {
          intelligence: intel,
          lpLockStatus: merged.overview.lpLockStatus,
          lpLockDetail: merged.overview.lpLockDetail,
          poolId: merged.overview.poolId,
          liquidityUsd: merged.liquidityUsd,
        });
        await persistProgressResponse(key, merged);
      },
      markLiquidityTerminal: async () => {
        /* terminal stage already present on merged; aggregate write is the mark */
      },
      maxRetries: 2,
    });
    if (!pub.ok) {
      if (pub.reason === "stale_publish_rejected") {
        const annotated = auth
          ? annotateFenceRejection(auth, merged.deepAttemptId)
          : merged;
        return { accepted: false, response: annotated };
      }
      // Partial / failed publish: keep nonterminal — do not expose done LP body.
      const canRetry =
        isDeepRetryable({
          ...merged,
          analysisStatus:
            merged.analysisStatus === "complete"
              ? "partial"
              : merged.analysisStatus,
        }) ||
        (isLpForceRefreshActive(merged) && mayLpForceRecover(merged.lpTerminal));
      const nonterm: ScanResponse = stampDeepRuntime(
        {
          ...clearStaleLpEvidence(merged),
          analysisStatus:
            merged.analysisStatus === "complete"
              ? canRetry
                ? "deep_running"
                : "partial"
              : merged.analysisStatus,
          analysisStages: {
            ...merged.analysisStages!,
            liquidity: canRetry ? "analyzing" : "partial",
            score:
              merged.analysisStages?.score === "done"
                ? "done"
                : canRetry
                  ? "analyzing"
                  : "partial",
          },
          lpPublish: undefined,
        },
        {
          lease: undefined,
          retryRequired: canRetry,
          retryScheduled: canRetry,
          lastTransition: canRetry ? "lp_publish_retry" : "lp_publish_terminal",
          lastErrorCode: pub.reason ?? "lp_publish_failed",
        },
      );
      const stamped = await persistProgressResponse(key, nonterm);
      return { accepted: true, response: stamped };
    }
    return { accepted: true, response: merged };
  }

  const stamped = await persistProgressResponse(key, merged);
  return { accepted: true, response: stamped };
}

/**
 * Fence Deep onProgress: stale generations and exhausted-terminal revivals no-op.
 */
async function persistFencedDeepProgress(
  key: string,
  incoming: ScanResponse,
): Promise<{ accepted: boolean; response: ScanResponse }> {
  return persistWithLpPublishContract(key, incoming, "progress");
}

/**
 * Fence Deep settle: reject older attempts; deepRetryCount = max(kv, bumped).
 */
async function persistFencedDeepSettle(
  key: string,
  incoming: ScanResponse,
): Promise<{ accepted: boolean; response: ScanResponse }> {
  return persistWithLpPublishContract(key, incoming, "settle");
}

/**
 * Read contract: verify published LP generation/scope before serving terminal LP JSON.
 * Candidate never falls back to Production bodies.
 */
async function reconcilePublishedLpOnRead(
  response: ScanResponse,
): Promise<ScanResponse> {
  const liq = response.analysisStages?.liquidity;
  const terminal = liq === "done" || liq === "partial" || liq === "unknown";
  if (!terminal) return response;
  const meta = extractLpPublishMeta(response);
  const scope = resolveDeploymentScope();
  const body = await loadLpPublishedBody(
    scope,
    response.overview.address,
    SCAN_CHAIN_ID,
  );
  const check = readLpContract({
    deploymentScope: scope,
    expectedScope: scope,
    scanMeta: meta,
    lpBody: body,
    allowProductionFallback: false,
  });
  if (check.ok) {
    // Prefer published body (authoritative) over any mixed aggregate fields.
    return attachPublishedLp(response, check.body, check.body);
  }

  const hasVerifiedLock = (response.overview.lpIntelligence?.positions ?? []).some(
    (p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN",
  );
  const genAligned =
    !!response.lpPublish?.lpGeneration &&
    (!!response.deepAttemptId
      ? response.lpPublish.lpGeneration === response.deepAttemptId
      : true);

  // Transient missing LP body: keep generation-aligned verified Locked aggregate.
  if (
    check.reason === "missing_lp_body" &&
    hasVerifiedLock &&
    genAligned
  ) {
    return response;
  }

  // Incompatible / cleared / timeout shells — strip and demote liquidity.
  if (
    check.reason === "generation_mismatch" ||
    check.reason === "scope_mismatch" ||
    check.reason === "schema_rejected" ||
    check.reason === "production_fallback_forbidden" ||
    (!hasVerifiedLock &&
      (/did not finish in time|probe budget exceeded/i.test(
        response.overview.lpIntelligence?.detail ?? "",
      ) ||
        /LP evidence cleared/i.test(
          response.overview.lpIntelligence?.detail ?? "",
        )))
  ) {
    const cleared = clearStaleLpEvidence(response);
    // Phase 13A: never demote to analyzing on read when no recovery path remains.
    const canRecover =
      isDeepRetryable({
        ...cleared,
        analysisStatus:
          cleared.analysisStatus === "complete"
            ? "partial"
            : cleared.analysisStatus,
      }) ||
      (isLpForceRefreshActive(cleared) && mayLpForceRecover(cleared.lpTerminal));
    const liqStage = canRecover ? "analyzing" : "partial";
    const scoreStage =
      cleared.analysisStages?.score === "done"
        ? "done"
        : canRecover
          ? "analyzing"
          : "partial";
    return {
      ...cleared,
      analysisStatus:
        cleared.analysisStatus === "complete"
          ? canRecover
            ? "deep_running"
            : "partial"
          : cleared.analysisStatus === "deep_running" && !canRecover
            ? "partial"
            : cleared.analysisStatus,
      analysisStages: {
        ...cleared.analysisStages!,
        liquidity: liqStage,
        score: scoreStage,
      },
      deepRuntime: canRecover
        ? {
            ...cleared.deepRuntime,
            retryRequired: true,
            retryScheduled: false,
            lastTransition: "lp_read_rearm",
            lastErrorCode: check.reason ?? "lp_body_incompatible",
          }
        : {
            ...cleared.deepRuntime,
            lease: undefined,
            retryRequired: false,
            retryScheduled: false,
            lastTransition: "lp_read_terminal",
            lastErrorCode: check.reason ?? "lp_body_incompatible",
          },
    };
  }
  return response;
}

/** Stamp / refresh force-LP terminal contract on a newly assigned deep attempt. */
function withForceLpTerminal(response: ScanResponse): ScanResponse {
  const gen = response.deepAttemptId;
  if (!gen) return response;
  const prior = response.lpTerminal;
  return {
    ...response,
    lpTerminal: markLpTerminalRunning(
      beginLpTerminal({
        attemptId: gen,
        generation: gen,
        forceRefresh: true,
        startedAt: prior?.startedAt,
      }),
    ),
  };
}

/**
 * Persist a settled Deep outcome. Phase 10C-5: force-LP never settles as
 * PARTIAL_TERMINAL for liquidity — recover or hard-terminal instead.
 */
function settleTerminalPartial(
  response: ScanResponse,
  opts?: { reason?: string; existingRetryCount?: number },
): ScanResponse {
  if (isLpForceRefreshActive(response) || response.lpTerminal?.forceRefresh) {
    const contract =
      response.lpTerminal ??
      beginLpTerminal({
        attemptId: response.deepAttemptId ?? "unknown",
        generation: response.deepAttemptId ?? "unknown",
        forceRefresh: true,
      });
    const outcome = resolveLpInterruptOutcome({
      response,
      contract,
      interruptReason: hasVerifiedLockedResult(response)
        ? "verified_lock_published"
        : "recovery_exhausted",
    });
    if (outcome.kind === "success") {
      return {
        ...outcome.response,
        deepRetryCount: mergeMonotonicDeepRetryCount(
          opts?.existingRetryCount,
          outcome.response.deepRetryCount,
        ),
      };
    }
    if (outcome.kind === "recover") {
      const existingRetry = mergeMonotonicDeepRetryCount(
        opts?.existingRetryCount,
        response.deepRetryCount,
      );
      // Phase 13A: if deep auto-retries already exhausted, do not re-open analyzing.
      if (existingRetry >= MAX_DEEP_AUTO_RETRIES) {
        const failed = applyLpHardTerminal(
          response.analysisStatus === "failed" ||
            response.analysisStatus === "partial"
            ? response
            : markScanPartial(response, opts),
          settleLpFailedTerminal(contract, {
            reason: "recovery_exhausted",
            failedStages: ["liquidity"],
          }),
        );
        const bumped = bumpDeepRetryCount({
          ...failed,
          analysisStatus: "failed",
          analysisStages: {
            ...failed.analysisStages!,
            liquidity: "unknown",
          },
        });
        return clearDeepLease(
          {
            ...bumped,
            deepRetryCount: mergeMonotonicDeepRetryCount(
              existingRetry,
              bumped.deepRetryCount,
            ),
          },
          "force_lp_retry_exhausted",
          "recovery_exhausted",
        );
      }
      // Keep collecting — new generation so cancelled workers stay fenced out.
      const addr = outcome.response.overview?.address;
      if (addr) markForceLpFullRefresh(addr);
      const rearmed = assignDeepAttempt({
        ...clearStaleLpEvidence(outcome.response),
        analysisStatus: "deep_running",
        analysisStages: {
          ...outcome.response.analysisStages!,
          liquidity: "analyzing",
        },
        scoreProvisional: true,
      });
      const gen = rearmed.deepAttemptId!;
      const bumped = bumpDeepRetryCount({
        ...rearmed,
        lpTerminal: {
          ...outcome.contract,
          attemptId: gen,
          generation: gen,
        },
      });
      return stampDeepRuntime(
        {
          ...bumped,
          deepRetryCount: mergeMonotonicDeepRetryCount(
            existingRetry,
            bumped.deepRetryCount,
          ),
        },
        {
          retryRequired: true,
          retryScheduled: true,
          lastTransition: "force_lp_recover",
          lastErrorCode: null,
        },
      );
    }
    const failed = applyLpHardTerminal(
      response.analysisStatus === "failed" ||
        response.analysisStatus === "partial"
        ? response
        : markScanPartial(response, opts),
      settleLpFailedTerminal(contract, {
        reason: "recovery_exhausted",
        failedStages: ["liquidity"],
      }),
    );
    // Force FAILED_TERMINAL: liquidity unknown (not sticky partial/analyzing).
    const bumped = bumpDeepRetryCount({
      ...failed,
      analysisStatus: "failed",
      analysisStages: {
        ...failed.analysisStages!,
        liquidity: "unknown",
      },
    });
    return {
      ...bumped,
      deepRetryCount: mergeMonotonicDeepRetryCount(
        opts?.existingRetryCount,
        bumped.deepRetryCount,
      ),
    };
  }

  const marked =
    response.analysisStatus === "partial" || response.analysisStatus === "failed"
      ? // Phase 13A: still run markScanPartial so sticky analyzing stages terminalize.
        markScanPartial(response, opts)
      : markScanPartial(response, opts);
  const bumped = bumpDeepRetryCount(marked);
  return clearDeepLease(
    {
      ...bumped,
      deepRetryCount: mergeMonotonicDeepRetryCount(
        opts?.existingRetryCount,
        bumped.deepRetryCount,
      ),
    },
    "settled_partial",
    opts?.reason ? "deep_partial" : undefined,
  );
}

/**
 * Phase 13A — recover orphan analyzing (no inflight, no valid lease, no retry).
 */
export async function recoverOrphanAnalyzingIfNeeded(
  address: string,
): Promise<ScanResponse | null> {
  const normalized = assertValidTokenAddress(address);
  const key = cacheKey(normalized);
  const loaded = await loadSnapshot(normalized);
  if (!loaded) return null;
  const deepInflight = isDeepAnalysisInflight(normalized);
  const outcome = recoverOrphanAnalyzing(loaded.snap.response, { deepInflight });
  if (!outcome.orphan) return null;
  console.warn(
    JSON.stringify({
      tag: "deep_orphan_recovered",
      address: normalized,
      shouldRetry: outcome.shouldRetry,
      transition: outcome.response.deepRuntime?.lastTransition,
      deepRetryCount: outcome.response.deepRetryCount ?? 0,
      deploymentScope: resolveDeploymentScope(),
    }),
  );
  let next = outcome.response;
  if (outcome.shouldRetry) {
    // Re-arm collecting so after()/schedule can continue with a new generation.
    next = rearmPartialForDeepRetry({
      ...next,
      analysisStatus: "partial",
    });
    next = stampDeepRuntime(next, {
      retryRequired: true,
      retryScheduled: true,
      lastTransition: "orphan_rearmed",
      lastErrorCode: "orphan_analyzing",
    });
  }
  const written = await persistProgressResponse(key, next);
  return written;
}

/**
 * If deep_running exceeded DEEP_STALE_THRESHOLD_MS, mark stages partial,
 * release lock, preserve Fast Scan body.
 * Phase 7.3: also recovers interactive stalls (watchdog / 90s) without waiting 360s.
 * Retires the Deep generation and clears coalescing so late writers no-op and
 * a retryable partial can start a new attempt.
 */
export async function recoverStaleDeepIfNeeded(
  address: string,
  now = Date.now(),
): Promise<ScanResponse | null> {
  const normalized = assertValidTokenAddress(address);
  const key = cacheKey(normalized);
  const loaded = await loadSnapshot(normalized);
  if (!loaded) return null;
  const { snap } = loaded;
  const hardStale = isDeepStale(snap.response, now);
  const interactiveStale =
    !hardStale &&
    isDeepInteractivelyStale(snap.response, now, DEEP_INTERACTIVE_STALE_MS);
  if (!hardStale && !interactiveStale) return null;

  // Cancel same-isolate worker before releasing lock (fenced).
  cancelActiveDeepAttempt(normalized, "interactive_stale");

  console.warn(
    `[scan-cache] recovering ${hardStale ? "stale" : "interactive-stale"} deep_running for ${normalized}` +
      ` (hard=${DEEP_STALE_THRESHOLD_MS}ms interactive=${DEEP_INTERACTIVE_STALE_MS}ms inflight=${inflight.has(key)})`,
  );
  backgroundRefresh.delete(key);
  // Drop coalescing entry so a re-armed attempt can start; old promise's
  // finally must not clear a newer inflight (identity check in runFreshScan).
  inflight.delete(key);
  await releaseRefreshLock(key);
  const recovered = retireDeepAttempt(
    settleTerminalPartial(snap.response, {
      reason:
        "Deep analysis stopped or timed out — Fast Scan preserved. Some sections temporarily unavailable.",
      existingRetryCount: snap.response.deepRetryCount,
    }),
  );
  await persistProgressResponse(key, recovered);
  return recovered;
}

async function runFreshScan(address: string): Promise<ScanResponse> {
  const key = cacheKey(address);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    let owned = await acquireRefreshLock(key, SCAN_DEEP_LOCK_TTL_SEC);
    if (!owned) {
      const waited = await waitForSnapshotAfterLock(key, SCAN_LOCK_WAIT_MS * 2);
      if (waited && isScanComplete(waited.response)) return waited.response;
      const fallback = memory.get(key) ?? (await kvGetSnapshot(key));
      if (fallback && isScanComplete(fallback.response)) return fallback.response;
      // Phase 7.3: fenced interactive takeover when prior owner is stalled.
      const stalledSnap = fallback ?? waited;
      if (
        stalledSnap &&
        isDeepInteractivelyStale(stalledSnap.response) &&
        !isDeepAnalysisInflight(address)
      ) {
        cancelActiveDeepAttempt(address, "interactive_stale");
        await releaseRefreshLock(key);
        owned = await acquireRefreshLock(key, SCAN_DEEP_LOCK_TTL_SEC);
      }
      if (!owned) {
        await sleep(1_500);
        const again = memory.get(key) ?? (await kvGetSnapshot(key));
        if (again && isScanComplete(again.response)) return again.response;
        if (again) return again.response;
        throw new Error(
          "Scan refresh in progress for this token — retry shortly (no snapshot yet).",
        );
      }
    }
    try {
      const prior = memory.get(key) ?? (await kvGetSnapshot(key));
      const deadline = Date.now() + DEEP_SCAN_MAX_EXECUTION_MS;

      // Prefer progressive enrich from Fast snapshot (avoids redoing wave1).
      if (prior && isDeepInProgress(prior.response)) {
        // Phase 13A order: allocate generation → register lease → persist analyzing → work.
        const allocated = prior.response.deepAttemptId
          ? {
              ...prior.response,
              deepStartedAt:
                prior.response.deepStartedAt ?? new Date().toISOString(),
              analysisStatus: "deep_running" as const,
            }
          : assignDeepAttempt({
              ...prior.response,
              analysisStatus: "deep_running",
            });
        const base = withRegisteredDeepJob(allocated);
        await persistProgressResponse(key, base);
        const attemptId = base.deepAttemptId;
        try {
          const enriched = await enrichScanDeep(base, {
            deadline,
            onProgress: async (partial) => {
              const lease = partial.deepRuntime?.lease ?? base.deepRuntime?.lease;
              const heartbeated = lease
                ? stampDeepRuntime(partial, {
                    lease: heartbeatDeepLease(lease),
                    lastTransition: "progress_heartbeat",
                  })
                : partial;
              await persistFencedDeepProgress(key, {
                ...heartbeated,
                deepAttemptId: attemptId,
              });
            },
          });
          // Never persist a terminal deep job still marked deep_running
          const existingRetry =
            (memory.get(key) ?? (await kvGetSnapshot(key)))?.response
              .deepRetryCount ?? base.deepRetryCount;
          // Phase 10C-5: force-LP recovery mid-flight stays deep_running + analyzing
          // — do not wrap again in settleTerminalPartial (would double-count recovery).
          const forceLpRecovering =
            enriched.lpTerminal?.forceRefresh === true &&
            !isLpHardTerminal(enriched.lpTerminal) &&
            enriched.analysisStages?.liquidity === "analyzing";
          const finalized =
            enriched.analysisStatus === "deep_running" && !forceLpRecovering
              ? settleTerminalPartial(
                  { ...enriched, deepAttemptId: attemptId },
                  {
                    reason:
                      "Deep analysis ended without completion — Fast Scan preserved.",
                    existingRetryCount: existingRetry,
                  },
                )
              : enriched.analysisStatus === "partial" ||
                  enriched.analysisStatus === "failed"
                ? {
                    ...bumpDeepRetryCount({
                      ...enriched,
                      deepAttemptId: attemptId,
                    }),
                    deepRetryCount: mergeMonotonicDeepRetryCount(
                      existingRetry,
                      (enriched.deepRetryCount ?? 0) + 1,
                    ),
                  }
                : { ...enriched, deepAttemptId: attemptId };
          const nowIso = new Date().toISOString();
          const released = forceLpRecovering
            ? stampDeepRuntime(
                {
                  ...finalized,
                  scoreComputedAt: nowIso,
                  activityUpdatedAt: nowIso,
                },
                {
                  lease: undefined,
                  retryRequired: true,
                  retryScheduled: true,
                  lastTransition: "force_lp_midflight",
                  lastErrorCode: null,
                },
              )
            : clearDeepLease(
                {
                  ...finalized,
                  scoreComputedAt: nowIso,
                  activityUpdatedAt: nowIso,
                },
                "deep_settled",
              );
          const stamped = stampResponse(released, nowIso, nowIso);
          const settled = await persistFencedDeepSettle(
            key,
            annotateFenceAccepted(stamped),
          );
          return settled.response;
        } catch (err) {
          const existingRetry =
            (memory.get(key) ?? (await kvGetSnapshot(key)))?.response
              .deepRetryCount ?? base.deepRetryCount;
          const errCode =
            err instanceof DeepScanTimeoutError
              ? "deep_timeout"
              : (err as { code?: string })?.code === "deep_lp_rpc_timeout"
                ? "deep_lp_rpc_timeout"
                : "deep_enrich_failed";
          const partial = settleTerminalPartial(
            clearDeepLease(
              { ...base, deepAttemptId: attemptId },
              "worker_failed",
              errCode,
            ),
            {
              reason:
                err instanceof DeepScanTimeoutError
                  ? err.message
                  : "Deep analysis failed — Fast Scan preserved. Some sections temporarily unavailable.",
              existingRetryCount: existingRetry,
            },
          );
          console.warn("[scan-cache] deep enrich failed; marking partial:", err);
          const settled = await persistFencedDeepSettle(key, partial);
          return settled.response;
        }
      }

      // No fast base (manual full refresh cold) — monolithic scanToken with deadline
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          scanToken(address).then(markScanComplete),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new DeepScanTimeoutError(
                    `Deep scanToken exceeded ${DEEP_SCAN_MAX_EXECUTION_MS}ms`,
                  ),
                ),
              DEEP_SCAN_MAX_EXECUTION_MS,
            );
          }),
        ]);
        const nowIso = new Date().toISOString();
        const stamped = stampResponse(
          {
            ...result,
            scoreComputedAt: nowIso,
            activityUpdatedAt: nowIso,
          },
          nowIso,
          nowIso,
        );
        await persistSnapshot(key, toStored(stamped));
        return stamped;
      } catch (err) {
        if (prior) {
          const existingRetry = prior.response.deepRetryCount;
          const partial = settleTerminalPartial(prior.response, {
            reason:
              err instanceof Error
                ? err.message
                : "Deep analysis failed — Fast Scan preserved.",
            existingRetryCount: existingRetry,
          });
          const settled = await persistFencedDeepSettle(key, partial);
          return settled.response;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    } finally {
      await releaseRefreshLock(key);
    }
  })().finally(() => {
    // Identity-safe: do not clear a newer attempt's coalescing entry.
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });

  inflight.set(key, promise);
  return promise;
}

async function runFastScan(address: string): Promise<ScanResponse> {
  const key = cacheKey(address);
  const existing = fastInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const result = await scanTokenFast(address);
    const nowIso = new Date().toISOString();
    const stamped = stampResponse(
      {
        ...result,
        scoreComputedAt: nowIso,
        activityUpdatedAt: nowIso,
      },
      nowIso,
      nowIso,
    );
    // Persist fast snapshot so SSR / status / concurrent users see TTFR result
    // Deep analysis will overwrite with complete when finished.
    const prior = memory.get(key) ?? (await kvGetSnapshot(key));
    if (prior && isScanComplete(prior.response) && isScoreFresh(prior)) {
      return prior.response;
    }
    await persistSnapshot(key, toStored(stamped));
    return stamped;
  })().finally(() => {
    fastInflight.delete(key);
  });

  fastInflight.set(key, promise);
  return promise;
}

/**
 * After a Deep attempt settles retryable-partial, re-arm stages and schedule
 * another attempt (fresh execution budget). Prevents Fast → partial → stuck UI.
 * Stale jobs whose generation is no longer authoritative must not re-arm.
 */
async function rearmAndContinueIfRetryable(
  address: string,
  result: ScanResponse,
): Promise<void> {
  if (!isDeepRetryable(result)) return;
  const key = cacheKey(address);
  const current = await loadAuthoritativeSnap(key);
  const auth = current?.response;
  if (
    result.deepAttemptId != null &&
    auth?.deepAttemptId != null &&
    result.deepAttemptId !== auth.deepAttemptId
  ) {
    return;
  }
  // Exhausted on the authoritative snapshot — do not re-open budget.
  if (auth && !isDeepRetryable(auth)) {
    if (auth.analysisStatus === "partial" || auth.analysisStatus === "failed") {
      return;
    }
  }
  // Re-arm from authoritative (not a possibly-stale settle payload).
  const base = preferAuthoritativeDeepResponse(auth, result) ?? result;
  if (!isDeepRetryable(base)) return;
  const rearmed = rearmPartialForDeepRetry(base);
  if (shouldRejectUnfencedDeepWrite(auth, rearmed)) return;
  const written = await persistProgressResponse(key, rearmed);
  if (written === auth) return;
  console.info(
    `[scan-cache] re-arm deep retry for ${address} deepRetryCount=${base.deepRetryCount ?? 0}`,
  );
}

/** Schedule deep scanToken (LP + creator + P2/P3). Same-CA coalesced. */
export function scheduleDeepAnalysis(address: string): void {
  const key = cacheKey(address);
  if (backgroundRefresh.has(key) || inflight.has(key)) return;
  backgroundRefresh.add(key);
  void runFreshScan(address)
    .then(async (result) => {
      await rearmAndContinueIfRetryable(address, result);
    })
    .catch((err) => {
      console.warn("[scan-cache] deep analysis failed:", err);
    })
    .finally(() => {
      backgroundRefresh.delete(key);
      // Kick the re-armed attempt now that this job released coalescing locks.
      void (async () => {
        const peeked = await peekScanSnapshot(address);
        if (
          peeked &&
          isDeepInProgress(peeked) &&
          !inflight.has(key) &&
          !backgroundRefresh.has(key)
        ) {
          scheduleDeepAnalysis(address);
        }
      })();
    });
}

/**
 * Await deep analysis (for Next.js `after()` so the isolate stays alive).
 * Coalesces with scheduleDeepAnalysis / concurrent callers.
 * Re-arms retryable partial so status polls continue collection.
 */
export async function ensureDeepAnalysis(address: string): Promise<ScanResponse> {
  const normalized = assertValidTokenAddress(address.trim());
  await recoverStaleDeepIfNeeded(normalized);
  await recoverOrphanAnalyzingIfNeeded(normalized);
  const key = cacheKey(normalized);
  const authSnap = await loadAuthoritativeSnap(key);
  const peeked = authSnap?.response ?? (await peekScanSnapshot(normalized));
  if (!peeked) return runFreshScan(normalized);

  if (isDeepRetryable(peeked)) {
    const rearmed = rearmPartialForDeepRetry(peeked);
    const written = await persistProgressResponse(key, rearmed);
    // Another isolate may have exhausted the budget; do not start collecting.
    if (
      (written.analysisStatus === "partial" ||
        written.analysisStatus === "failed") &&
      !isDeepRetryable(written)
    ) {
      return written;
    }
    return runFreshScan(normalized);
  }

  // Honest terminal partial/failed — budget exhausted or no retryable stages.
  if (
    peeked.analysisStatus === "partial" ||
    peeked.analysisStatus === "failed"
  ) {
    return peeked;
  }

  return runFreshScan(normalized);
}

function scheduleBackgroundRefresh(address: string): void {
  scheduleDeepAnalysis(address);
}

/** Whether a deep job is currently running for this CA. */
export function isDeepAnalysisInflight(address: string): boolean {
  const key = cacheKey(address);
  return inflight.has(key) || backgroundRefresh.has(key);
}

async function loadSnapshot(address: string): Promise<{
  snap: StoredSnapshot;
  source: "memory" | "kv";
} | null> {
  const key = cacheKey(address);
  const auth = await loadAuthoritativeSnap(key);
  if (!auth) return null;
  const mem = memory.get(key);
  const source =
    mem &&
    preferAuthoritativeDeepResponse(mem.response, auth.response) === mem.response
      ? "memory"
      : "kv";
  return { snap: auth, source };
}

/** Peek memory/KV only — never starts a full scan (SSR-safe). */
export async function peekScanSnapshot(
  address: string,
): Promise<CachedScanResponse | null> {
  const loaded = await loadSnapshot(address);
  if (!loaded) return null;
  const { snap, source } = loaded;
  return withMeta(snap.response, {
    hit: true,
    stale: !isScoreFresh(snap),
    source,
    ageMs: ageMs(snap),
    refreshing: false,
    refreshAvailableInSec: 0,
  });
}

async function checkRefreshRateLimit(
  key: string,
  clientIp?: string | null,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const kv = await getKv();

  // Address-level
  if (kv) {
    try {
      const flagged = await kv.get<number>(SCAN_KEYS.rlAddr(key));
      if (flagged) {
        return { allowed: false, retryAfterSec: Math.ceil(SCAN_REFRESH_ADDR_COOLDOWN_MS / 1000) };
      }
    } catch {
      /* fall through to memory */
    }
  }
  const addrUntil = memoryRlAddr.get(key) ?? 0;
  if (addrUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((addrUntil - now) / 1000) };
  }

  // IP-level
  if (clientIp) {
    const ipHash = Buffer.from(clientIp).toString("base64url").slice(0, 32);
    if (kv) {
      try {
        const flagged = await kv.get<number>(SCAN_KEYS.rlIp(ipHash));
        if (flagged) {
          return { allowed: false, retryAfterSec: Math.ceil(SCAN_REFRESH_IP_COOLDOWN_MS / 1000) };
        }
      } catch {
        /* memory */
      }
    }
    const ipUntil = memoryRlIp.get(ipHash) ?? 0;
    if (ipUntil > now) {
      return { allowed: false, retryAfterSec: Math.ceil((ipUntil - now) / 1000) };
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

async function markRefreshRateLimit(
  key: string,
  clientIp?: string | null,
): Promise<void> {
  const now = Date.now();
  memoryRlAddr.set(key, now + SCAN_REFRESH_ADDR_COOLDOWN_MS);
  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(SCAN_KEYS.rlAddr(key), now, {
        ex: Math.ceil(SCAN_REFRESH_ADDR_COOLDOWN_MS / 1000),
      });
    } catch {
      /* ignore */
    }
  }
  if (clientIp) {
    const ipHash = Buffer.from(clientIp).toString("base64url").slice(0, 32);
    memoryRlIp.set(ipHash, now + SCAN_REFRESH_IP_COOLDOWN_MS);
    if (kv) {
      try {
        await kv.set(SCAN_KEYS.rlIp(ipHash), now, {
          ex: Math.ceil(SCAN_REFRESH_IP_COOLDOWN_MS / 1000),
        });
      } catch {
        /* ignore */
      }
    }
  }
}

export type GetCachedScanOptions = {
  refresh?: boolean;
  clientIp?: string | null;
  /**
   * Internal / admin-only: force full LP ownership+lock revalidation.
   * Normal user refresh uses Smart LP freshness evaluation instead.
   * Not exposed on the public scan API body.
   */
  forceLpFullRefresh?: boolean;
};

/**
 * Fast / warm path: look up transfer-index; background refresh only when needed.
 * Does not mutate ScanResponse (no semantic change to Fast output).
 */
async function maybeScheduleTransferIndexRefresh(
  address: string,
): Promise<void> {
  try {
    const v = await peekTransferIndexValidation(address);
    if (v.needsBackgroundRefresh) {
      scheduleTransferIndexBackgroundRefresh({ tokenAddress: address });
    }
  } catch (err) {
    console.warn("[scan-cache] transfer-index peek failed:", err);
  }
}

/**
 * Overlay fresher `scan:burn:*` history onto a snapshot without re-running Score.
 * Incomplete windows stay Unknown / Incomplete — never invent completeness.
 */
async function applyBurnHistoryOverlay(
  address: string,
  response: ScanResponse,
): Promise<ScanResponse> {
  const sb = response.overview?.supplyBurn;
  if (!sb) return response;
  // Fast / provisional: deep job owns P2/P3 — do not start a parallel burn paginate
  if (
    response.analysisPhase === "fast" ||
    response.scoreProvisional ||
    response.analysisStatus === "deep_running" ||
    response.analysisStatus === "partial"
  ) {
    return response;
  }
  try {
    const bundle = await peekBurnHistoryBundle(address);
    const decimals = response.overview.decimals ?? null;
    const hasPath = hasSupplyReducingAbiPath(sb);
    if (bundle) {
      const nextSb = attachBurnHistoryToSupplyBurn(sb, bundle);
      if (!isBurnHistoryFresh(bundle.stored)) {
        scheduleBurnHistoryBackgroundRefresh({
          address,
          decimals,
          hasSupplyReducingAbiPath: hasPath,
        });
      }
      return {
        ...response,
        overview: { ...response.overview, supplyBurn: nextSb },
      };
    }
    scheduleBurnHistoryBackgroundRefresh({
      address,
      decimals,
      hasSupplyReducingAbiPath: hasPath,
    });
    return response;
  } catch (err) {
    console.warn("[scan-cache] burn history overlay failed:", err);
    return response;
  }
}

/**
 * KV/memory read-through Scan cache:
 * - Complete snapshots: Activity overlay + SWR (unchanged Performance MVP)
 * - Cold / incomplete: Fast Scan (seconds) + background Deep Analysis (minutes)
 * Same-CA dedupe for both fast and deep.
 */
export async function getCachedScan(
  address: string,
  opts: GetCachedScanOptions = {},
): Promise<CachedScanResponse> {
  const normalized = assertValidTokenAddress(address.trim());
  const key = cacheKey(normalized);

  if (opts.refresh) {
    const rlKey = rlAddrKey(normalized);
    const rl = await checkRefreshRateLimit(rlKey, opts.clientIp);
    if (!rl.allowed) {
      const peeked = await peekScanSnapshot(normalized);
      if (peeked) {
        return {
          ...peeked,
          cache: {
            ...peeked.cache,
            refreshDenied: true,
            refreshAvailableInSec: rl.retryAfterSec,
          },
        };
      }
    }
    // Phase 10C-3: refresh must recover zombie deep_running before re-arm/schedule.
    // Previously refresh skipped recoverStaleDeepIfNeeded (non-refresh path only).
    await recoverStaleDeepIfNeeded(normalized);
    // Non-blocking refresh: clear partial → schedule deep, return latest usable snapshot
    await markRefreshRateLimit(rlKey, opts.clientIp);
    const priorRefresh = await loadSnapshot(normalized);
    if (
      priorRefresh?.snap.response.analysisStatus === "partial" ||
      priorRefresh?.snap.response.analysisStatus === "failed"
    ) {
      // Manual refresh: new generation + reset auto-retry budget by design.
      // Must bypass exhausted-terminal unfenced write rejection — auto-rearm
      // remains blocked via persistProgressResponse / shouldRejectUnfencedDeepWrite.
      const forceFromPartial =
        opts.forceLpFullRefresh === true ||
        lpEvidenceNeedsFullRefresh(priorRefresh.snap.response);
      if (forceFromPartial) {
        markForceLpFullRefresh(normalized);
        await deleteLpPublishedBody(
          resolveDeploymentScope(),
          normalized,
          SCAN_CHAIN_ID,
        );
      }
      let rearmed: ScanResponse = {
        ...rearmPartialForDeepRetry(priorRefresh.snap.response),
        deepRetryCount: 0,
      };
      if (forceFromPartial) rearmed = withForceLpTerminal(rearmed);
      await persistSnapshot(key, toStored(rearmed));
    } else if (
      priorRefresh &&
      (opts.forceLpFullRefresh === true ||
        lpEvidenceNeedsFullRefresh(priorRefresh.snap.response))
    ) {
      // Sticky timeout / version-budget LP marked liquidity=done — force re-run.
      // Phase 10C-4: clear published LP body so warm cannot reuse timeout detail.
      markForceLpFullRefresh(normalized);
      await deleteLpPublishedBody(
        resolveDeploymentScope(),
        normalized,
        SCAN_CHAIN_ID,
      );
      await markManualSmartLpRefresh(SCAN_CHAIN_ID, normalized);
      const priorStages = priorRefresh.snap.response.analysisStages;
      let rearmed: ScanResponse = {
        ...rearmPartialForDeepRetry({
          ...priorRefresh.snap.response,
          analysisStatus: "partial",
          analysisStages: {
            contract: priorStages?.contract ?? "done",
            holders: priorStages?.holders ?? "done",
            market: priorStages?.market ?? "done",
            burn: priorStages?.burn ?? "partial",
            liquidity: "partial",
            creator: priorStages?.creator ?? "partial",
            relationships: priorStages?.relationships ?? "partial",
            score: "partial",
          },
        }),
        deepRetryCount: 0,
      };
      rearmed = withForceLpTerminal(rearmed);
      await persistSnapshot(key, toStored(rearmed));
    } else if (
      priorRefresh?.snap.response.analysisStatus === "complete" ||
      priorRefresh?.snap.response.analysisPhase === "complete"
    ) {
      // Phase 7 warm rearm: stamp new Deep generation; arm only stale/incomplete
      // stages. Preserve fresh completed siblings (no whole-scan restart).
      const priorResp = priorRefresh.snap.response;
      const xferV = await peekTransferIndexValidation(normalized);
      const lpCkpt = await loadLpDiscoveryCheckpoint(SCAN_CHAIN_ID, normalized);
      const scoreAt = priorResp.scoreComputedAt ?? priorResp.scannedAt;
      const snapshotAgeMs = scoreAt
        ? Math.max(0, Date.now() - Date.parse(scoreAt))
        : null;
      const eligibility = evaluateWarmEligibility({
        chainId: SCAN_CHAIN_ID,
        tokenAddress: normalized,
        snapshot: priorResp,
        snapshotSchemaVersion: SCAN_SNAPSHOT_SCHEMA_VERSION,
        analysisSemanticVersion: priorResp.version ?? ANALYSIS_SEMANTIC_VERSION,
        transferValidation: xferV,
      });
      const forceLp =
        opts.forceLpFullRefresh === true ||
        lpEvidenceNeedsFullRefresh(priorResp);
      if (forceLp) {
        markForceLpFullRefresh(normalized);
        await deleteLpPublishedBody(
          resolveDeploymentScope(),
          normalized,
          SCAN_CHAIN_ID,
        );
      }
      // Phase 7.1: mark manual refresh in KV so Deep (other isolate) always
      // evaluates Smart LP (never silently skip liquidity).
      await markManualSmartLpRefresh(SCAN_CHAIN_ID, normalized);
      // Arm liquidity for Smart LP freshness evaluation (not force-all
      // ownership/lock). Job body uses planSmartLpRefresh — may be price-only.
      const plan = planWarmDeepStages({
        eligibility,
        stages: priorResp.analysisStages,
        lpQuickComplete: lpCkpt?.quickComplete === true,
        snapshotAgeMs,
        forceLiquidityRefresh: true,
      });
      const warmStages = applyWarmRearmStages(priorResp, plan);
      const baseResp = forceLp ? clearStaleLpEvidence(priorResp) : priorResp;
      const rearmed: ScanResponse = assignDeepAttempt({
        ...baseResp,
        analysisPhase: "fast",
        analysisStatus: "deep_running",
        scoreProvisional: true,
        deepRetryCount: 0,
        analysisStages: {
          ...warmStages,
          ...(forceLp ? { liquidity: "analyzing" as const, score: "analyzing" as const } : {}),
        },
      });
      const gen = rearmed.deepAttemptId!;
      const stamped: ScanResponse = forceLp
        ? {
            ...rearmed,
            lpTerminal: markLpTerminalRunning(
              beginLpTerminal({
                attemptId: gen,
                generation: gen,
                forceRefresh: true,
              }),
            ),
          }
        : rearmed;
      await persistSnapshot(key, toStored(stamped));
    } else if (opts.forceLpFullRefresh === true && priorRefresh) {
      // Force LP while deep_running / other non-complete — new generation + terminal contract.
      cancelActiveDeepAttempt(normalized, "external");
      markForceLpFullRefresh(normalized);
      await deleteLpPublishedBody(
        resolveDeploymentScope(),
        normalized,
        SCAN_CHAIN_ID,
      );
      await markManualSmartLpRefresh(SCAN_CHAIN_ID, normalized);
      await releaseRefreshLock(key);
      const cleared = clearStaleLpEvidence(priorRefresh.snap.response);
      const rearmed = withForceLpTerminal(
        assignDeepAttempt({
          ...cleared,
          analysisPhase: "fast",
          analysisStatus: "deep_running",
          scoreProvisional: true,
          deepRetryCount: 0,
          analysisStages: {
            ...(cleared.analysisStages ?? priorRefresh.snap.response.analysisStages!),
            liquidity: "analyzing",
            score: "analyzing",
          },
        }),
      );
      await persistSnapshot(key, toStored(rearmed));
    }
    scheduleDeepAnalysis(normalized);
    const loadedRefresh = await loadSnapshot(normalized);
    if (loadedRefresh) {
      return withMetaReconciled(loadedRefresh.snap.response, {
        hit: true,
        stale: !isScanComplete(loadedRefresh.snap.response),
        source: loadedRefresh.source,
        ageMs: ageMs(loadedRefresh.snap),
        refreshing: true,
        refreshAvailableInSec: Math.ceil(SCAN_REFRESH_ADDR_COOLDOWN_MS / 1000),
      });
    }
    const fast = await runFastScan(normalized);
    scheduleDeepAnalysis(normalized);
    return withMetaReconciled(fast, {
      hit: false,
      stale: false,
      source: "fast",
      ageMs: 0,
      refreshing: true,
      refreshAvailableInSec: Math.ceil(SCAN_REFRESH_ADDR_COOLDOWN_MS / 1000),
    });
  }

  // Recover zombie deep_running left by terminated after()
  await recoverStaleDeepIfNeeded(normalized);

  const loaded = await loadSnapshot(normalized);
  if (loaded) {
    let snap = loaded.snap;
    let source = loaded.source;

    // Incomplete fast / deep_running / retryable partial — keep serving; ensure deep runs
    if (isDeepRetryable(snap.response)) {
      const rearmed = rearmPartialForDeepRetry(snap.response);
      const written = await persistProgressResponse(key, rearmed);
      snap = { ...snap, response: written };
      if (isDeepRetryable(written) || written.analysisStatus === "deep_running") {
        scheduleDeepAnalysis(normalized);
      }
      return withMetaReconciled(written, {
        hit: true,
        stale: !isDeepRetryable(written) && written.analysisStatus !== "deep_running",
        source,
        ageMs: ageMs(snap),
        refreshing:
          isDeepRetryable(written) || written.analysisStatus === "deep_running",
        refreshAvailableInSec: 0,
      });
    }
    if (isDeepInProgress(snap.response)) {
      scheduleDeepAnalysis(normalized);
      return withMetaReconciled(snap.response, {
        hit: true,
        stale: false,
        source,
        ageMs: ageMs(snap),
        refreshing: true,
        refreshAvailableInSec: 0,
      });
    }

    // Terminal partial/failed (retry budget exhausted) — serve Fast/available data.
    if (!isScanComplete(snap.response)) {
      return withMetaReconciled(snap.response, {
        hit: true,
        stale: true,
        source,
        ageMs: ageMs(snap),
        refreshing: false,
        refreshAvailableInSec: 0,
      });
    }

    if (isScoreFresh(snap)) {
      snap = await applyActivityOverlay(normalized, snap);
      const withBurn = await applyBurnHistoryOverlay(normalized, snap.response);
      snap = { ...snap, response: withBurn };
      source = memory.get(key) ? "memory" : source;
      // Warm Fast/complete: reuse valid transfer-index; refresh only when needed.
      void maybeScheduleTransferIndexRefresh(normalized);
      return withMetaReconciled(snap.response, {
        hit: true,
        stale: false,
        source,
        ageMs: ageMs(snap),
        refreshing: false,
        refreshAvailableInSec: 0,
      });
    }

    // Stale-while-revalidate complete snapshot
    scheduleBackgroundRefresh(normalized);
    void maybeScheduleTransferIndexRefresh(normalized);
    snap = await applyActivityOverlay(normalized, snap);
    const withBurn = await applyBurnHistoryOverlay(normalized, snap.response);
    return withMetaReconciled(withBurn, {
      hit: true,
      stale: true,
      source,
      ageMs: ageMs(snap),
      refreshing: true,
      refreshAvailableInSec: 0,
    });
  }

  // Cold miss — Fast Scan only (do not block HTTP on deep LP/creator)
  const wasFastInflight = fastInflight.has(key);
  try {
    const fast = await runFastScan(normalized);
    // Lookup + optional background transfer-index refresh (never blocks Fast).
    void maybeScheduleTransferIndexRefresh(normalized);
    scheduleDeepAnalysis(normalized);
    return withMeta(fast, {
      hit: wasFastInflight,
      stale: false,
      source: wasFastInflight ? "inflight" : "fast",
      ageMs: 0,
      refreshing: true,
      refreshAvailableInSec: 0,
    });
  } catch (err) {
    throw err;
  }
}

/**
 * Status poll helper — peek snapshot + deep inflight flag (no new scan start
 * unless caller also hits getCachedScan).
 */
export async function getScanAnalysisStatus(address: string): Promise<{
  address: string;
  analysisStatus: ScanResponse["analysisStatus"];
  analysisPhase: ScanResponse["analysisPhase"];
  scoreProvisional: boolean;
  analysisStages: ScanResponse["analysisStages"];
  deepInflight: boolean;
  /** True when caller should schedule after() deep work (not fire-and-forget). */
  needsDeepAfter: boolean;
  /** Phase 13A — lease / retry / fence diagnostics (no secrets). */
  deepRuntime: DeepRuntimeDiagnostics;
  result: CachedScanResponse | null;
}> {
  const normalized = assertValidTokenAddress(address.trim());
  await recoverStaleDeepIfNeeded(normalized);
  await recoverOrphanAnalyzingIfNeeded(normalized);
  const key = cacheKey(normalized);
  const authSnap = await loadAuthoritativeSnap(key);
  let peeked = authSnap
    ? await withMetaReconciled(authSnap.response, {
        hit: true,
        stale: !isScoreFresh(authSnap),
        source: "kv",
        ageMs: ageMs(authSnap),
        refreshing: false,
        refreshAvailableInSec: 0,
      })
    : await peekScanSnapshot(normalized);

  // Progress watchdog: may interrupt work but MUST NEVER publish an LP partial terminal.
  // Phase 10C-5: timeout → record → bounded recovery → SUCCESS_TERMINAL | FAILED_TERMINAL.
  const stallThresholdMs =
    peeked?.lpTerminal?.forceRefresh && !isLpHardTerminal(peeked.lpTerminal)
      ? LP_FORCE_PROGRESS_STALL_MS
      : DEEP_PROGRESS_STALL_MS;
  if (
    peeked &&
    peeked.analysisStatus === "deep_running" &&
    isDeepProgressStalled(peeked, Date.now(), stallThresholdMs) &&
    !peeked.deepProgress?.stalled
  ) {
    const { beginDeepStallSpan, endDeepStallSpan } = await import(
      "@/lib/hansome-score/deep-stall-trace"
    );
    const wd = beginDeepStallSpan("watchdog.fire", {
      stage: peeked.deepProgress?.stage ?? "relationships",
      operation: "watchdog_timeout",
      deepAttemptId: peeked.deepAttemptId,
      token: normalized,
      stageStateBefore: peeked.analysisStages?.relationships,
    });
    cancelActiveDeepAttempt(normalized, "watchdog_timeout");

    const attemptId = peeked.deepAttemptId ?? `wd_${Date.now().toString(36)}`;
    const baseContract =
      peeked.lpTerminal ??
      beginLpTerminal({
        attemptId,
        generation: attemptId,
        forceRefresh:
          peeked.analysisStages?.liquidity === "analyzing" ||
          lpEvidenceNeedsFullRefresh(peeked),
      });
    const outcome = resolveLpInterruptOutcome({
      response: peeked,
      contract: markLpTerminalRunning(baseContract),
      interruptReason: "watchdog_timeout",
    });

    await releaseRefreshLock(key);

    if (outcome.kind === "success") {
      const settled = await persistFencedDeepSettle(key, outcome.response);
      peeked = { ...settled.response, cache: peeked.cache };
      console.warn(
        `[scan-cache] watchdog → SUCCESS_TERMINAL for ${normalized} (verified after interrupt)`,
      );
    } else if (outcome.kind === "recover") {
      // Non-LP siblings may soft-settle; liquidity stays analyzing (no PARTIAL_TERMINAL).
      const stages = {
        ...(peeked.analysisStages ?? {}),
      } as NonNullable<ScanResponse["analysisStages"]>;
      for (const id of ["relationships", "creator", "burn"] as const) {
        const st = stages[id];
        if (!isDeepStageTerminal(st) && (st === "analyzing" || st === "pending")) {
          stages[id] = "partial";
        }
      }
      stages.liquidity = "analyzing";
      markForceLpFullRefresh(normalized);
      const cleared = hasVerifiedLockedResult(peeked)
        ? peeked
        : clearStaleLpEvidence(peeked);
      const rearmed = assignDeepAttempt({
        ...cleared,
        analysisStages: stages,
        analysisStatus: "deep_running",
        scoreProvisional: true,
        lpTerminal: {
          ...outcome.contract,
          // generation updated after assignDeepAttempt below
        },
      });
      const gen = rearmed.deepAttemptId ?? attemptId;
      const withContract: ScanResponse = stampDeepProgress(
        {
          ...rearmed,
          lpTerminal: {
            ...outcome.contract,
            attemptId: gen,
            generation: gen,
          },
        },
        {
          stage: "liquidity",
          action: "watchdog_timeout",
          completedUnits: peeked.deepProgress?.completedUnits,
          totalUnits: peeked.deepProgress?.totalUnits,
          pagesFetched: peeked.deepProgress?.pagesFetched,
          transfersIndexed: peeked.deepProgress?.transfersIndexed,
          stalled: true,
          stallReason: "watchdog_timeout_lp_recovery",
        },
      );
      const written = await persistProgressResponse(key, withContract);
      peeked = { ...written, cache: peeked.cache };
      scheduleDeepAnalysis(normalized);
      console.warn(
        `[scan-cache] watchdog → LP recovery for ${normalized} (attempt ${outcome.contract.recoveryAttempts}; no partial terminal)`,
      );
    } else {
      const settled = await persistFencedDeepSettle(key, outcome.response);
      peeked = { ...settled.response, cache: peeked.cache };
      console.warn(
        `[scan-cache] watchdog → FAILED_TERMINAL for ${normalized}`,
      );
    }

    endDeepStallSpan(wd, "completed", {
      stageStateAfter: peeked.analysisStages?.liquidity,
    });
  }

  // Status poll re-arm: retryable partial → deep_running so UI stays Collecting.
  if (peeked && isDeepRetryable(peeked) && !isDeepAnalysisInflight(normalized)) {
    const rearmed = rearmPartialForDeepRetry(peeked);
    const written = await persistProgressResponse(key, rearmed);
    peeked = { ...written, cache: peeked.cache };
  }

  // Phase 13A: sticky analyzing without lease/inflight/retry is orphan — recover again
  // after watchdog / reconcile paths may have rewritten stages.
  if (
    peeked &&
    isOrphanAnalyzing({
      response: peeked,
      deepInflight: isDeepAnalysisInflight(normalized),
    })
  ) {
    const recovered = await recoverOrphanAnalyzingIfNeeded(normalized);
    if (recovered) {
      peeked = { ...recovered, cache: peeked.cache };
    }
  }

  const deepInflight = isDeepAnalysisInflight(normalized);
  const retryScheduled = peeked?.deepRuntime?.retryScheduled === true;
  const needsDeepAfter = Boolean(
    peeked &&
      (needsDeepWork(peeked) ||
        retryScheduled ||
        (hasAnalyzingNeedingWork(peeked) && !deepInflight)),
  );
  // Kick work in-process; routes MUST also wrap ensureDeepAnalysis in after()
  // so the isolate stays alive after the HTTP response.
  if (needsDeepAfter && !deepInflight) {
    if (peeked) {
      peeked = stampDeepRuntime(peeked, {
        retryScheduled: true,
        lastTransition: "status_schedule_deep",
      });
      await persistProgressResponse(key, peeked);
    }
    scheduleDeepAnalysis(normalized);
  }
  const deepRuntime = toDeepRuntimeDiagnostics(peeked ?? {});
  return {
    address: normalized,
    analysisStatus:
      peeked?.analysisStatus ??
      (peeked && isScanComplete(peeked)
        ? "complete"
        : deepInflight
          ? "deep_running"
          : undefined),
    analysisPhase:
      peeked?.analysisPhase ??
      (peeked && isScanComplete(peeked) ? "complete" : peeked ? "fast" : undefined),
    scoreProvisional: Boolean(peeked?.scoreProvisional),
    analysisStages: peeked?.analysisStages,
    deepInflight: deepInflight || isDeepAnalysisInflight(normalized),
    needsDeepAfter,
    deepRuntime,
    result: peeked,
  };
}

function hasAnalyzingNeedingWork(
  response: Pick<ScanResponse, "analysisStages" | "deepRetryCount" | "analysisStatus">,
): boolean {
  const stages = response.analysisStages;
  if (!stages) return false;
  const analyzing =
    stages.liquidity === "analyzing" ||
    stages.creator === "analyzing" ||
    stages.burn === "analyzing" ||
    stages.relationships === "analyzing" ||
    stages.score === "analyzing";
  if (!analyzing) return false;
  return (response.deepRetryCount ?? 0) < MAX_DEEP_AUTO_RETRIES;
}
