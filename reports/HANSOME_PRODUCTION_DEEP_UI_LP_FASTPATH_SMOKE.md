# HANSOME Score — Production Progressive Deep UI + LP Fast-Path Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deploy Progressive Deep UI + LP known/cached-position fast path; focused Production smoke only |
| **Deploy ID** | `dpl_5moDKMkhUyDQ42dMcWrkk4NuwQed` |
| **Deployment URL** | https://hansomealpacas-37dv3122x-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/5moDKMkhUyDQ42dMcWrkk4NuwQed |
| **Verdict** | **GO WITH CAVEATS** |

---

## Pre-deploy

| Check | Result |
|-------|--------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Production) | **Present** (Encrypted) |
| `KV_URL` / `REDIS_URL` / read-only token | Present (Encrypted) |
| Runtime `X-Scan-KV` | **`1`** (`cache.kvConfigured=true`) |
| Command | `npx vercel --prod --yes` |
| Build | Next.js 15.5.20 — `/api/scan`, `/api/scan/status`, `/scan`, `/scan/[address]` present |
| Aliased | https://www.hansomealpacas.xyz |
| Included in tree | Progressive Deep UI + LP known-first path; homepage Hero CTA order swap (`/scan` primary gold) |

Secret values were not printed.

---

## Numbers table

