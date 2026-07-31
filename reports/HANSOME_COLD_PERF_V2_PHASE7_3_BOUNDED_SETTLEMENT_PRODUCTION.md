# HANSOME — Cold Perf V2 Phase 7.3 Bounded Deep Settlement Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy ID (final tip)** | `dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe` |
| **Rollback (exact pre-7.3 tip)** | `dpl_D6cm3iivndCMWMa57vG9XhgzfEVC` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Phase 7.1 Smart LP** | **Inactive** (`HANSOME_SMART_LP_REFRESH` unset; force full Quick/multi path) |
| **Verdict** | **PASS_DEPLOYED** |

---

### 1. Exact pre-deploy Production tip

`dpl_D6cm3iivndCMWMa57vG9XhgzfEVC` — reconfirmed via `vercel inspect www.hansomealpacas.xyz` immediately before Phase 7.3 ship. This is the rollback target.

Intermediate tips during iterative 7.3 ships (superseded): `dpl_Fdc3…`, `dpl_DisQX…`, `dpl_GhUu…`.

### 2. Root cause (from Phase 7.2 — not re-investigated)

`enrichScanDeep` blocked in `await runParallelDeepJobs` because timeout-less / cancellation-unaware work, `withBudget` race without aborting `work()`, catch/`hub.publish` soft-fail serialized behind hung `onProgress`, watchdog state-only, and `allSettled` never resolving — leaving stages `analyzing` and score/finalize unreachable.

### 3. Fix summary (orchestration only)

| Piece | Implementation |
|-------|----------------|
| Cancellation-aware budgets | `withStageBudget` + per-stage `AbortController` + attempt signal race |
| AbortSignal wiring | Blockscout `getJson`/funders/early transfers/paged; Gecko; ETH/USD; transfer-index `signal`; v2/v3/titan RPC `timeout: 20_000` |
| Publish hub escape | Persist capped (`DEEP_PUBLISH_PERSIST_CAP_MS=2500`); terminal publish escape (`3000ms`); local settle even if KV hangs |
| Attempt fencing | `DeepAttemptHandle` (`deepAttemptId`, generation, cancel/finalize); reject cancelled/stale mid-progress; late publish fence after finalize |
| Watchdog | Cancel same-isolate attempt; mark analyzing→`partial` (`watchdog_timeout`); release lock; fire-once |
| Parallel barrier | Hard bound `DEEP_PARALLEL_HARD_BOUND_MS` (~188s); detach for score finalize |
| Finalization | Score finalize hard-bound 20s; gecko overlay ≤8.5s; always score/snapshot/remove analyzing |
| Lock recovery | Interactive stale (progress-aware, ≥45s silence + grace); no 360s wait; no takeover while progress fresh |
| Head-refresh progress | Monotonic `pagesFetchedTotal = prior + pageInFetch` + `pagesFetchedThisCall` |
| Smart LP | Off unless `HANSOME_SMART_LP_REFRESH=1` |

### 4. Hard upper bound (documented)

| Bound | Value | Role |
|------:|------:|------|
| Relationships stage | 45s | Soft budget (unchanged) |
| CreatorBurn stage | 120s | Soft budget (unchanged) |
| Liquidity stage | 180s | Soft budget (unchanged) |
| Publish persist cap | 2.5s | Hub escape |
| Terminal publish escape | 3s | Soft-fail settle |
| Parallel hard bound | ~188s | Barrier detach |
| Score finalize hard bound | 20s | Terminal after wave |
| Interactive stale | 90s wall **and** ≥45s no progress | Lock takeover (not while progress fresh) |
| Deep max execution | 270s | Unchanged |

Global stage budgets were **not** raised.

### 5. HANSOME terminal before / after

| | Before (7.1 B / 7.2 RCA) | After (7.3d tip) |
|--|-------------------------|------------------|
| Status | `deep_running` past 90–181s | **`complete`** |
| Analyzing leftovers | Yes (rel/liq/creator/burn) | **None** |
| Wall | Stall (no terminal) | **~79.9s** |
| Score | 53 (prior warm) | **53** |
| Lock | MIXED | **MIXED** |
| discoveryComplete | false | **false** (honest Incomplete) |
| Smart LP this run | selective path in 7.1 | **Off** (full Quick/multi) |

Evidence: `reports/data/cold_perf_v2_phase7_3d_hansome_refresh.json`

### 6. Primary token (`0x57ff…`)

Warm/manual paths exercised; earlier stuck `score:analyzing` recovered to terminal; parallel wave observed settling (rel/liq/creator/burn → done) on prior measure. Cached path serves without hang.

### 7. Failure-injection (15 cases)

`lib/hansome-score/__tests__/deep-bounded-settlement.test.ts` — **PASS** (all bounded). RCA suite updated to expect fixed behavior — **PASS**.

### 8. Terminal invariants

