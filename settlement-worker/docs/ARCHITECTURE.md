# Settlement Worker Architecture

## Goal

Replace browser/Vercel request-driven settlement with an always-on worker that can settle days without a user tab open.

## Processes

| Service name | `WORKER_PROFILE` | `CHAIN_ID` | Default health port |
|--------------|------------------|------------|---------------------|
| `settlement-worker-testnet` | `testnet` | `46630` | `8080` |
| `settlement-worker-mainnet` | `mainnet` | `4663` | `8081` |

Isolation (must never be shared across profiles):

- RPC URL  
- Settler private key  
- Seed / randomness-provider private key  
- Contract addresses (guard-enforced)  
- Redis namespace (`REDIS_NAMESPACE`)  
- Log directory  
- Health port  

## On-chain steps

| Step | Contract | Who | When |
|------|----------|-----|------|
| `fulfillDaySeed(day, seed)` | `GameRandomness` | `randomnessProvider` only | After day start |
| `finalizeDay(day)` | `HansomeGame` | Permissionless | **Worker:** both profiles wait `t ≥ revealEnd`. (Testnet Solidity still allows `t ≥ commitEnd`; others may settle early.) |
| `creditBatch(day, limit≤50)` | `HansomeGame` | Permissionless | After finalize, until settled |

Worker **never** calls treasury withdraw, ownership transfer, or other admin functions (function allowlist).

## Trigger model

**Fixed-interval polling** (not cron, not Vercel, not chain subscriptions):

- Testnet default: 5s  
- Mainnet default: 15s  

## Reliability

| Feature | Implementation |
|---------|----------------|
| Idempotency | State `done[day:action[:cursor]]` + on-chain re-read |
| Duplicate tx protection | In-flight hash map; wait receipt before re-send |
| Nonce protection | Process write lock + fresh `pending` nonce; retry on nonce-too-low |
| Receipt confirmation | `waitForTransactionReceipt` require `status=success` |
| Retry / backoff | Exponential per tick failure (cap 120s) |
| Gas balance checks | `MIN_ETH_BALANCE` before tick |
| Fee cap | Optional `MAX_FEE_PER_GAS_GWEI` |
| Gas limit | `GAS_LIMIT` on every write |
| Restart-safe state | Upstash/KV REST JSON or file under `LOG_DIR` |
| Alerting | Optional `ALERT_WEBHOOK_URL` |
| Health | `GET /healthz`, `GET /readyz` |

## What this worker does **not** do

- Player reveals / commit salt vault (Mainnet players reveal themselves; Testnet gasless reveal stays on Next.js API)  
- Reward `claim` (player wallet)  
- Telegram buy-bot (`bot/`)  

## Safety (Mainnet)

- Wrong chainId → hard refuse  
- Testnet suite addresses on Mainnet → hard refuse  
- `DRY_RUN=1` default  
- Live mode requires `MAINNET_LIVE_ACK=I_UNDERSTAND_MAINNET_SETTLEMENT`  
- Seed wallet must equal on-chain `randomnessProvider` at boot  
