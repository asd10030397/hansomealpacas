# HANSOME — Cold Perf V2 Phase 7.2 Deep Stall Root Cause Analysis

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Mode** | Investigation + instrumentation only |
| **Deploy** | **None** (alias undisturbed) |
| **PonsLaunchLocker** | **Excluded** |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

### 1. Exact live Production tip

| Tip | Role |
|-----|------|
| **`dpl_D6cm3iivndCMWMa57vG9XhgzfEVC`** | **Verified live alias** for `www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` (via `vercel inspect www.hansomealpacas.xyz` + `vercel alias ls`) |
| `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` | Phase 7 Warm Incremental — still Ready; cited as Phase 7 baseline; inspect still lists www/game aliases on this deployment object (alias registry currently points at D6cm) |
| `dpl_Cq581YYcyRsF4GyNiMwyHWr3uVeA` | Phase 7.1 A — rolled back |
| `dpl_BmYaoS5WJbCGRC3Prtj6evWEKabi` | Phase 7.1 B — rolled back |

**Interpretation:** Analytics/admin secret reset (or later Production ship) moved the live tip to `dpl_D6cm3iivndCMWMa57vG9XhgzfEVC`. Treat **D6cm** as current alias tip. Phase 7 stall baseline measurements remain those taken on `dpl_FmkQQ…` / 7.1 attempts. Any future deploy’s rollback target = tip immediately before that deploy.

---

### 2. Reproduction steps

1. Ensure warm HANSOME snapshot exists (score 53, MIXED, incomplete discovery).
2. `GET/POST /api/scan?address=0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875&refresh=true`
3. Poll `/api/scan/status` every ~2s for ≥90s.
4. Observe: `deep_running` persists; last real actions then `watchdog_stall`; stages remain `analyzing`.
5. Also exercise primary `0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f` for cached / refresh parity.
6. Failure injection: unit tests in `lib/hansome-score/__tests__/deep-stall-rca.test.ts` (no destructive prod experiments).

---

### 3. HANSOME critical-path timeline (Phase 7.1 B evidence)

Source: `reports/data/cold_perf_v2_phase7_1b_hansome_refresh.json`

| atMs | action | stage | liq | notes |
|-----:|--------|-------|-----|-------|
| 1965 | `final_validation` | complete | analyzing | Stale deepProgress from prior complete snapshot |
| 4435 | `start` | relationships | analyzing | New Deep attempt |
| 6601 | `head_overlap_refresh` | creatorBurn | analyzing | CreatorBurn job **start** publish (work not done) |
| 8707–10598 | `lp_refresh_plan` | liquidity | analyzing | Smart LP planner published; next steps not observed |
| 12434 | `funder` | relationships | analyzing | **Last real progress** |
| 58884 | `watchdog_stall` | relationships | analyzing | 45s silence → status-poll watchdog |
| 91739 | `watchdog_stall` | relationships | analyzing | Still `deep_running`; measure end |

Phase 7 baseline complete wall: **~60.7s**. 7.1 A: **~181s** still `deep_running`. 7.1 B: **~91.7s** still `deep_running`.

---

### 4. Span table (sorted by diagnostic importance)

Opt-in: `HANSOME_DEEP_STALL_TRACE=1` → `lib/hansome-score/deep-stall-trace.ts`.

| Span | Observed / inferred status on stalled refresh | Notes |
|------|-----------------------------------------------|-------|
| `scan.refresh.request` | completed | HTTP returns fast with `deep_running` |
| `scan.deep.launch` / `after()` | started | `ensureDeepAnalysis` → `runFreshScan` |
| `scan.deep.parallel.start` | completed | Parallel wave armed |
| `relationships.start` | completed | |
| `relationships` / `funder` publish | completed (~12.4s) | Last durable progress (7.1 B) |
| `relationships.loadEarlyTransfers` / remaining funders | **unresolved or hub-blocked** | No `early_transfers` / `done` / `timeout` |
| `creatorBurn` / `head_overlap_refresh` | start only | No `page_*` / `new_transfers_merge` / `timeout` |
| `transferIndex.headRefresh` first Blockscout page | **unresolved** (7.1 A dominant) | `pagesFetched` stayed 0 for ~45s+ |
| `liquidity` / `lp_refresh_plan` | completed | |
| `liquidity.plan` → detect / gecko | **unresolved within measure** | No `lp_cache_validate` / `done` in polls |
| `parallel.await.settle` | **unresolved** | Score never starts |
| `watchdog.fire` | completed (state-only) | Does not settle barrier |
| `score.recompute` / `scan.finalize` | never reached | |

