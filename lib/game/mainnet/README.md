# Mainnet Genesis whitelist proofs

| File | Purpose |
|------|---------|
| `whitelistProofs.MAINNET.json` | Merkle root + per-wallet proofs for `whitelistMint` on chain `4663` |

## Owner list (edit this)

**Source of truth:** [`data/mainnet/whitelist-addresses.txt`](../../../data/mainnet/whitelist-addresses.txt)

中文維護步驟見 [`data/mainnet/README.md`](../../../data/mainnet/README.md)。

## Generate (ops — offline, no txs)

```bash
cd contracts
# 1) Paste approved addresses into ../../data/mainnet/whitelist-addresses.txt
# 2) Generate root + proofs
npm run genesis:merkle:mainnet
```

That overwrites this JSON and `contracts/deployments/robinhood-genesis-whitelist.mainnet.json`.

**Does not** call `scheduleWhitelistMerkleRoot`. On-chain schedule is a separate later step (latest safe: **2026-07-23 11:00 UTC**). See `docs/MAINNET_LAUNCH_RUNBOOK.md` §5.

## Rules

- Never copy `lib/game/testnet/whitelistProofs.TESTNET-ONLY.json` here.
- Empty `proofs` means Mainnet WL mint UI stays disabled until the real file is generated.
- Frontend loader: `lib/game/whitelistProofs.ts` → `resolveWhitelistProofs(chainId)`.
