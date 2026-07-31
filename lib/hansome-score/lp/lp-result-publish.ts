/**
 * Phase 10C-4 — deterministic LP result publish / read contracts.
 * Generation-fenced dual-write (LP body → scan aggregate). No lock/score changes.
 */

import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import {
  LP_RESULT_SCHEMA_VERSION,
  resolveDeploymentScope,
  scanLpResultKvKey,
  scopedTokenKey,
  type DeploymentScope,
} from "@/lib/hansome-score/deployment-scope";
import { emptyUniswapVersionCoverage } from "@/lib/hansome-score/lp/coverage";
import { LP_AGGREGATE_STATE_DISPLAY } from "@/lib/hansome-score/constants";
import type {
  LpIntelligence,
  ScanResponse,
  TokenOverview,
} from "@/lib/hansome-score/types";

export type LpPublishMeta = {
  schemaVersion: number;
  deploymentScope: DeploymentScope;
  lpGeneration: string;
  publishedAt: string;
  tokenAddress: string;
  chainId: number;
};

export type LpPublishedBody = LpPublishMeta & {
  intelligence: LpIntelligence;
  lpLockStatus: TokenOverview["lpLockStatus"];
  lpLockDetail: string | null;
  poolId: string | null;
  liquidityUsd: number | null;
};

export type PublishLpInput = {
  attemptId: string;
  generation: string;
  deploymentScope: DeploymentScope;
  tokenAddress: string;
  chainId?: number;
  /** Authoritative current deepAttemptId / generation for fence. */
  authoritativeGeneration: string | undefined;
  intelligence: LpIntelligence;
  lpLockStatus: TokenOverview["lpLockStatus"];
  lpLockDetail: string | null;
  poolId: string | null;
  liquidityUsd: number | null;
  /** Persist helpers (injected for tests). */
  persistLpBody: (body: LpPublishedBody) => Promise<void>;
  persistScanAggregate: (meta: LpPublishMeta) => Promise<void>;
  markLiquidityTerminal: () => Promise<void>;
  maxRetries?: number;
};

export type PublishLpResult =
  | {
      ok: true;
      meta: LpPublishMeta;
      retries: number;
    }
  | {
      ok: false;
      reason:
        | "stale_publish_rejected"
        | "scope_mismatch"
        | "missing_generation"
        | "lp_body_write_failed"
        | "scan_aggregate_write_failed"
        | "terminal_mark_failed";
      detail: string;
      retries: number;
      /** True when LP body wrote but aggregate/terminal did not — must stay nonterminal. */
      partialWrite: boolean;
    };

export type ReadLpContractInput = {
  deploymentScope: DeploymentScope;
  expectedScope: DeploymentScope;
  scanMeta: LpPublishMeta | null | undefined;
  lpBody: LpPublishedBody | null | undefined;
  allowProductionFallback?: boolean;
};

export type ReadLpContractResult =
  | { ok: true; body: LpPublishedBody }
  | {
      ok: false;
      reason:
        | "missing_lp_body"
        | "missing_scan_meta"
        | "scope_mismatch"
        | "generation_mismatch"
        | "schema_rejected"
        | "production_fallback_forbidden";
      detail: string;
    };

const memLpBodies = new Map<string, LpPublishedBody>();
let testKv: Map<string, LpPublishedBody> | null = null;

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

export function lpResultMemoryKey(
  scope: DeploymentScope,
  chainId: number,
  tokenAddress: string,
): string {
  return scopedTokenKey(scope, chainId, tokenAddress);
}

