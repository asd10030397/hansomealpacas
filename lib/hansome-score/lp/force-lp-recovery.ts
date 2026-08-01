/**
 * Phase 13C — Force LP refresh recovery transaction.
 *
 * Reliability only: preserve prior durable LP evidence across forceLp,
 * generation-safe dual-write commit/rollback, status/read reconciliation.
 * Does NOT change lock classification, Titan/Pons/Hook ownership, Score, or UI product semantics.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  LP_RESULT_SCHEMA_VERSION,
  resolveDeploymentScope,
  scanLpRecoveryKvKey,
  scopedTokenKey,
  type DeploymentScope,
} from "@/lib/hansome-score/deployment-scope";
import {
  attachPublishedLp,
  clearStaleLpEvidence,
  extractLpPublishMeta,
  loadLpPublishedBody,
  persistLpPublishedBody,
  type LpPublishedBody,
  type LpPublishMeta,
} from "@/lib/hansome-score/lp/lp-result-publish";
import type {
  LpForceRecoveryMeta,
  LpIntelligence,
  ScanResponse,
} from "@/lib/hansome-score/types";

/** Max age of an open force txn before automatic rollback on read/status. */
export const FORCE_LP_TXN_TTL_MS = 6 * 60 * 1000;

/** Dedup window: second forceLp within this window reuses open txn. */
export const FORCE_LP_DEDUP_MS = 45_000;

const RECOVERY_SCHEMA_VERSION = 1;

export type LpRecoverySlot = {
  schemaVersion: number;
  deploymentScope: DeploymentScope;
  tokenAddress: string;
  chainId: number;
  priorGeneration: string;
  pendingGeneration: string;
  savedAt: string;
  reason: "force_refresh_started" | "stale_forced_refresh";
  body: LpPublishedBody;
  /** Optional prior liquidity stage for restore honesty. */
  priorLiquidityStage?: "pending" | "analyzing" | "done" | "partial" | "failed" | "unknown";
};

export type PrepareForceLpResult = {
  /** True when a durable prior was stashed (active body kept until commit). */
  preserved: boolean;
  meta: LpForceRecoveryMeta;
  slot: LpRecoverySlot | null;
  /** Cleared-shell prior — safe to delete active body (legacy 10C-4 path). */
  mayDeleteActiveBody: boolean;
};

const memRecovery = new Map<string, LpRecoverySlot>();
let testRecoveryKv: Map<string, LpRecoverySlot> | null = null;

