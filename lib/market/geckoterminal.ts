import {
  GECKO_TERMINAL_POOL_API,
  GECKO_TERMINAL_POOL_ID,
  GECKO_TERMINAL_TOKEN_POOLS_API,
  MARKET_CACHE_TTL_MS,
  TOKEN_ADDRESS,
} from "@/lib/market/constants";

type GeckoTxWindow = {
  buys: number | null;
  sells: number | null;
  buyers: number | null;
  sellers: number | null;
};

type GeckoPoolAttributes = {
  base_token_price_usd?: string;
  base_token_price_native_currency?: string;
  quote_token_price_usd?: string;
  quote_token_price_native_currency?: string;
  token_price_usd?: string;
  pool_name?: string;
  name?: string;
  address?: string;
  price_change_percentage?: Record<string, string>;
  volume_usd?: Record<string, string>;
  reserve_in_usd?: string;
  transactions?: Record<string, GeckoTxWindow>;
};

type GeckoTokenAttributes = {
  address?: string;
  symbol?: string;
};

type GeckoIncluded = {
  id: string;
  type: string;
  attributes: GeckoTokenAttributes;
};

type GeckoPoolResource = {
  attributes: GeckoPoolAttributes;
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
};

type GeckoPoolListResponse = {
  data: GeckoPoolResource[];
};

type GeckoPoolResponse = {
  data: GeckoPoolResource;
  included?: GeckoIncluded[];
};

function parseNum(value: string | undefined): number {
  if (value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTxWindow(raw: GeckoTxWindow | undefined): GeckoTxWindow | null {
  if (!raw) return null;
  return {
    buys: raw.buys ?? 0,
    sells: raw.sells ?? 0,
    buyers: raw.buyers ?? 0,
    sellers: raw.sellers ?? 0,
  };
}

function normalizeAddress(address: string | undefined): string {
  return (address ?? "").toLowerCase();
}

function findRelatedToken(
  pool: GeckoPoolResource,
  included: GeckoIncluded[] | undefined,
  role: "base_token" | "quote_token",
): GeckoTokenAttributes | null {
  const tokenId = pool.relationships?.[role]?.data?.id;
  if (!tokenId || !included?.length) return null;
  const match = included.find((item) => item.id === tokenId && item.type === "token");
  return match?.attributes ?? null;
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_FETCH_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 400;
const MAX_RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 (rate limit) and 5xx are transient — worth retrying. Other 4xx (bad url/pool) are not. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, response: Response | null): number {
  if (response?.status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return Math.min(retryAfterMs, MAX_RETRY_DELAY_MS);
    }
  }
  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.random() * BASE_RETRY_DELAY_MS;
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

type FetchAttempt<T> =
  | { ok: true; data: T }
  | { ok: false; retryable: boolean; error: Error; response: Response | null };

async function attemptFetchJson<T>(url: string): Promise<FetchAttempt<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.ok) {
      return { ok: true, data: (await response.json()) as T };
    }

    return {
      ok: false,
      retryable: isRetryableStatus(response.status),
      error: new Error(`GeckoTerminal HTTP ${response.status}`),
      response,
    };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      retryable: true, // network errors / timeouts are always worth a retry
      error: isAbort
        ? new Error("GeckoTerminal request timed out")
        : error instanceof Error
          ? error
          : new Error("GeckoTerminal request failed"),
      response: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * fetch with a hard timeout plus retry/backoff for transient failures
 * (429 rate limiting, 5xx, network errors, timeouts). Non-retryable 4xx
 * fail immediately — retrying those would never succeed.
 */
async function fetchJson<T>(url: string): Promise<T> {
  let lastError = new Error("GeckoTerminal request failed");

  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    const result = await attemptFetchJson<T>(url);
    if (result.ok) {
      return result.data;
    }

    lastError = result.error;
    const isLastAttempt = attempt === MAX_FETCH_ATTEMPTS - 1;
    if (!result.retryable || isLastAttempt) {
      throw lastError;
    }

    const delay = retryDelayMs(attempt, result.response);
    console.warn(
      `[market] GeckoTerminal fetch failed (${result.error.message}), retrying ${attempt + 2}/${MAX_FETCH_ATTEMPTS} in ${delay}ms — ${url}`,
    );
    await sleep(delay);
  }

  throw lastError;
}