/** Cleared pending LP body — never looks like terminal Locked / timeout done. */
export function clearedLpIntelligence(): LpIntelligence {
  return {
    poolDetected: false,
    poolsDetectedCount: 0,
    poolId: null,
    poolManagerBalanceRaw: null,
    poolManagerBalanceFormatted: null,
    aggregateLockState: "UNABLE_TO_DETERMINE",
    aggregateLockStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    aggregateState: "UNKNOWN_INCOMPLETE",
    aggregateStateDisplay: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
    positionCounts: {
      detected: 0,
      material: 0,
      locked: 0,
      unlocked: 0,
      unknown: 0,
    },
    lockDistribution: {
      available: false,
      reason: "LP evidence cleared for full refresh",
      method: null,
      lockedPct: null,
      unlockedPct: null,
      unknownPct: null,
      lockedUsd: null,
      unlockedUsd: null,
      unknownUsd: null,
      totalPositionUsd: null,
      poolLiquidityUsd: null,
      reconciledWithPool: false,
    },
    positions: [],
    discoveryComplete: false,
    knownPositionsVerified: false,
    exhaustiveDiscoveryComplete: false,
    completenessWarning:
      "Prior LP evidence invalidated — multi-version discovery re-armed.",
    ownershipRiskNote:
      "Lock ownership unknown until fresh Uniswap v2/v3/v4 analysis completes.",
    sizeWarning: false,
    evidenceLevel: "unavailable",
    detail: "LP evidence cleared — awaiting fresh multi-version discovery.",
    discoverySources: [],
    uniswapVersions: emptyUniswapVersionCoverage(),
  };
}

/**
 * Strip stale LP-derived fields from a scan response (force-refresh path).
 * Preserves non-LP overview fields.
 */
export function clearStaleLpEvidence(response: ScanResponse): ScanResponse {
  const overview = response.overview;
  if (!overview) {
    return {
      ...response,
      lpPublish: undefined,
    };
  }
  return {
    ...response,
    lpPublish: undefined,
    liquidityUsd: response.liquidityUsd,
    overview: {
      ...overview,
      poolId: null,
      lpLockStatus: "unknown",
      lpLockDetail: null,
      lpIntelligence: clearedLpIntelligence(),
    },
  };
}

export function extractLpPublishMeta(
  response: ScanResponse | null | undefined,
): LpPublishMeta | null {
  const m = response?.lpPublish;
  if (!m || typeof m !== "object") return null;
  if (
    typeof m.schemaVersion !== "number" ||
    typeof m.deploymentScope !== "string" ||
    typeof m.lpGeneration !== "string"
  ) {
    return null;
  }
  return m;
}

export function validateLpBodySchema(
  body: LpPublishedBody | null | undefined,
): { ok: true } | { ok: false; reason: "schema_rejected"; detail: string } {
  if (!body) {
    return { ok: false, reason: "schema_rejected", detail: "missing body" };
  }
  if (body.schemaVersion !== LP_RESULT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: "schema_rejected",
      detail: `schemaVersion ${String(body.schemaVersion)} != ${LP_RESULT_SCHEMA_VERSION}`,
    };
  }
  if (!body.lpGeneration || !body.deploymentScope) {
    return {
      ok: false,
      reason: "schema_rejected",
      detail: "missing generation or scope",
    };
  }
  if (!body.intelligence || typeof body.intelligence !== "object") {
    return {
      ok: false,
      reason: "schema_rejected",
      detail: "missing intelligence",
    };
  }
  return { ok: true };
}

/**
 * Publish contract: validate → LP body → scan aggregate → mark terminal.
 * Partial failure stays nonterminal; stale late publish → stale_publish_rejected.
 */
