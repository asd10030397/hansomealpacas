# HANSOME Score — Production Deep Scan Reliability Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deploy Deep Scan Reliability + production smoke only |
| **Deploy ID** | `dpl_6Aex84h45sqJ9FqosFyKH31Rk2Mm` |
| **Deployment URL** | https://hansomealpacas-8qcht23i1-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/6Aex84h45sqJ9FqosFyKH31Rk2Mm |
| **Verdict** | **GO WITH CAVEATS** |

---

## Pre-deploy

| Check | Result |
|-------|--------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Production) | **Present** (Encrypted) |
| `KV_URL` / `REDIS_URL` / read-only token | Present (Encrypted) |
| Runtime `X-Scan-KV` | **`1`** (`cache.kvConfigured=true`) |
| Command | `npx vercel --prod --yes` |
| Build | Next.js 15.5.20 — `/api/scan`, `/api/scan/status`, `/scan` present |
| Aliased | https://www.hansomealpacas.xyz |

Secret values were not printed.

---

## Key timings

| Case | Token | Timing | Result | Notes |
|------|-------|-------:|--------|-------|
| Cold Fast Scan | ASTEROID `0x38aa…7777` | **16,764 ms** | PASS* | `hit=false`, `src=fast`, Overall **65**, Structural **68**, provisional, `deep_running` |
| Cold Fast Scan | TYGR `0x6998…e744` | **17,383 ms** | PASS* | `hit=false`, `src=fast`, Overall **77**, Structural **80**, provisional |
| Cached revisit | HANSOME | **304–525 ms** | **PASS** | memory hit; Fast body intact while Deep in progress |
| Concurrent cached ×4 | HANSOME | **427–449 ms** wall each | **PASS** | all HTTP 200, `hit=true` |
| Invalid CA | `not-an-address` | **1,045 ms** | **PASS** | HTTP **400**, `{"error":"Invalid token address","code":"invalid_address"}` |
| Stale → terminal | LEMON / CASHCAT / HANSOME | **&lt; ~3 min** observed | **PASS** | Left stuck-era `deep_running` → honest **`partial`** (not infinite Analyzing) |
| Progressive Deep | HANSOME / ASTEROID / TYGR | relationships **done** first; LP/creator/burn → **partial** | **PASS** | Stages update over status polls |
| Deep final state | HANSOME / TYGR / ASTEROID / LEMON / CASHCAT | within budget window | **PASS (honest partial)** | No token observed as full **`complete`** in this smoke |
| Manual refresh (HANSOME) | after cooldown | **428 ms** | PASS (by design) | Non-blocking: returns usable snapshot (`refreshing=true`), re-arms Deep |

\*Cold Fast for uncached non-HANSOME tokens landed ~**17s**, above the prior HANSOME ~8–10s band. Still usable provisional TTFR; see caveats.

### Deep stage progression (observed)

| Token | Early stages | Mid | Terminal (~≤6 min watch) |
|-------|--------------|-----|---------------------------|
| TYGR | Fast ✓; LP/creator/rel analyzing | relationships → **done** | **`partial`**, inflight=false; LP/creator/burn **partial** |
| ASTEROID | Fast ✓; deep_running | relationships → **done** (~26s); then LP/creator → partial (~52s) | **`partial`**, inflight=false (~234s) |
| HANSOME | Fast ✓; deep_running after refresh re-arm | relationships **done**; burn/LP/creator analyzing → partial | **`partial`**, inflight=false (~182s) |
| LEMON / CASHCAT | Recovered from prior stale deep | — | **`partial`** (honest unavailable copy on LP/burn history) |

---

