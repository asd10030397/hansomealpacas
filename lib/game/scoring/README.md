# Season Scoring Module (`scoringVersion = "v0.1.1"`)

Approved production direction. **Not** connected to the Demo leaderboard UI yet.

**Product scope (locked):** current **active season only**. Do not build season history browsing, archive pages, or past-season ranking APIs until explicitly requested. Scoring may still recompute the active season from settlement snapshots; that is not a public history product.

Spec: [`docs/HANSOME_Season_Scoring_Spec_v0.1.1.md`](../../../docs/HANSOME_Season_Scoring_Spec_v0.1.1.md)

## Public entry points

| Function | Purpose |
|------|------|
| `scoreSettlementDay(input)` | Score one day from a reproducible settlement snapshot |
| `computeSeasonScores(dayResults)` | Full 90-day average (inactive = 0) |
| `recomputeSeasonFromSettlements(days)` | Historical rebuild |
| `computeHunterSeason` / `computeSurvivorSeason` | Special boards |
| `rankEarningsWithinRole` | Role-split earnings ranking |

## What differentiates players on the same location (Alpacas)

Within a location cohort, ranking uses only:

1. **`netReward`** — GDS net Alpaca payout \(r^{A,\mathrm{net}}\) after settlement  
2. **`underHunt` + `penaltyRate`** — if under hunt, metric = `netReward * (1 + μ * (1 − π))` with `μ = 0.55`

Location weight does **not** appear as a separate Season bonus (within-location percentile removes label dominance).

### Identical inputs → true ties

If two Alpacas on the same tile share the same `(netReward, underHunt, penaltyRate)` (after metric rounding to 8 decimals), they receive:

- the same performance metric  
- the same midrank percentile score (shared midrank)

No tokenId noise, jitter, or artificial spread is applied.

## Fallbacks

| Condition | Behavior | `fallback` flag |
|------|------|------|
| Peer count in cohort `< n_min` (5) | Every member scores **50** | `neutral_insufficient_peers` |
| Tied metrics in cohort | Shared midrank → identical scores | `identical_tie_shared_midrank` |
| Wrong `scoringVersion` | Throws | — |
| Duplicate `tokenId` in day input | Throws | — |
| Wallet inactive that day | Season slot **0** | — |
| Wallet has `> K` actives | Mean of **lowest tokenIds** (K=3) | — |

## Reproducibility

- Pure functions of `SettlementDayInput`  
- Owners normalized to lowercase  
- Metrics rounded to 8 decimal places before ranking  
- `canonicalSettlementJson` for audit snapshots  
- Re-run `recomputeSeasonFromSettlements` on historical inputs to rebuild boards  
- Production season windows MUST pass `seasonStartDay` (protocol day of season slot 0)  
- Duplicate protocol-day records throw (`assertUniqueProtocolDays`)

## Time / season boundaries

- `day` = GDS integer **protocol day**, not a browser timezone  
- UTC day bounds are defined by GDS §6.2; the scoring module never parses wall clocks  
- Season hard-reset = new `seasonId` + new `seasonStartDay`; do not mix seasons in one aggregate

## Settlement input integrity (indexer)

Scores must be fed only from finalized settlement snapshots:

- After on-chain settlement for that day (I-SINGLE-SETTLE)  
- `owner` = ERC-721 owner at Reveal close  
- Never client-supplied rewards, locations, or owners

## Forbidden inputs

- Wallet HANSOME token balance  
- Cross-role raw earnings comparison on a single ladder  
- Sum / best-K wallet aggregation  
- Averaging only participated days for SeasonScore  
- Unconfirmed / mutable / client-authored settlement fields  