export async function publishDeepLpResult(
  input: PublishLpInput,
): Promise<PublishLpResult> {
  const maxRetries = Math.max(0, input.maxRetries ?? 2);
  let retries = 0;
  let lpWrote = false;

  if (!input.generation || !input.attemptId) {
    return {
      ok: false,
      reason: "missing_generation",
      detail: "attemptId/generation required",
      retries: 0,
      partialWrite: false,
    };
  }

  if (
    input.authoritativeGeneration != null &&
    input.authoritativeGeneration !== "" &&
    input.generation !== input.authoritativeGeneration
  ) {
    console.warn(
      JSON.stringify({
        tag: "stale_publish_rejected",
        generation: input.generation,
        authoritative: input.authoritativeGeneration,
        scope: input.deploymentScope,
      }),
    );
    return {
      ok: false,
      reason: "stale_publish_rejected",
      detail: "generation fence",
      retries: 0,
      partialWrite: false,
    };
  }

  if (input.deploymentScope !== resolveDeploymentScope()) {
    return {
      ok: false,
      reason: "scope_mismatch",
      detail: `${input.deploymentScope} != ${resolveDeploymentScope()}`,
      retries: 0,
      partialWrite: false,
    };
  }

  const meta: LpPublishMeta = {
    schemaVersion: LP_RESULT_SCHEMA_VERSION,
    deploymentScope: input.deploymentScope,
    lpGeneration: input.generation,
    publishedAt: new Date().toISOString(),
    tokenAddress: input.tokenAddress.toLowerCase(),
    chainId: input.chainId ?? SCAN_CHAIN_ID,
  };

  const body: LpPublishedBody = {
    ...meta,
    intelligence: input.intelligence,
    lpLockStatus: input.lpLockStatus,
    lpLockDetail: input.lpLockDetail,
    poolId: input.poolId,
    liquidityUsd: input.liquidityUsd,
  };

  while (retries <= maxRetries) {
    try {
      if (!lpWrote) {
        await input.persistLpBody(body);
        lpWrote = true;
      }
      await input.persistScanAggregate(meta);
      await input.markLiquidityTerminal();
      return { ok: true, meta, retries };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!lpWrote) {
        if (retries >= maxRetries) {
          return {
            ok: false,
            reason: "lp_body_write_failed",
            detail: msg,
            retries,
            partialWrite: false,
          };
        }
      } else if (retries >= maxRetries) {
        return {
          ok: false,
          reason: "scan_aggregate_write_failed",
          detail: msg,
          retries,
          partialWrite: true,
        };
      }
      retries += 1;
    }
  }

  return {
    ok: false,
    reason: lpWrote ? "scan_aggregate_write_failed" : "lp_body_write_failed",
    detail: "exhausted retries",
    retries,
    partialWrite: lpWrote,
  };
}

/** Read contract — no cross-scope / cross-generation mix. */
export function readLpContract(
  input: ReadLpContractInput,
): ReadLpContractResult {
  if (
    input.deploymentScope !== input.expectedScope &&
    !(
      input.allowProductionFallback === true &&
      input.expectedScope === "production"
    )
  ) {
    if (
      input.deploymentScope.startsWith("candidate") &&
      input.expectedScope === "production"
    ) {
      return {
        ok: false,
        reason: "production_fallback_forbidden",
        detail: "candidate must not fall back to production LP",
      };
    }
    return {
      ok: false,
      reason: "scope_mismatch",
      detail: `${input.deploymentScope} != ${input.expectedScope}`,
    };
  }

  if (!input.scanMeta) {
    return {
      ok: false,
      reason: "missing_scan_meta",
      detail: "scan aggregate missing lpPublish",
    };
  }
  if (input.scanMeta.deploymentScope !== input.expectedScope) {
    return {
      ok: false,
      reason: "scope_mismatch",
      detail: "scan meta scope",
    };
  }
  if (input.scanMeta.schemaVersion !== LP_RESULT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: "schema_rejected",
      detail: `scan meta schema ${input.scanMeta.schemaVersion}`,
    };
  }
  if (!input.lpBody) {
    return {
      ok: false,
      reason: "missing_lp_body",
      detail: "LP body not found for generation",
    };
  }
  const schema = validateLpBodySchema(input.lpBody);
  if (!schema.ok) return schema;

  if (input.lpBody.deploymentScope !== input.expectedScope) {
    return {
      ok: false,
      reason: "scope_mismatch",
      detail: "lp body scope",
    };
  }
  if (input.lpBody.lpGeneration !== input.scanMeta.lpGeneration) {
    return {
      ok: false,
      reason: "generation_mismatch",
      detail: `${input.lpBody.lpGeneration} != ${input.scanMeta.lpGeneration}`,
    };
  }
  return { ok: true, body: input.lpBody };
}