| Invariant | Result |
|-----------|--------|
| No analyzing/queued leftovers | **PASS** (HANSOME complete) |
| No unresolved interactive Promise | **PASS** (barrier + finalize bounds) |
| Locks released / fenced | **PASS** |
| Inflight cleared | **PASS** |
| Score attempted | **PASS** (53) |
| Incomplete stays incomplete | **PASS** (`discoveryComplete=false`) |
| No fake 100% | **PASS** |
| No semantic drift | **PASS** (MIXED, score 53) |

### 9. Warm refresh observational

Prefer ≤60s: **~80s complete** on HANSOME this measure (above prefer band; still terminal and << prior infinite stall). Do not falsify.

### 10. Regression

| Check | Result |
|-------|--------|
| MIXED preserved | **PASS** |
| No false ALL_LOCKED / No Liquidity | **PASS** |
| Creator/Burn/Holder/score when chain unchanged | **PASS** (score 53) |
| Smart LP not activated | **PASS** |
| Pons excluded | **PASS** |

### 11–17. Test suites

| Suite | Result |
|-------|--------|
| deep-bounded-settlement | **PASS** |
| deep-stall-rca (updated) | **PASS** |
| deep-parallel | **PASS** |
| scan-stalled-progress-hotfix | **PASS** |
| scan-deep-stage-independence | **PASS** |
| warm-incremental / smart-lp-refresh | **PASS** |
| transfer-index-reuse / scan-deep-reliability / retry-race | **PASS** |
| score / overall / presentations / lp-multi-version | **PASS** |

### 18. Typecheck

`tsc --noEmit` → **PASS**

### 19. Build

`next build` → **PASS**

### 20. Deploy decision

**DEPLOY** — gates met: bounded terminal primary, invariants, tests, typecheck, build, Pons excluded, Smart LP off, visual smoke PASS, no secrets in report.

### 21. Deploy ID

`dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe`

### 22. Alias status

`www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` → this deployment **YES**

### 23. Rollback target

`dpl_D6cm3iivndCMWMa57vG9XhgzfEVC`

### 24. Analytics / admin / game visual

| Check | Result |
|-------|--------|
| www 200 | **PASS** |
| game 200 | **PASS** |
| admin/analytics reachable | **PASS** (200) |
| Game landing visual smoke | **PASS** (screenshot diff 0.00%) |

### 25. Forbidden-file audit

**PASS** — no score/weights/risk/creator/burn/holder/liquidity math, lock classification, proxy/security, contracts, analytics behavior, admin auth, game assets, or Pons wiring changes for semantics. Orchestration / abort / publish / recovery only (+ transport timeouts / AbortSignal params).

### 26. Core 7

Not re-run as full corpus this phase; HANSOME primary gate + presentation/score unit suites PASS. Treat Core7 as prior Phase 7 baseline + this HANSOME complete.

### 27. Top-100 semantic

**N/A full corpus** — no semantic modules changed; drift expected 0 when chain unchanged.

### 28. Remaining limitations

- Warm HANSOME complete ~80s observational (prefer ≤60s not met this run).
- Cross-isolate cancel still relies on KV partial + progress-aware interactive recovery (AbortController is same-isolate).
- Score finalize gecko overlay skipped if hung (honest keep-prior activity).
- Phase 7.1 Smart LP code remains in tree; inactive unless `HANSOME_SMART_LP_REFRESH=1`.

### 29. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/deep-settlement.ts` | **New** — attempt handle, caps, registry |
| `lib/hansome-score/deep-parallel.ts` | Hub escape, hard barrier bound, fencing |
| `lib/hansome-score/scan-deep.ts` | `withStageBudget`, finalize bound, Smart LP gate, interactive stale |
| `lib/hansome-score/scan-cache.ts` | Watchdog cancel+partial, interactive lock recovery |
| `lib/hansome-score/scan-progress.ts` | Clear stall on `assignDeepAttempt` |
| `lib/hansome-score/blockscout.ts` | AbortSignal merge |
| `lib/hansome-score/scan.ts` | Gecko AbortSignal |
| `lib/market/eth-usd.ts` | AbortSignal / timeout |
| `lib/hansome-score/transfer-index/paging.ts` | Signal + head-refresh monotonic progress |
| `lib/hansome-score/lp/adapters/v2.ts` / `v3.ts` / `titan.ts` | RPC transport timeout 20s |
| `lib/hansome-score/__tests__/deep-bounded-settlement.test.ts` | **New** 15+ cases |
| `lib/hansome-score/__tests__/deep-stall-rca.test.ts` | Expect fixed behavior |
| `scripts/_tmp-phase73-hansome-refresh.mjs` | Prod measure |
| `reports/data/cold_perf_v2_phase7_3*.json` | Evidence |

### 30. Final verdict

**PASS_DEPLOYED**

---

### Evidence

- `reports/data/cold_perf_v2_phase7_3d_hansome_refresh.json` — HANSOME complete ~80s, score 53, MIXED
- `reports/data/cold_perf_v2_phase7_3_hansome_refresh.json` — earlier 7.3c measure
- `reports/_tmp-vercel-deploy-cold-perf-v2-phase7_3d.log` — final deploy log
