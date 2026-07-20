# Mainnet Genesis whitelist proofs

| File | Purpose |
|------|---------|
| `whitelistProofs.MAINNET.json` | Merkle root + per-wallet proofs for `whitelistMint` on chain `4663` |

## Generate (ops)

```bash
cd contracts
# Put approved addresses in deployments/mainnet-whitelist-addresses.txt
npx hardhat run scripts/generate-mainnet-whitelist-merkle.ts --network hardhat
```

That overwrites this JSON and `contracts/deployments/robinhood-genesis-whitelist.mainnet.json`.

## Rules

- Never copy `lib/game/testnet/whitelistProofs.TESTNET-ONLY.json` here.
- Empty `proofs` means Mainnet WL mint UI stays disabled until the real file is generated.
- Frontend loader: `lib/game/whitelistProofs.ts` → `resolveWhitelistProofs(chainId)`.
