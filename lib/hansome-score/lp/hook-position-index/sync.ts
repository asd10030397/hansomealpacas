/**
 * Phase 11E — bootstrap + incremental Hook Position Index sync.
 */

import { getAddress } from "viem";
import {
  DEFAULT_CONFIRMATION_DEPTH,
  DEFAULT_INITIAL_LOG_SPAN,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MIN_LOG_SPAN,
} from "@/lib/hansome-score/lp/hook-position-index/abis";
import {
  addNetDelta,
  classifyHookPositionOwner,
  isZeroLiquidityDelta,
} from "@/lib/hansome-score/lp/hook-position-index/classify";
import {
  filterAndDecodeModifyLiquidityLogs,
  positionKeyId,
} from "@/lib/hansome-score/lp/hook-position-index/decode";
import {
  fixtureRecordsFor,
  type HookPoolFixture,
} from "@/lib/hansome-score/lp/hook-position-index/fixtures";
import {
  bumpGeneration,
  resolvePublishTerminal,
  transitionTerminalState,
  uniqueReasons,
} from "@/lib/hansome-score/lp/hook-position-index/state-machine";
import {
  emptyHookPositionIndexState,
  upsertHookPosition,
} from "@/lib/hansome-score/lp/hook-position-index/store";
import type {
  DecodedModifyLiquidity,
  HookIncompleteReason,
  HookPositionIndexState,
  HookPositionRecord,
  HookPositionSource,
  HookPosSyncMetrics,
  RawLogLike,
} from "@/lib/hansome-score/lp/hook-position-index/types";

export type HookPosChainPort = {
  getBlockNumber(): Promise<number>;
  getBlockHash(blockNumber: number): Promise<string | null>;
  getTransactionReceipt(txHash: string): Promise<{
    blockNumber: number;
    logs: RawLogLike[];
  } | null>;
  getLogsModifyLiquidity(params: {
    poolManager: string;
    poolId: string;
    fromBlock: number;
    toBlock: number;
    sender?: string;
  }): Promise<RawLogLike[]>;
  getPositionInfo?(params: {
    poolId: string;
    owner: string;
    tickLower: number;
    tickUpper: number;
    salt: string;
  }): Promise<{ liquidity: string } | null>;
};

export type HookSyncOptions = {
  chainId: number;
  poolId: string;
  hookAddress: string;
  positionManager: string;
  poolManager: string;
  createTx?: string | null;
  createBlock?: number | null;
  confirmationDepth?: number;
  /** When true, also index foreign (non-hook) senders during replay. */
  indexForeign?: boolean;
  interactiveBudgetMs?: number;
  initialLogSpan?: number;
  minLogSpan?: number;
  maxRetries?: number;
  /**
   * After a successful create receipt, only tip-catch this many blocks
   * ending at safeHead (full middle history is background / optional).
   * Default 80_000.
   */
  tipCatchUpBlocks?: number;
  /** When true, scan createBlock→safeHead even after create receipt. */
  forceFullReplay?: boolean;
  /** Trusted fixture may complete hook discovery after tip catch-up. */
  fixture?: HookPoolFixture | null;
  /** Skip StateView tip validation. */
  skipStateView?: boolean;
};

function emptyMetrics(
  mode: HookPosSyncMetrics["mode"],
): HookPosSyncMetrics {
  return {
    mode,
    fromBlock: null,
    toBlock: null,
    logCount: 0,
    acceptedLogCount: 0,
    rejectedLogCount: 0,
    rpcCalls: 0,
    retries: 0,
    wallMs: 0,
    chunkShrinks: 0,
  };
}

