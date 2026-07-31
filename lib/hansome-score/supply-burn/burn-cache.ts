/**
 * P2/P3 burn history cache — KV keys `scan:burn:*` (isolated from forum/vault).
 * Server / Node harness only — do not import from Client Components.
 */
import { getAddress } from "viem";
import {
  fetchTokenTransfersPaged,
  type BlockscoutTokenTransferRow,
} from "@/lib/hansome-score/blockscout";
import { SCAN_CHAIN_ID } from "@/lib/hansome-score/constants";
import { scopedKvKey } from "@/lib/hansome-score/deployment-scope";
import {
  computeBurnActivityHistory,
  computeSupplyReductionHistory,
  emptyBurnActivityHistory,
  emptySupplyReductionHistory,
  extractBurnEventsFromTransfers,
  mergeBurnEvents,
  supplyReductionTriState,
} from "@/lib/hansome-score/supply-burn/burn-history";
import type {
  BurnActivityHistory,
  BurnInflowEvent,
  SupplyBurnIntelligence,
  SupplyReductionHistory,
  TriState,
} from "@/lib/hansome-score/supply-burn/types";

/** Fresh burn-history window (align with full Score TTL). */
export const BURN_HISTORY_TTL_MS = 15 * 60 * 1000;
/** Serve stale burn history + background refresh. */
export const BURN_HISTORY_STALE_TTL_MS = 60 * 60 * 1000;
/** Soft KV retention. */
export const BURN_HISTORY_KV_TTL_SEC = 24 * 60 * 60;
/** Lock while indexing the same CA. */
export const BURN_INDEX_LOCK_TTL_SEC = 90;

export type StoredBurnHistory = {
  version: 1;
  chainId: number;
  address: string;
  updatedAt: number;
  /** Newest ANY transfer timestamp seen (incremental stop cursor). */
  headTimestampMs: number | null;
  oldestIndexedMs: number | null;
  paginationComplete: boolean;
  fetchFailed: boolean;
  pagesFetched: number;
  transfersIndexed: number;
  burns: BurnInflowEvent[];
  /** Sticky: once true, keep unless a later full reindex fails hard. */
  allTimeComplete: boolean;
  hasSupplyReducingAbiPath: boolean;
  decimals: number | null;
};

type BurnHistoryBundle = {
  burnActivity: BurnActivityHistory;
  supplyReduction: SupplyReductionHistory;
  supplyReductionVerified: TriState;
  stored: StoredBurnHistory;
};

const memory = new Map<string, StoredBurnHistory>();
const inflight = new Map<string, Promise<BurnHistoryBundle>>();
const memoryLocks = new Map<string, number>();
const backgroundRefresh = new Set<string>();

function cacheKey(address: string): string {
  return `${SCAN_CHAIN_ID}:${getAddress(address).toLowerCase()}`;
}

const BURN_KEYS = {
  history: (k: string) => scopedKvKey("scan", "burn", k),
  lock: (k: string) => scopedKvKey("scan", "burn", "lock", k),
};

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

async function kvGet(key: string): Promise<StoredBurnHistory | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<StoredBurnHistory>(BURN_KEYS.history(key))) ?? null;
  } catch (err) {
    console.warn("[burn-cache] KV get failed:", err);
    return null;
  }
}

async function kvSet(key: string, value: StoredBurnHistory): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.set(BURN_KEYS.history(key), value, { ex: BURN_HISTORY_KV_TTL_SEC });
  } catch (err) {
    console.warn("[burn-cache] KV set failed:", err);
  }
}

async function acquireLock(key: string): Promise<boolean> {
  const kv = await getKv();
  if (kv) {
    try {
      const ok = await kv.set(BURN_KEYS.lock(key), "1", {
        nx: true,
        ex: BURN_INDEX_LOCK_TTL_SEC,
      });
      return ok != null;
    } catch {
      /* memory */
    }
  }
  const now = Date.now();
  const until = memoryLocks.get(key) ?? 0;
  if (until > now) return false;
  memoryLocks.set(key, now + BURN_INDEX_LOCK_TTL_SEC * 1000);
  return true;
}

async function releaseLock(key: string): Promise<void> {
  memoryLocks.delete(key);
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.del(BURN_KEYS.lock(key));
  } catch {
    /* ignore */
  }
}

function ageMs(stored: StoredBurnHistory): number {
  return Date.now() - stored.updatedAt;
}

export function isBurnHistoryFresh(stored: StoredBurnHistory): boolean {
  return ageMs(stored) < BURN_HISTORY_TTL_MS;
}

export function isBurnHistoryUsableStale(stored: StoredBurnHistory): boolean {
  return ageMs(stored) < BURN_HISTORY_STALE_TTL_MS;
}