export type GeckoMarketStats = {
  updatedAt: number;
  poolName: string;
  priceUsd: number;
  priceEth: number;
  change24h: number | null;
  volume24hUsd: number;
  liquidityUsd: number;
  transactions24h: GeckoTxWindow | null;
};

let cachedStats: GeckoMarketStats | null = null;
let cachedAt = 0;

async function fetchFreshGeckoTerminalPoolStats(): Promise<GeckoMarketStats> {
  const [poolJson, tokenPoolsJson] = await Promise.all([
    fetchJson<GeckoPoolResponse>(GECKO_TERMINAL_POOL_API),
    fetchJson<GeckoPoolListResponse>(GECKO_TERMINAL_TOKEN_POOLS_API),
  ]);

  const attrs = poolJson.data?.attributes;
  if (!attrs) {
    throw new Error("GeckoTerminal response missing pool attributes");
  }

  // HANSOME can be either side of the pair depending on how GeckoTerminal
  // orders the pool (e.g. it may list HANSOME as base_token with WETH as
  // quote_token, or vice versa) — check both instead of assuming one side.
  const baseToken = findRelatedToken(poolJson.data, poolJson.included, "base_token");
  const quoteToken = findRelatedToken(poolJson.data, poolJson.included, "quote_token");
  const hansomeIsBase = normalizeAddress(baseToken?.address) === normalizeAddress(TOKEN_ADDRESS);
  const hansomeIsQuote = normalizeAddress(quoteToken?.address) === normalizeAddress(TOKEN_ADDRESS);

  if (!hansomeIsBase && !hansomeIsQuote) {
    throw new Error("GeckoTerminal pool does not contain the HANSOME token");
  }

  const tokenPool = tokenPoolsJson.data.find(
    (pool) => normalizeAddress(pool.attributes.address) === normalizeAddress(GECKO_TERMINAL_POOL_ID),
  );
  const tokenAttrs = tokenPool?.attributes;

  const priceUsd = hansomeIsBase
    ? parseNum(attrs.base_token_price_usd ?? tokenAttrs?.token_price_usd)
    : parseNum(attrs.quote_token_price_usd ?? tokenAttrs?.token_price_usd);
  const priceEth = hansomeIsBase
    ? parseNum(attrs.base_token_price_native_currency)
    : parseNum(attrs.quote_token_price_native_currency);

  if (priceUsd <= 0) {
    throw new Error("GeckoTerminal returned invalid HANSOME price");
  }

  const changeRaw = tokenAttrs?.price_change_percentage?.h24;
  const changeParsed = changeRaw !== undefined ? Number(changeRaw) : NaN;
  const change24h = Number.isFinite(changeParsed) ? changeParsed : null;

  return {
    updatedAt: Date.now(),
    poolName: attrs.pool_name ?? attrs.name ?? "WETH / HANSOME",
    priceUsd,
    priceEth,
    change24h,
    volume24hUsd: parseNum(attrs.volume_usd?.h24),
    liquidityUsd: parseNum(attrs.reserve_in_usd),
    transactions24h: parseTxWindow(tokenAttrs?.transactions?.h24 ?? attrs.transactions?.h24),
  };
}

/**
 * Cached, resilient entry point used by /api/market:
 *  - Serves the in-memory cache directly while it's still within TTL,
 *    so concurrent/rapid page loads share one GeckoTerminal call instead
 *    of each triggering their own (the main lever against 429s).
 *  - On a cache miss, fetches fresh data (with retry/backoff above).
 *  - If the fresh fetch fails (e.g. still rate-limited after retries) but
 *    we have any previously successful result, serve that stale result
 *    instead of failing the request — only throws if nothing has ever
 *    succeeded yet (e.g. right after a cold deploy).
 */
export async function fetchGeckoTerminalPoolStats(): Promise<GeckoMarketStats> {
  const now = Date.now();
  if (cachedStats && now - cachedAt < MARKET_CACHE_TTL_MS) {
    return cachedStats;
  }

  try {
    const fresh = await fetchFreshGeckoTerminalPoolStats();
    cachedStats = fresh;
    cachedAt = now;
    return fresh;
  } catch (error) {
    if (cachedStats) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(
        `[market] GeckoTerminal refresh failed (${message}) — serving last known-good data from ${new Date(cachedAt).toISOString()}`,
      );
      return cachedStats;
    }
    throw error;
  }
}