## Checklist vs approval criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Cold Fast Scan ~8–10s | **PARTIAL** — ASTEROID/TYGR cold **~17s**; HANSOME true cold re-measure blocked by non-blocking refresh + warm KV (historical prod smoke was **8,276 ms**) |
| 2 | Cached scans &lt;1s | **PASS** (300–525 ms; concurrent ~440 ms) |
| 3 | Deep stages progressively update | **PASS** (relationships completes first; others settle) |
| 4 | Deep never remains indefinitely `deep_running` | **PASS** — watched tokens reached **`partial`** with `deepInflight=false` |
| 5 | Within timeout → **complete** or honest **partial** | **PASS** — all reached honest **`partial`** (none full complete in window) |
| 6 | Fast results available throughout Deep | **PASS** — Overall/Structural/provisional Fast body served on every poll |
| 7 | Stale Deep job can recover and retry | **PASS** — stale KV `deep_running` recovered to **`partial`**; refresh re-arms Deep (`refreshing=true`) |
| 8 | Invalid CA → HTTP **400** | **PASS** |
| 9 | Locked/Unlocked liquidity $/% when LP completes | **NOT OBSERVED** — LP stayed `available=false` with “Temporarily unavailable…” / pending; no locked/unlocked USD/% in this smoke |
| 10 | Burn P2/P3 Unknown/partial when incomplete | **PASS** — windows `completeness=unknown`; notes say temporarily unavailable / deep in progress |
| 11 | No scoring formula changes | **PASS** — Deep path recomputes via existing `computeStructuralScore` / `computeOverallTokenScore`; no formula retune shipped; live Overall weights still structural 0.3 / … / dataConfidence 0.05 (HANSOME Overall **51**, Structural **77**) |
| 12 | No secrets exposed | **PASS** — no KV/Upstash/relayer/private-key material in `/scan` HTML or scan JSON |

---

## Feature / LP / burn detail

| Check | Result |
|-------|--------|
| Fast provisional scores usable | **PASS** |
| `lockDistribution.available` after Deep attempt | **false** on all smoked tokens — honest unavailable, not fake 0% locked |
| Locked/Unlocked $ and % | **Pending / unavailable** this run (Deep LP budget exceeded → stage **partial**) |
| Supply & Burn P0/P1 on Fast | **PASS** (dead inventory / mechanisms present on cold Fast responses) |
| Supply & Burn P2/P3 history | **Honest unknown/partial** |
| Vercel production errors (1h) | Only expected invalid-address probe: `ScanRequestError: Invalid token address` → 400 path |

---

## Verdict

**GO WITH CAVEATS** — Deep Scan Reliability is live on Production. The prior infinite-`deep_running` failure mode is fixed: Deep settles to honest **`partial`**, Fast stays usable, invalid CA is **400**, KV is on, secrets not exposed.

### Caveats

1. **Full Deep `complete` + Locked/Unlocked $/% not confirmed** in this smoke. Heavy LP discovery still exhausts the soft budget; stages mark **partial** with retry copy. Aligns with residual risk in `HANSOME_DEEP_SCAN_RELIABILITY.md`.
2. **Cold Fast TTFR for uncached tokens ~17s** (ASTEROID/TYGR), not the HANSOME ~8–10s band. Still acceptable for Public Beta Fast path; monitor HANSOME cold after cache expiry.
3. Manual **`refresh=1` is non-blocking** when a snapshot exists (returns cached Fast + schedules Deep). Do not treat refresh latency as cold TTFR.
4. No token in this window finished multi-version LP far enough to populate economic lock distribution USD/%.

### Critical production break?

**None.** No STOP/hotfix required for Fast path or Deep hang. Main residual: LP lock $/% still requires a successful Deep LP finish (or Refresh retries) on heavy tokens.

---

## Confirmations

- [x] Deployed to Production (`dpl_6Aex84h45sqJ9FqosFyKH31Rk2Mm`)
- [x] KV verified on Production + runtime (`X-Scan-KV: 1`)
- [x] Production smoke only (no Week 2B / Explore / Analytics / Just Launched work started)
- [x] Scoring formulas unchanged (recompute only; no weight/deduction retune)
- [x] Secrets not exposed client-side
- [x] No unrelated feature work started in this deploy session (existing working-tree scan stack + build deps only)
