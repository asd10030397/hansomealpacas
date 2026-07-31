/**
 * Cold Perf V2 Phase 8 — hierarchical Deep profiling.
 * Opt-in: HANSOME_DEEP_PROFILE=1, HANSOME_CRITICAL_PATH_PROFILE=1 (Phase 9),
 * or HANSOME_DEEP_STALL_TRACE=1.
 * Diagnostics only — never changes score / LP / creator / burn semantics.
 */

import {
  beginDeepStallSpan,
  endDeepStallSpan,
  isDeepStallTraceEnabled,
  type DeepStallSpan,
  type DeepStallSpanStatus,
} from "@/lib/hansome-score/deep-stall-trace";

export type ProfileCategory =
  | "cpu"
  | "api"
  | "rpc"
  | "blockscout"
  | "kv"
  | "publish"
  | "lock"
  | "retry"
  | "dup"
  | "sequential"
  | "timeout_budget"
  | "bg_on_barrier"
  | "other";

export type DeepProfileSpan = {
  id: string;
  parentId: string | null;
  name: string;
  category: ProfileCategory;
  startTs: number;
  endTs?: number;
  durationMs?: number;
  status: DeepStallSpanStatus;
  stage?: string;
  operation?: string;
  exclusiveMs?: number;
  requestCount?: number;
  cacheHit?: boolean;
  dupOf?: string;
  retryCount?: number;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

type ActiveHandle = {
  id: string;
  parentId: string | null;
  name: string;
  category: ProfileCategory;
  startTs: number;
  stage?: string;
  operation?: string;
  stall: ReturnType<typeof beginDeepStallSpan>;
  children: string[];
  requestCount: number;
  meta: Record<string, string | number | boolean | null | undefined>;
};

const spans = new Map<string, DeepProfileSpan>();
const stack: string[] = [];
let seq = 0;
let enabledOverride: boolean | null = null;
let rootId: string | null = null;

export function isDeepProfileEnabled(): boolean {
  if (enabledOverride != null) return enabledOverride;
  return (
    process.env.HANSOME_DEEP_PROFILE === "1" ||
    process.env.HANSOME_CRITICAL_PATH_PROFILE === "1" ||
    isDeepStallTraceEnabled()
  );
}

export function setDeepProfileEnabledForTests(on: boolean | null): void {
  enabledOverride = on;
}

export function resetDeepProfile(): void {
  spans.clear();
  stack.length = 0;
  seq = 0;
  rootId = null;
  activeById.clear();
}

/** @deprecated alias — use resetDeepProfile */
export function clearDeepProfileForTests(): void {
  resetDeepProfile();
}

export function getDeepProfileSpans(): DeepProfileSpan[] {
  return [...spans.values()].sort((a, b) => a.startTs - b.startTs);
}

function nextId(name: string): string {
  seq += 1;
  return `${seq}:${name}`;
}

export function beginProfileSpan(
  name: string,
  opts?: {
    category?: ProfileCategory;
    stage?: string;
    operation?: string;
    parentId?: string | null;
    meta?: Record<string, string | number | boolean | null | undefined>;
  },
): ActiveHandle | null {
  if (!isDeepProfileEnabled()) return null;
  const parentId =
    opts?.parentId !== undefined
      ? opts.parentId
      : stack.length > 0
        ? stack[stack.length - 1]!
        : rootId;
  const id = nextId(name);
  const startTs = Date.now();
  const category = opts?.category ?? "other";
  const row: DeepProfileSpan = {
    id,
    parentId,
    name,
    category,
    startTs,
    status: "started",
    stage: opts?.stage,
    operation: opts?.operation,
    meta: opts?.meta,
  };
  spans.set(id, row);
  if (!rootId && (name === "scan.manual_refresh" || name === "scan.deep")) {
    rootId = id;
  }
  const stall = beginDeepStallSpan(name, {
    stage: opts?.stage,
    operation: opts?.operation ?? category,
  });
  const handle: ActiveHandle = {
    id,
    parentId,
    name,
    category,
    startTs,
    stage: opts?.stage,
    operation: opts?.operation,
    stall,
    children: [],
    requestCount: 0,
    meta: opts?.meta ?? {},
  };
  if (parentId) {
    const parentHandle = activeById.get(parentId);
    parentHandle?.children.push(id);
  }
  activeById.set(id, handle);
  stack.push(id);
  return handle;
}

const activeById = new Map<string, ActiveHandle>();

export function endProfileSpan(
  handle: ActiveHandle | null,
  status: DeepStallSpanStatus = "completed",
  extra?: Partial<DeepProfileSpan>,
): void {
  if (!handle || !isDeepProfileEnabled()) return;
  const endTs = Date.now();
  const durationMs = endTs - handle.startTs;
  const childDur = handle.children.reduce((sum, cid) => {
    const c = spans.get(cid);
    return sum + (c?.durationMs ?? 0);
  }, 0);
  const exclusiveMs = Math.max(0, durationMs - childDur);
  const row: DeepProfileSpan = {
    id: handle.id,
    parentId: handle.parentId,
    name: handle.name,
    category: handle.category,
    startTs: handle.startTs,
    endTs,
    durationMs,
    exclusiveMs,
    status,
    stage: handle.stage,
    operation: handle.operation,
    requestCount: handle.requestCount + (extra?.requestCount ?? 0),
    cacheHit: extra?.cacheHit,
    dupOf: extra?.dupOf,
    retryCount: extra?.retryCount,
    meta: { ...handle.meta, ...extra?.meta },
  };
  spans.set(handle.id, row);
  endDeepStallSpan(handle.stall, status, {
    stage: handle.stage,
    operation: handle.operation,
    durationMs,
    cacheHit: extra?.cacheHit,
    retryCount: extra?.retryCount,
  } as Partial<DeepStallSpan>);
  activeById.delete(handle.id);
  const idx = stack.lastIndexOf(handle.id);
  if (idx >= 0) stack.splice(idx, 1);
}

export function noteProfileRequest(handle: ActiveHandle | null, n = 1): void {
  if (handle) handle.requestCount += n;
}

export async function withProfileSpan<T>(
  name: string,
  opts: {
    category?: ProfileCategory;
    stage?: string;
    operation?: string;
    meta?: Record<string, string | number | boolean | null | undefined>;
  },
  work: (span: ActiveHandle | null) => Promise<T>,
): Promise<T> {
  const span = beginProfileSpan(name, opts);
  try {
    const result = await work(span);
    endProfileSpan(span, "completed");
    return result;
  } catch (err) {
    endProfileSpan(span, "aborted", {
      meta: {
        error: err instanceof Error ? err.message.slice(0, 120) : "error",
      },
    });
    throw err;
  }
}

/** Compact tree for optional attach to ScanResponse (no secrets). */
export function buildDeepProfileSummary(): {
  rootId: string | null;
  totalMs: number | null;
  spans: Array<{
    id: string;
    parentId: string | null;
    name: string;
    category: ProfileCategory;
    durationMs?: number;
    exclusiveMs?: number;
    status: DeepStallSpanStatus;
    stage?: string;
    requestCount?: number;
    cacheHit?: boolean;
  }>;
  byCategoryMs: Record<string, number>;
  criticalPath: string[];
} {
  const list = getDeepProfileSpans().filter((s) => s.endTs != null);
  const byCategoryMs: Record<string, number> = {};
  for (const s of list) {
    byCategoryMs[s.category] =
      (byCategoryMs[s.category] ?? 0) + (s.exclusiveMs ?? s.durationMs ?? 0);
  }
  const root = list.find((s) => s.id === rootId) ?? list[0];
  const criticalPath: string[] = [];
  if (root) {
    let cur: DeepProfileSpan | undefined = root;
    while (cur) {
      criticalPath.push(cur.name);
      const kids = list.filter((s) => s.parentId === cur!.id);
      if (kids.length === 0) break;
      cur = kids.reduce((a, b) =>
        (a.durationMs ?? 0) >= (b.durationMs ?? 0) ? a : b,
      );
    }
  }
  return {
    rootId,
    totalMs: root?.durationMs ?? null,
    spans: list.map((s) => ({
      id: s.id,
      parentId: s.parentId,
      name: s.name,
      category: s.category,
      durationMs: s.durationMs,
      exclusiveMs: s.exclusiveMs,
      status: s.status,
      stage: s.stage,
      requestCount: s.requestCount,
      cacheHit: s.cacheHit,
    })),
    byCategoryMs,
    criticalPath,
  };
}

export type HotspotRow = {
  name: string;
  inclusiveMs: number;
  exclusiveMs: number;
  onCriticalPath: boolean;
  requestCount: number;
  category: ProfileCategory;
  priorityScore: number;
  risk: "low" | "medium" | "high";
};

/**
 * priorityScore =
 *   0.35*inclusive + 0.25*exclusive + 0.20*criticalPathBonus
 *   + 0.10*requestPressure - 0.05*cacheHitBonus + riskPenalty
 */
export function rankHotspots(
  summary = buildDeepProfileSummary(),
): HotspotRow[] {
  const crit = new Set(summary.criticalPath);
  const maxInc = Math.max(
    1,
    ...summary.spans.map((s) => s.durationMs ?? 0),
  );
  return summary.spans
    .filter((s) => (s.durationMs ?? 0) >= 50)
    .map((s) => {
      const inclusiveMs = s.durationMs ?? 0;
      const exclusiveMs = s.exclusiveMs ?? inclusiveMs;
      const onCriticalPath = crit.has(s.name);
      const requestCount = s.requestCount ?? 0;
      const risk: HotspotRow["risk"] =
        s.category === "lock" || s.category === "publish"
          ? "medium"
          : s.category === "bg_on_barrier"
            ? "high"
            : "low";
      const priorityScore =
        0.35 * (inclusiveMs / maxInc) +
        0.25 * (exclusiveMs / maxInc) +
        (onCriticalPath ? 0.2 : 0) +
        0.1 * Math.min(1, requestCount / 20) -
        (s.cacheHit ? 0.05 : 0) +
        (risk === "high" ? 0.15 : risk === "medium" ? 0.05 : 0);
      return {
        name: s.name,
        inclusiveMs,
        exclusiveMs,
        onCriticalPath,
        requestCount,
        category: s.category,
        priorityScore,
        risk,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
