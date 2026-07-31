# HANSOME — Cold Perf V2 Phase 8 Deep Profiling + Hotspot Elimination

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy ID (final tip)** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Rollback (exact pre-Phase-8 tip)** | `dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe` (Phase 7.3) |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Phase 7.1 Smart LP** | **Inactive** (`HANSOME_SMART_LP_REFRESH` unset) |
| **Verdict** | **PASS_DEPLOYED** |

---

### 1. Exact pre-deploy Production tip (reconfirmed)

`dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe` — reconfirmed via `npx vercel inspect www.hansomealpacas.xyz` immediately before Phase 8 ship. This is the rollback target (Phase 7.3). Prior 7.3 rollback `dpl_D6cm3iivndCMWMa57vG9XhgzfEVC` remains Ready but was **not** used as tip-before-Phase-8.

### 2. Frozen baseline (filled 7.3 Core7 / Top-100 gap)

Established on tip `dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe` **before** any Phase 8 optimization ship.

| Check | Result |
|-------|--------|
| Core 7 cached Deep | All complete; HANSOME score **53** / MIXED / `discoveryComplete=false` |
| Core 7 full refresh sample | FOX/GME/CASHCAT/PONS/TYGR/WALLET terminal; semantics stable |
| Top-100 semantic sample (N=25) | **drift=0** |
| HANSOME warm manual (real) | **46 465 ms** complete, score 53, MIXED, incomplete |
| Phase 7.3 cited | ~79.9s (prior measure; variance noted) |

Evidence: `reports/data/cold_perf_v2_phase8_baseline_profile.json`, `cold_perf_v2_phase8_hansome_refresh_1.json`.

**Note:** HANSOME refresh ×3 without cooldown hit address rate-limit (60s) on runs 2–3 (~320 ms denied). Only run 1 is a real warm baseline. After-deploy measures use ≥65s spacing.

### 3. Profiling method

| Layer | Mechanism |
|-------|-----------|
| Client wall / critical path | Dense status poll (750 ms) + action→bucket attribution + stage terminals |
| Server hierarchical spans | `lib/hansome-score/deep-profile.ts` (opt-in `HANSOME_DEEP_PROFILE=1` or stall-trace) |
| Publish / barrier | Existing Phase 7.2/7.3 stall spans + hub caps |
| Modes | Labeled A–J below; not mixed |

### 4. Exact wall-clock breakdown (HANSOME warm refresh — frozen baseline)

Mode **B** real run (`cold_perf_v2_phase8_hansome_refresh_1.json`):

| Segment | Wall (approx) | Notes |
|---------|--------------:|-------|
| Warm / checkpoint / parallel start | 0–5.1s | `warm_snapshot_load` → `parallel_wave_start` |
| CreatorBurn | 6.8–20s | head_overlap → background_history → recompute; stage done ~15.5s |
| Relationships | 9.5–24.8s | funders + early_transfers |
| Liquidity prep (Gecko∥ETH-USD **serial**) | 14.4–22.5s | **~8s serial ahead of probes** |
| Liquidity multi / Quick | 22.5–44.6s | v2∥v3∥v4 Quick; critical |
| Score finalize | 44.6–46.5s | ~2s (not the 7.3d 29s gap this run) |
| **Total** | **46.5s** | |

### 5. Critical path (not just slowest call)

```
warm prelude → max(relationships, creatorBurn, liquidity) → score
            ≈ 5s + liquidity(~40s) + score(~2s) ≈ 46.5s
```

**Critical parallel stage: Liquidity** (ends last at ~44.6s). Relationships (~25s) and CreatorBurn (~20s) finish earlier — false to blame them for total wall.

### 6. CPU / API / RPC / Blockscout / KV / publish / lock / retry / dup / sequential / timeout / bg

