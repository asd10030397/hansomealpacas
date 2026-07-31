# HANSOME — Liquidity Analysis Coverage 45% Investigation

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Mode** | Investigate only — **NO code changes · NO deploy** |
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Production** | https://www.hansomealpacas.xyz `/api/scan` |
| **Snapshot** | `reports/_tmp_hansome_scan_cov.json` · Top-20 spot `reports/_tmp_top20_liq_cov.json` |
| **Verdict** | **B — coverage-model / state bug** (not justified by missing LP economics) |

---

## 1. Root cause (executive)

Liquidity Analysis Coverage shows **45% · Medium / incomplete** because `scoreLiquidityCoverage` hard-caps at **45** when `uniswapVersions.coverageComplete === false`.

On Production HANSOME that flag is false **only** because:

1. Known-first LP path sets `exhaustiveDiscoveryComplete=false` (by design when PM history is skipped).
2. `discoveryComplete` is gated on **`exhaustiveComplete`**, so known-first always yields `discoveryComplete=false` even with rich MIXED evidence.
3. Multi-version coverage treats `v4.discoveryComplete=false` as “v4 discovery incomplete” → `coverageComplete=false`.
4. Soft LP budget is **180s** while exhaustive is allowed only if budget **≥ 200s**, so exhaustive almost never runs → the gate never clears.
5. Finalize `markScanPartial` (when creator/burn remain partial) **always** forces `discoveryComplete=false` and overwrites `completenessWarning` with “Temporarily unavailable…”, even when `analysisStages.liquidity === "done"` and lock distribution is available.

**PARTIALLY_LOCKED / MIXED (28.9% locked) is a liquidity RESULT.** It does **not** itself reduce coverage. The 45% comes from false “discovery incomplete / multi-version incomplete” flags, not from missing lock economics.

---

## 2. Exact code path

| Layer | Path |
|-------|------|
| Formula | `lib/hansome-score/confidence.ts` → `scoreLiquidityCoverage()` |
| Aggregate Confidence | `computeConfidence()` (weighted avg; liquidity weight **0.25**) |
| Multi-version flag | `lib/hansome-score/lp/multi.ts` → `buildUniswapVersionCoverage()` / `computeMultiVersionAggregate()` |
| Known-first / discoveryComplete | `lib/hansome-score/lp/detect.ts` → `buildResult()` / known-first return |
| Exhaustive gate | `lib/hansome-score/scan-deep.ts` → `allowExhaustive = liqBudgetMs >= 200_000` |
| Partial clobber | `lib/hansome-score/scan-deep.ts` → `markScanPartial()` |
| UI band / blurb | `components/scan/ScanClient.tsx` → `confidenceDimBlurb` / `confidenceDimWarnings` |
| Copy | `content/i18n/en.ts` → `confidenceDimBlurbLiquidityIncomplete` (“Liquidity discovery is incomplete…”) |

Regression that documents the 45 hard-cap: `lib/hansome-score/__tests__/lp-multi-version.test.ts` (empty multi-version coverage → liquidity ≤ 45).

---

## 3. Exact current coverage formula (liquidity dimension)

`scoreLiquidityCoverage(overview)` in `confidence.ts`:

```
score = 100
incomplete = false

if !poolDetected || aggregateState==NONE:
  return 58 if multi-version incomplete, else 72

# pool detected:
if positions.length == 0: return 28 (incomplete)

if uniswapVersions && !coverageComplete:
  score = min(score, 45); incomplete=true   ← HANSOME lands here

if !discoveryComplete:
  score = min(score, 52); incomplete=true

if aggregateState == UNKNOWN_INCOMPLETE:
  score = min(score, 42); incomplete=true

if aggregateLockState == UNABLE_TO_DETERMINE || lpLockStatus == "unknown":
  score = min(score, 48); incomplete=true

if unknown positions > 0:
  score -= min(20, unknownCount * 8); incomplete=true

if MIXED && !discoveryComplete:
  score = min(score, 50); incomplete=true

if evidenceLevel in {unavailable, registry_inferred}: score -= 10

if lockDistribution && !available: score -= 5

return round(clamp 0..100)
```

**One-liner:** HANSOME liquidity % = `min(100, 45)` from `!uniswapVersions.coverageComplete` (“v4 discovery incomplete”), with redundant incomplete evidence from `!discoveryComplete` / `MIXED && !discoveryComplete`.

Bands: High ≥ 75 · Medium ≥ 45 · Low &lt; 45 → **45 = Medium**.

---

## 4. Why HANSOME = 45% (step-through)

Production confidence evidence (live):

```
pool_detected
positions_detected=3
discovery_complete=false
aggregate_state=MIXED
uniswap_versions=v4
multi_version_coverage_complete=false
discovery_sources=seeded_candidates+titan_locker+multi_version_orchestrator
multi_version_coverage_incomplete          ← applies min(score, 45)
position_discovery_incomplete              ← would apply min(score, 52) but already 45
mixed_with_incomplete_discovery            ← would apply min(score, 50) but already 45
evidence_on_chain_verified
```

