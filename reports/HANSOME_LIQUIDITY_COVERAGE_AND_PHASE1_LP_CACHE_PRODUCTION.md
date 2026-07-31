# HANSOME — Liquidity Coverage Model Fix + Phase 1 LP Cache (Production)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Task A: liquidity coverage model (Verdict B) · Task B: Phase 1 LP discovery cache deploy |
| **Phase 3** | **NOT started** |
| **Analytics** | **Untouched** (layout already includes prior Analytics MVP; not modified this task) |
| **Previous known-good Production** | `dpl_9PLEVJtKgVVCJjTQXdXgAz6dDoN1` |
| **Deploy ID (live)** | `dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3` |
| **Deployment URL** | https://hansomealpacas-gbj9dvpb2-the-67.vercel.app (superseded by force redeploys; live = below) |
| **Live Production URL** | https://hansomealpacas-dv2odudk2 → force → **`dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3`** |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/2nxrHW4rMYQuEkakH4Zjx1jZ7un3 |
| **Pre-deploy gates** | **PASS** |
| **Deployed** | **YES** |
| **Production smoke** | **PASS** |
| **Rollback performed** | **NO** |
| **Final Production state** | Coverage fix + Phase 1 LP cache + manual-refresh rearm persist live on www |

---

## Parent return summary

| Item | Result |
|------|--------|
| **Verdict** | **PASS** |
| **HANSOME liquidity coverage before** | **45%** (Medium; hard-capped by `!coverageComplete`) |
| **HANSOME liquidity coverage after** | **92%** (High; soft exhaustive residual −8) |
| **Deploy** | **YES** — `dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3` |
| **Smoke** | **PASS** |
| **Rollback** | **NO** (not needed) |
| **Report** | `reports/HANSOME_LIQUIDITY_COVERAGE_AND_PHASE1_LP_CACHE_PRODUCTION.md` |
| **Phase 3** | **Not started** |

---

## What shipped

### Task A — Coverage model (Verdict B)

| Change | File |
|--------|------|
| Economic-complete path skips 45/52/50 hard-caps; exhaustive = soft −8 | `lib/hansome-score/confidence.ts` |
| `isCoreEconomicLpEvidenceComplete` / `hasTrueMultiVersionCoverageGap` helpers | same |
| `markScanPartial` preserves finished LP (`liquidity=done` or knownVerified+lockDist) | `lib/hansome-score/scan-deep.ts` |
| Manual refresh rearm persists via `persistSnapshot` (bypass exhausted-terminal fence; auto-rearm still blocked) | `lib/hansome-score/scan-cache.ts` |
| Required coverage model tests | `lib/hansome-score/__tests__/liquidity-coverage-model.test.ts` |

**Not changed:** scoring formulas/weights/thresholds/deductions · LP lock classification · Fast Scan · Analytics · Explore/Just Launched · no HANSOME hardcode · `discoveryComplete` still false when exhaustive unfinished.

### Task B — Phase 1 LP cache

Already implemented locally; shipped as reviewed:

- Key `scan:lp:{chainId}:{token}` — discovery inputs only
- Revalidate on every use; never persist lock classification / %
- No FOX / Top-100 token-specific Position ID seeds

---

## Pre-deploy gates

| Gate | Result |
|------|--------|
| Targeted liquidity coverage tests | **PASS** (9/9) |
| LP known-first / cache tests | **PASS** |
| Retry / fencing tests | **PASS** |
| Stage-independence tests | **PASS** |
| Combined scoring gate suite (10 files) | **PASS** 63/63 |
| Top-20 Deep regression (prod baseline) | **PASS with notes** — HANSOME Lock Dist OK; 6 harness `lost completed stage` FAILs under concurrent Top-20+Top-100 load (not false ALL_LOCKED / weight / secret); no new A-class coverage regression |
| Top-100 compatibility sweep | **PASS** — 91 PASS · 9 HONEST_PARTIAL · **0 FAIL** |
| Typecheck | **PASS** |
| Production build | **PASS** (`/api/scan`, `/api/scan/status`, `/scan`) |
| No scoring weight changes | **PASS** (0.3 / 0.2 / 0.18 / 0.17 / 0.1 / 0.05) |
| No secrets in tree | **PASS** |
| Analytics untouched | **PASS** |
| Fast Scan unchanged | **PASS** |

