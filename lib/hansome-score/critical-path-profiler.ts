/**
 * Cold Perf V2 Phase 9 — Critical Path Profiler.
 * Opt-in: HANSOME_CRITICAL_PATH_PROFILE=1 (also enables Phase 8 deep-profile).
 * Diagnostics / timing only — never changes score, LP, creator, burn, or cache semantics.
 */

import {
  beginProfileSpan,
  buildDeepProfileSummary,
  endProfileSpan,
  getDeepProfileSpans,
  isDeepProfileEnabled,
  resetDeepProfile,
  setDeepProfileEnabledForTests,
  withProfileSpan,
  type DeepProfileSpan,
  type ProfileCategory,
} from "@/lib/hansome-score/deep-profile";

export type WaitKind =
  | "rpc"
  | "promise"
  | "serialization"
  | "json_parse"
  | "cache_lookup"
  | "cache_serialization"
  | "publish"
  | "network"
  | "idle";

export type RpcProvider =
  | "robinhood_rpc"
  | "blockscout"
  | "gecko"
  | "eth_usd"
  | "other_http";

export type CritPathNode = {
  id: string;
  name: string;
  parent: string | null;
  children: string[];
  start: number;
  finish: number | null;
  wallMs: number | null;
  cpuMs: number | null;
  awaitMs: number | null;
  queueWaitMs: number | null;
  criticalPathContributionMs: number | null;
  parallelGroup: string | null;
  attemptId: string | null;
  scanId: string | null;
  token: string | null;
  chain: number | null;
  category: ProfileCategory | "wait" | "rpc_call";
  onCriticalPath: boolean;
  idleMs: number | null;
  blockedBy: string[];
  meta?: Record<string, string | number | boolean | null | undefined>;
};

export type RpcCallEvent = {
  id: string;
  provider: RpcProvider;
  name: string;
  start: number;
  finish: number;
  durationMs: number;
  timedOut: boolean;
  retried: boolean;
  attempt: number;
  parentSpanId: string | null;
  token: string | null;
  chain: number | null;
  scanId: string | null;
  attemptId: string | null;
};

export type WaitEvent = {
  id: string;
  kind: WaitKind;
  name: string;
  start: number;
  finish: number;
  durationMs: number;
  parentSpanId: string | null;
};

type SessionMeta = {
  scanId: string | null;
  attemptId: string | null;
  token: string | null;
  chain: number | null;
  startedAt: number;
};

let enabledOverride: boolean | null = null;
let session: SessionMeta = {
  scanId: null,
  attemptId: null,
  token: null,
  chain: null,
  startedAt: 0,
};
const rpcEvents: RpcCallEvent[] = [];
const waitEvents: WaitEvent[] = [];
let rpcSeq = 0;
let waitSeq = 0;

export function isCriticalPathProfileEnabled(): boolean {
  if (enabledOverride != null) return enabledOverride;
  return (
    process.env.HANSOME_CRITICAL_PATH_PROFILE === "1" ||
    process.env.HANSOME_DEEP_PROFILE === "1"
  );
}

export function setCriticalPathProfileEnabledForTests(on: boolean | null): void {
  enabledOverride = on;
  setDeepProfileEnabledForTests(on);
}

export function resetCriticalPathProfiler(): void {
  resetDeepProfile();
  rpcEvents.length = 0;
  waitEvents.length = 0;
  rpcSeq = 0;
  waitSeq = 0;
  session = {
    scanId: null,
    attemptId: null,
    token: null,
    chain: null,
    startedAt: 0,
  };
}

export function beginCriticalPathSession(meta: {
  scanId?: string | null;
  attemptId?: string | null;
  token?: string | null;
  chain?: number | null;
}): void {
  if (!isCriticalPathProfileEnabled() && !isDeepProfileEnabled()) return;
  resetCriticalPathProfiler();
  session = {
    scanId: meta.scanId ?? null,
    attemptId: meta.attemptId ?? null,
    token: meta.token ?? null,
    chain: meta.chain ?? null,
    startedAt: Date.now(),
  };
}

export function noteCriticalPathMeta(patch: Partial<SessionMeta>): void {
  session = { ...session, ...patch };
}

