# HANSOME Score — Production Collecting vs Unavailable Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deploy Collecting vs Unavailable + scan-progress re-arm / ScanClient collecting UX; focused Production smoke only |
| **Deploy ID** | `dpl_Aqe2DGRbqwjvuLfuuajiUXNot2WW` |
| **Deployment URL** | https://hansomealpacas-o7mrjlwuh-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/Aqe2DGRbqwjvuLfuuajiUXNot2WW |
| **PASS / FAIL** | **PASS** |

---

## Pre-deploy / Deploy

| Check | Result |
|-------|--------|
| Feature changes before deploy | **None** — deployed current fix as-is |
| Build blockers only | `prefer-const` + CachedScanResponse re-arm type fix in `scan-cache.ts` (required for `next build`) |
| Command | `npx vercel --prod --yes` |
| Build | Next.js 15.5.20 — `/api/scan`, `/api/scan/status`, `/scan`, `/scan/[address]` present |
| Aliased | https://www.hansomealpacas.xyz |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Production) | **Present** (Encrypted) |
| Runtime `X-Scan-KV` | **`1`** |

Secret values were not printed.

### Fix included

1. Collecting vs Unavailable UI mapping (`ScanClient` + `scan-progress`).
2. Automatic Deep re-arm (`MAX_DEEP_AUTO_RETRIES = 2`) via `rearmPartialForDeepRetry` / status poll + `after()` continue.
3. Retryable partial stages stay Collecting; exhausted budget → honest terminal Unavailable / Unknown.
4. Scoring / LP / burn calculation formulas unchanged.

---

## Observed transitions (HANSOME `0x2C38…0875`)

Refresh watch via `/api/scan?refresh=1` + `/api/scan/status` (~468 s).

### Path A — analyzing → collecting/retryable → done (liquidity)

| t (ms) | `analysisStatus` | `deepRetryCount` | burn / liquidity / creator | Notes |
|-------:|------------------|-----------------:|----------------------------|-------|
| ~0 | `deep_running` | 0 | analyzing / analyzing / analyzing | Fast kick; Collecting |
| ~11k | `deep_running` | 0 | analyzing / **done** / analyzing | Liquidity settled early (known-first path) |
| ~145k | `partial` | **1** | partial / done / partial | Retryable Collecting (`retryable=true`) |
| ~150k | `deep_running` | 1 | **analyzing** / done / **analyzing** | **Auto re-arm #1** (partial → deep_running) |
| ~452k | `partial` | **2** | partial / done / partial | Budget exhausted (`retryable=false`, Collecting=false) |

Liquidity reached **done** while burn/creator remained retryable — not premature Unavailable.

### Path B — analyzing → collecting/retryable → exhausted → unavailable

| Step | Evidence |
|------|----------|
| Collecting / retryable | `partial` @ retry=1, `collecting=true`, `retryable=true` |
| Re-arm | `partial` → `deep_running` with burn/creator flipped back to `analyzing` |
| Exhausted | `deepRetryCount` peaked at **2** (`MAX_DEEP_AUTO_RETRIES`) |
| Terminal unavailable | Final `analysisStatus=partial`, `collecting=false`, `retryable=false`, `deepInflight=false`; burn/creator remain `partial` (UI: Temporarily unavailable / Unknown — not infinite spinner) |

OTHER-token watch skipped — exhaustion path fully observed on HANSOME.

---

## Timings / numbers

| Metric | Value |
|--------|------:|
| Fast TTFR (corrected warm verify) | **449 ms** |
| Refresh-kick TTFR (watch) | **314 ms** |
| Time to first liquidity `done` (watch) | **~11 s** |
| Time to first re-arm (retry 0→1→deep_running) | **~145–150 s** |
| Time to exhausted terminal (retry=2) | **~452 s** |
| Full watch duration | **~468 s** |
| Overall / Structural | **51 / 75** (provisional) |
| Lock Distribution | **available** — locked **$4,639.15 / 28.88%**; unlocked **$11,422.05 / 71.12%** |
| Pool liquidity USD | **$16,092.35** |
| Reconciled with pool | **true** |
| Positions #47299 / #357867 / #142938 | **Y** (all three) |
| Final Deep state | **`partial`**, `deepInflight=false`, `deepRetryCount=2` |
| KV | **on** (`X-Scan-KV: 1`) |

Weights unchanged: structural **0.3** / liquidityDepth **0.2** / holderAdoption **0.18** / activity **0.17** / maturity **0.1** / dataConfidence **0.05**.

Raw artifacts: `reports/_tmp-prod-collecting-retry-smoke.json`, scripts `_tmp-prod-collecting-retry-smoke.mjs` + `_tmp-prod-collecting-retry-verify.mjs`.

---

## Checklist vs approval criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Fast Scan results appear immediately | **PASS** — HTTP 200, TTFR 449 ms, Overall 51 / Structural 75 |
| 2 | Retryable partial stages remain Collecting | **PASS** — `collecting=true` while `retryable=true` at retry=1 |
| 3 | Automatic Deep re-arm works (up to 2 retries) | **PASS** — re-arm observed; peak `deepRetryCount=2` |
| 4 | Liquidity / Creator / Burn do not prematurely show Unavailable while retryable | **PASS** — no premature `failed` while collecting; stages re-armed to `analyzing` |
| 5 | Known-first Lock Distribution appears as soon as available | **PASS** — available with known positions + all three NFTs; liquidity `done` ~11 s into watch |
| 6 | After retries exhausted → stage settles to Unavailable / Unknown | **PASS** — terminal `partial`, retryable=false, burn/creator `partial`, inflight cleared |
| 7 | No infinite spinner | **PASS** — watch ended; `deepInflight=false` |
| 8 | No scoring / LP / burn calculation changes | **PASS** — live weights match documented blend; scores 51/75 |
| 9 | Hero CTA layout correct | **PASS** — Scan gold left, Swap top-right, Play + Litepaper bottom |
| 10 | No secrets exposed | **PASS** — no KV/Upstash/private-key material in `/`, `/scan`, scan JSON |

---

## Verdict

**PASS**

Collecting vs Unavailable + Deep re-arm is live on Production. Observed:

- `analyzing → collecting/retryable → done` (liquidity)
- `analyzing → collecting/retryable → exhausted → unavailable` (burn/creator)

Production left live. **STOP** — no Explore / Analytics / unrelated feature work; no further code changes after deploy.

### Notes

1. Initial smoke script used wrong response paths (`overallScore` / top-level `liquidity`); corrected verify uses `overall.score` + `overview.lpIntelligence`. Transition evidence (status / stages / `deepRetryCount`) was valid throughout.
2. Deploy required two non-feature build fixes only (`const finalized`, CachedScanResponse re-arm assign).
3. Terminal Deep state is honest `partial` (creator/burn incomplete) with Lock Dist preserved.

---

## Confirmations

- [x] Deployed to Production (`dpl_Aqe2DGRbqwjvuLfuuajiUXNot2WW`)
- [x] KV verified on Production + runtime (`X-Scan-KV: 1`)
- [x] No additional feature changes before/after deploy
- [x] Focused Collecting/retry Production smoke only
- [x] Scoring / LP / burn calculations unchanged
- [x] Secrets not exposed client-side
- [x] No unrelated features started
- [x] **STOP** after PASS — Production remains live