| Metric | HANSOME `0x2C38…0875` | TYGR `0x6998…e744` |
|--------|----------------------:|-------------------:|
| Fast TTFR (warm / cache hit) | **286–486 ms** | **282–294 ms** |
| Overall / Structural | **51 / 77** | **77 / 80** |
| Progressive Deep N/7 (done-only) | **4 / 7** | **4 / 7** |
| Time to first Lock Distribution | **null (not observed)** | **null (not observed)** |
| Positions detected (#47299 / #357867 / #142938) | **none** | n/a (other-token path) |
| Locked $ / % | **unavailable** | **unavailable** |
| Unlocked $ / % | **unavailable** | **unavailable** |
| Final Deep state | **`partial`**, `deepInflight=false` | **`partial`**, `deepInflight=false` |
| Cache revisit | **~286–346 ms**, `hit=true`, `source=memory` | **~275–282 ms**, `hit=true` |
| KV | **on** (`X-Scan-KV: 1`) | **on** |

Weights observed unchanged: structural 0.3 / liquidityDepth 0.2 / holderAdoption 0.18 / activity 0.17 / maturity 0.1 / dataConfidence 0.05.

Local known-first measure (pre-deploy, not Production): lock % ~**8.5s**, positions **47299 / 357867 / 142938**, locked ~**28.9%** / unlocked ~**71.1%**, reconciled — **not reproduced on Production deep path**.

---

## Checklist vs approval criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Fast Scan appears normally | **PASS** — Overall/Structural/provisional Fast body; HANSOME 51/77, TYGR 77/80 |
| 2 | Progressive Deep UI shows N / 7 | **PASS** — client copy `Deep Analysis — {done} / {total} complete`; live done-count **4/7** |
| 3 | ✓ / ⏳ / ⚠ update correctly | **PASS** — stages cycle `done` / `analyzing` / `partial`; i18n symbols shipped |
| 4 | Completed sections remain visible while others continue | **PASS** — contract/holders/market/relationships stay `done` while burn/LP/creator analyze |
| 5 | Spinner + estimated-time copy display | **PASS** — section spinner + Est. ~5–15s / ~1–2 min / ~2–4 min in client bundle |
| 6 | Partial not counted as complete | **PASS** — done-count uses only `done`; burn/LP/creator `partial` excluded from N |
| 7 | Positions #47299, #357867, #142938 all detected | **FAIL** — not observed on Production after refresh + ~234s deep watch |
| 8 | Known/cached revalidation before exhaustive | **FAIL (not observed)** — `knownPositionsVerified` never became true; no progressive LP publish |
| 9 | Lock Distribution without waiting for full LP discovery | **FAIL** — `lockDistribution.available=false` throughout |
| 10 | Time until Locked/Unlocked $ and % first appear | **n/a** — never appeared |
| 11 | Lock Distribution reconciles with pool liquidity | **FAIL** — no available lock dist |
| 12 | Exhaustive may continue without blocking Lock Dist | **FAIL** — Lock Dist never surfaced; exhaustive not reached with known-first publish |
| 13 | Deep reaches honest complete or partial | **PASS (honest partial)** — terminal `partial`, inflight clears |
| 14 | Cached revisit fast | **PASS** (~280–500 ms) |
| 15 | No secrets exposed | **PASS** — no KV/Upstash/private-key material in `/scan`, `/`, or scan JSON |
| 16 | No scoring changes | **PASS** — live weights unchanged; no formula retune in this deploy |

---

## Other-token result (TYGR)

| Check | Result |
|-------|--------|
| Fast Scan | **PASS** — TTFR ~282 ms (warm), Overall **77**, Structural **80**, provisional |
| Progressive stages | **PASS** — same 4/7 done pattern; partials not counted |
| LP known/cached fast path | **FAIL** — same as HANSOME: lock unavailable, no verified known positions |
| Conclusion | Fast path is **not HANSOME-only**; LP fast-path miss is **cross-token** on Production deep orchestration |

---

## Root cause (STOP — no further code changes)

Production Deep still runs **relationships → creatorBurn → liquidity** sequentially inside `enrichScanDeep`.

On **creatorBurn timeout**, the function **returns early** and **never enters the liquidity / known-first block**. Observed Production behavior matches this: relationships often `done`, creator/burn/liquidity settle `partial`, and `overview.lpIntelligence` never receives known-position progressive updates.

So:

- Progressive Deep **UI** is live and correct.
- LP known/cached fast path code is in the deploy, but **Production deep orchestration does not reach it** when creator/burn history exceeds budget (common on Robinhood tokens).
- This is **not** a Fast Scan outage and **not** a scoring regression. Production remains live.

**Critical production break requiring rollback?** **No** — Fast path and prior Deep reliability (honest `partial`) remain usable. **Critical for LP fast-path acceptance?** **Yes** — STOP before further feature work; fix requires letting liquidity/known-first run even when creatorBurn times out (separate approval).

---

## Verdict

**GO WITH CAVEATS** — Progressive Deep UI is live on Production (N/7, ✓/⏳/⚠, spinners/estimates, partials excluded). Fast Scan, KV, cache revisit, secrets, and scoring are healthy. Homepage Hero CTA swap (`/scan` primary) included.

### Caveats

1. **LP known/cached fast path not validated on Production** — positions / Lock Dist $/% not observed; blocked by creatorBurn timeout early-return before liquidity stage.
2. Same residual as prior Deep Reliability smoke: heavy tokens end **honest `partial`** without Locked/Unlocked economics.
3. Fast TTFR measured warm (KV/memory); true cold Fast not re-forced this run.
4. No Explore / Analytics / Just Launched / Week 2B / other new features started.

### Critical production break?

**None requiring STOP-rollback.** Production stays live. **STOP further changes** until LP orchestration fix is explicitly approved.

---

## Confirmations

- [x] Deployed to Production (`dpl_5moDKMkhUyDQ42dMcWrkk4NuwQed`)
- [x] KV verified on Production + runtime (`X-Scan-KV: 1`)
- [x] Focused Production smoke only
- [x] Scoring formulas unchanged
- [x] Secrets not exposed client-side
- [x] No new features started (Explore / Analytics / Just Launched / Week 2B)
- [x] Hero CTA order swap included from working tree (harmless)
- [x] STOP after LP fast-path Production miss — no hotfix applied in this session

---

## Addendum — LP orchestration fix (2026-07-28, not deployed)

| Field | Value |
|-------|-------|
| **Status** | Local fix verified — **ready for Production deploy (awaiting approval)** |
| **Deployed?** | **No** |

### Root cause (confirmed in code)

`lib/hansome-score/scan-deep.ts` previously ran `relationships → creatorBurn → liquidity` and **returned early** on creatorBurn timeout (`return current` after `creatorBurn:timeout`), so the liquidity / known-first block never ran. Same pattern existed for relationships timeout.

### Fix summary

1. Soft-fail relationships / creatorBurn / liquidity independently (no cross-stage abort).
2. Reorder Deep to **relationships → liquidity (known-first) → creatorBurn** so Lock Dist is not gated on transfer paging.
3. Finalize as honest `partial` when any deep stage is unresolved; preserve completed LP + Fast body.
4. Scoring formulas/weights unchanged.

### Local verification

| Check | Result |
|-------|--------|
| Unit: stage independence | **PASS** (`scan-deep-stage-independence.test.ts`) |
| Known-first measure | **PASS** — positions `#47299` / `#357867` / `#142938`; lock ~28.9% / ~71.1%; reconciled |
| Orchestration (creatorBurn forced timeout) | **PASS** — `liquidity:done` + Lock Dist **before** creatorBurn soft-timeout; terminal honest `partial` |
| Artifact | `reports/hansome-deep-orchestration-independence.json` |

**Production deploy recommendation:** **PASS** (not deployed in this session).