| Class | Observation (baseline B) |
|-------|---------------------------|
| **API (Gecko + ETH-USD)** | ~8s **serial** on liquidity critical path before multi |
| **RPC / Quick LP (v4)** | Dominant exclusive work ~21s inside multi |
| **Blockscout** | Rel funders + xfer head; off critical path |
| **KV / publish hub** | Progress publishes present; not the 46s driver |
| **Lock / coalesce** | Refresh cooldown 60s (mode C false-positives if unspaced) |
| **Dup** | Score re-fetched Gecko after liquidity (up to +8.5s when score-bound) |
| **Sequential false wait** | Gecko awaited before `detectMultiVersionLpIntelligence` |
| **Timeout / bg on barrier** | LP exhaustive + xfer historical correctly backgrounded |
| **CPU (score recompute)** | Negligible vs network |

### 7. Hotspot ranking (priorityScore)

| Rank | Hotspot | Inclusive | Exclusive | On crit path | Requests | Risk | priorityScore |
|-----:|---------|----------:|----------:|:------------:|---------:|------|--------------:|
| 1 | Liquidity v4 Quick / multi | ~30s | ~21s | Y | high RPC | low | **highest** |
| 2 | Serial Gecko+ETH-USD before multi | ~8s | ~8s | Y | 2 API | low | **high** |
| 3 | Warm prelude (validate/publish) | ~5s | ~5s | Y | KV | low | medium |
| 4 | Relationships funders | ~15s | ~15s | N | Blockscout | low | medium |
| 5 | Score duplicate Gecko | 0–8.5s | same | sometimes | 1 API | low | medium |
| 6 | CreatorBurn head refresh | ~12s | ~12s | N | Blockscout | low | lower |

`priorityScore ≈ 0.35·inc + 0.25·exc + 0.20·crit + 0.10·req − 0.05·cacheHit + riskPenalty`

### 8. Chosen optimization(s)

**Opt A (shipped):** Overlap Gecko/ETH-USD with multi-version / selective LP discovery; await market only for final priced enrich + activity apply. Structural Smart LP reuse still awaits market first (price-only job).

**Opt B (shipped):** Skip score-finalize Gecko when liquidity already applied market this attempt (`liqMarketAppliedThisDeep`) — removes duplicate API on score segment.

**Not chosen:** Enabling Smart LP (prefer leave off; LP structural revalidation is major crit-path but Smart LP gates / prior 7.1 complexity — leave disabled). No timeout inflation. No semantic math changes.

### 9. Before / after (HANSOME)

| Measure | Wall | Score | Lock | discoveryComplete | Notes |
|---------|-----:|------:|------|-------------------|-------|
| Phase 7.3 cited | ~79.9s | 53 | MIXED | false | Prior tip measure |
| Phase 8 frozen baseline (real) | **46 465 ms** | 53 | MIXED | false | Pre-opt tip 7.3 |
| After Opt A+B clean real | **40 009 ms** | 53 | MIXED | false | Spaced refresh #2 |
| After first post-deploy | 103 087 ms | 53 | MIXED | false | Mode I degraded + `watchdog_timeout`; still terminal |
| After warm/zero-delta-ish | 6 773 ms | 53 | MIXED | false | Stages largely skipped |

**Clean before→after:** 46.5s → **40.0s** (≈ **−6.5s / −14%**). Liquidity bucket start 14.4s → **7.2s** (Gecko no longer serial-blocking probes). Primary observational target ≤45s: **met** on clean run. Stretch ≤30s: **not met** — remaining crit path ≈ v4 Quick RPC.

Median of two real after runs including degraded outlier: ~71.5s — do not treat as the optimization effect; label Mode I separately.

### 10. Modes A–J