export async function persistLpPublishedBody(
  body: LpPublishedBody,
): Promise<void> {
  const key = lpResultMemoryKey(
    body.deploymentScope,
    body.chainId,
    body.tokenAddress,
  );
  memLpBodies.set(key, body);
  if (testKv) {
    testKv.set(scanLpResultKvKey(key), body);
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  await kv.set(scanLpResultKvKey(key), body, { ex: 24 * 60 * 60 });
}

export async function loadLpPublishedBody(
  scope: DeploymentScope,
  tokenAddress: string,
  chainId = SCAN_CHAIN_ID,
): Promise<LpPublishedBody | null> {
  const key = lpResultMemoryKey(scope, chainId, tokenAddress);
  const mem = memLpBodies.get(key);
  if (mem) return mem;
  if (testKv) {
    return testKv.get(scanLpResultKvKey(key)) ?? null;
  }
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<LpPublishedBody>(scanLpResultKvKey(key))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteLpPublishedBody(
  scope: DeploymentScope,
  tokenAddress: string,
  chainId = SCAN_CHAIN_ID,
): Promise<void> {
  const key = lpResultMemoryKey(scope, chainId, tokenAddress);
  memLpBodies.delete(key);
  if (testKv) {
    testKv.delete(scanLpResultKvKey(key));
    return;
  }
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.del(scanLpResultKvKey(key));
  } catch {
    /* ignore */
  }
}

export function clearLpPublishTestState(): void {
  memLpBodies.clear();
  testKv = null;
}

export function useLpPublishTestKv(on: boolean): void {
  testKv = on ? new Map() : null;
  if (!on) memLpBodies.clear();
}

/**
 * Attach lpPublish meta + intelligence onto a scan response (after successful publish).
 */
export function attachPublishedLp(
  response: ScanResponse,
  meta: LpPublishMeta,
  body: Pick<
    LpPublishedBody,
    "intelligence" | "lpLockStatus" | "lpLockDetail" | "poolId" | "liquidityUsd"
  >,
): ScanResponse {
  const publishMeta: LpPublishMeta = {
    schemaVersion: meta.schemaVersion,
    deploymentScope: meta.deploymentScope,
    lpGeneration: meta.lpGeneration,
    publishedAt: meta.publishedAt,
    tokenAddress: meta.tokenAddress,
    chainId: meta.chainId,
  };
  return {
    ...response,
    lpPublish: publishMeta,
    liquidityUsd: body.liquidityUsd ?? response.liquidityUsd,
    overview: {
      ...response.overview,
      poolId: body.poolId ?? response.overview.poolId,
      lpLockStatus: body.lpLockStatus,
      lpLockDetail: body.lpLockDetail,
      lpIntelligence: body.intelligence,
    },
  };
}

/**
 * Whether a liquidity-focused write should run the dual-write publish contract.
 */
export function shouldPublishLpBody(
  incoming: ScanResponse,
  focus?: string | null,
): boolean {
  const label = String(focus ?? "");
  const liqFocus =
    !label ||
    label === "liquidity" ||
    label.startsWith("liquidity") ||
    label === "complete" ||
    label === "partial" ||
    label === "score";
  if (!liqFocus) return false;
  const st = incoming.analysisStages?.liquidity;
  const hardTerminal =
    incoming.lpTerminal?.terminalState === "SUCCESS_TERMINAL" ||
    incoming.lpTerminal?.terminalState === "FAILED_TERMINAL";
  if (st !== "done" && st !== "partial" && st !== "unknown" && !hardTerminal) {
    return false;
  }
  const intel = incoming.overview?.lpIntelligence;
  if (!intel) return false;
  // Cleared pending body must not publish as terminal evidence (unless failed hard terminal).
  if (
    incoming.lpTerminal?.terminalState !== "FAILED_TERMINAL" &&
    (intel.detail?.includes("LP evidence cleared") ||
      intel.lockDistribution?.reason === "LP evidence cleared for full refresh")
  ) {
    return false;
  }
  return true;
}
