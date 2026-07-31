# HANSOME — Progressive Progress Bars Production Smoke

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Production deploy of Honest Progressive Analysis Progress Bars + five-token smoke |
| **Approval** | `reports/HANSOME_SCAN_PROGRESSIVE_PROGRESS_BARS.md` |
| **Vercel Production build** | **PASS** (compile + types + prerender) |
| **Deployed** | **YES** |
| **Production deploy ID (live tip)** | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |
| **Previous known-good (rollback target)** | `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` |
| **Production alias** | https://www.hansomealpacas.xyz — **YES** (aliased to live tip) |
| **PonsLaunchLocker in this release** | **NO** |
| **Rollback** | **NO** |
| **Overall verdict** | **PASS** |
| **Redeploy of same content?** | **YES** — fresh Production build/alias of the progress-bars ship already live on `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE`; no intentional feature delta; Pons still excluded |

---

## Redeploy note (2026-07-28 evening)

Prior tip `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` already carried progressive progress bars and had passed smoke. Per approved procedure, a **fresh** Vercel Production build + deploy was run anyway.

| Item | Prior tip | Fresh redeploy (live) |
|------|-----------|------------------------|
| Deploy ID | `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |
| URL | https://hansomealpacas-mbu4osw8i-the-67.vercel.app | https://hansomealpacas-n0h2r9y7r-the-67.vercel.app |
| Content | Progress-bars ship, Pons out | Same ship class; Pons still out |
| Smoke | PASS (earlier) | **PASS** (this run) |

Ship controls unchanged: `V3_LOCKER_ADAPTERS = []`; `LOCKER_REGISTRY` = Titan only; `pons.ts` + pons tests + Pons adapter report in `.vercelignore`.

---

## 1. Production deploy ID

`dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9`

| Item | Value |
|------|--------|
| URL | https://hansomealpacas-n0h2r9y7r-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/29CxyDDbzvLYK8gtm6y4T4U7hGQ9 |
| Command | `npx vercel --prod --yes` |
| Log | `reports/_tmp-vercel-redeploy-progress-bars.log` |
| Rollback target | `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` |

---

## 2. Alias confirmation

| Check | Result |
|-------|--------|
| `www.hansomealpacas.xyz` → live tip | **YES** (`vercel inspect` → `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9`) |
| Also aliased | `hansomealpacas.xyz`, `game.hansomealpacas.xyz`, project `.vercel.app` |

---

## 3. Vercel build result

| Gate | Result |
|------|--------|
| Upload / cloud `next build` | **PASS** |
| Compile | **PASS** (~14.8s) |
| Lint / typecheck (cloud) | **PASS** (existing img/hooks warnings only) |
| Prerender static pages | **PASS** (40/40) |
| Alias cutover | Only after build READY |

If build had failed, Production alias would **not** have been cut over. It succeeded; alias updated.

---

## 4. Smoke results (HANSOME, FOX, CASHCAT, PONS, TYGR)

Artifacts: `reports/_tmp-prod-progress-bars-redeploy-smoke.json`, `scripts/_tmp-prod-progress-bars-smoke.mjs` (retry-hardened fetch), `reports/_tmp-prod-progress-bars-redeploy-smoke.log`.

| Token | Fast | Deep after Fast | Notes |
|-------|------|-----------------|-------|
| **HANSOME** | **PASS** (~360ms cached TTFR) | **PASS** | Overall 53; weights OK; LP `#47299` / `#357867` / `#142938`; Lock Dist **~28.9%** (`MIXED`) |
| **FOX** | **PASS** | **PASS** | Overall 73; v3 `material=1, dust=1`; **one** presentation pool (WETH); USDG dust **not** a card |
| **CASHCAT** | **PASS** | **PASS** | Overall 85; Deep stages advanced; no false `ALL_LOCKED` |
| **PONS** | **PASS** | **PASS** (status sample) | Overall 81; locker support **not** activated |
| **TYGR** | **PASS** | **PASS** (status sample) | Overall 77; Scan healthy; no false `ALL_LOCKED` |

### Checklist

