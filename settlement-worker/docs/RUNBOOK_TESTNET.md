# Runbook — settlement-worker-testnet

| Field | Value |
|-------|--------|
| Profile | `testnet` |
| Chain | Robinhood Testnet `46630` |
| Game | `0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5` |
| Randomness | `0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F` |
| Settle phase | After **revealEnd** (worker policy; matches Mainnet). Contract still allows earlier finalize on Testnet. |

## Preconditions

1. Know current Testnet `GameRandomness.randomnessProvider()`.  
2. `SEED_PRIVATE_KEY` must be that provider.  
3. `SETTLER_PRIVATE_KEY` funded with Testnet ETH (may be same wallet).  
4. `ALLOW_MEMORY_STATE=1` OK for local; use Upstash in hosted prod.  

## Start (local)

```bash
cd settlement-worker
cp .env.testnet.example .env.testnet
# edit keys
npm install && npm test && npm run build
npm run start:testnet
```

## Start (hosted)

Deploy service with Testnet env only. Confirm:

```text
worker_boot ... profile=testnet chainId=46630
tick_ok ...
```

## Verify settle

1. Commit early in the day; players self-reveal within the 2m reveal window.  
2. During RevealOpen, worker logs should show `phase: "reveal"` and **not** finalize/credit yet (seed may already be fulfilled).  
3. After revealEnd, watch `finalizeDay` → `creditBatch`.  
4. Confirm on explorer: day `isSettled=true`, credits present; then player claim.  
5. `GET /healthz` → `ok: true`, `consecutiveFailures: 0`.  

## Failure checklist

| Symptom | Action |
|---------|--------|
| `SEED key is not on-chain randomnessProvider` | Fix `SEED_PRIVATE_KEY` or rotate provider on-chain |
| `Insufficient ETH` | Fund settler/seed wallets |
| `wrong chainId` | Check `RPC_URL` / `CHAIN_ID` |
| Repeated `tick_failed` | Read `lastError` on `/healthz`; check alert webhook |

## Stop

SIGINT/SIGTERM or `systemctl stop` / Railway stop. State persists in Redis/file for restart resume.