function applyDecodedLog(
  state: HookPositionIndexState,
  log: DecodedModifyLiquidity,
  source: HookPositionSource,
  opts: HookSyncOptions,
): HookPositionIndexState {
  const classification = classifyHookPositionOwner({
    sender: log.sender,
    hookAddress: opts.hookAddress,
    positionManager: opts.positionManager,
  });

  if (classification !== "hook_owned" && !opts.indexForeign) {
    // Still track foreign keys when we see them during create receipt (honesty),
    // but mark foreign incomplete.
    if (source !== "create_tx_receipt") {
      return state;
    }
  }

  const zero = isZeroLiquidityDelta(log.liquidityDelta);
  const id = positionKeyId({
    poolId: log.poolId,
    owner: log.sender,
    tickLower: log.tickLower,
    tickUpper: log.tickUpper,
    salt: log.salt,
  });
  const existing = state.positions.find((p) => positionKeyId(p) === id);

  // Zero-delta fee poke: update lastSeen only if key already exists; do not
  // invent ownership via poke alone.
  if (zero && !existing) {
    return state;
  }

  const record: HookPositionRecord = {
    chainId: opts.chainId,
    poolId: log.poolId.toLowerCase(),
    owner: getAddress(log.sender).toLowerCase(),
    tickLower: log.tickLower,
    tickUpper: log.tickUpper,
    salt: log.salt.toLowerCase(),
    classification,
    firstSeenBlock: existing?.firstSeenBlock ?? log.blockNumber,
    lastSeenBlock: log.blockNumber,
    lastLiquidityDelta: zero
      ? existing?.lastLiquidityDelta
      : log.liquidityDelta,
    netLiquidityDelta: zero
      ? existing?.netLiquidityDelta ?? "0"
      : addNetDelta(existing?.netLiquidityDelta, log.liquidityDelta),
    source: existing?.source ?? source,
    liveLiquidity: existing?.liveLiquidity,
    stateViewValidated: existing?.stateViewValidated,
    active: existing?.active,
    lastError: existing?.lastError ?? null,
  };
  return upsertHookPosition(state, record);
}

async function adaptiveGetLogs(params: {
  port: HookPosChainPort;
  opts: HookSyncOptions;
  fromBlock: number;
  toBlock: number;
  sender?: string;
  metrics: HookPosSyncMetrics;
  deadline: number;
}): Promise<{
  logs: DecodedModifyLiquidity[];
  partial: boolean;
  reasons: HookIncompleteReason[];
  reachedTo: number;
}> {
  const {
    port,
    opts,
    fromBlock,
    toBlock,
    sender,
    metrics,
  } = params;
  const minSpan = opts.minLogSpan ?? DEFAULT_MIN_LOG_SPAN;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  let span = opts.initialLogSpan ?? DEFAULT_INITIAL_LOG_SPAN;
  let cursor = fromBlock;
  const accepted: DecodedModifyLiquidity[] = [];
  const reasons: HookIncompleteReason[] = [];
  let partial = false;

  while (cursor <= toBlock) {
    if (Date.now() > params.deadline) {
      partial = true;
      reasons.push("budget_exceeded");
      reasons.push("replay_partial");
      break;
    }
    const end = Math.min(cursor + span - 1, toBlock);
    let attempt = 0;
    let ok = false;
    while (attempt <= maxRetries && !ok) {
      try {
        metrics.rpcCalls += 1;
        const raw = await port.getLogsModifyLiquidity({
          poolManager: opts.poolManager,
          poolId: opts.poolId,
          fromBlock: cursor,
          toBlock: end,
          sender,
        });
        metrics.logCount += raw.length;
        const decoded = filterAndDecodeModifyLiquidityLogs(raw, {
          expectedPoolId: opts.poolId,
          expectedSender: sender,
          poolManager: opts.poolManager,
        });
        metrics.acceptedLogCount += decoded.accepted.length;
        metrics.rejectedLogCount += decoded.rejected.length;
        if (decoded.rejected.length > 0) {
          // Client-side rejected RPC false positives — not incompleteness by itself.
        }
        accepted.push(...decoded.accepted);
        ok = true;
        cursor = end + 1;
        // Grow span slowly on success
        span = Math.min(span * 2, opts.initialLogSpan ?? DEFAULT_INITIAL_LOG_SPAN);
      } catch {
        metrics.retries += 1;
        attempt += 1;
        if (span > minSpan) {
          span = Math.max(minSpan, Math.floor(span / 2));
          metrics.chunkShrinks += 1;
        } else if (attempt > maxRetries) {
          partial = true;
          reasons.push("rpc_range_limited");
          reasons.push("replay_partial");
          // Skip this stubborn single-span block range and continue
          cursor = end + 1;
          ok = true;
        }
      }
    }
  }

  return {
    logs: accepted,
    partial,
    reasons: uniqueReasons(reasons),
    reachedTo: Math.min(cursor - 1, toBlock),
  };
}

