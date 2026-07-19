# Multi-Wallet Testnet QA Report

Generated: 2026-07-19T15:21:04.797Z
Network: robinhoodTestnet
HansomeGame: `0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0`
Day: **19**
Relayer (addresses only): `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`

> Private keys are never stored in this report.

## 1. Test wallets (addresses only)

- **player1**: `0x2006CF012842e757f1f79938cD646e8a19d5c389`
- **player2**: `0x0bd54aeE53E9603375C27940d74e7c0923573b2a`
- **player3**: `0xfEff679d14f7D1a2F343095680430e4c96dE691F`

## 2. NFTs tested (ownership)

### player1 (`0x2006CF012842e757f1f79938cD646e8a19d5c389`)
- #17 — Alpaca:Common
- #18 — Alpaca:Common
- #19 — Alpaca:Common
- #20 — Alpaca:Common
- #21 — Alpaca:Common

### player2 (`0x0bd54aeE53E9603375C27940d74e7c0923573b2a`)
- #27 — Alpaca:Common
- #28 — Alpaca:Common
- #29 — Alpaca:Common
- #30 — Cougar

### player3 (`0xfEff679d14f7D1a2F343095680430e4c96dE691F`)
- #22 — Alpaca:Common
- #23 — Alpaca:Common
- #24 — Alpaca:Common
- #25 — Alpaca:Common
- #26 — Alpaca:Common

### Class coverage

- **Alpaca:Common**: #17, #18, #19, #20, #21, #27, #28, #29, #22, #23, #24, #25, #26
- **Cougar**: #30

## 3. Commit results

| Player | Token | Class | Loc | Vault | Tx |
|--------|------:|-------|----:|:-----:|----|
| player1 | #17 | Alpaca:Common | 2 | OK | `0xe34e1601…` |
| player1 | #18 | Alpaca:Common | 3 | OK | `0x615a8b41…` |
| player1 | #19 | Alpaca:Common | 1 | OK | `0x1345fb10…` |
| player1 | #20 | Alpaca:Common | 4 | OK | `0xe353d5ef…` |
| player1 | #21 | Alpaca:Common | 2 | OK | `0x21c975d1…` |
| player2 | #27 | Alpaca:Common | 2 | OK | `0xc9ea4528…` |
| player2 | #28 | Alpaca:Common | 3 | OK | `0x69710d23…` |
| player2 | #29 | Alpaca:Common | 1 | OK | `0xf84798f9…` |
| player2 | #30 | Cougar | 4 | OK | `0x551ee303…` |
| player3 | #22 | Alpaca:Common | 2 | OK | `0x8ba14793…` |
| player3 | #23 | Alpaca:Common | 2 | OK | `0x28e2b110…` |
| player3 | #24 | Alpaca:Common | 3 | OK | `0xa3ee5111…` |
| player3 | #25 | Alpaca:Common | 1 | OK | `0xef1f6594…` |
| player3 | #26 | Alpaca:Common | 4 | OK | `0xe0b912b3…` |

## 4. Reveal / resolve

```json
{
  "attempt": 1,
  "ok": true,
  "enabled": true,
  "day": 19,
  "alreadySettled": false,
  "seedSkipped": true,
  "revealed": 14,
  "revealTxHash": "0x40f3115e9edef5486e61af04245e892019ce68219299f46bc85fe5cf4e311bc5",
  "seedTxHash": null,
  "settleTxHash": "0xb0f994b6c0a30539999800e575d04a1744772675bccc76098e357832b4e372b9",
  "vaultCount": 14
}
```

## 5. Personal battle report isolation

| Player | Personal token IDs | Leaked from others |
|--------|-------------------:|-------------------:|
| player1 | #17, #18, #19, #20, #21 | none |
| player2 | #27, #28, #29, #30 | none |
| player3 | #22, #23, #24, #25, #26 | none |

## 6. Rewards / claim

| Player | Token | Claimable before | Double claim |
|--------|------:|------------------|--------------|
| player1 | #17 | 3692.307692307692307692 | PASS |
| player1 | #18 | 6153.846153846153846153 | PASS |
| player1 | #19 | 2461.538461538461538461 | PASS |
| player1 | #20 | 6892.307692307692307693 | PASS |
| player1 | #21 | 3692.307692307692307692 | PASS |
| player2 | #27 | 6739.926739926739926739 | PASS |
| player2 | #28 | 11537.973137973137973137 | PASS |
| player2 | #29 | 2461.538461538461538461 | PASS |
| player2 | #30 | 24000.0 | PASS |
| player3 | #22 | 3692.307692307692307692 | PASS |
| player3 | #23 | 3692.307692307692307692 | PASS |
| player3 | #24 | 6153.846153846153846153 | PASS |
| player3 | #25 | 2461.538461538461538461 | PASS |
| player3 | #26 | 6892.307692307692307697 | PASS |

## 7. Gas report

