import { getAddress } from "viem";
import { BURN_ADDRESSES } from "@/lib/hansome-score/constants";
import { formatTokenAmount } from "@/lib/hansome-score/rpc";
import type { BlockscoutTokenTransferRow } from "@/lib/hansome-score/blockscout";
import type {
  BurnActivityHistory,
  BurnActivityWindow,
  BurnActivityWindowId,
  BurnInflowEvent,
  BurnWindowCompleteness,
  HistoricalReductionStatus,
  SupplyReductionHistory,
  TriState,
} from "@/lib/hansome-score/supply-burn/types";

const ZERO = "0x0000000000000000000000000000000000000000";
const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;
const MS_30D = 30 * MS_24H;

const WINDOW_MS: Record<Exclude<BurnActivityWindowId, "all">, number> = {
  "24h": MS_24H,
  "7d": MS_7D,
  "30d": MS_30D,
};

export function isAllowlistedBurnAddress(address: string): boolean {
  try {
    return BURN_ADDRESSES.has(getAddress(address).toLowerCase());
  } catch {
    return BURN_ADDRESSES.has(address.toLowerCase());
  }
}

/** Method names that indicate a supply-reducing burn call (not a plain transfer to dead). */
export function isSupplyReducingBurnMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  const m = method.trim().toLowerCase();
  if (!m) return false;
  // Exact / prefix common OpenZeppelin + custom burn entrypoints
  if (m === "burn" || m === "burnfrom" || m === "burntoken" || m === "burntokens") {
    return true;
  }
  if (m.startsWith("burn(") || m.startsWith("burnfrom(")) return true;
  // Avoid matching "burned" labels / unrelated methods
  if (/^burn[_]/i.test(m)) return true;
  return false;
}

/**
 * P3 classification: Transfer into the zero address via a burn method,
 * from a non-zero sender. Sends to 0xdead are dead-inventory only — never supply reduction.
 * Does NOT infer reduction from dead balances alone.
 */
export function isProvenSupplyReducingTransfer(row: {
  from: string;
  to: string;
  method: string | null;
}): boolean {
  let toLc: string;
  let fromLc: string;
  try {
    toLc = getAddress(row.to).toLowerCase();
    fromLc = getAddress(row.from).toLowerCase();
  } catch {
    toLc = row.to.toLowerCase();
    fromLc = row.from.toLowerCase();
  }
  if (fromLc === ZERO) return false; // mint / from-zero accounting
  if (toLc !== ZERO) return false; // 0xdead and others are not proven supply burns
  return isSupplyReducingBurnMethod(row.method);
}

export function parseTransferTimestampMs(
  timestamp: string | null | undefined,
): number | null {
  if (!timestamp) return null;
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : null;
}

export function transferRowToBurnEvent(
  row: BlockscoutTokenTransferRow,
): BurnInflowEvent | null {
  if (!isAllowlistedBurnAddress(row.to)) return null;
  // Never count mint-from-zero dust as a "burn inflow"
  try {
    if (getAddress(row.from).toLowerCase() === ZERO) return null;
  } catch {
    if (row.from.toLowerCase() === ZERO) return null;
  }
  let value: bigint;
  try {
    value = BigInt(row.valueRaw || "0");
  } catch {
    return null;
  }
  if (value <= 0n) return null;
  return {
    timestamp: row.timestamp,
    timestampMs: parseTransferTimestampMs(row.timestamp),
    valueRaw: value.toString(),
    txHash: row.txHash,
    to: row.to,
    from: row.from,
    method: row.method,
    supplyReducing: isProvenSupplyReducingTransfer(row),
  };
}

export type TransferIndexInput = {
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
};

/**
 * Completeness for a time window when Blockscout returns newest-first pages.
 * Complete iff the index covers the entire window (reached genesis, or oldest
 * indexed transfer is at/before the window start). Never treat partial sums as full.
 */
export function windowCompleteness(input: {
  windowStartMs: number | null; // null = all-time
  oldestIndexedMs: number | null;
  newestIndexedMs: number | null;
  paginationComplete: boolean;
  fetchFailed: boolean;
  pagesFetched: number;
  nowMs: number;
}): BurnWindowCompleteness {
  if (input.fetchFailed && input.pagesFetched === 0) return "unknown";
  if (input.pagesFetched === 0 && !input.paginationComplete) return "unknown";

  // All-time requires exhausting pagination
  if (input.windowStartMs == null) {
    return input.paginationComplete ? "complete" : "incomplete";
  }

  if (input.paginationComplete) return "complete";

  // Newest-first: if oldest indexed row is older than window start, window is covered
  if (
    input.oldestIndexedMs != null &&
    input.oldestIndexedMs <= input.windowStartMs
  ) {
    return "complete";
  }

  // Head indexed but did not reach window floor
  return "incomplete";
}

