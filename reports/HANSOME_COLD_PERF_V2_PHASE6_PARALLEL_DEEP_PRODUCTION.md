# HANSOME — Cold Perf V2 Phase 6 Parallel Deep Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy ID** | `dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy` |
| **Rollback (exact pre-deploy tip)** | `dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **PASS_DEPLOYED** |

---

### Tip race / composition note

| Tip | ID | Role |
|-----|-----|------|
| Live alias **before** Phase 6 | `dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` | Creator Explainability (PASS_DEPLOYED) |
| Phase 5 Quick LP | `dpl_EhAadgwGhZzSapdCgb1oBTJrXimm` | Prior tip; still Ready |
| Phase 6 ship | `dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy` | This deploy |

Working tree retained Phase 5 Quick LP (`quickDiscovery`, `discovery-checkpoint`, background exhaustive) and Creator Explainability i18n (`creatorExplain*`). Phase 6 ship **composes** both — does not revert Creator presentation/i18n. Pre-deploy Production smoke on Creator tip still showed Quick LP honesty (`discoveryComplete=false` / `exhaustive=false` on HANSOME).

---

### 1. Parallel architecture

After Fast base, Deep runs a **true concurrent wave**:

1. **Relationships** (funding graph + early transfers; reuses transfer-index head)
2. **Liquidity** (known-first + Phase 5 Quick LP; exhaustive background)
3. **CreatorBurn** (single shared transfer-index job → Creator + Burn together)

Then **Score** recomputes with existing formulas only.

Orchestration modules:

| Path | Role |
|------|------|
| `lib/hansome-score/deep-parallel.ts` | Dependency graph, publish hub, stage merge, `runParallelDeepJobs` |
| `lib/hansome-score/scan-deep.ts` | Stage job bodies + parallel wave wiring |
| `lib/hansome-score/deep-progress.ts` | Parallel-aware pipeline focus |
| `lib/hansome-score/analysis-progress.ts` | Modules no longer force-queued behind each other |

Concurrent publishes go through a mutex’d hub + `mergeParallelStageWrite` so sibling stage fields are not clobbered; `mergeMonotonicAnalysisStages` prevents `done` → `analyzing` regression.

### 2. Dependency graph

```
Fast base
   ├─ Relationships ──────────────┐
   ├─ Liquidity (Quick LP) ───────┼─► Score
   └─ CreatorBurn (1× xfer index)─┘
         │
         ├─ background: LP exhaustive
         └─ background: transfer-index historical