function isScanKvConfigured(): boolean {
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

async function getKv() {
  if (!isScanKvConfigured()) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

function recoveryMemKey(
  scope: DeploymentScope,
  chainId: number,
  tokenAddress: string,
): string {
  return scopedTokenKey(scope, chainId, tokenAddress);
}

/** Cleared pending shell — not durable product evidence. */
export function isClearedLpShell(
  intel: LpIntelligence | null | undefined,
): boolean {
  if (!intel) return false;
  const detail = `${intel.detail ?? ""} ${intel.lockDistribution?.reason ?? ""}`;
  return /LP evidence cleared/i.test(detail);
}

/**
 * Durable prior worth preserving across forceLp.
 * Classification-agnostic: presence of published verified rows / real positions / hook class.
 */
export function isDurableLpEvidence(
  response: Pick<ScanResponse, "overview" | "lpPublish"> | null | undefined,
  body?: LpPublishedBody | null,
): boolean {
  const intel = body?.intelligence ?? response?.overview?.lpIntelligence;
  if (!intel || isClearedLpShell(intel)) return false;
  const meta = body
    ? {
        lpGeneration: body.lpGeneration,
        schemaVersion: body.schemaVersion,
      }
    : extractLpPublishMeta(response as ScanResponse);
  if (!meta?.lpGeneration) return false;

  const positions = intel.positions ?? [];
  if (positions.some((p) => p.lockState === "LOCKED_VERIFIED_ONCHAIN")) {
    return true;
  }
  if (positions.length > 0) return true;
  if (
    typeof (intel as { ownershipClass?: string }).ownershipClass === "string" &&
    (intel as { ownershipClass?: string }).ownershipClass
  ) {
    return true;
  }
  if (
    (intel as { hookIntelligence?: unknown }).hookIntelligence != null ||
    (intel as { aggregateState?: string }).aggregateState === "LOCKED" ||
    (intel as { aggregateLockState?: string }).aggregateLockState ===
      "LOCKED_VERIFIED_ONCHAIN"
  ) {
    return true;
  }
  // Published non-empty pool evidence
  if (intel.poolDetected === true && (intel.poolsDetectedCount ?? 0) > 0) {
    return true;
  }
  return false;
}

export function bodyFromScanResponse(
  response: ScanResponse,
): LpPublishedBody | null {
  const meta = extractLpPublishMeta(response);
  const intel = response.overview?.lpIntelligence;
  if (!meta || !intel || isClearedLpShell(intel)) return null;
  if (!isDurableLpEvidence(response)) return null;
  return {
    schemaVersion: meta.schemaVersion,
    deploymentScope: meta.deploymentScope,
    lpGeneration: meta.lpGeneration,
    publishedAt: meta.publishedAt,
    tokenAddress: meta.tokenAddress,
    chainId: meta.chainId,
    intelligence: intel,
    lpLockStatus: response.overview.lpLockStatus,
    lpLockDetail: response.overview.lpLockDetail ?? null,
    poolId: response.overview.poolId ?? null,
    liquidityUsd: response.liquidityUsd ?? null,
  };
}

export async function persistLpRecoverySlot(
  slot: LpRecoverySlot,
): Promise<void> {
  const key = recoveryMemKey(
    slot.deploymentScope,
    slot.chainId,
    slot.tokenAddress,
  );
  memRecovery.set(key, slot);
  if (testRecoveryKv) {
    testRecoveryKv.set(scanLpRecoveryKvKey(key), slot);
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  await kv.set(scanLpRecoveryKvKey(key), slot, {
    ex: Math.ceil((FORCE_LP_TXN_TTL_MS * 2) / 1000),
  });
}

export async function loadLpRecoverySlot(
  scope: DeploymentScope,
  tokenAddress: string,
  chainId = SCAN_CHAIN_ID,
): Promise<LpRecoverySlot | null> {
  const key = recoveryMemKey(scope, chainId, tokenAddress);
  const mem = memRecovery.get(key);
  if (mem) return mem;
  if (testRecoveryKv) {
    return testRecoveryKv.get(scanLpRecoveryKvKey(key)) ?? null;
  }
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<LpRecoverySlot>(scanLpRecoveryKvKey(key))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteLpRecoverySlot(
  scope: DeploymentScope,
  tokenAddress: string,
  chainId = SCAN_CHAIN_ID,
): Promise<void> {
  const key = recoveryMemKey(scope, chainId, tokenAddress);
  memRecovery.delete(key);
  if (testRecoveryKv) {
    testRecoveryKv.delete(scanLpRecoveryKvKey(key));
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.del(scanLpRecoveryKvKey(key));
  } catch {
    /* ignore */
  }
}

export function clearForceLpRecoveryTestState(): void {
  memRecovery.clear();
  testRecoveryKv = null;
}

export function useForceLpRecoveryTestKv(on: boolean): void {
  testRecoveryKv = on ? new Map() : null;
  if (!on) memRecovery.clear();
}

export function isForceTxnExpired(
  meta: LpForceRecoveryMeta | null | undefined,
  now = Date.now(),
): boolean {
  if (!meta || meta.state !== "open") return false;
  const t = Date.parse(meta.savedAt);
  if (!Number.isFinite(t)) return true;
  return now - t > FORCE_LP_TXN_TTL_MS;
}

export function shouldDedupeForceLp(
  prior: ScanResponse | null | undefined,
  now = Date.now(),
): boolean {
  const meta = prior?.lpForceRecovery;
  if (!meta || meta.state !== "open") return false;
  if (isForceTxnExpired(meta, now)) return false;
  const t = Date.parse(meta.savedAt);
  if (!Number.isFinite(t)) return false;
  return now - t < FORCE_LP_DEDUP_MS;
}

/**
 * Open a force-LP transaction: stash durable prior into recovery slot.
 * Active published body is kept when durable (commit-on-success dual-write).
 */
export async function prepareForceLpRefresh(params: {
  response: ScanResponse;
  pendingGeneration: string;
  scope?: DeploymentScope;
  chainId?: number;
}): Promise<PrepareForceLpResult> {
  const scope = params.scope ?? resolveDeploymentScope();
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const token = params.response.overview.address.toLowerCase();

  // Dedup: reuse existing open txn / slot.
  if (shouldDedupeForceLp(params.response)) {
    const existing = await loadLpRecoverySlot(scope, token, chainId);
    const meta = params.response.lpForceRecovery!;
    return {
      preserved: meta.durablePrior === true,
      meta,
      slot: existing,
      mayDeleteActiveBody: !meta.durablePrior,
    };
  }

  let body =
    (await loadLpPublishedBody(scope, token, chainId)) ??
    bodyFromScanResponse(params.response);

  // Prefer response body when KV empty but aggregate still holds durable evidence.
  if (!body || !isDurableLpEvidence(params.response, body)) {
    body = bodyFromScanResponse(params.response);
  }

  const durable = !!body && isDurableLpEvidence(params.response, body);
  const priorGeneration =
    body?.lpGeneration ??
    extractLpPublishMeta(params.response)?.lpGeneration ??
    null;

  const meta: LpForceRecoveryMeta = {
    state: "open",
    priorGeneration,
    pendingGeneration: params.pendingGeneration,
    reason: "force_refresh_started",
    savedAt: new Date().toISOString(),
    durablePrior: durable,
  };

  if (!durable || !body || !priorGeneration) {
    return {
      preserved: false,
      meta,
      slot: null,
      mayDeleteActiveBody: true,
    };
  }

  const slot: LpRecoverySlot = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    deploymentScope: scope,
    tokenAddress: token,
    chainId,
    priorGeneration,
    pendingGeneration: params.pendingGeneration,
    savedAt: meta.savedAt,
    reason: "force_refresh_started",
    body: {
      ...body,
      schemaVersion: body.schemaVersion || LP_RESULT_SCHEMA_VERSION,
      deploymentScope: scope,
    },
    priorLiquidityStage: params.response.analysisStages?.liquidity,
  };
  await persistLpRecoverySlot(slot);

  return {
    preserved: true,
    meta,
    slot,
    // Keep active KV body until successful commit of new generation.
    mayDeleteActiveBody: false,
  };
}

/** Successful force publish — drop recovery slot. */
export async function commitForceLpRefresh(params: {
  scope: DeploymentScope;
  tokenAddress: string;
  chainId?: number;
  response: ScanResponse;
}): Promise<ScanResponse> {
  await deleteLpRecoverySlot(
    params.scope,
    params.tokenAddress,
    params.chainId ?? SCAN_CHAIN_ID,
  );
  const prior = params.response.lpForceRecovery;
  return {
    ...params.response,
    lpForceRecovery: prior
      ? {
          ...prior,
          state: "committed",
          reason: "committed",
        }
      : {
          state: "committed",
          priorGeneration: params.response.lpPublish?.lpGeneration ?? null,
          pendingGeneration: params.response.deepAttemptId ?? "",
          reason: "committed",
          savedAt: new Date().toISOString(),
          durablePrior: true,
        },
  };
}

/**
 * Restore prior durable evidence after failed/expired force.
 * Marks stale_forced_refresh — honesty that evidence predates the failed refresh.
 */
export async function rollbackForceLpRefresh(params: {
  response: ScanResponse;
  scope?: DeploymentScope;
  chainId?: number;
  reason?: "stale_forced_refresh" | "force_txn_expired";
}): Promise<ScanResponse> {
  const scope = params.scope ?? resolveDeploymentScope();
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const token = params.response.overview.address.toLowerCase();
  const slot = await loadLpRecoverySlot(scope, token, chainId);

  if (!slot?.body) {
    // Nothing to restore — leave as-is (may already be cleared / unknown).
    const meta = params.response.lpForceRecovery;
    return {
      ...params.response,
      lpForceRecovery: meta
        ? { ...meta, state: "rolled_back", reason: "stale_forced_refresh" }
        : params.response.lpForceRecovery,
    };
  }

  // Re-publish prior body to active slot (generation-safe restore).
  await persistLpPublishedBody(slot.body);

  const meta: LpPublishMeta = {
    schemaVersion: slot.body.schemaVersion,
    deploymentScope: slot.body.deploymentScope,
    lpGeneration: slot.body.lpGeneration,
    publishedAt: slot.body.publishedAt,
    tokenAddress: slot.body.tokenAddress,
    chainId: slot.body.chainId,
  };

  const restored = attachPublishedLp(params.response, meta, slot.body);
  const liq =
    slot.priorLiquidityStage === "done" ||
    slot.priorLiquidityStage === "partial" ||
    slot.priorLiquidityStage === "unknown"
      ? slot.priorLiquidityStage
      : "partial";

  const out: ScanResponse = {
    ...restored,
    analysisStatus:
      restored.analysisStatus === "deep_running" ||
      restored.analysisStatus === "fast_ready"
        ? "partial"
        : restored.analysisStatus,
    analysisStages: {
      ...restored.analysisStages!,
      liquidity: liq,
    },
    lpForceRecovery: {
      state: "rolled_back",
      priorGeneration: slot.priorGeneration,
      pendingGeneration: slot.pendingGeneration,
      reason: "stale_forced_refresh",
      savedAt: slot.savedAt,
      durablePrior: true,
    },
    lpTerminal: restored.lpTerminal
      ? {
          ...restored.lpTerminal,
          terminalReason: "stale_forced_refresh",
          terminalState:
            restored.lpTerminal.terminalState === "SUCCESS_TERMINAL"
              ? "SUCCESS_TERMINAL"
              : "FAILED_TERMINAL",
          forceRefresh: true,
        }
      : restored.lpTerminal,
  };

  // Keep slot briefly for diagnostics; mark reason.
  await persistLpRecoverySlot({
    ...slot,
    reason: "stale_forced_refresh",
  });

  return out;
}

/** Attach prior/recovery body while force is still RUNNING (read path). */
export function attachRefreshingPriorLp(
  response: ScanResponse,
  body: LpPublishedBody,
): ScanResponse {
  const attached = attachPublishedLp(
    response,
    {
      schemaVersion: body.schemaVersion,
      deploymentScope: body.deploymentScope,
      lpGeneration: body.lpGeneration,
      publishedAt: body.publishedAt,
      tokenAddress: body.tokenAddress,
      chainId: body.chainId,
    },
    body,
  );
  return {
    ...attached,
    // Keep analyzing honesty for in-flight force.
    analysisStages: {
      ...attached.analysisStages!,
      liquidity: attached.analysisStages?.liquidity ?? "analyzing",
    },
  };
}

export async function loadPriorLpForForceDeep(params: {
  response: ScanResponse;
  scope?: DeploymentScope;
  chainId?: number;
}): Promise<LpIntelligence | null> {
  const cleared = isClearedLpShell(params.response.overview?.lpIntelligence);
  const current = params.response.overview?.lpIntelligence ?? null;
  if (current && !cleared && (current.positions?.length ?? 0) > 0) {
    return current;
  }
  const scope = params.scope ?? resolveDeploymentScope();
  const token = params.response.overview.address;
  const chainId = params.chainId ?? SCAN_CHAIN_ID;
  const slot = await loadLpRecoverySlot(scope, token, chainId);
  if (slot?.body?.intelligence) return slot.body.intelligence;
  const active = await loadLpPublishedBody(scope, token, chainId);
  if (active?.intelligence && !isClearedLpShell(active.intelligence)) {
    return active.intelligence;
  }
  return current;
}

/**
 * Invariant A — After force ends, never sticky cleared-only when durable prior existed.
 * Invariant B — Open force with durable prior ⇒ recovery slot or active body present.
 * Invariant C — After force hard-terminal: new gen published OR prior restored (stale_forced_refresh).
 */
export function evaluateForceLpEndInvariants(params: {
  response: ScanResponse;
  slot: LpRecoverySlot | null;
  activeBody: LpPublishedBody | null;
  forceEnded: boolean;
}): { A: boolean; B: boolean; C: boolean } {
  const { response, slot, activeBody, forceEnded } = params;
  const meta = response.lpForceRecovery;
  const cleared = isClearedLpShell(response.overview?.lpIntelligence);
  const hadDurable = meta?.durablePrior === true || !!slot;

  const A =
    !forceEnded ||
    !hadDurable ||
    !cleared ||
    meta?.state === "rolled_back" ||
    meta?.reason === "stale_forced_refresh" ||
    isDurableLpEvidence(response, activeBody);

  const B =
    meta?.state !== "open" ||
    !meta.durablePrior ||
    !!slot ||
    !!activeBody;

  const hard =
    response.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
    response.lpTerminal?.terminalState === "FAILED_TERMINAL" ||
    (forceEnded &&
      (response.analysisStages?.liquidity === "done" ||
        response.analysisStages?.liquidity === "partial" ||
        response.analysisStages?.liquidity === "unknown"));

  const newGenCommitted =
    meta?.state === "committed" &&
    !!response.lpPublish?.lpGeneration &&
    response.lpPublish.lpGeneration !== meta.priorGeneration;

  const restored =
    meta?.state === "rolled_back" ||
    meta?.reason === "stale_forced_refresh" ||
    (!!meta?.priorGeneration &&
      response.lpPublish?.lpGeneration === meta.priorGeneration &&
      isDurableLpEvidence(response));

  const C = !hard || !hadDurable || newGenCommitted || restored || !cleared;

  return { A, B, C };
}

/** Token recovery expectations (product gates for soak — not classification changes). */
export const FORCE_LP_TOKEN_CONTRACTS = {
  BEER: {
    address: "0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804",
    requireLockedVerified: true,
    requireTokenId: "436637",
  },
  HANSOME: {
    address: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
    requireNonEmptyPositions: true,
  },
  GME: {
    address: "0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3",
    requireHookClassOrIntel: true,
  },
  OKC: {
    address: "0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3",
    requireTerminal: true,
  },
} as const;

/**
 * Apply force-arm clear for rediscovery while preserving txn meta.
 * Does not delete recovery slot or (when preserved) active KV body.
 */
export function armForceLpClearedAggregate(
  response: ScanResponse,
  meta: LpForceRecoveryMeta,
): ScanResponse {
  const cleared = clearStaleLpEvidence(response);
  return {
    ...cleared,
    lpForceRecovery: meta,
  };
}

/**
 * After force hard-fail without new publish: prefer rollback over sticky clear.
 */
export async function finalizeForceLpFailure(
  response: ScanResponse,
  opts?: { scope?: DeploymentScope; chainId?: number },
): Promise<ScanResponse> {
  const scope = opts?.scope ?? resolveDeploymentScope();
  const token = response.overview.address;
  const slot = await loadLpRecoverySlot(
    scope,
    token,
    opts?.chainId ?? SCAN_CHAIN_ID,
  );
  if (slot?.body && (response.lpForceRecovery?.durablePrior || slot)) {
    return rollbackForceLpRefresh({
      response,
      scope,
      chainId: opts?.chainId,
      reason: "stale_forced_refresh",
    });
  }
  // No prior — allow cleared/unknown terminal (honest empty).
  return response;
}