---

### 5. Await graph

```
scan API (refresh=true)
└─ getCachedScan → rearm warm stages → scheduleDeepAnalysis
   └─ after(() => ensureDeepAnalysis)
      └─ runFreshScan
         ├─ acquireRefreshLock (NX, TTL ≈ 300s)          ← held for whole enrich
         └─ enrichScanDeep
            └─ runParallelDeepJobs          ← Promise.allSettled BARRIER
               ├─ Relationships
               │  └─ withBudget(45s)
               │     └─ Promise.all
               │        ├─ fetchNativeFunder × N  (+ await publish mid-loop)
               │        └─ loadEarlyTransfersFromIndex
               │     catch → await hub.publish(partial)   ← can block on hub
               ├─ Liquidity
               │  └─ publish(lp_refresh_plan)
               │  └─ withBudget(180s)
               │     └─ coalesceSmartLpRefresh
               │        └─ fetchOptionalGeckoActivity     ← NO AbortSignal
               │        └─ fetchEthUsd                    ← NO AbortSignal
               │        └─ detectV4LpIntelligence / multi ← v2/v3/titan http() often no timeout
               └─ CreatorBurn
                  └─ withBudget(120s)
                     └─ fetchTokenTransfersWithCheckpoint
                        ├─ acquireTransferIndexLock
                        └─ runHeadRefresh
                           ├─ loadPriorChunkTransfers
                           └─ fetchTokenTransfersPaged (page 1)  ← blocked before onPage
                              └─ onPage → await onPageProgress → hub.publish
            └─ score.recompute   ← NEVER reached while barrier unresolved

status poll (parallel path)
└─ watchdog_stall stamp only     ← does NOT abort / detach barrier
└─ scheduleDeepAnalysis if !inflight
   └─ runFreshScan !lock → return deep_running snapshot (no takeover)
```

**Exact unresolved operation (prod stall shape):**  
`await runParallelDeepJobs(...)` inside `enrichScanDeep`, because at least one parallel job remains pending on either (a) unterminated stage work inside `withBudget`, or (b) `await hub.publish(...)` soft-fail queued behind a hung `onProgress` persist — while the status-poll watchdog only sets `deepProgress.stalled` and never detaches the barrier.

---

### 6. Lock timeline

| Lock | TTL | Acquire | Release | Stale recovery | Stall role |
|------|----:|---------|---------|----------------|------------|
| Scan refresh `SCAN_KEYS.lock` | **~300s** (`DEEP_SCAN_MAX_EXECUTION_MS/1000+30`) | NX at `runFreshScan` | `finally` | TTL expiry; `recoverStaleDeepIfNeeded` at **360s** | Owner hung/dead → waiters **return `deep_running` without takeover** |
| Transfer-index NX | 120s (Deep uses ≤150s) | Writer path | `finally` | TTL | Miss → immediate `concurrent_reuse` (0 RPC) — **not** a wait loop |
| Smart LP refresh | 120s | coalesce | `finally` | memory TTL helper | Same-isolate coalesce; hung owner blocks coalesced waiters |
| Promise `inflight` / `backgroundRefresh` | process-local | schedule/ensure | `finally` identity-safe | isolate death clears memory | Cross-isolate cannot see memory inflight |

**Stale lock as sole cause?** Not proven for 7.1 B (worker still publishing until 12s). Proven amplifier: after owner death/hang past interactive budgets, **300s refresh lock + non-takeover waiter** keeps `deep_running` visible through 90–180s measure windows.

