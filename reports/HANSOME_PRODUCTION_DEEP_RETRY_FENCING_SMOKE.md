# HANSOME — Production Deep Retry Race / Generation Fencing Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Pre-deploy gates → deploy fencing IFF PASS → Production smoke |
| **Prior fix report** | `reports/HANSOME_DEEP_RETRY_RACE_FENCING.md` |
| **Previous known-good Production** | `dpl_Aqe2DGRbqwjvuLfuuajiUXNot2WW` (Collecting/retry) |
| **Deploy ID** | `dpl_5m5tmNkwfYXhXejZAQqXAkaSSYz8` |
| **Deployment URL** | https://hansomealpacas-6ojvvv8sm-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/5m5tmNkwfYXhXejZAQqXAkaSSYz8 |
| **Pre-deploy** | **PASS** |
| **Deployed** | **YES** |
| **Production smoke** | **PASS** |
| **Rollback performed** | **NO** |
| **Final Production state** | Fencing deploy live on www.hansomealpacas.xyz |

---

## Pre-deploy gates

| Gate | Result |
|------|--------|
| Unit / regression tests | **PASS** — 5 files, **28/28** tests |
| Typecheck (`npm run typecheck`) | **PASS** |
| Build (`npm run build`) | **PASS** — `/api/scan`, `/api/scan/status`, `/scan` present |
| No scoring / weight formula changes | **PASS** — fencing only touches `deepAttemptId` / persist fences; `OVERALL_WEIGHTS` unchanged (0.3 / 0.2 / 0.18 / 0.17 / 0.1 / 0.05) |
| No secrets exposed | **PASS** |
| No unrelated feature work in this task | **PASS** — deploy ships fencing on top of already-live Scan Collecting/retry stack; no new product features added for this task |
| FOX / HANSOME local+prod-read baseline | **PASS** (see below) |

**Test command:**

```bash
npm run test:scoring -- lib/hansome-score/__tests__/scan-deep-retry-race.test.ts \
  lib/hansome-score/__tests__/scan-progress.test.ts \
  lib/hansome-score/__tests__/scan-deep-reliability.test.ts \
  lib/hansome-score/__tests__/scan-cache.test.ts \
  lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts
```

### Pre-deploy Production baseline (read-only)

| Check | HANSOME | FOX |
|-------|---------|-----|
| Fast Scan HTTP 200 | **PASS** (TTFR ~401 ms) | **PASS** (TTFR ~320 ms) |
| `X-Scan-KV` | **1** | **1** |
| Lock Distribution | **available** | unavailable (expected; not a race fail) |
| LP survives creator/burn partial | **PASS** (liq done / lock on; burn+creator partial) | N/A (heavy token) |
| `deepAttemptId` on Production before deploy | **absent** (Collecting/retry live; fencing not yet) | absent |

**Pre-deploy verdict: PASS** → proceed to deploy.

---

## Deploy

| Item | Value |
|------|-------|
| Command | `npx vercel --prod --yes` |
| Deployed | **YES** |
| Deploy ID | `dpl_5m5tmNkwfYXhXejZAQqXAkaSSYz8` |
| URL | https://hansomealpacas-6ojvvv8sm-the-67.vercel.app |
| Aliased | https://www.hansomealpacas.xyz |
| Build | Next.js 15.5.20 — Ready |

---

## Production smoke

Artifacts: `reports/_tmp-prod-deep-retry-fencing-smoke.json`, `scripts/_tmp-prod-deep-retry-fencing-smoke.mjs`.

### Site / infra

| Check | Result |
|-------|--------|
| www.hansomealpacas.xyz healthy | **PASS** |
| Fast Scan available | **PASS** |
| KV configured (`X-Scan-KV`) | **PASS** (`1`) |
| Cache revisit | **PASS** (memory hit; HANSOME ~0.4–1.2 s) |
| No secrets in `/`, `/scan`, `/scan/[address]` | **PASS** |
| Weights unchanged live | **PASS** |

### Required race / fencing gates

| Gate | Result | Evidence |
|------|--------|----------|
| `deepRetryCount` monotonic; never 2→1 | **PASS** | Corrected watch: no illegal regressions; manual Refresh 2→0 excluded (by design) |
| Stale workers cannot overwrite newer `deepAttemptId` | **PASS** | Unit race suite + live generation ids stamped on start/re-arm |
| Exhausted terminal not re-armed by older worker / auto path | **PASS** | Post-watch: HANSOME `retry=2`, `partial`, `inflight=false`, `collecting=false`, `retryable=false`; stable 25s same `deepAttemptId` |
| Retryable → Collecting | **PASS** | Watch observed `partial` + `retryable/collecting` before re-arm |
| Exhausted → Temporarily unavailable (not Collecting) | **PASS** | Terminal `partial` with `collecting=false` / `retryable=false` |
| No terminal → Collecting regression | **PASS** | No post-exhaustion auto Collecting revival |
| `deepAttemptId` generation fencing live | **PASS** | Present on scan + status `result` after deploy |
| Fast Scan available | **PASS** | |
| HANSOME known-first Lock Dist | **PASS** | See below |
| Completed LP survives creator/burn partial | **PASS** | Lock Dist + known positions remain while burn/creator partial |
| No scoring/weight changes | **PASS** | |
| No unrelated features | **PASS** | |
| Unit/typecheck/build | **PASS** | |
| No secrets | **PASS** | |

### HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`

| Metric | Result |
|--------|--------|
| Fast / Overall / Structural | **51 / 75** (provisional OK) |
| Lock Distribution | **available** — locked **$4,639.15 / 28.88%**; unlocked **$11,422.05 / 71.12%** |
| Known positions #47299 / #357867 / #142938 | **all present** |
| Exhausted terminal | **`analysisStatus=partial`**, `deepRetryCount=2`, `deepInflight=false`, Collecting=false |
| `deepAttemptId` (terminal) | `d_ms3oaoop_i57trac2` (stable across 25s re-check) |
| Relationships | **done** |
| Burn / Creator | **partial** (honest unavailable path; not infinite Collecting) |
| Liquidity stage | may show `partial` on later attempts while Lock Dist values remain available |

### FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1`

| Metric | Result |
|--------|--------|
| Fast Scan | **PASS** (Overall ~69–72) |
| Lock Distribution | unavailable / slow (expected; **not** a race-gate failure) |
| Retry / attempt fencing | Observed `deepAttemptId` + Collecting while deep_running; LP may remain partial across attempts |
| Note | Heavy-token LP soft-fail under budget is a known performance caveat (`HANSOME_FOX_DEEP_RUNTIME_DIAGNOSIS.md`), out of scope for fencing |

### Retry / `deepAttemptId` timeline (summary)

**HANSOME (corrected watch + post-verify):**

| Phase | Status | `deepRetryCount` | Notes |
|-------|--------|-----------------:|-------|
| Pre-refresh baseline | `partial` | 2 | Prior exhausted terminal |
| Manual Refresh | `deep_running` | 0 | New `deepAttemptId`; intentional reset |
| Mid deep | `deep_running` | 0→… | Collecting; stages analyzing / partial |
| Auto re-arm | `deep_running` | bumped on settle path | New generation id |
| Post-watch terminal | `partial` | **2** | Exhausted; Collecting=false; no auto re-arm for ≥25s |

**Illegal 2→1:** **not observed**.  
**Manual Refresh 2→0:** observed and allowed by design.

Raw timeline: `reports/_tmp-prod-deep-retry-fencing-smoke.json` → `fencing.timeline`.

### Automated watch note

First automated full-watch pass used a buggy status parser (`deepRetryCount` / stages live under `result` / `analysisStages`) and treated Refresh 2→0 as a race fail — **false FAIL**, not a Production regression.

Corrected watch (~540s/token) confirmed monotonicity + Collecting + Lock Dist, but ended mid-cycle before capturing exhaustion in-window (`exhaustedTerminal` checklist false at script exit). Immediate post-watch Production read + 25s stability check confirmed exhausted terminal fencing — treated as **PASS**.

---

## Rollback

| Item | Value |
|------|-------|
| Critical regression found? | **NO** |
| Rollback performed | **NO** |
| Production left on | `dpl_5m5tmNkwfYXhXejZAQqXAkaSSYz8` → www.hansomealpacas.xyz |

---

## Final Production state

- **Live:** Deep retry generation fencing (`deepAttemptId` + fenced persist/settle/recover)
- **Alias:** https://www.hansomealpacas.xyz
- **KV:** on
- **HANSOME:** Fast + Lock Dist OK; exhausted terminal stable at `deepRetryCount=2`
- **FOX:** Fast OK; LP may remain slow/partial (performance caveat, not race failure)

---

## Remaining caveats

1. Multi-isolate KV RMW races still possible without compare-and-swap; monotonic `max(deepRetryCount)` remains the safety net.
2. FOX / heavy-token Lock Dist often soft-fails inside liquidity budget — performance follow-up, not fencing.
3. Liquidity stage may flip `done` ↔ `partial` across re-arms while known-position Lock Dist USD/% remain available.
4. Full 0→1→2 wall-clock can exceed ~8–9 minutes; short smoke windows can miss exhaustion even when fencing is correct.
5. Hung workers are not aborted mid-RPC; they no-op on write after generation retire.

---

## Verdict

### Pre-deploy: **PASS**
### Deployed: **YES** (`dpl_5m5tmNkwfYXhXejZAQqXAkaSSYz8`)
### Production smoke: **PASS**
### Rollback: **NO**
### Final: Production remains on fencing deploy — **STOP**
