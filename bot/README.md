# HANSOME ALPACAS — Telegram Buy/Sell Bot

A standalone Node.js/TypeScript service that watches the official
**$HANSOME / ETH Uniswap v4 pool** on Robinhood Chain directly on-chain
(via the singleton `PoolManager`'s `Swap` events) and posts live buy/sell
alerts to a Telegram group or channel. It also answers a handful of
Telegram commands (`/status`, `/stats`, `/price`, `/liquidity`, ...).

This is a **completely separate module** from the main website — it has
its own `package.json`, its own `tsconfig.json`, its own `.env`, and its
own SQLite database. It does not import from, depend on, or modify
`app/`, `lib/`, `components/`, or the root `package.json`/lockfile.

## Why on-chain and not a third-party API?

Uniswap v4 uses a single shared `PoolManager` contract for every pool
(unlike v2/v3, where each pool is its own contract). Third-party
bots/APIs built for v2/v3 often don't decode this correctly. This bot
listens directly to `PoolManager`'s `Swap` event, filtered to HANSOME's
specific Pool ID, and classifies buy vs. sell from the actual token flow
— it never depends on a third-party API to detect a trade. (GeckoTerminal
is used only for supplementary liquidity/volume context in messages and
commands — never for detecting or counting trades.)

## Architecture

```
src/
├── index.ts          entrypoint — wires everything together, graceful shutdown
├── config.ts         env loading + validation, all tunables in one place
├── logger.ts          leveled console logger
├── types.ts            shared TypeScript types
├── database.ts        SQLite schema/migrations + typed query helpers
├── listener.ts          polls PoolManager for Swap logs, resumable, auto-retry
├── parser.ts             decodes a raw Swap log -> ParsedSwap (direction, amounts, trader)
├── pricing.ts           on-chain spot price (sqrtPriceX96) -> USD, market cap
├── market.ts             GeckoTerminal liquidity/volume lookup (supplementary only)
├── holders.ts            new-holder check (on-chain) + best-effort total holders
├── stats.ts              orchestrates enrichment + persistence + snapshot reads
├── telegram.ts           Telegraf bot instance, message formatting, sending
├── commands.ts           /start /help /status /stats /price /liquidity
└── chain/
    ├── provider.ts        ethers JsonRpcProvider factory
    ├── poolManagerAbi.ts  Swap/Initialize event ABI
    ├── erc20Abi.ts         balanceOf/decimals ABI
    └── stateViewAbi.ts     getSlot0/getLiquidity ABI
```

**Blockchain logic and Telegram logic are isolated from each other.**
`telegram.ts` and `commands.ts` never import `ethers`, the database
driver, or anything chain-facing — they only receive plain data objects
already computed by `stats.ts`/`pricing.ts`/`market.ts`/`holders.ts`. You
can change the Telegram library, add a Discord adapter, or change how
prices are computed, without touching the other side.

A few small, framework-free files from the website's `lib/` are
**copied** (not imported) into `src/shared/` and `src/chain/`, with a
comment on each explaining why: importing them directly would pull in
the website's `@/` tsconfig path aliases and dependency tree, which this
standalone service intentionally does not depend on. If those website
files change, update the copies here to match.

## Requirements

- Node.js **>= 22.5** (uses the built-in `node:sqlite` module — no native
  compiler/build toolchain needed, unlike `better-sqlite3`).
- A Telegram bot token (from [@BotFather](https://t.me/BotFather)).

## Install

```bash
cd bot
npm install
```

## Deployment model: Railway (production) vs. local (dev/test only)

**Production runs on Railway**, independent of any developer's machine —
that's the only instance that should ever use the real `BOT_TOKEN` /
`CHAT_ID` / `MESSAGE_THREAD_ID` for the live HANSOME community group.

**Local `npm start` / `npm run dev` is for development and testing only.**
Do **not** point your local `.env` at the production bot token or the
production chat. Telegram's `getUpdates` long-polling only allows one
active consumer per bot token — if your local instance and the Railway
deployment both run with the same `BOT_TOKEN` at the same time, they will
fight over polling (commands intermittently fail) and, because each
keeps its own separate SQLite database, **both may independently detect
the same on-chain trade as "new" and send duplicate notifications** to
the real group.

Instead, for local dev/testing use:

- A **separate test bot** (create one with @BotFather — it's free and
  instant) for `BOT_TOKEN`.
- A **separate test group/channel** you control for `CHAT_ID` (add your
  test bot as admin there).

This way local runs never contend with Railway's long-polling and never
risk posting into the real community chat.

## Configure `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

- `BOT_TOKEN` — from @BotFather. **Locally, use a separate test bot** —
  see "Deployment model" above. Only the Railway deployment should use
  the production bot's token.
- `CHAT_ID` — the group/channel to post alerts to. **Locally, use a test
  group you control**, not the production community chat. For a public
  channel you can use `@yourchannel`. For a group or private channel, add
  the bot as admin, send a message, then check
  `https://api.telegram.org/bot<token>/getUpdates` for the numeric
  `chat.id` (often negative, e.g. `-1001234567890`).
- `MESSAGE_THREAD_ID` — only relevant if `CHAT_ID` is a forum supergroup
  (Topics enabled) and you want alerts in a specific topic rather than
  "General". See the comment in `.env.example` for how to find the real
  thread id (it's a live `message_thread_id` field, not a link's trailing
  message id — the two aren't the same thing in general).

Everything else (RPC URL, pool/token addresses, links, polling interval,
database path, log level) already has sensible defaults matching the
live HANSOME deployment — you only need to touch those if something
changes on-chain.

## Run locally

```bash
npm run build
npm start
```

Or for iterative development (auto-restarts on file changes):

```bash
npm run dev
```

On first boot the bot creates `data/hansome-bot.sqlite` (path
configurable via `DATABASE_PATH`), looks back
`INITIAL_LOOKBACK_BLOCKS` blocks (default 500) for any Swap logs it
missed, and then polls every `POLL_INTERVAL_MS` (default 15s) from there
on. Send `/start` or `/status` to the bot in Telegram to confirm it's
alive.

## Run continuously (PM2)

Not needed for this project's production bot — it runs on Railway, which
already keeps it alive across crashes/redeploys. This section is kept for
reference if you ever need to self-host outside Railway (e.g. a VPS).
[PM2](https://pm2.keymetrics.io/) keeps the process alive across crashes
and reboots.

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name hansome-buy-bot
pm2 save
pm2 logs hansome-buy-bot
```

To have PM2 restart the bot automatically after a server reboot:

```bash
pm2 startup
pm2 save
```

Common PM2 commands:

```bash
pm2 restart hansome-buy-bot   # after pulling code changes + npm run build
pm2 stop hansome-buy-bot
pm2 logs hansome-buy-bot --lines 200
```

## Reliability notes

- **Resumable, no duplicate notifications.** The last successfully
  processed block is persisted in SQLite (`bot_state.last_processed_block`)
  and only advances after a block range is fully handled. Every trade is
  also keyed by a unique `tx_hash`, so even if a block range is re-scanned
  after a crash or RPC hiccup, already-recorded trades are silently
  skipped instead of re-notified.
- **Automatic retry/backoff.** If a poll fails (RPC timeout, rate limit,
  etc.), the bot retries with exponential backoff (capped at
  `MAX_BACKOFF_MS`) without advancing its position. After 3 consecutive
  failures it also recreates the RPC provider instance, in case it's
  holding bad internal state.
- **WebSocket vs. polling.** Robinhood Chain's free public RPC (the
  default here — the same one the website uses) does not expose a
  standard `eth_subscribe` WebSocket for logs, only a low-level sequencer
  feed that isn't a drop-in replacement. Real-time push updates require a
  paid provider (Alchemy, QuickNode, Validation Cloud, etc.) that supports
  `eth_subscribe` over WSS. This is a documented extension point (see
  below), not wired up by default — v1 polls over HTTP.

## Data & analytics

Every trade (buy or sell) is stored permanently in the `trades` table
with its full context (tx hash, block, timestamp, direction, trader,
amounts, USD value, price, new-holder flag). The schema is intentionally
flat and complete so future analytics/reporting can query historical data
without any migration. `daily_stats` gives pre-aggregated per-day rollups
for quick reporting.

## Future Expansion

The module is structured so these can be added without restructuring
existing files:

- **LP health monitoring / whale alerts** — `chain/stateViewAbi.ts`
  already includes `getLiquidity`; add a `src/jobs/lpHealth.ts` that
  polls it on an interval and calls `telegram.ts`'s `sendPlainMessage`
  when liquidity or a single trade crosses a threshold. Wire it up as
  another `setInterval`-style loop started from `index.ts`, alongside the
  listener.
- **Daily reports** — `daily_stats` already has everything a daily
  summary needs; a small cron-style job (e.g. via `node-cron` or a plain
  `setTimeout` scheduled for UTC midnight) can read it and post a summary.
- **Website integration** — `database.ts` is a plain SQLite file; a
  read-only API route on the website could query the same file (or a
  small HTTP endpoint added to this bot) to surface live stats on the
  site without duplicating the listener.
- **Discord / X (Twitter) support** — because Telegram-specific code is
  isolated in `telegram.ts`/`commands.ts`, adding a sibling
  `discord.ts` that consumes the same `EnrichedTrade` objects from
  `stats.ts` is a self-contained addition.
- **Real WebSocket subscriptions** — swap in a paid provider's WSS URL
  via `WS_RPC_URL` in `.env` and extend `chain/provider.ts` /
  `listener.ts` to use `ethers.WebSocketProvider` with reconnect
  handling, falling back to the existing polling path if the socket
  drops.
- **AI analytics** — `trades`'s flat schema (amounts, timestamps,
  addresses, USD values) is ready to feed into any offline analysis or
  ML pipeline without touching the bot's runtime code.

## Troubleshooting

- **"Missing required environment variable"** — copy `.env.example` to
  `.env` and fill in `BOT_TOKEN`/`CHAT_ID`.
- **No notifications appear** — check the bot has admin rights in the
  target chat/channel (Telegram requires this for bots to post in
  channels), and that `CHAT_ID` is correct (see Configure `.env` above).
- **"Unexpected swap deltas" warnings in the logs** — extremely rare;
  would only happen if the pool's token ordering ever changed. Not
  expected under normal operation.
- **Liquidity/holder counts show "—"** — these come from GeckoTerminal
  and Blockscout respectively and are explicitly best-effort/supplementary
  (never used for buy/sell detection). They degrade gracefully if those
  services are briefly unavailable.