| Role | Wallet | Action | Token | Gas used | Fee (ETH) | Tx |
|------|--------|--------|------:|---------:|----------:|----|
| player | `0x2006CF…` | commit | 17 | 115671 | 0.00000115671 | `0xe34e1601…` |
| player | `0x2006CF…` | commit | 18 | 115671 | 0.00000115671 | `0x615a8b41…` |
| player | `0x2006CF…` | commit | 19 | 115671 | 0.00000115671 | `0x1345fb10…` |
| player | `0x2006CF…` | commit | 20 | 115671 | 0.00000115671 | `0xe353d5ef…` |
| player | `0x2006CF…` | commit | 21 | 115671 | 0.00000115671 | `0x21c975d1…` |
| player | `0x0bd54a…` | commit | 27 | 115671 | 0.00000115671 | `0xc9ea4528…` |
| player | `0x0bd54a…` | commit | 28 | 115671 | 0.00000115671 | `0x69710d23…` |
| player | `0x0bd54a…` | commit | 29 | 115671 | 0.00000115671 | `0xf84798f9…` |
| player | `0x0bd54a…` | commit | 30 | 115627 | 0.00000115627 | `0x551ee303…` |
| player | `0xfEff67…` | commit | 22 | 115671 | 0.00000115671 | `0x8ba14793…` |
| player | `0xfEff67…` | commit | 23 | 115671 | 0.00000115671 | `0x28e2b110…` |
| player | `0xfEff67…` | commit | 24 | 115671 | 0.00000115671 | `0xa3ee5111…` |
| player | `0xfEff67…` | commit | 25 | 115659 | 0.00000115659 | `0xef1f6594…` |
| player | `0xfEff67…` | commit | 26 | 115671 | 0.00000115671 | `0xe0b912b3…` |
| relayer | `0xcE1528…` | revealBatch | — | 1281906 | 0.00001281906 | `0x40f3115e…` |
| relayer | `0xcE1528…` | settleDay | — | 559969 | 0.00000559969 | `0xb0f994b6…` |
| player | `0x2006CF…` | claim | 17 | 85649 | 0.00000085649 | `0xeccbc240…` |
| player | `0x2006CF…` | claim | 18 | 68549 | 0.00000068549 | `0xb0109c3b…` |
| player | `0x2006CF…` | claim | 19 | 68549 | 0.00000068549 | `0xa3ffef8e…` |
| player | `0x2006CF…` | claim | 20 | 68549 | 0.00000068549 | `0xa0a0d010…` |
| player | `0x2006CF…` | claim | 21 | 68549 | 0.00000068549 | `0x308b7746…` |
| player | `0x0bd54a…` | claim | 27 | 85649 | 0.00000085649 | `0xe23b7504…` |
| player | `0x0bd54a…` | claim | 28 | 68549 | 0.00000068549 | `0xd12473e0…` |
| player | `0x0bd54a…` | claim | 29 | 68549 | 0.00000068549 | `0x76add12e…` |
| player | `0x0bd54a…` | claim | 30 | 68549 | 0.00000068549 | `0xfa2ac4b1…` |
| player | `0xfEff67…` | claim | 22 | 85649 | 0.00000085649 | `0x9403f182…` |
| player | `0xfEff67…` | claim | 23 | 68549 | 0.00000068549 | `0xb5d92bd6…` |
| player | `0xfEff67…` | claim | 24 | 68549 | 0.00000068549 | `0x053c7700…` |
| player | `0xfEff67…` | claim | 25 | 68549 | 0.00000068549 | `0x3055dc0f…` |
| player | `0xfEff67…` | claim | 26 | 68549 | 0.00000068549 | `0x05a9e670…` |

**Fee sanity:** PASS — no tx above 0.01 ETH

## 8. Pass / Fail summary

| Check | Result |
|-------|--------|
| api.gaslessResolve | PASS |
| testnetGameplayUnlock | PASS |
| isolation.ownership | PASS |
| inventory.loaded | PASS |
| phase.CommitOpen | PASS |
| loop.commit | PASS |
| loop.vault | PASS |
| resolve.idempotent | PASS |
| loop.settled | PASS |
| loop.revealMatch | PASS |
| isolation.battleReport | PASS |
| isolation.walletSwitch | PASS |
| loop.claim | PASS |
| edge.doubleClaim | PASS |
| gas.noAbsurdFees | PASS |
| class.Alpaca:King | SKIP |
| class.Alpaca:Runner | SKIP |
| class.Alpaca:Lucky | SKIP |
| class.Alpaca:Guardian | SKIP |
| class.Alpaca:Farmer | SKIP |
| class.Alpaca:Common | PASS |
| class.Cougar | PASS |

## 9. Bugs found

- None recorded in this run.

## 10. Notes / recommended fixes

- Waited for day 19 CommitOpen (was day 18 Claimable)
- Wallet-switch / refresh UI: verified via on-chain personal commit filter (same rule as Result page). Manual MetaMask switch still recommended.
- isolation.battleReport revalidated: prior FAIL was checksum/lowercase false positive in harness.

---

Skill FX are presentation-layer; this report validates on-chain commit→reveal→settle→claim and wallet isolation.
