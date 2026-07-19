# Special Trait Gameplay QA Report

Generated: 2026-07-19T15:46:06.304Z
Network: robinhoodTestnet
HansomeGame: `0x7b2ce5ECD270Ce55Ac94aCe3BF12d83ef113D0a0`
Day: **24**
Player wallet (addresses only): `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
Hunt location: **2** (Grassland) — all specials + Cougar co-located
Cohort at location: alpaca=6, cougar=1

> Private keys never included. Visual Crown/escape FX confirmed via activation rules + on-chain Bernoulli (manual browser polish optional).

## NFT IDs tested

| Token | Class | Loc | Hunted | Outcome | Ability activation | Reward (tHANSOME) |
|------:|-------|----:|:------:|---------|--------------------|------------------:|
| #1 | Alpaca:King | 2 | Y | King immune | king | 10322.58064516129032258 |
| #11 | Alpaca:Common | 2 | Y | Common hunted | — | 8774.193548387096774193 |
| #12 | Alpaca:Guardian | 2 | Y | Guardian protected | guardian | 9548.387096774193548387 |
| #13 | Alpaca:Farmer | 2 | Y | Farmer hunted | Farmer · Harvest Boost | 10529.032258064516129032 |
| #14 | Alpaca:Lucky | 2 | Y | Lucky hunted | — | 8774.193548387096774193 |
| #15 | Alpaca:Runner | 2 | Y | Runner escaped | runner | 10322.580645161290322584 |
| #16 | Cougar | 2 | Y | Cougar hunting | — | 16000.0 |

### Ability detail

#### #1 Alpaca:King
- Outcome: King immune
- Activated ability (proc FX): `king`
- Ability label: King activated!
- Penalty bps (presentation): 0
- Reward: 10322.58064516129032258

#### #11 Alpaca:Common
- Outcome: Common hunted
- Activated ability (proc FX): `null`
- Ability label: —
- Penalty bps (presentation): 1500
- Reward: 8774.193548387096774193

#### #12 Alpaca:Guardian
- Outcome: Guardian protected
- Activated ability (proc FX): `guardian`
- Ability label: Guardian activated!
- Penalty bps (presentation): 750
- Reward: 9548.387096774193548387

#### #13 Alpaca:Farmer
- Outcome: Farmer hunted
- Activated ability (proc FX): `null`
- Ability label: Farmer · Harvest Boost
- Penalty bps (presentation): 1500
- Reward: 10529.032258064516129032

#### #14 Alpaca:Lucky
- Outcome: Lucky hunted
- Activated ability (proc FX): `null`
- Ability label: —
- Lucky bernoulli: false
- Penalty bps (presentation): 1500
- Reward: 8774.193548387096774193

#### #15 Alpaca:Runner
- Outcome: Runner escaped
- Activated ability (proc FX): `runner`
- Ability label: Runner activated!
- Runner bernoulli: true
- Penalty bps (presentation): 0
- Reward: 10322.580645161290322584

#### #16 Cougar
- Outcome: Cougar hunting
- Activated ability (proc FX): `null`
- Ability label: —
- Penalty bps (presentation): 0
- Reward: 16000.0

## Resolve

```json
{
  "ok": true,
  "enabled": true,
  "day": 24,
  "alreadySettled": false,
  "seedSkipped": false,
  "revealed": 7,
  "revealTxHash": "0xece39e567a4666c187c4283c0c12391871281a91498f607f5634c11b023ea86e",
  "seedTxHash": "0x4891778330e2d9a74717e530689aadba7471bbfc5fbe855935122a049e477da4",
  "settleTxHash": "0xbe863b43ca7d6cb6933228f0b1e3d9e2b6440ffef664759a89373d1f92860829",
  "vaultCount": 7
}
```

Idempotent second resolve: ok=true alreadySettled=true

## Personal battle isolation

Token IDs in personal report: #1, #11, #12, #13, #14, #15, #16

## Gas usage

| Action | Token | Gas used | Fee (ETH) | Tx |
|--------|------:|---------:|----------:|----|
| commit | 1 | 114564 | 0.00000114564 | `0x6f43ec56…` |
| commit | 11 | 115100 | 0.000001151 | `0x0b64cda1…` |
| commit | 12 | 115100 | 0.000001151 | `0x0b6164fa…` |
| commit | 13 | 115100 | 0.000001151 | `0x3e6f40f2…` |
| commit | 14 | 115100 | 0.000001151 | `0xf24c54e1…` |
| commit | 15 | 115100 | 0.000001151 | `0x73fc7ef1…` |
| commit | 16 | 115056 | 0.00000115056 | `0x1f9b1ad4…` |
| revealBatch | — | 686217 | 0.00000686217 | `0xece39e56…` |
| fulfillDaySeed | — | 56009 | 0.00000056009 | `0x48917783…` |
| settleDay | — | 366180 | 0.0000036618 | `0xbe863b43…` |
| claim | 1 | 68167 | 0.00000068167 | `0xd56de171…` |
| claim | 11 | 68167 | 0.00000068167 | `0x82ce9220…` |
| claim | 12 | 68167 | 0.00000068167 | `0x5baaee4d…` |
| claim | 13 | 68167 | 0.00000068167 | `0x01adba28…` |
| claim | 14 | 68167 | 0.00000068167 | `0xe07cff37…` |
| claim | 15 | 68167 | 0.00000068167 | `0xaafd5394…` |
| claim | 16 | 68167 | 0.00000068167 | `0xe9f7584e…` |

**Fee sanity:** PASS — no tx above 0.01 ETH

## Bugs

- None

## Notes

- Duplicate resolve OK (no failed second settle)
- Crown / escape / clover overlays are UI; this run validates activation gating matches SettlementLib + bernoulli.
