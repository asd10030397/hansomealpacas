import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Chain/pool identifiers below mirror the website's single source of
 * truth (lib/chain.ts + content/project.ts). They're kept as plain string
 * literals here — rather than imported — because lib/chain.ts pulls in
 * `viem`, which this standalone service does not depend on (it uses
 * ethers, per the bot's own requirements). Override any of them via env
 * vars if they ever drift from the website.
 */
const DEFAULTS = {
  CHAIN_ID: 4663,
  RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
  TOKEN_ADDRESS: "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875",
  POOL_ID: "0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d",
  POOL_MANAGER_ADDRESS: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  STATE_VIEW_ADDRESS: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  TOKEN_DECIMALS: 18,
  TOTAL_SUPPLY: 1_000_000_000,
  EXPLORER_BASE_URL: "https://robinhoodchain.blockscout.com",
  WEBSITE_URL: "https://hansomealpacas.xyz",
  DEXSCREENER_URL:
    "https://dexscreener.com/robinhood/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d",
} as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy bot/.env.example to bot/.env and fill it in.`,
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function optionalNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  telegram: {
    botToken: requireEnv("BOT_TOKEN"),
    chatId: requireEnv("CHAT_ID"),
    /**
     * Forum supergroups (chat.is_forum === true) organize messages into
     * topics. A message sent WITHOUT message_thread_id still succeeds
     * (ok: true) but lands in the "General" topic — which is easy to
     * silently deliver into while everyone actually watches a different,
     * named topic (e.g. "Trading Alerts"). Set this to post buy/sell
     * alerts into a specific topic instead. Find the id from that topic's
     * "Copy Link" in Telegram — the URL looks like
     * https://t.me/c/<internal_chat_id>/<thread_id> — the trailing number
     * is the thread id. Leave unset to use General.
     */
    messageThreadId: (() => {
      const raw = process.env.MESSAGE_THREAD_ID?.trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  },

  chain: {
    chainId: optionalNumberEnv("CHAIN_ID", DEFAULTS.CHAIN_ID),
    rpcUrl: optionalEnv("RPC_URL", DEFAULTS.RPC_URL),
    /** Only used if you have a paid provider that supports eth_subscribe over WSS. */
    wsRpcUrl: process.env.WS_RPC_URL?.trim() || null,
    tokenAddress: optionalEnv("TOKEN_ADDRESS", DEFAULTS.TOKEN_ADDRESS),
    poolId: optionalEnv("POOL_ID", DEFAULTS.POOL_ID).toLowerCase(),
    poolManagerAddress: optionalEnv("POOL_MANAGER_ADDRESS", DEFAULTS.POOL_MANAGER_ADDRESS),
    stateViewAddress: optionalEnv("STATE_VIEW_ADDRESS", DEFAULTS.STATE_VIEW_ADDRESS),
    tokenDecimals: optionalNumberEnv("TOKEN_DECIMALS", DEFAULTS.TOKEN_DECIMALS),
    totalSupply: optionalNumberEnv("TOTAL_SUPPLY", DEFAULTS.TOTAL_SUPPLY),
    explorerBaseUrl: optionalEnv("EXPLORER_BASE_URL", DEFAULTS.EXPLORER_BASE_URL).replace(/\/$/, ""),
  },

  links: {
    websiteUrl: optionalEnv("WEBSITE_URL", DEFAULTS.WEBSITE_URL).replace(/\/$/, ""),
    dexScreenerUrl: optionalEnv("DEXSCREENER_URL", DEFAULTS.DEXSCREENER_URL),
  },

  listener: {
    pollIntervalMs: optionalNumberEnv("POLL_INTERVAL_MS", 15_000),
    /** Max block range per getLogs call — keeps requests within public-RPC limits. */
    maxBlockRange: optionalNumberEnv("MAX_BLOCK_RANGE", 2_000),
    /** First-boot lookback if bot_state has no last_processed_block yet. */
    initialLookbackBlocks: optionalNumberEnv("INITIAL_LOOKBACK_BLOCKS", 500),
    /** Backoff cap for RPC error retries. */
    maxBackoffMs: optionalNumberEnv("MAX_BACKOFF_MS", 120_000),
    /** Per-request RPC timeout — ethers' own default (300s) is far too long for fast failure detection. */
    rpcTimeoutMs: optionalNumberEnv("RPC_TIMEOUT_MS", 20_000),
    /**
     * One-time historical backfill window (hours) run on first startup so
     * 24h stats (volume, largest buy/sell, buy/sell counts) are accurate
     * from the very first /status call, instead of only reflecting trades
     * observed after the bot happened to be started. Runs once — tracked
     * via bot_state.backfill_done — then the normal polling loop takes
     * over from where the backfill left off.
     */
    backfillHours: optionalNumberEnv("BACKFILL_HOURS", 24),
  },

  market: {
    ethUsdFallback: process.env.ETH_USD_FALLBACK?.trim() || "",
    geckoTerminalPoolApi: `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${optionalEnv(
      "POOL_ID",
      DEFAULTS.POOL_ID,
    )}`,
    cacheTtlMs: optionalNumberEnv("MARKET_CACHE_TTL_MS", 25_000),
  },

  database: {
    path: path.resolve(process.cwd(), optionalEnv("DATABASE_PATH", "./data/hansome-bot.sqlite")),
  },

  logLevel: optionalEnv("LOG_LEVEL", "info"),
} as const;

export type Config = typeof config;