---

### 7. Promise settlement audit

| Promise | Settles? | On timeout | Risk |
|---------|----------|------------|------|
| `withBudget` race | outer await rejects | **does not abort `work()`** | Abandoned work may still hold hub via `await publish` |
| Stage catch → `hub.publish(partial)` | only if hub free | Blocked if prior `onProgress` hung | Soft-fail never lands (matches missing `timeout` actions in prod) |
| `runParallelDeepJobs` / `Promise.allSettled` | waits all jobs | N/A | One hung job → score never runs |
| Publish hub chain | serial `chain.then` | N/A | Single hung `onProgress` blocks all stages |
| Watchdog | N/A (sync stamp) | N/A | **Not cancellation-aware** |
| `fetchOptionalGeckoActivity` / `fetchEthUsd` | may never | no signal | Liquidity hangs until 180s budget |
| v2/v3/titan `http()` | may never | no transport timeout | Full LP path hang |
| Blockscout `getJson` | ≤12s×3 | AbortSignal.timeout | Bounded |
| Transfer concurrent_reuse | immediate | N/A | Safe |
| Background LP exhaustive / xfer hist | fire-and-forget | N/A | Correctly off barrier |

---

### 8. Watchdog findings

| Question | Answer |
|----------|--------|
| 1. Does orchestration stop waiting when watchdog marks partial? | **No** — watchdog does not mark stages partial; only `deepProgress.stalled` |
| 2. Does underlying fetch get `AbortController.abort()`? | **No** |
| 3. Can late completion overwrite partial/done? | Yes — late publish can still land; monotonic stage merge helps, but `deepProgress` action overwrites |
| 4. Can watchdog fire repeatedly? | Flag prevents re-stamp while `stalled===true`; polls keep returning stalled |
| 5. Can watchdog hold publish mutex? | Uses `persistProgressResponse` on status path — **separate from hub**, can write while worker hub stuck |
| 6. Can stage remain `analyzing` after watchdog? | **Yes** (prod evidence) |
| 7. Can final score wait forever on watchdog-marked stage? | **Yes** until stage budget / isolate death / 360s stale recovery |

**Verdict:** Watchdog is **state-only**, not cancellation-aware.

---

### 9. Relationships findings

| Check | Result |
|-------|--------|
| Independent transfer refetch? | Only if `loadEarlyTransfersFromIndex` returns null → `fetchEarlyTokenTransfers` |
| Waits on transfer-index head? | Reads index chunk (no lock wait) |
| Waits on historical continuation? | **No** |
| Funding graph RPC? | `fetchNativeFunder` per sample holder (Blockscout, bounded) |
| Mid-loop `await publish`? | **Yes** (every 2 funders) — couples Rel to hub |
| Soft-fail releases barrier? | Only if catch publish completes |
| Exact blocking call (7.1 B) | After last `funder` publish: remaining `fetchNativeFunder` / early-transfer branch **or** next `await publish` blocked on hub; no `timeout` action ⇒ catch publish did not land |

---

### 10. CreatorBurn findings

| Path | Behavior |
|------|----------|
| complete+fresh | `reuse_hit`, 0 pages |
| complete+stale | `runHeadRefresh` ≤5 pages |
| incomplete+stale | warm head refresh + `historicalContinuationPending` |
| concurrent lock | immediate `concurrent_reuse` |
| 7.1 A | Stuck on `head_overlap_refresh` with `pagesFetched=0` until watchdog (~53s) — **before first onPage** |
| 7.1 B | Start publish only; no page progress while Rel/LP also silent |
| Catch path hazard | `await loadTransferIndexProgress` **before** timeout publish — extra await ahead of soft-fail |

**Head-refresh progress bug:** `runHeadRefresh` passes constant `pagesFetchedTotal: priorMeta.pagesFetchedTotal` into `onPageProgress`, so Deep’s `lastPagePublish` gate suppresses subsequent page publishes (silence → watchdog). First page still should publish once unless fetch never reaches `onPage`.