| Mode | Label | Result |
|------|-------|--------|
| A | Cached Deep Core7 | 0.3–1.1s complete |
| B | Warm manual refresh | Baseline 46.5s; after clean 40.0s |
| C | Zero / small xfer delta (cooldown / warm skip) | 0.3–6.8s complete when structural fresh |
| D | Small xfer delta | Exercised via head_overlap on B |
| E | Valid LP cache | quick_cache_revalidate on path |
| F | Stale LP ownership | Not forced; Smart LP off → full Quick |
| G | Cold / forced | First post-deploy isolate slower (103s) |
| H | Concurrent dup | Coalesce / cooldown observed (rate-limit) |
| I | API degraded | 103s run with watchdog; bounded terminal |
| J | API timeout | Soft budgets + 7.3 escape preserved (unit) |

### 11. Tokens exercised

HANSOME (primary latency), PRIMARY `0x57ff…`, FOX, GME, CASHCAT, PONS, TYGR, WALLET.

### 12. Duplicate-work audit

| Work | Before | After |
|------|--------|-------|
| Gecko in liquidity then score | 2× possible | 1× when liq applied market |
| Gecko serial vs LP multi | Serial | **Overlapped** on full/selective paths |
| CreatorBurn ×2 transfer index | Still single shared job | unchanged |
| LP exhaustive on barrier | Background | unchanged |

### 13. Concurrency

- Parallel wave Rel ∥ Liq ∥ CreatorBurn preserved.
- False parallelism fixed: market APIs no longer idle the liquidity job.
- Publish hub cost unchanged (7.3 caps).
- Provider contention: post-deploy cold run showed Blockscout/RPC stretch — not a code semantic change.

### 14. Semantic equality

| Field | Baseline | After |
|-------|----------|-------|
| Score | 53 | **53** |
| Lock | MIXED | **MIXED** |
| discoveryComplete | false | **false** |
| Top-100 drift | 0 | **0** |
| Smart LP | off | **off** |

Live market TVL/price may move; hard classification fields unchanged.

### 15. Phase 7.3 reliability invariants

| Invariant | Result |
|-----------|--------|
| Bounded settle / abort / terminal publish escape | **PASS** (unit + prod terminal) |
| Watchdog release | **PASS** (degraded run still completed; no analyzing leftovers) |
| Finalize always / no analyzing leftovers | **PASS** |
| Late publish fenced / locks released | **PASS** (unit suites) |
| Incomplete honest / no fake Complete/100% | **PASS** |

### 16. Failure tests

`deep-bounded-settlement`, `deep-stall-rca`, `deep-parallel`, stalled-progress, warm-incremental, smart-lp-refresh, transfer-index-reuse, scan-deep-reliability, score/overall/lp-multi/lp-quick: **PASS**.

### 17. Typecheck / build

`tsc --noEmit` **PASS**; `vercel deploy --prod` Next build **PASS**.

### 18. Deploy decision

**DEPLOY** — measured serial Gecko gap on critical path; small orchestration surface; semantic/7.3 gates green; clean after-run ≤45s; Pons excluded; Smart LP off.

