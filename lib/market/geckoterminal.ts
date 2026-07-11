import {
  GECKO_TERMINAL_POOL_API,
  GECKO_TERMINAL_POOL_ID,
  GECKO_TERMINAL_TOKEN_POOLS_API,
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GeckoTerminal HTTP ${response.status}`);
  }

  return (await response.json()) as T;
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

export async function fetchGeckoTerminalPoolStats(): Promise<GeckoMarketStats> {
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
