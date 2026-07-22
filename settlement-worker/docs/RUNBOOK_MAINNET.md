# Runbook — settlement-worker-mainnet

| Field | Value |
|-------|--------|
| Profile | `mainnet` |
| Chain | Robinhood Mainnet `4663` |
| Game | `0xb8dad421881171f4485523d109C94dc650ecB7Eb` |
| Randomness | `0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791` |
| Settle phase | **Only after reveal ends** |
| Default | **`DRY_RUN=1` — do not go live yet** |

## Hard rules

1. **No Mainnet live deploy** until Testnet worker has proven ≥1 full settle.  
2. Never copy Testnet private keys or Redis namespaces.  
3. Never point Mainnet worker at Testnet addresses (guards refuse).  
4. Live mode requires:
   - `DRY_RUN=0`
   - `MAINNET_LIVE_ACK=I_UNDERSTAND_MAINNET_SETTLEMENT`

## Dry-run start (allowed now)

```bash
cd settlement-worker
cp .env.mainnet.example .env.mainnet
# Fill SEED_PRIVATE_KEY = current randomnessProvider
# Keep DRY_RUN=1
npm run build
npm run start:mainnet
```

Expect logs: `dry_run_tx` for planned actions; **no** broadcast txs.

## Live cutover (future — not now)

1. Sign GO from ops.  
2. Fund settler + seed wallets on Mainnet.  
3. Confirm provider address.  
4. Set `DRY_RUN=0` + ACK.  
5. Watch first Day settle after reveal close.  
6. Keep alert webhook on.  

## Rollback

1. Set `DRY_RUN=1` or stop service.  
2. Settlement remains permissionless — a wallet can finish `finalizeDay` / `creditBatch` manually if needed.  
3. Seed still requires provider key.  