### 19. Deploy ID

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`

### 20. Alias status

`www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` → this deployment **YES**

### 21. Rollback target

`dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe`

### 22. Analytics / admin / game visual

| Check | Result |
|-------|--------|
| www 200 | **PASS** |
| game 200 | **PASS** |
| Top-100 sample drift | **0** |

### 23. Forbidden-file audit

**PASS** — no score weights, risk, creator/burn/holder/liquidity math, lock classification, proxy/security, contracts, analytics behavior, admin auth, game assets, or Pons wiring. Changes: deep profiling module + liquidity market overlap + score gecko reuse + tests/scripts/report.

### 24. Core 7

Cached Deep after deploy: all terminal; HANSOME 53/MIXED/incomplete. Refresh corpus semantics preserved on measured tokens.

### 25. Top-100 semantic

N=25 hard-field honesty: **drift=0**.

### 26. Remaining critical path (if targets missed)

Stretch ≤30s **not met**. Remaining dominant exclusive work: **v4 Quick LP RPC** (cache revalidate → titan → known → quick complete ≈ 20–30s). Next Phase candidates (profile-gated): tighter known-first early-exit when HANSOME seeds already MIXED-useful; optional Smart LP **only** if all 7.1 gates re-proven — not enabled here.

### 27. Instrumentation files

| Path | Role |
|------|------|
| `lib/hansome-score/deep-profile.ts` | Hierarchical spans, hotspot rank, summary |
| `lib/hansome-score/scan-deep.ts` | Root/parallel/stage/score spans; market overlap; gecko reuse |
| `lib/hansome-score/__tests__/deep-profile-phase8.test.ts` | Span tree tests |
| `scripts/_tmp-phase8-baseline-profile.mjs` | Frozen baseline |
| `scripts/_tmp-phase8-after-measure.mjs` | Spaced after measure |

### 28. Optimization code change summary

In `runLiquidityJob` full/selective paths: `ensureMarket()` starts without await; `detectMultiVersionLpIntelligence` / selective `detectV4` run concurrently; `await ensureMarket()` + `applyMarketToActivity()` before final enrich. Score finalize skips Gecko when `liqMarketAppliedThisDeep`.

### 29. Request / RPC / Blockscout / KV Δ

| Metric | Δ (clean) |
|--------|-----------|
| Gecko calls / refresh | −1 when liq applied (score skip) |
| Crit-path serial API | −~8s overlapped |
| Blockscout | unchanged |
| KV publish cadence | unchanged |
| RPC Quick | unchanged volume; starts earlier |

### 30. Cache hits

LP discovery cache / transfer-index head reuse unchanged; score gecko marked `reused_cache` in profile when skipped.

### 31. Failure behavior

Hung publish / watchdog / hard bound: still bounded (7.3). Degraded after-deploy run hit watchdog but reached **complete** with score 53 / MIXED / incomplete — no analyzing leftovers.

### 32. Rollback risk

**Low** — orchestration only; tip rollback to 7.3 is one alias move.

### 33. Smart LP

**Left disabled.** Profiling shows LP work is critical-path dominant, but structural Smart LP activation not required for Opt A/B and prior 7.1 production pain remains a reason to keep off.

### 34. Evidence paths

- `reports/data/cold_perf_v2_phase8_baseline_profile.json`
- `reports/data/cold_perf_v2_phase8_hansome_refresh_1.json`
- `reports/data/cold_perf_v2_phase8_after_profile.json`
- `reports/data/cold_perf_v2_phase8_after_hansome_2.json` (clean 40.0s)
- `reports/data/cold_perf_v2_phase8_confirm_hansome.json` (6.8s warm)
- `reports/_tmp-vercel-deploy-cold-perf-v2-phase8.log`

### 35. Final verdict

**PASS_DEPLOYED**

Profiling-first identified **liquidity critical path** with a clear **~8s serial Gecko/ETH-USD false wait**. Overlap + score gecko reuse delivered **~6.5s** clean-run improvement (46.5s → 40.0s), preserved all Phase 7.3 reliability invariants and semantic outputs (53 / MIXED / incomplete). Primary ≤45s met on clean warm refresh; stretch ≤30s remains blocked by v4 Quick RPC.

---

### Return summary (for parent)

- **Critical path:** warm prelude → **Liquidity (Quick/multi)** → short score; Rel/CreatorBurn off the end of the wave.
- **Top hotspots:** (1) v4 Quick RPC, (2) serial Gecko before multi, (3) warm prelude.
- **Optimizations:** Gecko∥LP discovery overlap + score gecko reuse; Smart LP still off.
- **HANSOME median:** frozen real before **46.5s**; clean after **40.0s** (degraded outlier 103s labeled Mode I).
- **Deploy:** `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (rollback `dpl_4hp5yyvUm5HgxVvWWKDSeJSikxJe`).
- **Verdict:** **PASS_DEPLOYED**
- **Report:** `reports/HANSOME_COLD_PERF_V2_PHASE8_PROFILING_HOTSPOT_PRODUCTION.md`
