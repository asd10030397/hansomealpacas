# HANSOME Settlement Worker

24/7 long-running process that settles battle days:

`fulfillDaySeed` → `finalizeDay` → `creditBatch` (loop)

**Not** Vercel serverless. Run on Railway / Render / Fly.io / VPS.

## Architecture

```
┌────────────────────────────┐     ┌────────────────────────────┐
│ settlement-worker-testnet  │     │ settlement-worker-mainnet  │
│ chainId 46630              │     │ chainId 4663               │
│ own RPC / keys / Redis NS  │     │ own RPC / keys / Redis NS  │
│ health :8080               │     │ health :8081               │
└─────────────┬──────────────┘     └─────────────┬──────────────┘
              │ poll                           │ poll
              ▼                                ▼
     Robinhood Testnet                  Robinhood Mainnet
     HansomeGame + GameRandomness       HansomeGame + GameRandomness
```

Each tick:

1. Verify chainId + gas balance  
2. Read `dayZero` timings, `currentDay`, `hasDaySeed`, `creditProgress`  
3. Enforce phase gates (both profiles: after reveal end)  
4. Execute next planned step with nonce lock, receipt wait, idempotency keys  
5. Exponential backoff + webhook alert on failure  

Mainnet defaults to **`DRY_RUN=1`**. Live Mainnet writes require `MAINNET_LIVE_ACK`.

## Files

| Path | Role |
|------|------|
| `src/index.ts` | Boot, health server, graceful shutdown |
| `src/config.ts` | Env validation + profile isolation |
| `src/loop/worker.ts` | Poll loop |
| `src/loop/plan.ts` | Seed / finalize / credit planner |
| `src/chain/phase.ts` | Day clock + `_settlePhaseOk` parity |
| `src/chain/write.ts` | Nonce-safe writes + fee/gas caps |
| `src/safety/guards.ts` | Allowlists, cross-network rejection |
| `src/state/store.ts` | Redis REST or file state (restart-safe) |
| `docs/*` | Architecture + runbooks + deploy |

## Quick start (Testnet)

```bash
cd settlement-worker
cp .env.testnet.example .env.testnet
# Fill SETTILER_PRIVATE_KEY / SEED_PRIVATE_KEY (provider wallet)
npm install
npm test
npm run build
npm run start:testnet
# Health: curl http://127.0.0.1:8080/healthz
```

First Testnet run tip: set `DRY_RUN=1` once to confirm logs, then `DRY_RUN=0`.

## Mainnet

**Do not deploy live yet.** Use `.env.mainnet` with `DRY_RUN=1` only until Testnet is proven.

See [`docs/RUNBOOK_MAINNET.md`](docs/RUNBOOK_MAINNET.md).

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/RUNBOOK_TESTNET.md`](docs/RUNBOOK_TESTNET.md)
- [`docs/RUNBOOK_MAINNET.md`](docs/RUNBOOK_MAINNET.md)