---

### 11. Transfer-index findings

- Writer lock miss does **not** poll; returns `concurrent_reuse`.
- Head refresh awaits first Blockscout page before any useful Deep progress (and progress units are sticky).
- Background historical schedule is correctly non-blocking (`scheduleTransferIndexBackgroundRefresh`).
- 90s+ refresh wall on 7.1 was **not** explained by LP selective path alone — siblings never reached terminal publish.

---

### 12. Exact root cause

**`enrichScanDeep` never leaves `await runParallelDeepJobs` because stage `withBudget` soft-fail publishes are serialized on `createDeepStagePublishHub`’s `await onProgress` chain (and/or stage work remains inside unterminated timeout-less fetches), while the status-poll watchdog only stamps `watchdog_stall` without aborting work or detaching the settle barrier — so Liquidity/Relationships/CreatorBurn stay `analyzing` and score/finalize never run.**

---

### 13. Evidence proving root cause

1. **Prod timelines** (7.1 A/B): last real actions then only `watchdog_stall`; no `timeout` / `done` / `partial` stage actions; status remains `deep_running` past Rel 45s and into 90–180s.
2. **Code:** `createDeepStagePublishHub` awaits `onProgress` on a single chain; stage catches `await publish`; `withBudget` does not abort `work()`.
3. **Unit proof** (`deep-stall-rca.test.ts`): hung `onProgress` blocks timeout soft-fail publish; barrier stays unresolved; watchdog flag does not settle jobs.
4. **Lock path:** `runFreshScan` when `!owned` returns incomplete `deep_running` — no replacement worker.
5. **Timeout gaps:** `fetchOptionalGeckoActivity`, `fetchEthUsd`, v2/v3/titan `http()` lack hard abort — liquidity can sit inside `withBudget(180s)` without mid-progress.

---

### 14. Minimal fix (recommended — **not shipped**)

Smallest bounded-settlement change set (orchestration only):

1. **Cancellation-aware stage budgets:** `AbortController` passed into Blockscout/RPC/gecko; `withBudget` aborts on timeout.
2. **Hub soft-fail escape:** timeout/partial publishes must not await a hung prior `onProgress` forever — `Promise.race` publish with hard cap (e.g. 2–3s) or detach `onProgress` from the settle path (fire-and-forget persist with fencing).
3. **Watchdog upgrade (optional companion):** when firing, mark non-terminal parallel stages `partial` **or** set a generation cancel flag that makes `withBudget` / jobs reject promptly (still honest Incomplete — never fake Complete).
4. **Lock takeover:** if `deep_running` + no progress + lock held beyond interactive budget, allow fenced re-acquire / stale recovery earlier than 360s (without lengthening timeouts).
5. **Head-refresh progress:** pass increasing `pagesFetchedTotal` (or `pageInFetch`) so UI/watchdog see real head work.
6. **Add AbortSignal** to `fetchOptionalGeckoActivity` / `fetchEthUsd` / v2/v3/titan transports.

Do **not** raise global timeouts as the fix. Do **not** ship 7.1 Smart LP until stall fix + smart/full equality gates pass.

---

### 15. Before/after wall time

| Path | Before (evidence) | After fix |
|------|------------------:|----------:|
| Phase 7 HANSOME refresh | ~60.7s complete | n/a (not deployed) |
| 7.1 A/B | 181s / 91.7s still `deep_running` | **Not fixed in prod** |

---

### 16. Before/after terminal-state behavior

| | Before | After (expected from fix — not deployed) |
|--|--------|------------------------------------------|
| Terminal within measure | No (`deep_running`) | `partial` or `complete` with no `analyzing` leftovers |
| Watchdog | Flag only | Flag + cancel/detach |
| Promise barrier | Can hang | Bounded settle |

---

### 17. Failure-injection tests

`lib/hansome-score/__tests__/deep-stall-rca.test.ts` — **15 cases, all bounded:**