function sumBurnsInRange(
  burns: BurnInflowEvent[],
  startMs: number | null,
  endMs: number,
): bigint {
  let sum = 0n;
  for (const b of burns) {
    if (b.timestampMs == null) continue;
    if (b.timestampMs > endMs) continue;
    if (startMs != null && b.timestampMs < startMs) continue;
    try {
      sum += BigInt(b.valueRaw);
    } catch {
      /* skip bad */
    }
  }
  return sum;
}

function buildWindow(
  id: BurnActivityWindowId,
  burns: BurnInflowEvent[],
  completeness: BurnWindowCompleteness,
  decimals: number | null,
  nowMs: number,
): BurnActivityWindow {
  const startMs =
    id === "all" ? null : nowMs - WINDOW_MS[id as Exclude<BurnActivityWindowId, "all">];

  if (completeness !== "complete") {
    return {
      window: id,
      burnedToDeadRaw: null,
      burnedToDeadFormatted: null,
      completeness,
      note:
        completeness === "unknown"
          ? "Transfer index unavailable — window Unknown."
          : "Transfer index incomplete for this window — Unknown / Incomplete (not a partial total).",
    };
  }

  const raw = sumBurnsInRange(burns, startMs, nowMs);
  return {
    window: id,
    burnedToDeadRaw: raw.toString(),
    burnedToDeadFormatted: formatTokenAmount(raw, decimals),
    completeness: "complete",
    note:
      id === "all"
        ? "All-time known burn inflows to allowlisted dead addresses (complete index)."
        : `Allowlisted dead-address inflows for ${id} (window fully covered by transfer index).`,
  };
}

