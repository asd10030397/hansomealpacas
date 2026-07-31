import { BLOCKSCOUT_BASE } from "@/lib/hansome-score/constants";
import { withRpcTiming } from "@/lib/hansome-score/critical-path-profiler";

export type BlockscoutHolder = {
  address: string;
  value: string;
};

export type BlockscoutTokenInfo = {
  name: string | null;
  symbol: string | null;
  decimals: string | null;
  totalSupply: string | null;
  holdersCount: number | null;
};

export type BlockscoutAddressInfo = {
  creator: string | null;
  creationTxHash: string | null;
  isContract: boolean | null;
  name: string | null;
};

/** Per-request timeout — prevents one hung explorer call from stalling Deep forever. */
export const BLOCKSCOUT_FETCH_TIMEOUT_MS = 12_000;
/** Bounded retries with exponential backoff + jitter (429 / transient network). */
export const BLOCKSCOUT_FETCH_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = 400 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(8_000, base + jitter);
}

function mergeAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => s != null);
  if (list.length === 0) return AbortSignal.timeout(BLOCKSCOUT_FETCH_TIMEOUT_MS);
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([
      AbortSignal.timeout(BLOCKSCOUT_FETCH_TIMEOUT_MS),
      ...list,
    ]);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), BLOCKSCOUT_FETCH_TIMEOUT_MS);
  for (const s of list) {
    if (s.aborted) {
      clearTimeout(timer);
      ac.abort();
      return ac.signal;
    }
    s.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        ac.abort();
      },
      { once: true },
    );
  }
  ac.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return ac.signal;
}