function bundleFromStored(stored: StoredBurnHistory): BurnHistoryBundle {
  const burnActivity = computeBurnActivityHistory({
    burns: stored.burns,
    pagesFetched: stored.pagesFetched,
    paginationComplete: stored.allTimeComplete || stored.paginationComplete,
    fetchFailed: stored.fetchFailed,
    transfersIndexed: stored.transfersIndexed,
    oldestIndexedMs: stored.oldestIndexedMs,
    newestIndexedMs: stored.headTimestampMs,
    decimals: stored.decimals,
    source: "burn_cache",
  });
  const supplyReduction = computeSupplyReductionHistory({
    burns: stored.burns,
    paginationComplete: stored.allTimeComplete || stored.paginationComplete,
    fetchFailed: stored.fetchFailed,
    pagesFetched: stored.pagesFetched,
    hasSupplyReducingAbiPath: stored.hasSupplyReducingAbiPath,
    decimals: stored.decimals,
  });
  return {
    burnActivity,
    supplyReduction,
    supplyReductionVerified: supplyReductionTriState(supplyReduction),
    stored,
  };
}

export async function loadBurnHistory(
  address: string,
): Promise<StoredBurnHistory | null> {
  const key = cacheKey(address);
  const mem = memory.get(key);
  if (mem && isBurnHistoryUsableStale(mem)) return mem;
  const fromKv = await kvGet(key);
  if (fromKv && isBurnHistoryUsableStale(fromKv)) {
    memory.set(key, fromKv);
    return fromKv;
  }
  return mem && isBurnHistoryUsableStale(mem) ? mem : fromKv;
}

export async function persistBurnHistory(
  stored: StoredBurnHistory,
): Promise<void> {
  const key = cacheKey(stored.address);
  memory.set(key, stored);
  await kvSet(key, stored);
}

/**
 * Build / merge burn history from an already-fetched transfer index (zero extra
 * Blockscout pagination — used inside scanToken alongside Creator Behaviour).
 */
export function buildBurnHistoryFromTransferIndex(input: {
  address: string;
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  decimals: number | null;
  hasSupplyReducingAbiPath: boolean;
  prior?: StoredBurnHistory | null;
}): BurnHistoryBundle {
  const extracted = extractBurnEventsFromTransfers(input.transfers);
  const burns = input.prior
    ? mergeBurnEvents(input.prior.burns, extracted.burns)
    : extracted.burns;

  const headTimestampMs =
    extracted.newestIndexedMs != null
      ? extracted.newestIndexedMs
      : (input.prior?.headTimestampMs ?? null);

  // Oldest: prefer deepest coverage (min of prior + this fetch)
  let oldestIndexedMs = extracted.oldestIndexedMs;
  if (input.prior?.oldestIndexedMs != null) {
    oldestIndexedMs =
      oldestIndexedMs == null
        ? input.prior.oldestIndexedMs
        : Math.min(oldestIndexedMs, input.prior.oldestIndexedMs);
  }

  const allTimeComplete =
    input.paginationComplete || Boolean(input.prior?.allTimeComplete);

  const stored: StoredBurnHistory = {
    version: 1,
    chainId: SCAN_CHAIN_ID,
    address: getAddress(input.address),
    updatedAt: Date.now(),
    headTimestampMs,
    oldestIndexedMs,
    paginationComplete: input.paginationComplete,
    fetchFailed: input.fetchFailed,
    pagesFetched: Math.max(input.pagesFetched, input.prior?.pagesFetched ?? 0),
    transfersIndexed: Math.max(
      input.transfers.length,
      input.prior?.transfersIndexed ?? 0,
    ),
    burns,
    allTimeComplete,
    hasSupplyReducingAbiPath: input.hasSupplyReducingAbiPath,
    decimals: input.decimals,
  };

  return bundleFromStored(stored);
}

/**
 * Incremental head refresh: page from newest until prior head cursor, then merge.
 * Does not re-scan from genesis when prior history exists.
 */
