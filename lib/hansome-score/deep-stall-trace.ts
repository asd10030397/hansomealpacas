/**
 * Cold Perf V2 Phase 7.2 — temporary Deep stall instrumentation.
 * Opt-in via HANSOME_DEEP_STALL_TRACE=1. Never logs secrets / auth / wallets / IPs.
 * Performance / diagnostics only — no score or analysis semantics.
 */

export type DeepStallSpanStatus =
  | "started"
  | "completed"
  | "timed_out"
  | "aborted"
  | "retried"
  | "reused_cache"
  | "unresolved";

export type DeepStallSpan = {
  name: string;
  scanAttemptId?: string;
  deepAttemptId?: string;
  token?: string;
  chainId?: number;
  deploymentId?: string;
  isolateMarker?: string;
  stage?: string;
  operation?: string;
  startTs: number;
  endTs?: number;
  durationMs?: number;
  status: DeepStallSpanStatus;
  timeoutReason?: string;
  retryCount?: number;
  lockKey?: string;
  lockOwner?: string;
  cacheHit?: boolean;
  blockscoutPage?: number;
  rpcMethod?: string;
  publishSequence?: number;
  stageStateBefore?: string;
  stageStateAfter?: string;
};

type SpanHandle = {
  name: string;
  startTs: number;
  meta: Partial<DeepStallSpan>;
};

const spans: DeepStallSpan[] = [];
let enabledOverride: boolean | null = null;

function deploymentId(): string | undefined {
  return (
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID?.trim() ||
    undefined
  );
}

function isolateMarker(): string {
  const pid = typeof process !== "undefined" ? String(process.pid) : "na";
  return `pid:${pid}`;
}

export function isDeepStallTraceEnabled(): boolean {
  if (enabledOverride != null) return enabledOverride;
  return process.env.HANSOME_DEEP_STALL_TRACE === "1";
}

/** Test helper — force enable/disable without env. */
export function setDeepStallTraceEnabledForTests(on: boolean | null): void {
  enabledOverride = on;
}

export function clearDeepStallSpansForTests(): void {
  spans.length = 0;
}

export function getDeepStallSpans(): readonly DeepStallSpan[] {
  return spans;
}

export function beginDeepStallSpan(
  name: string,
  meta?: Partial<DeepStallSpan>,
): SpanHandle | null {
  if (!isDeepStallTraceEnabled()) return null;
  const startTs = Date.now();
  const row: DeepStallSpan = {
    name,
    startTs,
    status: "started",
    deploymentId: deploymentId(),
    isolateMarker: isolateMarker(),
    ...meta,
  };
  spans.push(row);
  // Structured JSON only — no secrets.
  console.info(
    JSON.stringify({
      type: "deep_stall_span",
      event: "start",
      name,
      startTs,
      deepAttemptId: meta?.deepAttemptId,
      stage: meta?.stage,
      operation: meta?.operation,
      lockKey: meta?.lockKey,
    }),
  );
  return { name, startTs, meta: meta ?? {} };
}

export function endDeepStallSpan(
  handle: SpanHandle | null,
  status: DeepStallSpanStatus,
  extra?: Partial<DeepStallSpan>,
): void {
  if (!handle || !isDeepStallTraceEnabled()) return;
  const endTs = Date.now();
  const durationMs = endTs - handle.startTs;
  const row: DeepStallSpan = {
    name: handle.name,
    startTs: handle.startTs,
    endTs,
    durationMs,
    status,
    deploymentId: deploymentId(),
    isolateMarker: isolateMarker(),
    ...handle.meta,
    ...extra,
  };
  spans.push(row);
  console.info(
    JSON.stringify({
      type: "deep_stall_span",
      event: "end",
      name: handle.name,
      status,
      durationMs,
      deepAttemptId: row.deepAttemptId,
      stage: row.stage,
      operation: row.operation,
      timeoutReason: row.timeoutReason,
      lockKey: row.lockKey,
      unresolved: status === "unresolved",
    }),
  );
}

/**
 * Race work against a wall budget; records timeout spans.
 * Does NOT abort `work` (mirrors production withBudget semantics for RCA).
 */
export async function raceWithStallTrace<T>(
  name: string,
  budgetMs: number,
  work: () => Promise<T>,
  meta?: Partial<DeepStallSpan>,
): Promise<T> {
  const handle = beginDeepStallSpan(name, meta);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          endDeepStallSpan(handle, "timed_out", {
            timeoutReason: `${name}_budget_${budgetMs}`,
          });
          reject(new Error(`Deep stall trace timeout: ${name}`));
        }, budgetMs);
      }),
    ]);
    endDeepStallSpan(handle, "completed");
    return result;
  } catch (err) {
    if (handle && !spans.some((s) => s.name === name && s.status === "timed_out" && s.startTs === handle.startTs)) {
      endDeepStallSpan(handle, "aborted", {
        timeoutReason: err instanceof Error ? err.message : "error",
      });
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