async function getJson<T>(
  url: string,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const path = (() => {
    try {
      return new URL(url).pathname.slice(0, 80);
    } catch {
      return "blockscout";
    }
  })();
  return withRpcTiming("blockscout", path, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < BLOCKSCOUT_FETCH_MAX_ATTEMPTS; attempt++) {
      if (opts?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
          cache: "no-store",
          next: { revalidate: 0 },
          signal: mergeAbortSignals(opts?.signal),
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`Blockscout HTTP ${res.status} for ${url}`);
          if (attempt < BLOCKSCOUT_FETCH_MAX_ATTEMPTS - 1) {
            await sleep(backoffMs(attempt));
            continue;
          }
          throw lastErr;
        }
        if (!res.ok) {
          throw new Error(`Blockscout HTTP ${res.status} for ${url}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        const msg = String((err as Error)?.name || (err as Error)?.message || err);
        const retryable =
          /AbortError|TimeoutError|timeout|ECONNRESET|ETIMEDOUT|fetch failed|HTTP 429|HTTP 5\d\d/i.test(
            msg,
          );
        if (!retryable || attempt >= BLOCKSCOUT_FETCH_MAX_ATTEMPTS - 1) {
          throw err;
        }
        await sleep(backoffMs(attempt));
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`Blockscout fetch failed for ${url}`);
  });
}

export async function fetchBlockscoutToken(
  address: string,
): Promise<BlockscoutTokenInfo> {
  const data = await getJson<{
    name?: string;
    symbol?: string;
    decimals?: string;
    total_supply?: string;
    holders_count?: string | number;
  }>(`${BLOCKSCOUT_BASE}/api/v2/tokens/${address}`);

  const holdersRaw = data.holders_count;
  const holdersCount =
    holdersRaw === undefined || holdersRaw === null
      ? null
      : Number(holdersRaw);

  return {
    name: data.name ?? null,
    symbol: data.symbol ?? null,
    decimals: data.decimals ?? null,
    totalSupply: data.total_supply ?? null,
    holdersCount: Number.isFinite(holdersCount) ? holdersCount : null,
  };
}

export async function fetchBlockscoutCounters(address: string): Promise<{
  holdersCount: number | null;
  transfersCount: number | null;
}> {
  try {
    const data = await getJson<{
      token_holders_count?: string | number;
      transfers_count?: string | number;
    }>(`${BLOCKSCOUT_BASE}/api/v2/tokens/${address}/counters`);
    const holders = Number(data.token_holders_count);
    const transfers = Number(data.transfers_count);
    return {
      holdersCount: Number.isFinite(holders) ? holders : null,
      transfersCount: Number.isFinite(transfers) ? transfers : null,
    };
  } catch {
    return { holdersCount: null, transfersCount: null };
  }
}

export async function fetchBlockscoutHolders(
  address: string,
): Promise<BlockscoutHolder[]> {
  const data = await getJson<{
    items?: Array<{
      address?: { hash?: string };
      value?: string;
    }>;
  }>(`${BLOCKSCOUT_BASE}/api/v2/tokens/${address}/holders`);

  return (data.items ?? [])
    .map((item) => ({
      address: item.address?.hash ?? "",
      value: item.value ?? "0",
    }))
    .filter((h) => /^0x[a-fA-F0-9]{40}$/.test(h.address));
}

export async function fetchBlockscoutAddress(
  address: string,
): Promise<BlockscoutAddressInfo> {
  const data = await getJson<{
    creator_address_hash?: string | null;
    creation_transaction_hash?: string | null;
    is_contract?: boolean;
    name?: string | null;
  }>(`${BLOCKSCOUT_BASE}/api/v2/addresses/${address}`);

  return {
    creator: data.creator_address_hash ?? null,
    creationTxHash: data.creation_transaction_hash ?? null,
    isContract: data.is_contract ?? null,
    name: data.name ?? null,
  };
}

export async function fetchBlockscoutVerified(address: string): Promise<boolean | null> {
  try {
    const data = await getJson<{ is_verified?: boolean; verified?: boolean }>(
      `${BLOCKSCOUT_BASE}/api/v2/smart-contracts/${address}`,
    );
    if (typeof data.is_verified === "boolean") return data.is_verified;
    if (typeof data.verified === "boolean") return data.verified;
    // Endpoint 200 with ABI/source typically means verified
    return true;
  } catch {
    return null;
  }
}

export async function fetchCreationTimestampDays(
  txHash: string | null,
): Promise<number | null> {
  if (!txHash) return null;
  try {
    const data = await getJson<{ timestamp?: string }>(
      `${BLOCKSCOUT_BASE}/api/v2/transactions/${txHash}`,
    );
    if (!data.timestamp) return null;
    const created = new Date(data.timestamp).getTime();
    if (!Number.isFinite(created)) return null;
    return (Date.now() - created) / (24 * 60 * 60 * 1000);
  } catch {
    return null;
  }
}

export type BlockscoutSmartContract = {
  isVerified: boolean;
  abi: unknown[] | null;
  /** Primary contract source only (prefer for tax/honeypot heuristics). */
  sourceCode: string | null;
  /** Primary + dependencies — use sparingly (OZ libs can false-positive). */
  fullSourceCode: string | null;
  name: string | null;
};

export async function fetchBlockscoutSmartContract(
  address: string,
): Promise<BlockscoutSmartContract> {
  try {
    const data = await getJson<{
      is_verified?: boolean;
      verified?: boolean;
      abi?: unknown[] | string | null;
      source_code?: string | null;
      additional_sources?: { source_code?: string }[];
      name?: string | null;
    }>(`${BLOCKSCOUT_BASE}/api/v2/smart-contracts/${address}`);

    const isVerified =
      typeof data.is_verified === "boolean"
        ? data.is_verified
        : typeof data.verified === "boolean"
          ? data.verified
          : true;

    let abi: unknown[] | null = null;
    if (Array.isArray(data.abi)) abi = data.abi;
    else if (typeof data.abi === "string") {
      try {
        const parsed = JSON.parse(data.abi) as unknown;
        if (Array.isArray(parsed)) abi = parsed;
      } catch {
        abi = null;
      }
    }

    const primary = data.source_code ?? null;
    const parts: string[] = [];
    if (primary) parts.push(primary);
    for (const s of data.additional_sources ?? []) {
      if (s.source_code) parts.push(s.source_code);
    }

    return {
      isVerified,
      abi,
      sourceCode: primary,
      fullSourceCode: parts.length ? parts.join("\n") : null,
      name: data.name ?? null,
    };
  } catch {
    return {
      isVerified: false,
      abi: null,
      sourceCode: null,
      fullSourceCode: null,
      name: null,
    };
  }
}

/** First native funding tx "from" for an address (probabilistic graph edge). */
export async function fetchNativeFunder(
  address: string,
  opts?: { signal?: AbortSignal },
): Promise<{ from: string; blockNumber: number | null } | null> {
  try {
    const data = await getJson<{
      items?: Array<{
        from?: { hash?: string };
        to?: { hash?: string };
        value?: string;
        block?: number | string;
        block_number?: number | string;
      }>;
    }>(
      `${BLOCKSCOUT_BASE}/api/v2/addresses/${address}/transactions?filter=to`,
      opts,
    );
    for (const item of data.items ?? []) {
      const value = item.value ?? "0";
      if (value === "0") continue;
      const from = item.from?.hash;
      if (!from) continue;
      const blockRaw = item.block_number ?? item.block;
      const blockNumber =
        blockRaw == null || blockRaw === "" ? null : Number(blockRaw);
      return {
        from,
        blockNumber: Number.isFinite(blockNumber) ? blockNumber : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Early token transfer recipients (first page) for same-block clustering. */
export async function fetchEarlyTokenTransfers(
  tokenAddress: string,
  opts?: { signal?: AbortSignal },
): Promise<Array<{ to: string; blockNumber: number }>> {
  try {
    const data = await getJson<{
      items?: Array<{
        to?: { hash?: string };
        block_number?: number | string;
        type?: string;
      }>;
    }>(`${BLOCKSCOUT_BASE}/api/v2/tokens/${tokenAddress}/transfers`, opts);

    const out: Array<{ to: string; blockNumber: number }> = [];
    for (const item of data.items ?? []) {
      const to = item.to?.hash;
      const block = Number(item.block_number);
      if (!to || !Number.isFinite(block)) continue;
      out.push({ to, blockNumber: block });
    }
    return out;
  } catch {
    return [];
  }
}

export type BlockscoutTokenTransferRow = {
  from: string;
  to: string;
  valueRaw: string;
  blockNumber: number | null;
  timestamp: string | null;
  txHash: string | null;
  toIsContract: boolean | null;
  method: string | null;
};

type NextPageParams = Record<string, string | number> | null | undefined;

function buildPagedUrl(base: string, params: NextPageParams): string {
  if (!params || Object.keys(params).length === 0) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export type FetchTokenTransfersPageEvent = {
  /** 1-based page index within this fetch call (not lifetime total). */
  pageInFetch: number;
  pageTransfers: BlockscoutTokenTransferRow[];
  /** Opaque Blockscout cursor for the *next* page (null if genesis exhausted). */
  nextPageParams: NextPageParams;
  /**
   * Params used to request *this* page (null = first page).
   * When `stoppedAtCursor`, historical continuation should resume from here
   * (re-fetch without stopAt) so boundary-page older rows are not skipped.
   */
  pageStartParams?: NextPageParams;
  paginationComplete: boolean;
  stoppedAtCursor: boolean;
};

/**
 * Paginate ERC-20 token transfers for creator-behaviour / burn-history indexing.
 * Completeness = exhausted next_page_params before maxPages.
 *
 * Optional `stopAtOrBeforeTimestampMs`: when set (incremental burn refresh),
 * stop once a page contains a transfer at/before that cursor (newest-first API).
 * That early stop does **not** set paginationComplete — only genesis exhaustion does.
 *
 * Optional `startNextPageParams`: resume from a checkpoint cursor (not page 1).
 * Optional `onPage`: invoked after each successful page (for incremental persist).
 * Optional `shouldContinue`: return false to stop early without marking complete.
 */
export async function fetchTokenTransfersPaged(
  tokenAddress: string,
  opts?: {
    maxPages?: number;
    stopAtOrBeforeTimestampMs?: number;
    startNextPageParams?: NextPageParams;
    onPage?: (event: FetchTokenTransfersPageEvent) => void | Promise<void>;
    shouldContinue?: () => boolean;
    signal?: AbortSignal;
  },
): Promise<{
  transfers: BlockscoutTokenTransferRow[];
  pagesFetched: number;
  paginationComplete: boolean;
  fetchFailed: boolean;
  stoppedAtCursor: boolean;
  /** Cursor to resume from if pagination not complete. */
  nextPageParams: NextPageParams;
  /**
   * When stoppedAtCursor (time/head stop mid-page), resume historical from this
   * page start (re-fetch without stopAt). Otherwise equals nextPageParams.
   */
  resumePageParams?: NextPageParams;
}> {
  const maxPages = opts?.maxPages ?? 40;
  const stopAt = opts?.stopAtOrBeforeTimestampMs;
  const base = `${BLOCKSCOUT_BASE}/api/v2/tokens/${tokenAddress}/transfers`;
  const transfers: BlockscoutTokenTransferRow[] = [];
  let pagesFetched = 0;
  let next: NextPageParams = opts?.startNextPageParams ?? null;
  let stoppedAtCursor = false;
  let lastPageStartParams: NextPageParams = opts?.startNextPageParams ?? null;

  try {
    while (pagesFetched < maxPages) {
      if (opts?.signal?.aborted) {
        return {
          transfers,
          pagesFetched,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor,
          nextPageParams: next ?? null,
          resumePageParams: next ?? null,
        };
      }
      if (opts?.shouldContinue && !opts.shouldContinue()) {
        return {
          transfers,
          pagesFetched,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor,
          nextPageParams: next ?? null,
          resumePageParams: next ?? null,
        };
      }

      const pageStartParams: NextPageParams = next ?? null;
      lastPageStartParams = pageStartParams;
      const url = buildPagedUrl(base, next);
      const data = await getJson<{
        items?: Array<{
          from?: { hash?: string; is_contract?: boolean };
          to?: { hash?: string; is_contract?: boolean };
          total?: { value?: string };
          block_number?: number | string;
          timestamp?: string;
          transaction_hash?: string;
          method?: string | null;
        }>;
        next_page_params?: NextPageParams;
      }>(url, { signal: opts?.signal });

      pagesFetched++;
      let hitCursor = false;
      const pageTransfers: BlockscoutTokenTransferRow[] = [];
      for (const item of data.items ?? []) {
        const from = item.from?.hash;
        const to = item.to?.hash;
        if (!from || !to) continue;
        const timestamp = item.timestamp ?? null;
        if (stopAt != null && timestamp) {
          const ms = Date.parse(timestamp);
          if (Number.isFinite(ms) && ms <= stopAt) {
            hitCursor = true;
            // Skip already-indexed rows at/before cursor
            continue;
          }
        }
        const row: BlockscoutTokenTransferRow = {
          from,
          to,
          valueRaw: item.total?.value ?? "0",
          blockNumber:
            item.block_number == null || item.block_number === ""
              ? null
              : Number(item.block_number),
          timestamp,
          txHash: item.transaction_hash ?? null,
          toIsContract:
            typeof item.to?.is_contract === "boolean" ? item.to.is_contract : null,
          method: item.method ?? null,
        };
        pageTransfers.push(row);
        transfers.push(row);
      }

      if (hitCursor) {
        stoppedAtCursor = true;
        if (opts?.onPage) {
          await opts.onPage({
            pageInFetch: pagesFetched,
            pageTransfers,
            nextPageParams: data.next_page_params ?? null,
            pageStartParams,
            paginationComplete: false,
            stoppedAtCursor: true,
          });
        }
        return {
          transfers,
          pagesFetched,
          paginationComplete: false,
          fetchFailed: false,
          stoppedAtCursor,
          // Next-page cursor skips boundary remainder — callers that need those
          // rows should use resumePageParams (re-fetch this page without stopAt).
          nextPageParams: data.next_page_params ?? null,
          resumePageParams: pageStartParams,
        };
      }

      next = data.next_page_params ?? null;
      if (opts?.onPage) {
        await opts.onPage({
          pageInFetch: pagesFetched,
          pageTransfers,
          nextPageParams: next ?? null,
          pageStartParams,
          paginationComplete: !next,
          stoppedAtCursor: false,
        });
      }
      if (!next) {
        return {
          transfers,
          pagesFetched,
          paginationComplete: true,
          fetchFailed: false,
          stoppedAtCursor: false,
          nextPageParams: null,
          resumePageParams: null,
        };
      }
    }

    return {
      transfers,
      pagesFetched,
      paginationComplete: false,
      fetchFailed: false,
      stoppedAtCursor,
      nextPageParams: next ?? null,
      resumePageParams: next ?? null,
    };
  } catch {
    return {
      transfers,
      pagesFetched,
      paginationComplete: false,
      fetchFailed: pagesFetched === 0,
      stoppedAtCursor,
      nextPageParams: next ?? null,
      resumePageParams: stoppedAtCursor
        ? lastPageStartParams
        : (next ?? null),
    };
  }
}

/** ERC-721 PositionManager token IDs currently held by an address. */
export async function fetchAddressPositionNftIds(
  ownerAddress: string,
  positionManager: string,
): Promise<bigint[]> {
  try {
    const data = await getJson<{
      items?: Array<{
        id?: string | number;
        token?: { address_hash?: string };
      }>;
    }>(`${BLOCKSCOUT_BASE}/api/v2/addresses/${ownerAddress}/nft?type=ERC-721`);

    const pm = positionManager.toLowerCase();
    const ids: bigint[] = [];
    for (const item of data.items ?? []) {
      const tokenAddr = item.token?.address_hash?.toLowerCase();
      if (tokenAddr !== pm) continue;
      if (item.id == null) continue;
      try {
        ids.push(BigInt(String(item.id)));
      } catch {
        /* skip */
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Recent PositionManager NFT mint/transfer token IDs (candidate discovery).
 * Callers must filter via getPoolAndPositionInfo for token involvement.
 */
export async function fetchRecentPositionManagerTokenIds(
  positionManager: string,
  opts?: { maxPages?: number },
): Promise<bigint[]> {
  const maxPages = opts?.maxPages ?? 8;
  const base = `${BLOCKSCOUT_BASE}/api/v2/tokens/${positionManager}/transfers`;
  const ids = new Set<string>();
  let next: NextPageParams = null;
  let pages = 0;

  try {
    while (pages < maxPages) {
      const url = buildPagedUrl(base, next);
      const data = await getJson<{
        items?: Array<{
          total?: { token_id?: string | number };
        }>;
        next_page_params?: NextPageParams;
      }>(url);
      pages++;
      for (const item of data.items ?? []) {
        const tid = item.total?.token_id;
        if (tid == null) continue;
        ids.add(String(tid));
      }
      next = data.next_page_params ?? null;
      if (!next) break;
    }
  } catch {
    /* return what we have */
  }

  const out: bigint[] = [];
  for (const id of ids) {
    try {
      out.push(BigInt(id));
    } catch {
      /* skip */
    }
  }
  return out;
}