export async function refreshBurnHistoryIncremental(input: {
  address: string;
  decimals: number | null;
  hasSupplyReducingAbiPath: boolean;
  maxPages?: number;
  prior?: StoredBurnHistory | null;
}): Promise<BurnHistoryBundle> {
  const key = cacheKey(input.address);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const owned = await acquireLock(key);
    if (!owned) {
      const prior =
        input.prior ?? memory.get(key) ?? (await kvGet(key));
      if (prior) return bundleFromStored(prior);
      return {
        burnActivity: emptyBurnActivityHistory(
          "Burn index in progress — Incomplete.",
        ),
        supplyReduction: emptySupplyReductionHistory(
          "Burn index in progress — supply reduction Unknown.",
        ),
        supplyReductionVerified: "unknown" as TriState,
        stored: {
          version: 1 as const,
          chainId: SCAN_CHAIN_ID,
          address: getAddress(input.address),
          updatedAt: Date.now(),
          headTimestampMs: null,
          oldestIndexedMs: null,
          paginationComplete: false,
          fetchFailed: false,
          pagesFetched: 0,
          transfersIndexed: 0,
          burns: [],
          allTimeComplete: false,
          hasSupplyReducingAbiPath: input.hasSupplyReducingAbiPath,
          decimals: input.decimals,
        },
      };
    }
    try {
      const prior =
        input.prior ?? memory.get(key) ?? (await kvGet(key)) ?? null;
      const maxPages = input.maxPages ?? (prior?.headTimestampMs != null ? 5 : 40);
      const page = await fetchTokenTransfersPaged(input.address, {
        maxPages,
        stopAtOrBeforeTimestampMs: prior?.headTimestampMs ?? undefined,
      });
      const bundle = buildBurnHistoryFromTransferIndex({
        address: input.address,
        transfers: page.transfers,
        pagesFetched: page.pagesFetched,
        paginationComplete: page.paginationComplete,
        fetchFailed: page.fetchFailed,
        decimals: input.decimals,
        hasSupplyReducingAbiPath: input.hasSupplyReducingAbiPath,
        prior,
      });
      await persistBurnHistory(bundle.stored);
      return bundle;
    } finally {
      await releaseLock(key);
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** Persist transfer-index-derived history (called from scanToken — no extra fetch). */
export async function upsertBurnHistoryFromScan(input: {
  address: string;
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  decimals: number | null;
  hasSupplyReducingAbiPath: boolean;
}): Promise<BurnHistoryBundle> {
  const key = cacheKey(input.address);
  const prior = memory.get(key) ?? (await kvGet(key));
  const bundle = buildBurnHistoryFromTransferIndex({
    ...input,
    prior,
  });
  await persistBurnHistory(bundle.stored);
  return bundle;
}

export function attachBurnHistoryToSupplyBurn(
  base: SupplyBurnIntelligence,
  bundle: BurnHistoryBundle,
): SupplyBurnIntelligence {
  const notes = [...base.dataCompletenessNotes];
  // Drop P0/P1 placeholders about missing P2/P3
  const filtered = notes.filter(
    (n) =>
      !n.includes("Burned 24H/7D/all-time not computed") &&
      !n.includes("Unknown in P0/P1"),
  );
  filtered.push(
    "P2: Burned windows count only verifiable transfers into allowlisted dead/burn addresses.",
  );
  filtered.push(bundle.supplyReduction.note);
  for (const w of bundle.burnActivity.windows) {
    if (w.completeness !== "complete") {
      filtered.push(`${w.window}: ${w.note}`);
    }
  }

  const findings = [...base.findings];
  if (
    bundle.supplyReduction.historicalReductionStatus === "partial" &&
    !findings.some((f) => f.code === "supply_reduction_partial")
  ) {
    findings.push({
      code: "supply_reduction_partial",
      severity: "info",
      message: bundle.supplyReduction.note,
      source: "transfer_index",
    });
  }

  return {
    ...base,
    burnActivity: bundle.burnActivity,
    supplyReduction: bundle.supplyReduction,
    supplyReductionVerified: bundle.supplyReductionVerified,
    findings,
    dataCompletenessNotes: filtered,
  };
}

/**
 * Non-blocking: if burn history is stale, refresh incrementally in background.
 * Callers should already have attached the latest cached history to the response.
 */
export function scheduleBurnHistoryBackgroundRefresh(input: {
  address: string;
  decimals: number | null;
  hasSupplyReducingAbiPath: boolean;
}): void {
  const key = cacheKey(input.address);
  if (backgroundRefresh.has(key) || inflight.has(key)) return;
  const mem = memory.get(key);
  if (mem && isBurnHistoryFresh(mem)) return;
  backgroundRefresh.add(key);
  void refreshBurnHistoryIncremental({
    address: input.address,
    decimals: input.decimals,
    hasSupplyReducingAbiPath: input.hasSupplyReducingAbiPath,
    prior: mem,
  })
    .catch((err) => {
      console.warn("[burn-cache] background refresh failed:", err);
    })
    .finally(() => {
      backgroundRefresh.delete(key);
    });
}

/** Peek cached burn bundle without network. */
export async function peekBurnHistoryBundle(
  address: string,
): Promise<BurnHistoryBundle | null> {
  const stored = await loadBurnHistory(address);
  if (!stored) return null;
  return bundleFromStored(stored);
}
