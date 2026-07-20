# Batched settlement execution (Testnet)

## Architecture

```
Commit → Reveal (chunks ≤50) → fulfillDaySeed
  → finalizeDay (SettlementLib + reserve + DaySettled)
  → creditBatch(limit≤50) × N  (permissionless)
  → claim (unchanged pull)
```

SettlementLib formulas, 80/10/10, Candidate A π₀, traits, and claim model are unchanged.

`finalizeDay` does **not** SSTORE per-token nets (peak-gas safe). Each `creditBatch` recomputes SettlementLib in memory (identical seed + reveal set ⇒ identical rewards) and credits the next slice.

## Testnet deploy

| Field | Value |
|-------|--------|
| HansomeGame | `0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5` |
| Deploy tx | `0x4b734a4e58413bc31dee24cf3424d76af318e87d034aebc771e4c019319010a3` |
| Timings | Commit 120s / Reveal 120s / Day 240s |
| Identities | `testnetGameplayUnlock: true` |
| Mainnet | **not deployed** |

Treasury / distributor / randomness / genesis reused; distributor + treasury `setGame` pointed at the new game.

## Gas (Hardhat)

See [batched-settlement-gas.md](./batched-settlement-gas.md). Peak at N=550 ≈ **8.2M** gas per tx.

## Old Testnet data

Previous game `0x20B85Dbb…` days remain on that address (not migrated). New commits use the new game + new dayZero.