function nowCpuMs(): number | null {
  try {
    if (typeof process !== "undefined" && typeof process.cpuUsage === "function") {
      const u = process.cpuUsage();
      return Math.round((u.user + u.system) / 1000);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function recordRpcCall(opts: {
  provider: RpcProvider;
  name: string;
  start: number;
  finish: number;
  timedOut?: boolean;
  retried?: boolean;
  attempt?: number;
  parentSpanId?: string | null;
}): void {
  if (!isCriticalPathProfileEnabled()) return;
  rpcSeq += 1;
  rpcEvents.push({
    id: `rpc:${rpcSeq}`,
    provider: opts.provider,
    name: opts.name,
    start: opts.start,
    finish: opts.finish,
    durationMs: Math.max(0, opts.finish - opts.start),
    timedOut: opts.timedOut === true,
    retried: opts.retried === true,
    attempt: opts.attempt ?? 1,
    parentSpanId: opts.parentSpanId ?? null,
    token: session.token,
    chain: session.chain,
    scanId: session.scanId,
    attemptId: session.attemptId,
  });
}

export async function withRpcTiming<T>(
  provider: RpcProvider,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!isCriticalPathProfileEnabled()) return work();
  const start = Date.now();
  let timedOut = false;
  const retried = false;
  try {
    return await work();
  } catch (err) {
    const msg = String((err as Error)?.name || (err as Error)?.message || err);
    timedOut = /AbortError|TimeoutError|timeout/i.test(msg);
    throw err;
  } finally {
    recordRpcCall({
      provider,
      name,
      start,
      finish: Date.now(),
      timedOut,
      retried,
      attempt: 1,
    });
  }
}

export function recordWait(opts: {
  kind: WaitKind;
  name: string;
  start: number;
  finish: number;
  parentSpanId?: string | null;
}): void {
  if (!isCriticalPathProfileEnabled()) return;
  waitSeq += 1;
  waitEvents.push({
    id: `wait:${waitSeq}`,
    kind: opts.kind,
    name: opts.name,
    start: opts.start,
    finish: opts.finish,
    durationMs: Math.max(0, opts.finish - opts.start),
    parentSpanId: opts.parentSpanId ?? null,
  });
}

export {
  beginProfileSpan,
  endProfileSpan,
  withProfileSpan,
  isDeepProfileEnabled,
};

function parallelGroupFor(name: string, stage?: string): string | null {
  if (name.includes("parallel_wave")) return "parallel_wave";
  if (stage === "relationships" || name.includes("relationships"))
    return "parallel_wave";
  if (stage === "liquidity" || name.includes("liquidity") || name.includes("lp_"))
    return "parallel_wave";
  if (
    stage === "creator" ||
    stage === "burn" ||
    name.includes("creatorBurn") ||
    name.includes("creator") ||
    name.includes("burn")
  )
    return "parallel_wave";
  if (stage === "score" || name.includes("score")) return "score_finalize";
  if (name.includes("warm") || name.includes("checkpoint") || name.includes("discovery"))
    return "prelude";
  return null;
}

function computeCriticalPathIds(spans: DeepProfileSpan[]): string[] {
  const done = spans.filter((s) => s.endTs != null && s.durationMs != null);
  if (done.length === 0) return [];
  const byParent = new Map<string | null, DeepProfileSpan[]>();
  for (const s of done) {
    const k = s.parentId;
    const list = byParent.get(k) ?? [];
    list.push(s);
    byParent.set(k, list);
  }
  const root =
    done.find((s) => s.parentId == null) ??
    done.reduce((a, b) => ((a.durationMs ?? 0) >= (b.durationMs ?? 0) ? a : b));

  // Longest path by overlapping wall: prefer child whose finish is latest and
  // that overlaps the parent's active window (true critical-path among siblings).
  const path: string[] = [];
  let cur: DeepProfileSpan | undefined = root;
  while (cur) {
    path.push(cur.id);
    const kids = (byParent.get(cur.id) ?? []).slice().sort((a, b) => {
      const af = a.endTs ?? 0;
      const bf = b.endTs ?? 0;
      if (bf !== af) return bf - af;
      return (b.durationMs ?? 0) - (a.durationMs ?? 0);
    });
    cur = kids[0];
  }
  return path;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function summarizeProvider(events: RpcCallEvent[]) {
  const durs = events.map((e) => e.durationMs).sort((a, b) => a - b);
  const slowest = events.reduce<RpcCallEvent | null>(
    (best, e) => (!best || e.durationMs > best.durationMs ? e : best),
    null,
  );
  return {
    count: events.length,
    medianMs: percentile(durs, 50),
    p95Ms: percentile(durs, 95),
    p99Ms: percentile(durs, 99),
    slowestMs: slowest?.durationMs ?? null,
    slowestName: slowest?.name ?? null,
    timeoutCount: events.filter((e) => e.timedOut).length,
    retryCount: events.filter((e) => e.retried).length,
    totalMs: durs.reduce((a, b) => a + b, 0),
  };
}

export function buildCritPathNodes(): CritPathNode[] {
  const spans = getDeepProfileSpans();
  const critIds = new Set(computeCriticalPathIds(spans));
  const byParent = new Map<string | null, string[]>();
  for (const s of spans) {
    const list = byParent.get(s.parentId) ?? [];
    list.push(s.id);
    byParent.set(s.parentId, list);
  }

  return spans.map((s) => {
    const children = byParent.get(s.id) ?? [];
    const finish = s.endTs ?? null;
    const wallMs = s.durationMs ?? (finish != null ? finish - s.startTs : null);
    const childWall = children.reduce((sum, cid) => {
      const c = spans.find((x) => x.id === cid);
      return sum + (c?.durationMs ?? 0);
    }, 0);
    const exclusive = s.exclusiveMs ?? Math.max(0, (wallMs ?? 0) - childWall);
    const awaitMs = Math.max(0, (wallMs ?? 0) - exclusive);
    const siblings = spans.filter(
      (x) => x.parentId === s.parentId && x.id !== s.id && x.endTs != null,
    );
    const blockedBy = siblings
      .filter((sib) => (sib.endTs ?? 0) > s.startTs && sib.startTs < s.startTs)
      .map((sib) => sib.id);
    const idleMs =
      s.parentId == null && session.startedAt > 0 && finish != null
        ? Math.max(0, s.startTs - session.startedAt)
        : null;

    return {
      id: s.id,
      name: s.name,
      parent: s.parentId,
      children,
      start: s.startTs,
      finish,
      wallMs,
      cpuMs: null,
      awaitMs,
      queueWaitMs: null,
      criticalPathContributionMs: critIds.has(s.id) ? exclusive : 0,
      parallelGroup: parallelGroupFor(s.name, s.stage),
      attemptId: session.attemptId,
      scanId: session.scanId,
      token: session.token,
      chain: session.chain,
      category: s.category,
      onCriticalPath: critIds.has(s.id),
      idleMs,
      blockedBy,
      meta: s.meta,
    };
  });
}

export type CriticalPathReport = {
  version: "phase9";
  enabled: boolean;
  session: SessionMeta;
  totalWallMs: number | null;
  criticalPath: string[];
  criticalPathTotalMs: number | null;
  nodes: CritPathNode[];
  stages: Record<string, number | null>;
  rpcByProvider: Record<RpcProvider, ReturnType<typeof summarizeProvider>>;
  waitAnalysis: Record<WaitKind, { count: number; totalMs: number; medianMs: number | null }>;
  parallelUtilizationPct: number | null;
  idlePct: number | null;
  blockedPct: number | null;
  top30LongestNodes: Array<{ name: string; wallMs: number; onCriticalPath: boolean }>;
  top10Blocking: Array<{ name: string; blockedBy: string[]; wallMs: number }>;
  top10LongestRpcs: Array<{ provider: RpcProvider; name: string; durationMs: number }>;
  top10LongestAwaits: Array<{ name: string; awaitMs: number }>;
  top10IdleGaps: Array<{ name: string; idleMs: number }>;
  top10Serialization: Array<{ name: string; durationMs: number }>;
  top10PublishDelays: Array<{ name: string; durationMs: number }>;
  parallelization: {
    alreadyParallel: string[];
    serialize: string[];
    independent: string[];
    unnecessarilyWait: string[];
    couldStartEarlier: string[];
    blocksWithoutDataDep: string[];
  };
  optimizationOpportunities: Array<{
    rank: number;
    opportunity: string;
    expectedSavedMs: number;
    complexity: "low" | "medium" | "high";
    risk: "low" | "medium" | "high";
  }>;
  chromeTrace: { traceEvents: Array<Record<string, unknown>> };
  mermaidDag: string;
  flamegraphTimeline: Array<{
    name: string;
    start: number;
    end: number;
    depth: number;
    value: number;
  }>;
  criticalPathTable: Array<{
    step: number;
    name: string;
    start: number;
    finish: number;
    wallMs: number;
    contributionMs: number;
  }>;
};

function stageDurations(nodes: CritPathNode[]): Record<string, number | null> {
  const pick = (pred: (n: CritPathNode) => boolean) => {
    const hits = nodes.filter(pred);
    if (hits.length === 0) return null;
    return Math.max(...hits.map((n) => n.wallMs ?? 0));
  };
  return {
    DeepScan: pick((n) => n.name === "scan.manual_refresh" || n.name === "scan.deep"),
    Liquidity: pick((n) => n.name.includes("liquidity") || n.parallelGroup === "parallel_wave" && n.name.includes("lp")),
    Creator: pick((n) => n.name.includes("creator") && !n.name.includes("creatorBurn")),
    Burn: pick((n) => /\.burn|burn_/i.test(n.name)),
    CreatorBurn: pick((n) => n.name.includes("creatorBurn")),
    Holder: pick((n) => n.name.includes("holder")),
    Relationships: pick((n) => n.name.includes("relationships")),
    Market: pick(
      (n) =>
        n.name.includes("gecko") ||
        n.name.includes("eth_usd") ||
        n.name.includes("market") ||
        n.name.includes("lp_market"),
    ),
    Presentation: pick((n) => n.name.includes("presentation")),
    Security: pick((n) => n.name.includes("security") || n.name.includes("goplus")),
    Score: pick((n) => n.name.includes("score")),
    Discovery: pick((n) => n.name.includes("discovery") || n.name.includes("quick")),
    TransferIndex: pick((n) => n.name.includes("transfer") || n.name.includes("xfer")),
    Cache: pick((n) => n.name.includes("cache") || n.name.includes("warm_snapshot")),
    BackgroundExhaustive: pick((n) => n.name.includes("background") || n.name.includes("exhaustive")),
    Publish: pick((n) => n.name.includes("publish")),
    FinalValidation: pick((n) => n.name.includes("final_validation")),
    ParallelWave: pick((n) => n.name.includes("parallel_wave")),
  };
}

function buildMermaid(nodes: CritPathNode[], critNames: Set<string>): string {
  const lines = ["flowchart TD"];
  const idSafe = (id: string) =>
    "n_" + id.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 48);
  for (const n of nodes) {
    const label = `${n.name}\\n${n.wallMs ?? "?"}ms`;
    const shape = critNames.has(n.name)
      ? `${idSafe(n.id)}[["${label}"]]`
      : `${idSafe(n.id)}["${label}"]`;
    lines.push(`  ${shape}`);
  }
  for (const n of nodes) {
    if (n.parent) {
      lines.push(`  ${idSafe(n.parent)} --> ${idSafe(n.id)}`);
    }
  }
  return lines.join("\n");
}

function buildChromeTrace(
  nodes: CritPathNode[],
  rpcs: RpcCallEvent[],
): { traceEvents: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const t0 = session.startedAt || Math.min(...nodes.map((n) => n.start), Date.now());
  for (const n of nodes) {
    if (n.finish == null) continue;
    events.push({
      name: n.name,
      cat: n.category,
      ph: "X",
      ts: (n.start - t0) * 1000,
      dur: Math.max(0, (n.finish - n.start) * 1000),
      pid: 1,
      tid: n.parallelGroup === "parallel_wave" ? 2 : n.parallelGroup === "score_finalize" ? 3 : 1,
      args: {
        onCriticalPath: n.onCriticalPath,
        attemptId: n.attemptId,
        scanId: n.scanId,
        token: n.token,
        chain: n.chain,
        awaitMs: n.awaitMs,
      },
    });
  }
  for (const r of rpcs) {
    events.push({
      name: `rpc:${r.provider}:${r.name}`,
      cat: "rpc",
      ph: "X",
      ts: (r.start - t0) * 1000,
      dur: Math.max(0, r.durationMs * 1000),
      pid: 1,
      tid: 10,
      args: { timedOut: r.timedOut, retried: r.retried },
    });
  }
  return { traceEvents: events };
}

function rankOptimizations(
  nodes: CritPathNode[],
  stages: Record<string, number | null>,
  rpcByProvider: CriticalPathReport["rpcByProvider"],
): CriticalPathReport["optimizationOpportunities"] {
  const opps: CriticalPathReport["optimizationOpportunities"] = [];
  const rel = stages.Relationships ?? 0;
  const liq = stages.Liquidity ?? 0;
  const cb = stages.CreatorBurn ?? 0;
  const market = stages.Market ?? 0;
  const score = stages.Score ?? 0;
  const prelude = stages.Cache ?? 0;
  const parallelMax = Math.max(rel, liq, cb);

  if (market >= 2000 && liq >= market) {
    opps.push({
      rank: 0,
      opportunity:
        "Overlap / cache Gecko+ETH-USD so market refresh is not exclusive on Liquidity critical path",
      expectedSavedMs: Math.min(market, 8000),
      complexity: "low",
      risk: "low",
    });
  }
  if (rel > 0 && rel < parallelMax && parallelMax - rel < 3000 && rel >= 10_000) {
    opps.push({
      rank: 0,
      opportunity:
        "Relationships still near critical-path end — trim Blockscout funder/early-transfer work or overlap more aggressively",
      expectedSavedMs: Math.min(rel * 0.3, 8000),
      complexity: "medium",
      risk: "medium",
    });
  }
  if (cb > 0 && cb >= 12_000) {
    opps.push({
      rank: 0,
      opportunity:
        "CreatorBurn head/history still long off-path — keep off barrier but reduce head_overlap RPC when warm",
      expectedSavedMs: Math.min(cb * 0.25, 6000),
      complexity: "medium",
      risk: "medium",
    });
  }
  if ((rpcByProvider.blockscout.count ?? 0) >= 8) {
    opps.push({
      rank: 0,
      opportunity: "Coalesce Blockscout pages / raise reuse of transfer-index checkpoint",
      expectedSavedMs: Math.min(rpcByProvider.blockscout.totalMs * 0.2, 10_000),
      complexity: "medium",
      risk: "low",
    });
  }
  if (score >= 1500) {
    opps.push({
      rank: 0,
      opportunity: "Bound score finalize + ensure no duplicate market fetch (Phase 8 Opt B)",
      expectedSavedMs: Math.min(score, 5000),
      complexity: "low",
      risk: "low",
    });
  }
  if (prelude >= 3000) {
    opps.push({
      rank: 0,
      opportunity: "Shrink warm prelude (snapshot load / checkpoint validate / publish hub)",
      expectedSavedMs: Math.min(prelude * 0.4, 4000),
      complexity: "low",
      risk: "low",
    });
  }
  const pubNodes = nodes.filter((n) => n.name.includes("publish"));
  if (pubNodes.some((n) => (n.wallMs ?? 0) >= 500)) {
    opps.push({
      rank: 0,
      opportunity: "Batch / debounce Deep progress publishes on critical path",
      expectedSavedMs: 1000,
      complexity: "medium",
      risk: "medium",
    });
  }
  if (liq >= 5000 && !nodes.some((n) => n.name.includes("quick") && (n.wallMs ?? 0) > 1000)) {
    opps.push({
      rank: 0,
      opportunity:
        "With Quick skipped, Liquidity wall still material — profile price/TVL/owner-lock reuse path for residual awaits",
      expectedSavedMs: Math.min(liq * 0.4, 12_000),
      complexity: "high",
      risk: "medium",
    });
  }

  return opps
    .sort((a, b) => b.expectedSavedMs - a.expectedSavedMs)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}

export function buildCriticalPathReport(): CriticalPathReport {
  const enabled = isCriticalPathProfileEnabled() || isDeepProfileEnabled();
  const summary = buildDeepProfileSummary();
  const nodes = buildCritPathNodes();
  const critIds = new Set(computeCriticalPathIds(getDeepProfileSpans()));
  const critNodes = nodes.filter((n) => critIds.has(n.id));
  const critNames = new Set(critNodes.map((n) => n.name));
  const totalWallMs =
    summary.totalMs ??
    (nodes[0]?.wallMs ?? null) ??
    (session.startedAt > 0 ? Date.now() - session.startedAt : null);

  const stages = stageDurations(nodes);
  const providers: RpcProvider[] = [
    "robinhood_rpc",
    "blockscout",
    "gecko",
    "eth_usd",
    "other_http",
  ];
  const rpcByProvider = Object.fromEntries(
    providers.map((p) => [
      p,
      summarizeProvider(rpcEvents.filter((e) => e.provider === p)),
    ]),
  ) as CriticalPathReport["rpcByProvider"];

  const waitKinds: WaitKind[] = [
    "rpc",
    "promise",
    "serialization",
    "json_parse",
    "cache_lookup",
    "cache_serialization",
    "publish",
    "network",
    "idle",
  ];
  const waitAnalysis = Object.fromEntries(
    waitKinds.map((k) => {
      const ev = waitEvents.filter((w) => w.kind === k);
      const durs = ev.map((e) => e.durationMs).sort((a, b) => a - b);
      return [
        k,
        {
          count: ev.length,
          totalMs: durs.reduce((a, b) => a + b, 0),
          medianMs: percentile(durs, 50),
        },
      ];
    }),
  ) as CriticalPathReport["waitAnalysis"];

  // Parallel utilization: sum of parallel-group exclusive work / (wall * width)
  const parallelNodes = nodes.filter((n) => n.parallelGroup === "parallel_wave");
  const parallelBusy = parallelNodes.reduce((s, n) => s + (n.criticalPathContributionMs === 0 ? (n.wallMs ?? 0) : (n.wallMs ?? 0)), 0);
  const parallelWindow = stages.ParallelWave ?? Math.max(
    stages.Relationships ?? 0,
    stages.Liquidity ?? 0,
    stages.CreatorBurn ?? 0,
  );
  const parallelUtilizationPct =
    parallelWindow > 0
      ? Math.min(100, Math.round((parallelBusy / (parallelWindow * 3)) * 1000) / 10)
      : null;

  const idleTotal = waitAnalysis.idle.totalMs;
  const idlePct =
    totalWallMs && totalWallMs > 0
      ? Math.round((idleTotal / totalWallMs) * 1000) / 10
      : null;
  const blockedNodes = nodes.filter((n) => n.blockedBy.length > 0);
  const blockedPct =
    nodes.length > 0
      ? Math.round((blockedNodes.length / nodes.length) * 1000) / 10
      : null;

  const top30LongestNodes = [...nodes]
    .filter((n) => n.wallMs != null)
    .sort((a, b) => (b.wallMs ?? 0) - (a.wallMs ?? 0))
    .slice(0, 30)
    .map((n) => ({
      name: n.name,
      wallMs: n.wallMs!,
      onCriticalPath: n.onCriticalPath,
    }));

  const top10Blocking = [...nodes]
    .filter((n) => n.blockedBy.length > 0)
    .sort((a, b) => (b.wallMs ?? 0) - (a.wallMs ?? 0))
    .slice(0, 10)
    .map((n) => ({
      name: n.name,
      blockedBy: n.blockedBy,
      wallMs: n.wallMs ?? 0,
    }));

  const top10LongestRpcs = [...rpcEvents]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((e) => ({
      provider: e.provider,
      name: e.name,
      durationMs: e.durationMs,
    }));

  const top10LongestAwaits = [...nodes]
    .filter((n) => (n.awaitMs ?? 0) > 0)
    .sort((a, b) => (b.awaitMs ?? 0) - (a.awaitMs ?? 0))
    .slice(0, 10)
    .map((n) => ({ name: n.name, awaitMs: n.awaitMs ?? 0 }));

  const top10IdleGaps = [...nodes]
    .filter((n) => (n.idleMs ?? 0) > 0)
    .sort((a, b) => (b.idleMs ?? 0) - (a.idleMs ?? 0))
    .slice(0, 10)
    .map((n) => ({ name: n.name, idleMs: n.idleMs ?? 0 }));

  const top10Serialization = waitEvents
    .filter((w) => w.kind === "serialization" || w.kind === "json_parse")
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((w) => ({ name: w.name, durationMs: w.durationMs }));

  const top10PublishDelays = waitEvents
    .filter((w) => w.kind === "publish")
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((w) => ({ name: w.name, durationMs: w.durationMs }));

  const depthOf = (id: string): number => {
    let d = 0;
    let cur = nodes.find((n) => n.id === id);
    while (cur?.parent) {
      d += 1;
      cur = nodes.find((n) => n.id === cur!.parent);
    }
    return d;
  };

  const flamegraphTimeline = nodes
    .filter((n) => n.finish != null)
    .map((n) => ({
      name: n.name,
      start: n.start,
      end: n.finish!,
      depth: depthOf(n.id),
      value: n.wallMs ?? 0,
    }))
    .sort((a, b) => a.start - b.start || a.depth - b.depth);

  const criticalPathTable = critNodes.map((n, i) => ({
    step: i + 1,
    name: n.name,
    start: n.start,
    finish: n.finish ?? n.start,
    wallMs: n.wallMs ?? 0,
    contributionMs: n.criticalPathContributionMs ?? 0,
  }));

  const criticalPathTotalMs =
    totalWallMs ??
    (critNodes.length
      ? Math.max(...critNodes.map((n) => n.finish ?? 0)) -
        Math.min(...critNodes.map((n) => n.start))
      : null);

  const parallelization = {
    alreadyParallel: [
      "relationships ∥ liquidity ∥ creatorBurn (parallel_wave)",
      "Gecko ∥ ETH-USD within ensureMarket (Promise.all)",
    ],
    serialize: [
      "score finalize after parallel_wave barrier",
      "known-first: plan → evidence → owner → lock → market → exit (sequential LP steps)",
      "warm prelude before parallel_wave",
    ],
    independent: [
      "relationships vs liquidity vs creatorBurn (no data dependency until score)",
      "background exhaustive after LP interactive barrier",
    ],
    unnecessarilyWait: [
      "score stage marked analyzing early while parallel still running (presentation only)",
      "publish hub may serialize stage writes across parallel jobs",
    ],
    couldStartEarlier: [
      "market ensureMarket on KF path starts at market step — could start at plan/evidence",
      "score recompute inputs ready as each parallel leg finishes — currently waits for all",
    ],
    blocksWithoutDataDep: [
      "score waits for relationships even when LP+creatorBurn already done (orchestration barrier)",
      "liquidity KF owner/lock reuse publishes before market even when market independent",
    ],
  };

  return {
    version: "phase9",
    enabled,
    session,
    totalWallMs,
    criticalPath: summary.criticalPath,
    criticalPathTotalMs,
    nodes,
    stages,
    rpcByProvider,
    waitAnalysis,
    parallelUtilizationPct,
    idlePct,
    blockedPct,
    top30LongestNodes,
    top10Blocking,
    top10LongestRpcs,
    top10LongestAwaits,
    top10IdleGaps,
    top10Serialization,
    top10PublishDelays,
    parallelization,
    optimizationOpportunities: rankOptimizations(nodes, stages, rpcByProvider),
    chromeTrace: buildChromeTrace(nodes, rpcEvents),
    mermaidDag: buildMermaid(nodes, critNames),
    flamegraphTimeline,
    criticalPathTable,
  };
}

/** Compact payload safe to attach to ScanResponse when profiling is on. */
export function buildCriticalPathCompact(): {
  version: "phase9";
  totalWallMs: number | null;
  criticalPath: string[];
  criticalPathTotalMs: number | null;
  stages: Record<string, number | null>;
  rpcByProvider: CriticalPathReport["rpcByProvider"];
  parallelUtilizationPct: number | null;
  idlePct: number | null;
  blockedPct: number | null;
  top10LongestNodes: CriticalPathReport["top30LongestNodes"];
  top10LongestRpcs: CriticalPathReport["top10LongestRpcs"];
  optimizationOpportunities: CriticalPathReport["optimizationOpportunities"];
  nodeCount: number;
  rpcCount: number;
} {
  const full = buildCriticalPathReport();
  return {
    version: "phase9",
    totalWallMs: full.totalWallMs,
    criticalPath: full.criticalPath,
    criticalPathTotalMs: full.criticalPathTotalMs,
    stages: full.stages,
    rpcByProvider: full.rpcByProvider,
    parallelUtilizationPct: full.parallelUtilizationPct,
    idlePct: full.idlePct,
    blockedPct: full.blockedPct,
    top10LongestNodes: full.top30LongestNodes.slice(0, 10),
    top10LongestRpcs: full.top10LongestRpcs,
    optimizationOpportunities: full.optimizationOpportunities,
    nodeCount: full.nodes.length,
    rpcCount: rpcEvents.length,
  };
}

export function cpuMark(): number | null {
  return nowCpuMs();
}