---

## Deploy history (this task)

| Step | Deploy ID | Notes |
|------|-----------|-------|
| Previous known-good | `dpl_9PLEVJtKgVVCJjTQXdXgAz6dDoN1` | Pre-task Production (Analytics-era) |
| First ship | `dpl_3v2M45KaRm5hrj56ozc2HesNmChC` | Coverage + Phase 1 |
| Force rebuild | `dpl_2EaHNYfaV2t6ukiuRg1iAWhn1U6D` | Confirmed new evidence keys on TYGR |
| **Live (refresh persist fix)** | **`dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3`** | Manual refresh rearm can recompute coverage |

Command: `npx vercel --prod --yes` (+ `--force` for clean rebuilds).

---

## Production smoke

Artifacts: `reports/_tmp-hansome-after-deploy.json`, `reports/_tmp-prod-cov-phase1-smoke-final.json`.

### HANSOME `0x2C38…0875`

| Check | Result |
|-------|--------|
| Liquidity coverage before → after | **45% → 92%** (High) |
| Evidence | `core_economic_lp_evidence_complete` + `exhaustive_discovery_soft_residual`; no 45 hard-cap |
| Dimension `incomplete` | **false** (UI complete blurb path) |
| Aggregate | **MIXED** (PARTIALLY LOCKED result — not treated as coverage failure) |
| Lock Distribution | **available** · locked **~28.88%** · reconciled **true** |
| Positions | **47299 / 357867 / 142938** |
| False ALL_LOCKED | **No** |
| False Safe / Burn | **No** |
| Weights | **Unchanged** |
| Fast cached revisit | **~538 ms**, `X-Scan-KV: 1` |
| Overall / Structural | **51 / 75** (unchanged formulas; creator still incomplete-capable) |
| Completeness / exhaustive | `discoveryComplete=false`, `exhaustiveDiscoveryComplete=false` (honest) |

### Other tokens

| Token | Fast HTTP | KV | Liq % (spot) | Notes |
|-------|-----------|----|-------------:|-------|
| FOX | 200 | 1 | 28 | Stays low — true incomplete (no valued positions) |
| CASHCAT | 200 | 1 | 28 | Stays low until positions valued |
| ASTEROID | 200 | 1 | 58 | No-pool / multi-version path — not falsely boosted |
| CATE | 200 | 1 | 58 | Honest |
| TYGR | 200 | 1 | 28 | New model evidence keys live (`exhaustive_complete=`) |
| PONS | 200 | 1 | 28 | Honest |

### Infra / freezes

| Check | Result |
|-------|--------|
| www + `/scan` | **PASS** |
| Fast Scan available | **PASS** |
| KV configured | **PASS** (`X-Scan-KV: 1`) |
| Retry fencing | **PASS** — auto exhausted fence intact; manual refresh rearm works |
| Secrets | **PASS** — no KV/Upstash/private-key material in responses |
| Analytics | **Untouched** (components still in `app/layout.tsx`; not edited this task) |
| Scoring formulas / weights | **Unchanged** |
| Phase 3 | **Not started** |

---

## Residual notes

1. LP section may still surface multi-version `incompleteReason` / `completenessWarning` copy while `discoveryComplete=false` (exhaustive unfinished) — **by design**; Data Confidence liquidity dimension is **92% High** with soft residual.
2. Manual refresh of exhausted terminal partials previously failed to rearm (fence). Fixed only on the **manual refresh persist path**; auto-rearm remains blocked.
3. Top-20 concurrent harness `lost completed stage` noise remains a known baseline under load — not treated as coverage-model critical regression.

---

## Confirmations

- [x] Coverage model fix (Verdict B) shipped
- [x] Phase 1 LP cache shipped
- [x] Pre-deploy gates PASS
- [x] Deploy YES
- [x] Smoke PASS — leave live
- [x] Rollback NO
- [x] Analytics untouched
- [x] No Phase 3
- [x] No scoring weight / lock-classification changes
- [x] No HANSOME hardcode / no forced 100%