| Check | Result |
|-------|--------|
| Fast first; Deep progress immediately after | **PASS** |
| Progress from real stages/pages/pools/positions only | **PASS** (UI copy in Production chunks; no fake timers) |
| Workflow Progress ≠ Analysis Coverage | **PASS** (distinct client fields; coverage vs stage-completion proxy) |
| Scores/coverage update only on real snapshot changes | **PASS** |
| Retryable partial / exhausted copy keys live | **PASS** |
| Monotonic within `deepAttemptId` | **PASS** (HANSOME/FOX/CASHCAT watches) |
| Cached completed / warm path | **PASS** (HANSOME revisit ~308ms, `x-scan-cache: memory`) |
| FOX one material pool; dust omitted | **PASS** |
| HANSOME LP targets + Lock Dist intact | **PASS** |
| No false `ALL_LOCKED` | **PASS** (all five) |
| No score/LP/burn/creator/holder/lock/cache/fencing regressions | **PASS** |
| No secrets exposed | **PASS** |
| Pons adapter markers in Production JS | **ABSENT** |

---

## 5. Progress UI evidence (textual)

Production JS chunks still contain honest progress copy:

```text
progressOverallLabel / "Deep Analysis"
progressModulesCompleted: "{done} / {total} modules completed"
progressActiveStage: "Analyzing {stage}…"
progressTimeVaries: "Time remaining varies by on-chain history."
progressCollectingLiquidity / progressWorkflowCollecting / …
```

Chunk samples (same family as prior tip):

- `/_next/static/chunks/4555-3d966344e98f17a8.js`
- `/_next/static/chunks/4983-d251c21a0af4dfab.js`

---

## 6. Regression summary

| Area | Result |
|------|--------|
| Score weights (0.3 / 0.2 / 0.18 / 0.17 / 0.1 / 0.05) | Intact |
| FOX dust materiality | Intact (`material=1`, dust omitted from cards) |
| HANSOME LP presentation + Lock Dist | Intact (~28.9%, three Position NFTs) |
| Retry / `deepAttemptId` fencing | No regression in Production watches |
| Burn / creator / holder semantics | No intentional changes; smoke OK |
| Secrets in HTML/API | None |
| PonsLaunchLocker | **Not included** |

---

## 7. Rollback decision

**Rollback: NO**

Production left on `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` after smoke **PASS**.

Rollback target if needed later: `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE`.

---

## 8. Pons not implemented this release; backlog recorded

| Item | Status |
|------|--------|
| PonsLaunchLocker adapter activated in Production | **NO** |
| Active markers (`pons_launch` / `PonsLaunchLocker.getLaunchedToken`) in Production JS | **Absent** |
| Ship controls | `V3_LOCKER_ADAPTERS = []`; `LOCKER_REGISTRY` = Titan only; `pons.ts` + pons tests + Pons adapter report in `.vercelignore` |
| Backlog note | **Recorded** in `reports/HANSOME_LOCKER_0xbcbdf667_INVESTIGATION.md` → section **Future work (approved backlog)** |
| Current Production policy for Pons V3 | Unknown / Unavailable when real Position NFT not resolvable; no inference from pool inventory or `v3-pool:` stub |

Local `lib/hansome-score/lp/lockers/pons.ts` may still exist on disk as unfinished backlog source, but it is **not wired** and **not uploaded** for this Production ship.

---

## Parent return summary

| Field | Value |
|-------|--------|
| **1. Production deploy ID** | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |
| **2. Production alias** | **YES** — `www.hansomealpacas.xyz` → this deploy |
| **3. Vercel build** | **PASS** |
| **4. Smoke** | **PASS** (HANSOME / FOX / CASHCAT / PONS / TYGR) |
| **5. Regression summary** | No regressions; FOX materiality + HANSOME LP/Lock Dist intact; progress UI live |
| **6. Rollback** | **NO** (not performed); target `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` |
| **Pons included** | **NO** |
| **Redeploy same content** | **YES** (fresh deploy of progress-bars ship) |
| **Report path** | `reports/HANSOME_SCAN_PROGRESSIVE_PROGRESS_BARS_PRODUCTION_SMOKE.md` |