Notes (duplicated):  
`INCOMPLETE COVERAGE — v4 discovery incomplete…`

Computation: start 100 → multi-version incomplete → **45** → stop effective.

---

## 5. Input contribution table (Production HANSOME)

| Field / condition | Production value | Coverage contribution | Pass / fail why |
|-------------------|------------------|------------------------|-----------------|
| `poolDetected` | `true` | Enables full path (not 72/58 N/A) | Pass |
| `positions.length` | `3` | Avoids hard 28 (zero positions) | Pass |
| Position ownership | 1 locked + 2 unlocked EOA; `unknown=0` | No unknown −8/−16 | Pass |
| `aggregateState` | `MIXED` → UI **PARTIALLY_LOCKED** | **Not a direct penalty**; only couples via `!discoveryComplete` → min 50 | Result OK; coupling fails |
| `lockedPct` / unlocked | **28.88% / 71.12%** | Result only | Pass (result, not gap) |
| `lockDistribution.available` | `true` | Avoids −5 | Pass |
| `reconciledWithPool` | `true` (pos ≈$16.1k vs pool ≈$15.5k) | Not read by coverage formula; economic quality OK | Pass |
| Position valuation | All 3 have `valueUsd` | Indirect (enables lock dist) | Pass |
| `poolLiquidityUsd` / stage liq USD | `$15,529.573` | Not a coverage input | Pass |
| `evidenceLevel` | `on_chain_verified` | No −10 | Pass |
| `knownPositionsVerified` | **`true`** | **Not used by `scoreLiquidityCoverage`** | Evidence present; ignored |
| `exhaustiveDiscoveryComplete` | `false` | Indirect: forces `discoveryComplete=false` in detect | Soft residual only |
| `discoveryComplete` (token) | **`false`** | min(score, 52) + MIXED min 50 | **Fail — model** |
| `uniswapVersions.coverageComplete` | **`false`** | **`min(score, 45)`** | **Fail — model** |
| `byVersion.v2` | searched, 0 pools, discovery+lock complete | OK for coverageComplete | Pass |
| `byVersion.v3` | searched, 0 pools, discovery+lock complete | OK for coverageComplete | Pass |
| `byVersion.v4.discoveryComplete` | **`false`** | Sole reason coverageComplete=false | **Fail — model** |
| `byVersion.v4.lockAnalysisComplete` | **`false`** (because discoveryComplete false) | Feeds incomplete reason | **Fail — model** |
| Secondary pools | v2/v3 none in probe set | Honest negative | Pass |
| Unsupported locker | Titan path verified on #47299 | N/A | Pass |
| `analysisStages.liquidity` | **`done`** | Stage finished | Pass |
| `completenessWarning` / `detail` | “Temporarily unavailable — liquidity did not finish…” | Stale copy from `markScanPartial` | **Fail — state clobber** |
| Overall `analysisStatus` | `partial` (creator/burn partial) | Triggers finalize `markScanPartial` | Side-effect |

### What evidence is actually missing?

**Economically relevant LP data is present.** Residual true gap: full PositionManager transfer history was not exhausted (`exhaustiveDiscoveryComplete=false`). That is a **small residual enumeration gap**, not “liquidity data incomplete” at the 45% hard floor.

**Not missing:** V4 pool, 3 valued positions, lock distribution, reconciliation, multi-version v2/v3 probes (empty), on-chain verified locks/unlocks.

---

## 6. Is 45% justified?

**No.**  

45% is the intentional hard floor for *true* multi-version discovery failure (unsearched versions / undecoded pools). HANSOME’s v2/v3 probes completed with zero pools; v4 has verified MIXED ownership + reconciled lock %. Treating “known-first skipped exhaustive PM history” as the same class of failure as “didn’t search / can’t decode” is incorrect.

Product distinction holds: **PARTIALLY_LOCKED ≠ incomplete data.**

---

## 7. Verdict: **B** (coverage-model / state bug)

| Class | Meaning | Applies? |
|-------|---------|----------|
| **A** | Correct ~45% because material evidence missing | No |
| **B** | Coverage model / stage state mislabels rich LP as incomplete | **Yes** |

Not a scoring-weight / lock-semantics bug. Do **not** hardcode HANSOME or force 100%.

---

## 8. Proposed generic correction (DO NOT IMPLEMENT HERE)

Cross-token, no HANSOME special-case, no score-weight retune:

### B1 — Separate known-sufficient discovery from exhaustive history

In `detect.ts` `buildResult`:

- Keep `exhaustiveDiscoveryComplete` = PM history finished.
- Allow `discoveryComplete=true` when **known-first sufficient** (`knownPositionsVerified`) **and** material positions have **no unknown** ownership **and** aggregate is a determined state (`MIXED` / `ALL_LOCKED` / `ALL_UNLOCKED`) — without requiring `exhaustiveComplete`.
- Comment already admits “Known-first MIXED is honest with discoveryComplete=false”; that honesty belongs as a soft residual on `exhaustiveDiscoveryComplete`, not as hard incomplete multi-version coverage.

### B2 — Multi-version coverage follows version slices honestly

Once B1 sets `v4.discoveryComplete=true` and `lockAnalysisComplete` (no unknown), with v2/v3 searched+complete empties, `buildUniswapVersionCoverage` → `coverageComplete=true`. No formula change required for the 45 cap itself.

### B3 — Stop clobbering finished liquidity in `markScanPartial`

When `analysisStages.liquidity === "done"` **or** (`knownPositionsVerified` ∧ `lockDistribution.available`):

- Do **not** force `discoveryComplete=false`.
- Do **not** overwrite `completenessWarning` / `detail` with “Temporarily unavailable…” (especially do not treat the substring `"pending"` inside lock-valuation prose as stage failure).
- Leave creator/burn partial independently.

### B4 — Optional soft residual (preferred over hard 45)

In `scoreLiquidityCoverage`, if `exhaustiveDiscoveryComplete === false` but `knownPositionsVerified === true` and `coverageComplete === true`: soft **−5 to −10**, `incomplete` optional/false — **never** the multi-version 45 hard-cap.

### Explicit non-goals

- Do not change Structural / Overall scoring weights or lock % math.
- Do not treat MIXED / PARTIALLY_LOCKED as incomplete.
- Do not force HANSOME to 100%.
- Do not claim ALL_LOCKED from known-first alone (aggregate rules stay).

---

## 9. Expected HANSOME liquidity coverage after correction

Using **only** evidence already on Production (3 positions, 0 unknown, MIXED, lock dist available+reconciled, v2/v3 searched empty, on-chain verified):

| Fix set | Expected liquidity dimension |
|---------|------------------------------|
| B1+B2+B3, no soft exhaustive penalty | **~100** (High) |
| B1+B2+B3 + soft −5/−10 for non-exhaustive | **~90–95** (High) — recommended |
| B1+B2 only (markScanPartial still clobbers `discoveryComplete`) | **~50** (MIXED + forced `!discoveryComplete`) — insufficient |

**Recommended expected band after full generic fix: ~90–95% · High**, with UI blurb switching to complete liquidity copy; PARTIALLY_LOCKED remains the lock **result**.

Aggregate Data Confidence would rise only via the liquidity weight (0.25); other dims (creator 18, wallet 34, etc.) unchanged by this fix.

---

## 10. Top-20 sanity (Production spot-check)

Generic interpretation must keep truly incomplete tokens low:

| Token | Liq % | Why | After proposed fix |
|-------|------:|-----|--------------------|
| **HANSOME** | **45** | Rich MIXED + lock dist; false v4 discovery incomplete | ↑ ~90–95 (B) |
| **FOX** | **21** | v3 pools found but lock analysis incomplete; 2 unknown positions; lock % unavailable | Stays low (true A) |
| **CASHCAT** | 28 | Deep still analyzing / 0 positions enumerated | Stays low until positions exist |
| **PONS** | 28 | Same — mid-deep, 0 positions | Stays low until done |
| **TYGR** | 28 | Same | Stays low |
| **LEMON.FUN** | 28 | Same | Stays low |
| **ASTEROID** | 58 | No pool + incomplete multi-version path (fast/empty coverage) | Unchanged until multi-version finishes |

**Sanity conclusion:** Fixing known-sufficient discovery + partial clobber raises HANSOME-like tokens with verified MIXED economics; tokens with undecoded v2/v3 pools or zero positions (FOX / mid-deep CASHCAT) correctly remain incomplete. Definition stays generic.

---

## 11. Confirmations

| Item | Status |
|------|--------|
| Code changes | **NONE** |
| Deploy | **NONE** |
| Scoring formulas / weights / lock semantics / safety thresholds | **Unchanged** |
| HANSOME hardcode | **Not proposed** |
| PARTIALLY_LOCKED treated as incomplete data | **Rejected** (bug is flag coupling) |

---

## 12. Parent return summary

- **Verdict:** **B**
- **Formula one-liner:** `min(100,45)` when `!uniswapVersions.coverageComplete` (here: “v4 discovery incomplete” from known-first `discoveryComplete=false`)
- **Why 45%:** Hard multi-version cap; not missing lock economics
- **Missing evidence:** Only non-exhaustive PM history (soft); economics present
- **Expected after fix:** **~90–95%** liquidity dimension (with soft exhaustive residual)
- **Report:** `reports/HANSOME_LIQUIDITY_COVERAGE_45_INVESTIGATION.md`
- **NO code / NO deploy**
