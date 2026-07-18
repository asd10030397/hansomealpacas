# Season Scoring Implementation Report — v0.1.1

| Field | Value |
|------|------|
| Status | **MODULE APPROVED; INTEGRATION REVIEW COMPLETE; NOT LIVE** |
| scoringVersion | `v0.1.1` |
| Spec | `docs/HANSOME_Season_Scoring_Spec_v0.1.1.md` (APPROVED) |
| Module path | `lib/game/scoring/` |
| Test command | `npm run test:scoring` |
| Tests | **27/27 passed** (includes L=90 replay + edge cases) |
| Integration review | `reports/leaderboard/scoring-integration-review-v0.1.1.md` |
| Cutover | **NO-GO** until checklist + explicit enablement |
| Date | 2026-07-19 |

## 1. Scope delivered

Pure TypeScript scoring library with:

- Within-location Alpaca midrank percentile scoring
- Within-role Cougar relative performance scoring (`σ + η·huntShare`; miss = 0)
- Wallet normalization: mean of ≤ K=3 lowest `tokenId`s
- Full-L season average (inactive days = 0)
- Deterministic ties (shared midrank; no artificial jitter)
- Minimum peer-sample fallback (`n < n_min` → score 50)
- Historical recomputation (`recomputeSeasonFromSettlements`)
- Canonical settlement JSON for reproducible inputs
- Explicit `scoringVersion = "v0.1.1"` guard on all entry points

**Not delivered (intentionally deferred):**

- Wiring into the Demo leaderboard UI
- Indexer / production settlement pipeline
- Contract changes, deploy, IPFS uploads

Frontend remains **Demo / Under Review**.

## 2. Public API

| Export | Role |
|------|------|
| `scoreSettlementDay(input)` | Score one day from `SettlementDayInput` |
| `computeSeasonScores(dayResults)` | Full-L wallet season average |
| `recomputeSeasonFromSettlements(days)` | Historical rebuild |
| `canonicalSettlementJson(input)` | Sorted-key JSON for audit hashes |
| `computeHunterSeason` / `computeSurvivorSeason` | Special boards |
| `rankEarningsWithinRole` | Role-split earnings ladder |
| `SCORING_VERSION` / `SCORING_CONSTANTS` | Version + locked constants |

## 3. What differentiates players within the same location

Alpaca peers on one tile are ranked **only** by the local performance metric:

1. `netReward` (GDS \(r^{A,\mathrm{net}}\))
2. If `underHunt`: multiply by `(1 + μ·(1 − π))` with `μ = 0.55` and `π = penaltyRate`

Location weight is **not** a Season bonus (within-location percentile already removes cross-tile label dominance).

### Identical inputs → true ties

If all Alpacas on a tile share identical `(netReward, underHunt, penaltyRate)` after 8-decimal metric rounding, they receive:

- the same performance metric
- the same midrank percentile score (`fallback: identical_tie_shared_midrank`)

No tokenId noise, random jitter, or manufactured spread is applied. Wallet/board ordering among equal season scores uses deterministic owner string order where ranking helpers sort ties.

## 4. Fallback behavior (complete)

| Condition | Behavior | Flag / effect |
|------|------|------|
| Cohort size `< n_min` (5) | Every peer scores **50** | `neutral_insufficient_peers` |
| Tied metrics in cohort | Shared midrank → identical scores | `identical_tie_shared_midrank` |
| Distinct metrics | Midrank percentile in (0, 100] | `none` |
| Wrong `scoringVersion` | Throws | — |
| Duplicate `tokenId` in day input | Throws | — |
| Wallet inactive on a season day | Contributes **0** to full-L average | — |
| Wallet has `> K` actives | Mean of **lowest tokenIds** (K=3) | `countedTokenIds` records selection |
| Cougar hunt miss | Performance metric **0** | Ranked with peers |
| Survivor: not under hunt | `survivorDayScore = null` (excluded) | — |

## 5. Locked constants

```
K = 3, L = 90, D_min = 25, n_min = 5
mu = 0.55, eta = 0.15, neutralScore = 50
D_min_survivor = 15, metricDecimals = 8
```

## 6. Test results

```
npm run test:scoring

Test Files  3 passed (3)
Tests       14 passed (14)
```

| Suite | Coverage |
|------|------|
| `percentile.test.ts` | `n_min` neutral, true ties, all-equal no spread, ranking order, metric rounding |
| `scoreDay.test.ts` | Version guard, within-location (not global), identical-input ties, K=lowest tokenIds, Cougar σ differentiation, miss=0, under-hunt metric |
| `season.test.ts` | Full-L zeros on inactive days; deterministic recompute |

## 7. Guardrails checklist

| Guardrail | Status |
|------|------|
| No gameplay contract modifications | ✅ |
| No deploy | ✅ |
| No IPFS upload | ✅ |
| Demo leaderboard not replaced | ✅ |
| Frontend still Demo / Under Review | ✅ |
| Wallet HANSOME balance unused | ✅ (`BOARDS_META.forbidsWalletHansomeBalance`) |
| No cross-role raw earnings ladder | ✅ (`rankEarningsWithinRole` is role-split) |

## 8. Enablement gate (next)

Production scoring may be enabled on the live leaderboard **only after**:

1. Review of this report and the `lib/game/scoring` module
2. Explicit approval to replace Demo ranks
3. Indexer producing `SettlementDayInput` snapshots per settlement day

Until then, keep UI copy as Demo / Under Review.