export function computeBurnActivityHistory(input: {
  burns: BurnInflowEvent[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  transfersIndexed: number;
  oldestIndexedMs: number | null;
  newestIndexedMs: number | null;
  decimals: number | null;
  nowMs?: number;
  source?: BurnActivityHistory["source"];
}): BurnActivityHistory {
  const nowMs = input.nowMs ?? Date.now();
  const headIndexed =
    !input.fetchFailed &&
    (input.pagesFetched > 0 || input.paginationComplete);

  const windows: BurnActivityWindow[] = (
    ["24h", "7d", "30d", "all"] as BurnActivityWindowId[]
  ).map((id) => {
    const startMs =
      id === "all" ? null : nowMs - WINDOW_MS[id as Exclude<BurnActivityWindowId, "all">];
    const completeness = windowCompleteness({
      windowStartMs: startMs,
      oldestIndexedMs: input.oldestIndexedMs,
      newestIndexedMs: input.newestIndexedMs,
      paginationComplete: input.paginationComplete,
      fetchFailed: input.fetchFailed,
      pagesFetched: input.pagesFetched,
      nowMs,
    });
    return buildWindow(id, input.burns, completeness, input.decimals, nowMs);
  });

  // Last burn: reliable when head was indexed (newest-first). Among indexed burns, take max ts.
  let lastBurnAt: string | null = null;
  if (headIndexed) {
    let bestMs = -1;
    let bestIso: string | null = null;
    for (const b of input.burns) {
      if (b.timestampMs == null) continue;
      if (b.timestampMs > bestMs) {
        bestMs = b.timestampMs;
        bestIso = b.timestamp;
      }
    }
    // If all-time complete and no burns → null ("never" / none). If incomplete and none found → null
    // with note that older burns may exist — UI treats null + incomplete all-time as Unknown for last burn
    // only when we also lack head? With head indexed and no burns in pages covering recent history,
    // last burn is either older than oldest indexed or never. Prefer:
    // - complete all-time + none → null (no burns)
    // - incomplete + none → null but UI shows Unknown for last burn
    lastBurnAt = bestIso;
  }

  const burnTransactionCount = input.paginationComplete
    ? new Set(
        input.burns
          .map((b) => b.txHash?.toLowerCase())
          .filter((h): h is string => Boolean(h)),
      ).size || input.burns.length
    : null;

  return {
    lastBurnAt,
    burnTransactionCount,
    windows,
    headIndexed,
    pagesFetched: input.pagesFetched,
    transfersIndexed: input.transfersIndexed,
    paginationComplete: input.paginationComplete,
    fetchFailed: input.fetchFailed,
    source: input.source ?? "transfer_index",
  };
}

export function computeSupplyReductionHistory(input: {
  burns: BurnInflowEvent[];
  paginationComplete: boolean;
  fetchFailed: boolean;
  pagesFetched: number;
  /** ABI/source indicates a supply-reducing burn path exists. */
  hasSupplyReducingAbiPath: boolean;
  decimals: number | null;
}): SupplyReductionHistory {
  if (input.fetchFailed && input.pagesFetched === 0) {
    return {
      provenSupplyReductionRaw: null,
      provenSupplyReductionFormatted: null,
      historicalReductionStatus: "unknown",
      provenBurnEventCount: null,
      note: "Transfer index unavailable — cannot prove totalSupply reduction.",
    };
  }

  const reducing = input.burns.filter((b) => b.supplyReducing);
  let proven = 0n;
  for (const b of reducing) {
    try {
      proven += BigInt(b.valueRaw);
    } catch {
      /* skip */
    }
  }

  let status: HistoricalReductionStatus = "unknown";
  let note: string;

  if (proven > 0n && input.paginationComplete) {
    status = "verified";
    note =
      "Proven supply reduction from burn-method Transfers to the zero address (complete index). Not inferred from dead-address balances.";
  } else if (proven > 0n && !input.paginationComplete) {
    status = "partial";
    note =
      "Partial lower-bound of burn-method Transfers to zero — transfer index incomplete. Not a full totalSupply reduction total.";
  } else if (
    proven === 0n &&
    input.paginationComplete &&
    input.hasSupplyReducingAbiPath
  ) {
    status = "verified";
    note =
      "Complete transfer index with supply-reducing burn ABI path — no burn-method-to-zero events observed (proven reduction = 0). Dead-address inventory is separate.";
  } else if (!input.hasSupplyReducingAbiPath && proven === 0n) {
    status = "unknown";
    note =
      "No verifiable totalSupply reduction evidence. Dead-address inventory alone never proves supply reduction.";
  } else {
    status = "unknown";
    note =
      "Supply-reducing burn path may exist, but the transfer index is incomplete and no burn-method-to-zero events were observed yet.";
  }

  if (status === "unknown") {
    return {
      provenSupplyReductionRaw: null,
      provenSupplyReductionFormatted: null,
      historicalReductionStatus: "unknown",
      provenBurnEventCount: null,
      note,
    };
  }

  return {
    provenSupplyReductionRaw: proven.toString(),
    provenSupplyReductionFormatted: formatTokenAmount(proven, input.decimals),
    historicalReductionStatus: status,
    provenBurnEventCount: reducing.length,
    note,
  };
}

export function supplyReductionTriState(
  history: SupplyReductionHistory,
): TriState {
  if (history.historicalReductionStatus === "verified") {
    if (
      history.provenSupplyReductionRaw != null &&
      BigInt(history.provenSupplyReductionRaw) > 0n
    ) {
      return "yes";
    }
    if (
      history.provenSupplyReductionRaw != null &&
      BigInt(history.provenSupplyReductionRaw) === 0n
    ) {
      return "no";
    }
  }
  return "unknown";
}

/** Extract burn events + index bounds from a Blockscout transfer page set. */
export function extractBurnEventsFromTransfers(
  transfers: BlockscoutTokenTransferRow[],
): {
  burns: BurnInflowEvent[];
  oldestIndexedMs: number | null;
  newestIndexedMs: number | null;
} {
  const burns: BurnInflowEvent[] = [];
  let oldest: number | null = null;
  let newest: number | null = null;
  for (const row of transfers) {
    const ms = parseTransferTimestampMs(row.timestamp);
    if (ms != null) {
      if (oldest == null || ms < oldest) oldest = ms;
      if (newest == null || ms > newest) newest = ms;
    }
    const ev = transferRowToBurnEvent(row);
    if (ev) burns.push(ev);
  }
  return { burns, oldestIndexedMs: oldest, newestIndexedMs: newest };
}

export function emptyBurnActivityHistory(
  reason = "Burn activity not indexed on this path.",
): BurnActivityHistory {
  const incompleteWindow = (window: BurnActivityWindowId): BurnActivityWindow => ({
    window,
    burnedToDeadRaw: null,
    burnedToDeadFormatted: null,
    completeness: "unknown",
    note: reason,
  });
  return {
    lastBurnAt: null,
    burnTransactionCount: null,
    windows: [
      incompleteWindow("24h"),
      incompleteWindow("7d"),
      incompleteWindow("30d"),
      incompleteWindow("all"),
    ],
    headIndexed: false,
    pagesFetched: 0,
    transfersIndexed: 0,
    paginationComplete: false,
    fetchFailed: false,
    source: "none",
  };
}

export function emptySupplyReductionHistory(
  note = "Supply reduction not assessed on this path.",
): SupplyReductionHistory {
  return {
    provenSupplyReductionRaw: null,
    provenSupplyReductionFormatted: null,
    historicalReductionStatus: "unknown",
    provenBurnEventCount: null,
    note,
  };
}

/** Merge two burn event lists by txHash+value+to (dedupe). */
export function mergeBurnEvents(
  prior: BurnInflowEvent[],
  newer: BurnInflowEvent[],
): BurnInflowEvent[] {
  const key = (e: BurnInflowEvent) =>
    `${(e.txHash ?? "").toLowerCase()}|${e.to.toLowerCase()}|${e.valueRaw}|${e.from.toLowerCase()}`;
  const map = new Map<string, BurnInflowEvent>();
  for (const e of [...prior, ...newer]) {
    map.set(key(e), e);
  }
  return [...map.values()].sort(
    (a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0),
  );
}