async function validateWithStateView(
  port: HookPosChainPort,
  state: HookPositionIndexState,
  metrics: HookPosSyncMetrics,
): Promise<HookPositionIndexState> {
  if (!port.getPositionInfo) return state;
  const next = structuredClone(state);
  for (const p of next.positions) {
    try {
      metrics.rpcCalls += 1;
      const info = await port.getPositionInfo({
        poolId: p.poolId,
        owner: p.owner,
        tickLower: p.tickLower,
        tickUpper: p.tickUpper,
        salt: p.salt,
      });
      if (info == null) {
        p.stateViewValidated = false;
        p.lastError = "state_view_null";
        continue;
      }
      p.liveLiquidity = info.liquidity;
      p.stateViewValidated = true;
      p.active = BigInt(info.liquidity) > 0n;
      p.lastError = null;
    } catch (e) {
      p.stateViewValidated = false;
      p.lastError = String((e as Error)?.message ?? e);
    }
  }
  return next;
}

function evaluateHookComplete(
  state: HookPositionIndexState,
  opts: HookSyncOptions,
  reachedSafeHead: boolean,
): boolean {
  if (!reachedSafeHead) return false;
  if (state.positions.filter((p) => p.classification === "hook_owned").length === 0) {
    return false;
  }

  // A: create receipt path
  if (
    state.discoveryMethod === "create_receipt" &&
    opts.createTx &&
    state.createBlock != null
  ) {
    return true;
  }

  // B: init_data (placeholder — not implemented reconstruction yet)
  if (state.discoveryMethod === "init_data") {
    return true;
  }

  // C: trusted fixture marked complete
  if (
    state.discoveryMethod === "fixture" &&
    opts.fixture?.fixtureComplete === true
  ) {
    return true;
  }

  // Full log replay exhaustive for hook-filtered range from create
  if (
    state.discoveryMethod === "full_log_replay" &&
    state.createBlock != null &&
    !state.incompleteReasons.includes("rpc_range_limited") &&
    !state.incompleteReasons.includes("replay_partial")
  ) {
    return true;
  }

  return false;
}

function evaluateForeignComplete(
  state: HookPositionIndexState,
  opts: HookSyncOptions,
  reachedSafeHead: boolean,
  foreignExhaustive: boolean,
): boolean {
  if (!opts.indexForeign) return false;
  if (!reachedSafeHead) return false;
  if (!foreignExhaustive) return false;
  if (state.createBlock == null) return false;
  if (state.incompleteReasons.includes("rpc_range_limited")) return false;
  if (state.incompleteReasons.includes("replay_partial")) return false;
  if (state.incompleteReasons.includes("foreign_backfill_skipped")) return false;
  return true;
}

/**
 * Bootstrap priority:
 * 1 create receipt → 2 bounded replay → 3 init_data (stub) → 4 fixture → 5 partial
 */
