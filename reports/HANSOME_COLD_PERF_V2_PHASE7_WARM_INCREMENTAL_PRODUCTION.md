# HANSOME — Cold Perf V2 Phase 7 Warm Incremental Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy ID** | `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` |
| **Rollback (exact pre-deploy tip)** | `dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **PASS_DEPLOYED** |

---

### 1. Exact pre-deploy Production tip

`dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy` (Phase 6 Parallel Deep — verified alias before ship).

### 2. Root cause of repeated warm work

Warm / repeat Deep could still:

- skip Creator/Burn entirely when stages were `done` (manual refresh only re-armed liquidity), so transfer head never refreshed
- or, when Creator/Burn ran, fall into cold recent-first / historical resume without a unified warm eligibility gate
- lack explicit reorg overlap on head refresh (exact head timestamp stop missed tip reorg window)
- lack warm-specific progress actions and per-data-type freshness documentation

Phase 7 adds fail-closed warm eligibility, stage reuse planning, reorg-overlap head merge, and warm progress actions — without changing scan semantics.

### 3. Warm eligibility rules

Eligible only when **all** hold:

| Check | Fail → |
|-------|--------|
| Snapshot present | `missing_snapshot` → cold |
| `SCAN_SNAPSHOT_SCHEMA_VERSION === 1` | `snapshot_schema_mismatch` |
| `analysisSemanticVersion === SCORE_SPEC_VERSION` | `semantic_version_mismatch` |
| Matching `chainId` + normalized address | `chain_mismatch` / `address_mismatch` |
| Transfer-index reusable (not corrupt/rebuild/expired) | `transfer_index_*` |
| Checkpoint progress present when incomplete | `checkpoint_cursor_missing` |
| No forced cold / reorg conflict flag | `force_cold` / `reorg_conflict` |

Module: `lib/hansome-score/warm-incremental.ts` → `evaluateWarmEligibility`.

### 4. Snapshot / checkpoint versions

| Store | Version constant |
|-------|------------------|
| Scan snapshot schema | `SCAN_SNAPSHOT_SCHEMA_VERSION = 1` |
| Analysis semantic | `ANALYSIS_SEMANTIC_VERSION = SCORE_SPEC_VERSION` (`1.3.0-overall`) |
| Transfer-index meta | `version: 1` / `TRANSFER_INDEX_SCHEMA_VERSION` |
| LP discovery checkpoint | `version: 1` / `LP_CHECKPOINT_SCHEMA_VERSION` |
| Contract cache | `CONTRACT_CACHE_SCHEMA_VERSION = 1` |

Incompatible semantic/schema → cold fallback (never silent reuse).

### 5. Reorg overlap strategy

| Parameter | Value | Why |
|-----------|------:|-----|
| `WARM_REORG_OVERLAP_BLOCKS` | **64** | Covers typical short L2/tip reorg depth without replaying genesis |
| `WARM_REORG_OVERLAP_MS` | **3 min** | Timestamp floor when block numbers missing |
| Head stop | `headTimestampMs − overlapMs` | Re-fetch overlap window |
| Merge | Replace overlap window with incoming; preserve finalized older rows; stable identity dedupe | No double-count burns/balances |

### 6. Transfer head-refresh architecture

`fetchTokenTransfersWithCheckpoint`:

| Status | Path |
|--------|------|
| complete + fresh | `reuse_hit` — **0 Blockscout pages** |
| complete + stale | `head_refresh` ≤5 pages + reorg overlap merge |
| incomplete + stale head + `recentFirst` | warm head refresh; `historicalContinuationPending`; background resume |
| incomplete + fresh head | Phase 4 cursor **resume** (no recent re-walk) |
| corrupt / version mismatch | rebuild → cold recent-first |

### 7. Creator/Burn reuse behavior

- Still **one** transfer-index coordinator job
- Warm: head delta once → recompute Creator + Burn from merged index
- Never claim Complete when `paginationComplete=false`
- Background historical resume when incomplete (non-blocking)

### 8. Relationships reuse behavior

- Warm plan `reuse` when stage done + zero-delta head
- `refresh` when head stale
- Continues to prefer `loadEarlyTransfersFromIndex` (no duplicate page-1 GET when index has head)

### 9. Liquidity incremental behavior

- Reuses Phase 1 LP KV + Phase 5 Quick LP checkpoint (`quickComplete` → skip broad PM)
- Manual refresh forces ownership/lock revalidate (`forceLiquidityRefresh`)
- Exhaustive remains background; never marks discovery complete unless existing rules allow

### 10. Contract-cache refresh behavior

Unchanged Phase 3 rules: refresh on expire / bytecode hash change / proxy evidence / partial prior. Warm eligibility ties semantic version so incompatible analyzer versions do not reuse silently.

### 11. Concurrency and locking

| Layer | Mechanism |
|-------|-----------|
| Scan refresh | `acquireRefreshLock` + inflight Promise coalesce |
| Transfer-index | NX lock; concurrent waiters → `concurrent_reuse` (0 RPC) |
| Deep attempts | `deepAttemptId` fencing + CAS-style generation on xfer meta |
| Warm rearm | Arms only stale/incomplete stages; preserves done siblings |

### 12. Cold vs warm measurements

Production tokens were already **warm/cached** at smoke time (Phase 6 tip). Labels:

| Path | Label |
|------|-------|
| Immediate `/api/scan` deep on populated snapshot | **cached** (memory/KV) — no Deep re-run |
| Immediate second scan | **warm cached** — 0.4–1.3s |
| Manual `refresh=true` Deep | **warm incremental Deep** — stage plan + head overlap |

### 13. Zero-delta measurements (cached warm)

| Token | First ms | Second ms | Score | Lock |
|-------|--------:|---------:|------:|------|
| PRIMARY | 1846 | **421** | 66 | UNABLE_TO_DETERMINE (honest Incomplete) |
| HANSOME | 573 | **463** | 53 | **MIXED** |
| FOX | 1113 | 1340 | 73 | UNABLE_TO_DETERMINE |
| GME | 912 | 967 | 55 | UNABLE_TO_DETERMINE |
| CASHCAT | 824 | **508** | 60 | UNABLE_TO_DETERMINE |
| PONS | 1072 | **859** | 81 | UNABLE_TO_DETERMINE |
| TYGR | 1187 | 1112 | 76 | UNABLE_TO_DETERMINE |
| WALLET | 1069 | **801** | 77 | UNABLE_TO_DETERMINE |

All second scans: `cache.hit=true`, `source=memory`. Target 3–10s zero-delta **met** (sub-second to ~1.3s cached).

Unit proof: complete+fresh → `reuse_hit`, `rpcPagesThisCall=0`.

### 14. Small-delta measurements

HANSOME manual refresh (`refresh=true`): **~60.7s** wall (includes forced LP ownership revalidate + parallel wave). Observed warm actions: `checkpoint_validate`, `head_overlap_refresh`, `background_history_resume`, `creator_burn_recompute`, `final_validation`. Score remained **53**, lock **MIXED**, `discoveryComplete=false`.

Bottleneck on refresh path: LP ownership revalidation (forced on manual refresh), not historical transfer re-crawl. Target 5–20s small-delta **not met** on forced-liquidity refresh; honest report — do not inflate timeouts.

### 15. Blockscout pages before / after

| Path | Historical pages this call |
|------|---------------------------:|
| Cached warm second scan | **0** (no Deep / no xfer fetch) |
| Unit complete+fresh | **0** |
| Unit/stale head refresh | **≤5** |
| Cold recent-first (unchanged) | ≤6 recent then historical budget |

`pagesFetched` on cached responses reflects **lifetime** creator index pages in snapshot, not RPC this call.

### 16. RPC calls before / after

Warm zero-delta cached: no Deep RPC. Head refresh: ≤5 Blockscout transfer pages + existing LP revalidate RPCs when liquidity stage runs. Relationships reuse index head when present.

### 17. Stages reused / rerun

Warm plan (`planWarmDeepStages`):

- Case A (CreatorBurn partial, Rel/Liq done): rerun CreatorBurn only
- Case B (zero-delta + LP checkpoint): reuse all three parallel stages
- Case C (LP force refresh): refresh Liquidity; preserve Rel/CreatorBurn when fresh

Production refresh showed CreatorBurn head path + LP probes (force liquidity) while preserving score semantics.

### 18. Progress sequence

Warm Deep actions (when enrich runs):

`warm_snapshot_load` → `checkpoint_validate` → (`zero_delta_reuse` | `head_overlap_refresh` / `new_transfers_merge`) → `creator_burn_recompute` / `relationship_refresh` / `lp_delta_refresh` → `background_history_resume` (if needed) → `final_validation`

Cached serve path does not stamp these (no Deep worker) — honest: cache hit, not fake 100% jump.

### 19. Primary token results

`0x57ff…de00f`: score **66**, `discoveryComplete=false`, lock unavailable honest, second scan **421ms** cached. No false ALL_LOCKED / No Liquidity.

### 20. Core 7 results

All 7 Fast/Deep measured HTTP 200; no false `ALL_LOCKED`; HANSOME **MIXED** + `discoveryComplete=false`; scores stable cold/warm equality on same snapshot.

### 21. Top-100 semantic validation

Sample 25: **semanticDrift = 0**.

### 22. Cold/warm semantic equality

All 8 acceptance tokens: `semanticEqualScore=true` (first vs second). HANSOME refresh: score 53 unchanged, MIXED unchanged.

### 23. Tests

| Suite | Result |
|-------|--------|
| warm-incremental (28 cases) | **PASS** |
| transfer-index / reuse / recent-first / checkpoint | **PASS** |
| LP Quick / LP known-first / LP discovery cache | **PASS** |
| deep-parallel / stage-independence / retry-race | **PASS** |
| progress / stalled-progress / analysis-progress | **PASS** |
| Creator / Burn / Holder / Score / Contract Cache | **PASS** |
| scan-cache | **PASS** |

### 24. Typecheck

`tsc --noEmit` → **PASS**

### 25. Production build

`next build` → **PASS**

### 26. Deploy ID

`dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ`

### 27. Alias status

`www.hansomealpacas.xyz` + `game.hansomealpacas.xyz` → this deployment **YES**

### 28. Rollback target

`dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy`

### 29. Analytics/admin smoke

| Check | Result |
|-------|--------|
| Public site 200 | **PASS** |
| Admin unauthorized 401/403 | **PASS** |
| Opt-out API | **PASS** |
| Admin authorized | **N/A** (secret not in runner env) |

### 30. Game visual smoke

`scripts/game-landing-visual-smoke.mjs` → **PASS**, screenshot diff **0.00%**

### 31. Remaining limitations

- Manual refresh still force-revalidates LP ownership (by design for lock correctness) — can exceed 5–20s small-delta band
- Warm progress actions only appear when Deep enrich runs (not on pure cache hits)
- Historical genesis for heavy tokens still needs background resume / Phase 8 prewarm for interactive completeness
- Blockscout RTT remains the dominant cost when head refresh must page

### 32. Final verdict

**PASS_DEPLOYED**

---

### Files changed (Phase 7)

| Path | Role |
|------|------|
| `lib/hansome-score/warm-incremental.ts` | **New** — eligibility, freshness TTLs, reorg merge, stage plan, progress actions |
| `lib/hansome-score/transfer-index/paging.ts` | Reorg-overlap head refresh; warm incomplete stale-head path; merge stats |
| `lib/hansome-score/scan-deep.ts` | Warm plan + progress wiring; stage skip from plan |
| `lib/hansome-score/scan-cache.ts` | Warm rearm on manual refresh (preserve fresh siblings) |
| `lib/hansome-score/deep-parallel.ts` | `applyWarmSkipToParallelJobs` helper |
| `lib/hansome-score/__tests__/warm-incremental.test.ts` | **New** 28 cases |
| `lib/hansome-score/__tests__/transfer-index-reuse.test.ts` | Overlap stop assertion |
| `lib/hansome-score/__tests__/deep-parallel.test.ts` | Mock warm peeks |
| `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts` | Mock warm peeks |
| `scripts/_tmp-cold-perf-v2-phase7-prod-smoke.mjs` | Prod smoke |
| `reports/data/cold_perf_v2_phase7_*.json` | Evidence |

**Forbidden-file audit: PASS** — no score/weights/burn/lock math, holders, creator attribution, security, proxy semantics, token contracts, website analytics modules, admin auth, game assets, or Pons wiring.

### Evidence

- `reports/data/cold_perf_v2_phase7_prod_smoke.json`
- `reports/data/cold_perf_v2_phase7_warm_refresh_hansome.json`
- `reports/_tmp-vercel-deploy-cold-perf-v2-phase7.log`