- hung `onProgress` blocks timeout publish  
- publish mutex contention + release  
- one hung job → barrier unresolved  
- withBudget race detaches hung work from barrier  
- timeout soft-fail blocked by hub  
- background neverResolve not on barrier  
- watchdog state-only  
- late publish after watchdog  
- lock-miss returns `deep_running`  
- stale inflight coalesce  
- concurrent_reuse no wait  
- head-refresh constant pagesFetchedTotal suppresses publishes  
- all jobs reject → settles  
- one ok + two hang → unresolved  
- instrumentation spans  

---

### 18. Regression results

| Suite | Result |
|-------|--------|
| deep-stall-rca | **PASS** (15) |
| deep-parallel | **PASS** |
| scan-stalled-progress-hotfix | **PASS** (22) |

Full Core7 / Top-100 / build / typecheck / visual smokes: **not re-run for deploy** (no deploy). Instrumentation is opt-in / additive.

---

### 19. Core 7 results

**N/A — PASS_NOT_DEPLOYED** (no Production ship). Prior Phase 7 Core7 on tip FmkQQ remained PASS; 7.1 rolled back.

---

### 20. Top-100 semantic validation

**N/A — not deployed.** No semantic modules changed for scoring/lock/burn/holders.

---

### 21. Tests

Failure-injection + deep-parallel + stalled-progress: **PASS**. Broader suite not required for non-deploy RCA.

---

### 22. Typecheck

Not required for non-deploy; instrumentation uses existing types. Recommend `tsc --noEmit` before any follow-up ship.

---

### 23. Build

**N/A — not deployed.**

---

### 24. Deploy decision

**DO NOT DEPLOY.**

Reasons: root cause proven at orchestration level; minimal fix **not** implemented end-to-end with abort wiring; HANSOME refresh completion gate not re-proven; Smart LP 7.1 code remains in workspace and must not ride along without equality gates.

---

### 25. Deploy ID if deployed

**None.**

---

### 26. Alias status

`www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` → **`dpl_D6cm3iivndCMWMa57vG9XhgzfEVC`** (undisturbed by this phase).

---

### 27. Rollback target

For any future Phase 7.2+ fix deploy: record tip immediately before ship. Current live tip to restore if needed: **`dpl_D6cm3iivndCMWMa57vG9XhgzfEVC`**. Phase 7 tree reference: `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ`.

---

### 28. Remaining limitations

- Exact which sibling’s `onProgress` hung in Production (KV vs gecko vs first Blockscout page) is **narrowed but not single-RPC-fingerprinted** without a traced Preview replay with `HANSOME_DEEP_STALL_TRACE=1`.
- 7.1 Smart LP selective path is a latency contributor when it runs, but **not** the barrier root cause.
- `DEEP_STALE_THRESHOLD_MS` (360s) is far above interactive UX; users see `deep_running` + watchdog for minutes.
- Workspace still contains rolled-back 7.1 Smart LP code.

---

### 29. Final verdict

**PASS_NOT_DEPLOYED**

---

### Artifacts / files

| Path | Role |
|------|------|
| `reports/HANSOME_COLD_PERF_V2_PHASE7_2_DEEP_STALL_RCA.md` | This report |
| `lib/hansome-score/deep-stall-trace.ts` | Opt-in structured spans |
| `lib/hansome-score/deep-parallel.ts` | Publish / settle span hooks |
| `lib/hansome-score/scan-deep.ts` | `withBudget` span hooks |
| `lib/hansome-score/scan-cache.ts` | Watchdog span + cancellation-unaware comment |
| `lib/hansome-score/__tests__/deep-stall-rca.test.ts` | Failure injection |
| `reports/data/cold_perf_v2_phase7_1b_hansome_refresh.json` | Prod evidence |
| `reports/data/cold_perf_v2_phase7_1_hansome_refresh.json` | Prod evidence A |

**Forbidden-file audit:** no score/weights/burn/lock math, holders, creator attribution, security, proxy, token contracts, analytics behavior, admin auth, game assets, or Pons wiring changed for semantics.
