import { GECKO_TERMINAL_POOL_API } from "@/lib/market/constants";

type GeckoTxWindow = {
  buys: number | null;
  sells: number | null;
  buyers: number | null;
  sellers: number | null;
};

type GeckoPoolAttributes = {
  quote_token_price_usd: string;
  quote_token_price_native_currency: string;
  pool_name: string;
  price_change_percentage: Record<string, string>;
  volume_usd: Record<string, string>;
  reserve_in_usd: string;
  transactions: Record<string, GeckoTxWindow>;
};

type GeckoPoolResponse = {
  data: {
    attributes: GeckoPoolAttributes;
  };
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
  const response = await fetch(GECKO_TERMINAL_POOL_API, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GeckoTerminal HTTP ${response.status}`);
  }

  const json = (await response.json()) as GeckoPoolResponse;
  const attrs = json.data?.attributes;

  if (!attrs) {
    throw new Error("GeckoTerminal response missing pool attributes");
  }

  const priceUsd = parseNum(attrs.quote_token_price_usd);
  const priceEth = parseNum(attrs.quote_token_price_native_currency);

  if (priceUsd <= 0) {
    throw new Error("GeckoTerminal returned invalid UGLY price");
  }

  const changeRaw = attrs.price_change_percentage?.h24;
  const changeParsed = changeRaw !== undefined ? Number(changeRaw) : NaN;
  const change24h = Number.isFinite(changeParsed) ? changeParsed : null;

  return {
    updatedAt: Date.now(),
    poolName: attrs.pool_name ?? "WETH / UGLY",
    priceUsd,
    priceEth,
    change24h,
    volume24hUsd: parseNum(attrs.volume_usd?.h24),
    liquidityUsd: parseNum(attrs.reserve_in_usd),
    transactions24h: parseTxWindow(attrs.transactions?.h24),
  };
}