export async function bootstrapHookPositionIndex(params: {
  port: HookPosChainPort;
  opts: HookSyncOptions;
  existing?: HookPositionIndexState | null;
}): Promise<HookPositionIndexState> {
  const t0 = Date.now();
  const { port, opts } = params;
  const depth = opts.confirmationDepth ?? DEFAULT_CONFIRMATION_DEPTH;
  const deadline =
    Date.now() + (opts.interactiveBudgetMs ?? 12_000);
  const metrics = emptyMetrics("bootstrap");

  let state =
    params.existing != null
      ? structuredClone(params.existing)
      : emptyHookPositionIndexState({
          chainId: opts.chainId,
          poolId: opts.poolId,
          hookAddress: opts.hookAddress,
          positionManager: opts.positionManager,
          poolManager: opts.poolManager,
          createTx: opts.createTx ?? null,
          createBlock: opts.createBlock ?? null,
          confirmationDepth: depth,
        });

  state = transitionTerminalState(state, "BOOTSTRAPPING");
  state.generation = bumpGeneration(state.generation);

  const head = await port.getBlockNumber();
  metrics.rpcCalls += 1;
  const safeHead = Math.max(0, head - depth);
  state.safeHeadBlock = safeHead;

  const reasons: HookIncompleteReason[] = [];
  let bootstrapSource: HookPositionSource | null = null;

  // 1. Known create transaction receipt
  if (opts.createTx) {
    metrics.rpcCalls += 1;
    const receipt = await port.getTransactionReceipt(opts.createTx);
    if (receipt) {
      state.createBlock = receipt.blockNumber;
      state.createTx = opts.createTx.toLowerCase();
      const decoded = filterAndDecodeModifyLiquidityLogs(receipt.logs, {
        expectedPoolId: opts.poolId,
        poolManager: opts.poolManager,
      });
      metrics.logCount += receipt.logs.length;
      metrics.acceptedLogCount += decoded.accepted.length;
      metrics.rejectedLogCount += decoded.rejected.length;
      for (const log of decoded.accepted) {
        state = applyDecodedLog(state, log, "create_tx_receipt", {
          ...opts,
          indexForeign: true, // capture foreign on create for honesty
        });
      }
      if (
        state.positions.some((p) => p.classification === "hook_owned")
      ) {
        state.discoveryMethod = "create_receipt";
        bootstrapSource = "create_tx_receipt";
      }
    } else {
      reasons.push("create_tx_unknown");
    }
  } else {
    reasons.push("create_tx_unknown");
  }

  // 2. Bounded ModifyLiquidity replay (hook sender)
  // After create receipt closes the mint set, tip-catch a trailing window to
  // safeHead (full create→head replay is forceFullReplay / background only).
  let replayPartial = false;
  let reachedTo: number | null = state.createBlock ?? null;
  const createBlockNum = state.createBlock ?? null;
  if (createBlockNum != null && createBlockNum <= safeHead) {
    state = transitionTerminalState(state, "REPLAYING");
    const fromCreateReceipt =
      !opts.forceFullReplay &&
      bootstrapSource === "create_tx_receipt" &&
      state.positions.some((p) => p.classification === "hook_owned");
    const tipWindow = opts.tipCatchUpBlocks ?? 80_000;
    const from: number = fromCreateReceipt
      ? Math.max(createBlockNum + 1, safeHead - tipWindow + 1)
      : createBlockNum;
    metrics.fromBlock = from;
    metrics.toBlock = safeHead;
    if (from <= safeHead) {
      const result = await adaptiveGetLogs({
        port,
        opts,
        fromBlock: from,
        toBlock: safeHead,
        sender: opts.hookAddress,
        metrics,
        deadline,
      });
      for (const log of result.logs) {
        state = applyDecodedLog(state, log, "modify_liquidity_log", opts);
      }
      replayPartial = result.partial;
      // Create-receipt tip catch-up: if the trailing window completed, treat
      // lastSynced as safeHead (mint set already closed by receipt).
      reachedTo =
        fromCreateReceipt && !result.partial ? safeHead : result.reachedTo;
      reasons.push(...result.reasons);
      if (!bootstrapSource) {
        state.discoveryMethod = result.partial
          ? "partial_log_replay"
          : "full_log_replay";
        bootstrapSource = "modify_liquidity_log";
      }
    } else {
      reachedTo = safeHead;
    }
  } else if (createBlockNum == null) {
    reasons.push("create_block_unknown");
  }

  // 3. InitData — not available in this phase
  if (
    !state.positions.some((p) => p.classification === "hook_owned")
  ) {
    reasons.push("init_data_unavailable");
  }

  // 4. Trusted fixture (only when hook set still empty)
  if (
    opts.fixture?.fixturePositions?.length &&
    !state.positions.some((p) => p.classification === "hook_owned")
  ) {
    for (const rec of fixtureRecordsFor(opts.fixture)) {
      state = upsertHookPosition(state, rec);
    }
    state.discoveryMethod = "fixture";
    bootstrapSource = "fixture";
    if (!opts.fixture.fixtureComplete) {
      reasons.push("fixture_only");
    }
    if (opts.fixture.createBlock != null) {
      state.createBlock = opts.fixture.createBlock;
    }
    if (opts.fixture.createTx) {
      state.createTx = opts.fixture.createTx.toLowerCase();
    }
    // Tip-catch after fixture seed (same trailing-window strategy).
    if (state.createBlock != null && state.createBlock <= safeHead) {
      const tipWindow = opts.tipCatchUpBlocks ?? 80_000;
      const from = Math.max(state.createBlock + 1, safeHead - tipWindow + 1);
      if (from <= safeHead && Date.now() < deadline) {
        const result = await adaptiveGetLogs({
          port,
          opts,
          fromBlock: from,
          toBlock: safeHead,
          sender: opts.hookAddress,
          metrics,
          deadline,
        });
        for (const log of result.logs) {
          state = applyDecodedLog(state, log, "modify_liquidity_log", opts);
        }
        replayPartial = result.partial;
        reachedTo = !result.partial ? safeHead : result.reachedTo;
        reasons.push(...result.reasons);
      }
    }
  }

  // Foreign exhaustive backfill skipped by default in interactive bootstrap
  if (!opts.indexForeign) {
    reasons.push("foreign_backfill_skipped");
  }

  const reachedSafeHead =
    reachedTo != null && reachedTo >= safeHead && !replayPartial;
  if (!reachedSafeHead) {
    reasons.push("safe_head_not_reached");
  }

  state.lastSyncedBlock = reachedTo;
  if (reachedTo != null) {
    metrics.rpcCalls += 1;
    state.lastSyncedBlockHash = await port.getBlockHash(reachedTo);
  }
  state.incompleteReasons = uniqueReasons(reasons);
  state.hookDiscoveryComplete = evaluateHookComplete(
    state,
    opts,
    reachedSafeHead,
  );
  state.foreignDiscoveryComplete = evaluateForeignComplete(
    state,
    opts,
    reachedSafeHead,
    false,
  );

  if (!opts.skipStateView) {
    state = await validateWithStateView(port, state, metrics);
  }

  state = transitionTerminalState(state, "PUBLISHING");
  const terminal = resolvePublishTerminal(state);
  state = transitionTerminalState(state, terminal, {
    failedReason:
      terminal === "FAILED_TERMINAL"
        ? "no_hook_positions_discovered"
        : undefined,
    lastSuccessfulBlock: state.lastSyncedBlock,
  });

  metrics.wallMs = Date.now() - t0;
  state.metrics = metrics;
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Incremental: lastSyncedBlock+1 → safeHead. */
export async function incrementalSyncHookPositionIndex(params: {
  port: HookPosChainPort;
  opts: HookSyncOptions;
  existing: HookPositionIndexState;
}): Promise<HookPositionIndexState> {
  const t0 = Date.now();
  const { port, opts, existing } = params;
  const depth = opts.confirmationDepth ?? DEFAULT_CONFIRMATION_DEPTH;
  const deadline =
    Date.now() + (opts.interactiveBudgetMs ?? 4_000);
  const metrics = emptyMetrics("incremental");

  let state = structuredClone(existing);
  state = transitionTerminalState(state, "REPLAYING");

  const head = await port.getBlockNumber();
  metrics.rpcCalls += 1;
  const safeHead = Math.max(0, head - depth);
  state.safeHeadBlock = safeHead;

  const start =
    state.lastSyncedBlock != null ? state.lastSyncedBlock + 1 : null;
  if (start == null || start > safeHead) {
    // Nothing to do — re-evaluate completeness at tip
    const reachedSafeHead = state.lastSyncedBlock != null && state.lastSyncedBlock >= safeHead;
    state.hookDiscoveryComplete = evaluateHookComplete(
      state,
      opts,
      reachedSafeHead,
    );
    if (!opts.skipStateView) {
      state = await validateWithStateView(port, state, metrics);
    }
    state = transitionTerminalState(state, "PUBLISHING");
    state = transitionTerminalState(state, resolvePublishTerminal(state));
    metrics.wallMs = Date.now() - t0;
    state.metrics = metrics;
    state.updatedAt = new Date().toISOString();
    return state;
  }

  metrics.fromBlock = start;
  metrics.toBlock = safeHead;
  const result = await adaptiveGetLogs({
    port,
    opts,
    fromBlock: start,
    toBlock: safeHead,
    sender: opts.hookAddress,
    metrics,
    deadline,
  });
  for (const log of result.logs) {
    state = applyDecodedLog(state, log, "modify_liquidity_log", opts);
  }

  const reasons: HookIncompleteReason[] = [
    ...state.incompleteReasons.filter(
      (r) => r !== "safe_head_not_reached" && r !== "budget_exceeded",
    ),
    ...result.reasons,
  ];
  const reachedSafeHead = result.reachedTo >= safeHead && !result.partial;
  if (!reachedSafeHead) reasons.push("safe_head_not_reached");
  if (!opts.indexForeign) reasons.push("foreign_backfill_skipped");

  state.lastSyncedBlock = result.reachedTo;
  metrics.rpcCalls += 1;
  state.lastSyncedBlockHash = await port.getBlockHash(result.reachedTo);
  state.incompleteReasons = uniqueReasons(reasons);
  state.hookDiscoveryComplete = evaluateHookComplete(
    state,
    opts,
    reachedSafeHead,
  );
  state.foreignDiscoveryComplete = evaluateForeignComplete(
    state,
    opts,
    reachedSafeHead,
    false,
  );

  if (!opts.skipStateView) {
    state = await validateWithStateView(port, state, metrics);
  }

  state = transitionTerminalState(state, "PUBLISHING");
  state = transitionTerminalState(state, resolvePublishTerminal(state));
  metrics.wallMs = Date.now() - t0;
  state.metrics = metrics;
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Apply fixture positions into empty/partial state (unit / offline). */
export function applyFixtureBootstrap(
  opts: HookSyncOptions,
  fixture: HookPoolFixture,
): HookPositionIndexState {
  let state = emptyHookPositionIndexState({
    chainId: opts.chainId,
    poolId: opts.poolId,
    hookAddress: opts.hookAddress,
    positionManager: opts.positionManager,
    poolManager: opts.poolManager,
    createTx: fixture.createTx,
    createBlock: fixture.createBlock,
    confirmationDepth: opts.confirmationDepth,
  });
  state = transitionTerminalState(state, "BOOTSTRAPPING");
  for (const rec of fixtureRecordsFor(fixture)) {
    state = upsertHookPosition(state, rec);
  }
  state.discoveryMethod = "fixture";
  state.generation = "1";
  state.incompleteReasons = fixture.fixtureComplete
    ? ["safe_head_not_reached", "foreign_backfill_skipped"]
    : ["fixture_only", "safe_head_not_reached", "foreign_backfill_skipped"];
  state.hookDiscoveryComplete = false;
  state.foreignDiscoveryComplete = false;
  state.terminalState = "SUCCESS_PARTIAL";
  state.updatedAt = new Date().toISOString();
  return state;
}