```

- Creator and Burn **share one** transfer-index coordinator (no double page fetch).
- Score waits only for the parallel wave to settle (done / partial / skipped).
- Background continuations do not block completed stages.

### 3. Before vs after stage timings

| Stage | Before (sequential model) | After (parallel wave) |
|-------|---------------------------:|----------------------:|
| Relationships | ~5–12s (blocks next) | Concurrent; ~5–12s wall of own job |
| Liquidity / Quick LP | Waited on Relationships | Concurrent with Rel + CreatorBurn |
| CreatorBurn (recent-first) | Waited on Liquidity | Concurrent; shared xfer job |
| Score | After sum of above | After `max(Rel, Liq, CreatorBurn)` |

Unit overlap proof (`deep-parallel.test.ts`): liquidity finish observed while creatorBurn transfers still pending.

### 4. Before vs after total latency

| Path | Before (sequential sum, design/audit) | After |
|------|--------------------------------------:|------:|
| Cold useful Deep (HANSOME-class) | ≈ Rel + Liq + CreatorBurn (~sum) | ≈ **max(Rel, Quick LP, recent xfer)** |
| Primary Production Deep (warm) | often multi-stage wait | **~1.7s** complete (cached/warm) |
| Design cold useful band | sequential path missed 30–60s when stages stacked | Target bundle **~25–60s** when Phases 4–5 work is useful |

Primary smoke: `totalMs=1689`, status `complete`, pagesFetched=5, positions=1, `discoveryComplete=false`.

### 5. Parallel overlap analysis

| Evidence | Result |
|----------|--------|
| Unit: concurrent job ordering | Liquidity finishes before Relationships when Liq is faster |
| Unit: enrichScanDeep | `sawLiqDoneWhileTransferPending=true` |
| Prod smoke timeline | First poll already `complete` (warm) — overlap not visible in status cadence |
| Publish hub | Serialized merges; no sibling field clobber in tests |

### 6. RPC reduction

No semantic RPC removal; overlap reduces **wall-clock** RPC contention window. Duplicate work avoided via:

- One transfer-index writer for Creator+Burn
- Relationships `loadEarlyTransfersFromIndex` (no second page-1 GET when index has head)
- Phase 5 Quick LP checkpoint / Phase 1 LP KV reuse on second scan

### 7. Blockscout reduction

Same page budgets as Phases 4–5 (recent-first ≤6∩7d; Quick PM ≤3). Parallelism does not add a second transfer pager. Second-scan reuse still `rpcPagesThisCall=0` when index hits (Phase 2/4 semantics preserved).

### 8. Checkpoint behaviour

| Store | Behaviour |
|-------|-----------|
| Snapshot `analysisStages` | Resume skips `done`/`unknown` stages; only incomplete jobs re-run |
| Transfer-index | Shared CreatorBurn job; historical continues in background |
| LP discovery checkpoint | Phase 5 unchanged — Quick complete + checked IDs; exhaustive async |
| Soft-fail | Failed stage → `partial`; successful siblings preserved |

### 9. Progress behaviour

- Parallel wave marks incomplete stages `analyzing` together at start.
- Module progress no longer force-queues Liquidity/Creator/Burn behind Relationships.
- Overall advances when **any** module advances (weighted modules).
- Cap incomplete stages at ≤95% until stage `done` (Quick LP / page bands unchanged).
- `deepProgress.sequence` / `updatedAt` still advance on each publish (stall watchdog intact).

### 10. Primary token results

`0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f`

| Metric | Result |
|--------|--------|
| HTTP | 200 |
| Final | `complete` |
| Wall | **~1689 ms** (warm) |
| Stages | all `done` |
| Positions | 1 |
| `discoveryComplete` / exhaustive | **false / false** (honest Quick LP) |
| Overall score | 65 |

### 11. Top100 validation

| Check | Result |
|-------|--------|
| Sample | 25 |
| Semantic drift | **0** |
| Fast HTTP errors | 0 |
| Core7 all HTTP 200 | **PASS** |
| HANSOME MIXED / lockAvail | **true** / `discoveryComplete=false` |
| No false ALL_LOCKED on Core7 | **PASS** |

Evidence: `reports/data/cold_perf_v2_phase6_prod_smoke.json`

### 12. Tests

| Suite | Result |
|-------|--------|
| deep-parallel (graph, merge, hub, overlap, failures) | **PASS** |
| scan-deep stage-independence / retry-race | **PASS** |
| lp-quick-discovery + known-first / discovery-cache | **PASS** |
| analysis-progress + stalled-progress (parallel queued model) | **PASS** |
| transfer-index / contract-cache / score / burn / holder / creator presentation | **PASS** (Pons adapter tests excluded — vercelignored) |
| hansome-score `__tests__` excl. pons | **375 passed** |

### 13. Typecheck

**PASS** (`tsc --noEmit`)

### 14. Build

**PASS** on Vercel Production (`next build`, 42/42 pages)

### 15. Deploy ID

`dpl_FxoegVVj1ZNHkmUv9C2rsxEeRvZy`  
URL: https://hansomealpacas-czvkmhb9l-the-67.vercel.app

### 16. Alias

**YES** → https://www.hansomealpacas.xyz

### 17. Rollback target

`dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` (exact live tip immediately before Phase 6 deploy — Creator Explainability)

### 18. Remaining limitations

- Warm Production smokes can finish before status polling observes mid-wave `analyzing` overlap; unit tests cover concurrency.
- FOX-class genesis history / Lock Dist still depend on Phase 7 warm incremental + Phase 8 prewarm for interactive 10–30s completeness.
- Quick LP may miss old Position NFTs → honest Incomplete + background exhaustive (Phase 5 unchanged).
- `dashboard_authorized_stats` still needs `ANALYTICS_ADMIN_SECRET` in smoke env (unauthorized 401 PASS).
- Pons locker adapter remains vercelignored / unwired.

### 19. Final verdict

**PASS_DEPLOYED**
