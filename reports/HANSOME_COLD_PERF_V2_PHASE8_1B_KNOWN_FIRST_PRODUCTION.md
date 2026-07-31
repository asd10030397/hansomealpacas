# HANSOME — Cold Perf V2 Phase 8.1B Known-First Production Re-Gate

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Live tip before** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (Phase 8) |
| **Live tip after** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (unchanged) |
| **Candidate deploy** | `dpl_59LKD82aQcmuMGEvdYQYHFwks17w` |
| **Rollback target** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Alias www/game promoted?** | **NO** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Phase 7.1 Smart LP** | **Inactive** (`HANSOME_SMART_LP_REFRESH` unset) |
| **Verdict** | **PASS_NOT_DEPLOYED** |

Machine-readable: `reports/data/cold_perf_v2_phase81b_regate.json`  
Candidate meta: `reports/data/phase81b_candidate.json`  
Per-run: `reports/data/cold_perf_v2_phase81b_hansome_{1,2,3}.json`

---

### 1. Exact pre-deploy Production tip

Reconfirmed via `npx vercel inspect www.hansomealpacas.xyz` → **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`**.  
`game.hansomealpacas.xyz` same tip. Phase 8.1A harness also reconfirmed `tipMatchesExpected=true` before ship.

### 2. Rollback target

**`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`** (current Phase 8 PASS_DEPLOYED tip). No www/game promotion performed → no rollback action required.

### 3. Exact Phase 8.1 code revision reintroduced

| Item | Value |
|------|--------|
| Module | `lib/hansome-score/lp/known-first-early-exit.ts` |
| SHA-256 | `C07B1270824AB6C20B2B29EDEE6B5562663F00AF5216838B6F3A77FBE4606E62` |
| Wiring | `lib/hansome-score/scan-deep.ts` (Smart LP off path) |
| Prior 8.1 tip (rolled back) | `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` |
| Workspace git HEAD | `6667f9565736cacf761b75f542d414940973ff35` |
| This candidate | `dpl_59LKD82aQcmuMGEvdYQYHFwks17w` |

Scope limited to: known-first planner, known-evidence validation, owner/lock reuse/revalidation, price-only path, targeted fallback, broad Quick skip when safe, background exhaustive continuation, progress actions, attempt-scoped memoization. No formula/weight/threshold/liquidity-semantic changes. Smart LP not enabled. Pons not wired.

### 4. Pre-deploy Phase 8.1A semantic harness

| Mode | Result |
|------|--------|
| A Full Quick (frozen inputs) | score **54**, components equal |
| B Known-First | **equal** to A |
| C Forced Full Quick | **equal** to A |
| D Frozen-market replay | **equal** to A |
| Classification | **MARKET_STATE_DRIFT** (prior 53→54) |
| Expected frozen score | **54** |

Command: `node scripts/phase81a-semantic-drift-compare.mjs` → PASS equality; tip `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`.

### 5. Production test deployment method

```
npx vercel deploy --prod --skip-domain --yes
```

- Deploy ID: `dpl_59LKD82aQcmuMGEvdYQYHFwks17w`
- Direct URL SSO-protected (401 on raw `*.vercel.app` POST)
- A/B method: temporary public alias `hansomealpacas.vercel.app` → candidate for measures; **www/game stayed on Phase 8**
- After gate: alias restored → Phase 8 tip
- Env: Production-equivalent; `HANSOME_SMART_LP_REFRESH` unset; Pons excluded; no secrets printed

### 6. A/B comparison method

| Arm | URL / tip | Purpose |
|-----|-----------|---------|
| Phase 8 baseline | `https://www.hansomealpacas.xyz` → `dpl_5xqS15t…` | Live Full Quick tip; cached snapshot + latency baseline 40.0s |
| Known-First candidate | `https://hansomealpacas.vercel.app` (temp) → `dpl_59LKD82…` | Latency + KF path proof |
| Forced Full Quick | Unit/harness Mode C + PRIMARY degraded fallback observed | Structural equality via frozen harness; live PRIMARY hit `full_quick_fallback` |

Structural equality: Phase 8.1A Modes A/B/C/D + clean KF component vector. Latency: real spaced live refreshes on candidate only.

### 7. HANSOME clean runs (≥3)

| # | Wall (ms) | Score | Lock | discoveryComplete | Plan | skipQuick | v4/Titan |
|---|----------:|------:|------|-------------------|------|:---------:|:--------:|
| 1 | **40 797** | 54 | MIXED | false | `known_first_price_only` | YES | skipped |
| 2 | **37 510** | 54 | MIXED | false | `known_first_price_only` | YES | skipped |
| 3 | **35 727** | 54 | MIXED | false | `known_first_price_only` | YES | skipped |

- Spacing ≥68s; no overlapping Deep; no cooldown denials in clean sample
- Entered Liquidity; published Known-First plan; eligible early-exit; skipped broad v4 Quick + broad Titan; terminal `complete`; no analyzing leftovers; finalized score; MIXED; `discoveryComplete=false`
- Progress sequence observed: `lp_known_first_plan` → `lp_known_evidence_load` → `lp_known_evidence_validate` → `lp_owner_reuse` → `lp_lock_reuse` → `lp_market_refresh` → `lp_known_first_early_exit` → `lp_final_validation` → `lp_background_exhaustive`

### 8. Latency gate

| Metric | Value | Gate |
|--------|------:|------|
| Phase 8 baseline | ~40 009 ms | reference |
| Clean n | **3** | ≥3 required |
| min / median / max | **35 727 / 37 510 / 40 797** | |
| Primary ≤25s | **FAIL** (37.5s) | |
| Fallback ≤32s AND ≥20% vs 40s | **FAIL** (37.5s ≉ ≤32s; only ~6% vs baseline) | |

**Latency gate: FAIL** → do not deploy.

### 9. Request reduction

Per clean run (progress/action signals):

| Signal | Run1 | Run2 | Run3 |
|--------|:----:|:----:|:----:|
| Broad v4 Quick (`probe_v4` / quick path) | skipped | skipped | skipped |
| Broad Titan (`quick_titan`) | skipped | skipped | skipped |
| `lp_owner_reuse` | yes | yes | yes |
| `lp_lock_reuse` | yes | yes | yes |
| `lp_market_refresh` (price-only) | yes | yes | yes |
| `lp_full_quick_fallback` | no | no | no |
| Source tag | `known_first_early_exit` | same | same |

No unexplained broad Quick/Titan burst on eligible clean runs. Price-only path as designed. Exact RPC/Blockscout/Gecko counters not exported from Production spans; qualitative skip of LP RPC burst confirmed via action sequence.

### 10. Fallback validation (15 scenarios)

Covered by `known-first-early-exit.test.ts` + `phase81a-semantic-drift.test.ts` (unit; all PASS):

| # | Scenario | Outcome |
|---|----------|---------|
| 1 | Owner stale | `known_first_owner_revalidate` (targeted) |
| 2 | Lock stale | `known_first_lock_revalidate` |
| 3 | Near-expiry | `known_first_lock_revalidate` |
| 4 | Position NFT transfer | owner revalidate / fail-closed |
| 5 | New liquidity event | `full_quick_fallback` |
| 6 | Reorg conflict | `full_quick_fallback` |
| 7 | Corrupt LP cache | `cold_fallback` |
| 8 | Schema mismatch | `cold_fallback` |
| 9 | Semantic-version mismatch | `cold_fallback` |
| 10 | Explicit full refresh | `full_quick_fallback` |
| 11 | Previous critical partial | fail-closed to full Quick |
| 12 | Known evidence insufficient | `known_first_insufficient` |
| 13 | Cold token / no known positions | `cold_fallback` |
| 14 | Unsupported locker | reuse when fresh / no false ALL_LOCKED |
| 15 | Failed owner lookup | `known_first_owner_revalidate` |

Live: PRIMARY refresh exercised `full_quick_fallback` (degraded_watchdog) and still terminated `complete` score 66, lock `UNABLE_TO_DETERMINE`, `discoveryComplete=false` — no false ALL_LOCKED / No Liquidity.

### 11. Semantic equality (hard fields)

| Field | Clean KF (×3) | Frozen harness A/B/C/D | Equal? |
|-------|---------------|------------------------|:------:|
| Score | **54** | **54** | YES |
| Components | 75/45/43/34/55/67 | same | YES |
| Lock | MIXED | MIXED | YES |
| discoveryComplete | false | false | YES |
| Position IDs (live curl/evidence) | 47299, 357867, 142938 | fixture match | YES |
| Owner / locker | Titan + EOAs (reuse) | equal helpers | YES |

Phase 8.1A proved prior 53→54 is **MARKET_STATE_DRIFT**, not Known-First semantic bug. Expected Production score for this window: **54**.

### 12. Core 7

| Token | Status (cached poll @ candidate) | Score | Lock | Notes |
|-------|----------------------------------|------:|------|-------|
| HANSOME | complete | 54 | MIXED | OK |
| PRIMARY | complete | 66 | UNABLE_TO_DETERMINE | OK after refresh |
| FOX…WALLET | `deep_running` @ ~45s budget | — | UNABLE_TO_DETERMINE | Short poll / residual Deep contention; **core7Terminal=false** |
| False ALL_LOCKED / No Liquidity | **0** | | | |

Gate incomplete for promotion; not the primary blocker (latency already fails).

### 13. Top-100 frozen semantic sample

N=25 cached sample on candidate:

| Metric | Value |
|--------|------:|
| semanticDrift | **0** |
| terminalViolations | **0** |
| false ALL_LOCKED / No Liquidity | **0** |

Natural live market/score diffs labeled separately from hard-field drift (none observed as false classifications).

### 14. Phase 7.3 reliability

- Unit: `deep-bounded-settlement`, `deep-stall-rca`, retry-race, stalled-progress, warm-incremental, deep-parallel-related — **PASS**
- Live HANSOME clean runs: Promise settled, finalization OK, locks released, no analyzing leftovers, no fake 100%, background exhaustive not on interactive barrier
- Watchdog path still bounded (PRIMARY degraded fallback terminated)
- No late overwrite of complete KF results observed in clean sample

### 15. Progress actions

Required sequence present on clean runs (monotonic; single terminal):  
`lp_known_first_plan` → evidence load/validate → owner/lock reuse → `lp_market_refresh` → `lp_known_first_early_exit` → `lp_final_validation` → `lp_background_exhaustive`. Fallback reason visible when applicable (`full_quick_fallback` on PRIMARY).

### 16. Analytics / admin / game (pre-promotion; www = Phase 8)

| Check | Result |
|-------|--------|
| www | **200** |
| game | **200** |
| analytics visit (beacon) | **200** |
| analytics opt-out | **200** |
| analytics stats (unauthorized) | **401** |
| admin page | **200** (login surface; no secrets printed) |
| game visual diff | **0.00%** (PASS) |
| www visual | **0.00%** (PASS) |

### 17. Tests

| Suite | Result |
|-------|--------|
| phase81a-semantic-drift | PASS |
| known-first-early-exit / lp-known-first | PASS |
| lp-mixed / quick / multi-version / discovery-cache | PASS |
| score / overall / presentations (creator/burn/holder) | PASS |
| deep-bounded / stall / retry-race / stalled-progress | PASS |
| warm-incremental / transfer-index / scan-cache | PASS |
| analytics | PASS |
| visual game landing | **PASS** (0% diff) |
| `tsc --noEmit` | **PASS** |
| Production build (candidate) | **Ready** |

### 18. Typecheck

`npx tsc --noEmit -p tsconfig.json` → exit 0.

### 19. Build

Candidate `dpl_59LKD82aQcmuMGEvdYQYHFwks17w` Ready after `vercel deploy --prod --skip-domain`.

### 20. Deploy decision

**PASS_NOT_DEPLOYED** — hard latency gate failed.

| Hard gate | Result |
|-----------|--------|
| Pre-deploy A/B/C/D equality @54 | PASS |
| ≥3 clean KF HANSOME runs | PASS |
| Broad Quick+Titan skipped on clean | PASS |
| Score/MIXED/incomplete stable | PASS |
| Latency primary ≤25s OR fallback ≤32s & ≥20% | **FAIL** (median **37 510 ms**) |
| Core7 all terminal | FAIL (poll/contention) |
| Top-100 hard drift=0 | PASS |
| Analytics/admin/game/visual | PASS |
| Smart LP off / Pons excluded | PASS |

Promote www/game **only if all hard gates true** → not met.

### 21. Deploy ID

Candidate (not promoted): **`dpl_59LKD82aQcmuMGEvdYQYHFwks17w`**  
Live tip: **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`**

### 22. Alias status

| Host | Tip |
|------|-----|
| www.hansomealpacas.xyz | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| game.hansomealpacas.xyz | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| hansomealpacas.vercel.app | restored → `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |

### 23. Rollback status

**Not required** (www/game never left Phase 8). Temporary test alias restored to Phase 8 tip. Candidate remains Ready but unaliased for www/game.

### 24. Post-promotion smoke

**N/A** — not promoted.

### 25. Known-first architecture (reconfirmed)

Unchanged from Phase 8.1: planner outcomes, MIXED sufficiency, freshness TTLs, price-only separation, background exhaustive, progress units. Smart LP remains off.

### 26. Remaining limitations

- Clean Known-First median **~37.5s** still dominated by non-Quick parallel work (CreatorBurn / Relationships / market) — Quick skip alone insufficient for ≤25s / ≤32s gates
- Stretch ≤15s not approached
- Core7 full-terminal matrix needs longer isolated poll after latency work
- Non-aliased deployment URLs remain SSO-protected; use public alias or `vercel curl` for tip A/B
- Do not broaden Known-First or re-enable Smart LP without a new gated phase

### 27. Forbidden-scope compliance

No score formula/weight/threshold changes. No liquidity/lock semantic changes. Smart LP off. Pons excluded. No creator/burn/holder/price/TVL/proxy/contracts/analytics/admin/game modifications for this re-gate. No new optimization ideas shipped.

### 28. Request / cache notes

Clean runs: owner+lock reuse, market refresh only, background exhaustive flagged, cache provenance retained `known_first_early_exit` source on success path. Invalidation fail-closed covered by unit scenarios.

### 29. PRIMARY

Refresh: **137 919 ms**, terminal complete, score **66**, lock `UNABLE_TO_DETERMINE`, `discoveryComplete=false`, plan `full_quick_fallback` / degraded_watchdog — honest fallback, not counted as clean KF latency sample.

### 30. Final gate table (summary)

| Gate | Pass? |
|------|:-----:|
| Semantic harness A=B=C=D @54 | ✅ |
| Clean KF ×3 | ✅ |
| Skip broad Quick+Titan | ✅ |
| Latency ≤25s / ≤32s | ❌ |
| Core7 terminal | ❌ |
| Top-100 drift=0 | ✅ |
| Reliability units + live settle | ✅ |
| Analytics/admin/game/visual | ✅ |
| Promote www/game | ❌ |

### 31. Final verdict

**PASS_NOT_DEPLOYED**

Known-First was reintroduced on candidate `dpl_59LKD82aQcmuMGEvdYQYHFwks17w`, passed frozen semantic equality (expected score **54**), and delivered **3/3** clean `known_first_price_only` runs with broad Quick/Titan skipped. Clean median **37 510 ms** misses both latency hard gates (≤25s primary; ≤32s fallback / ≥20% vs 40s). www/game remain on Phase 8 `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`. Smart LP off; Pons excluded. No production alias promotion.

---

### Return summary (for parent)

- **Verdict:** **PASS_NOT_DEPLOYED**
- **Report:** `reports/HANSOME_COLD_PERF_V2_PHASE8_1B_KNOWN_FIRST_PRODUCTION.md`
- **Live tip before/after:** `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` / `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`
- **Candidate deploy ID:** `dpl_59LKD82aQcmuMGEvdYQYHFwks17w` (not promoted)
- **Median latency (clean KF):** **37 510 ms** (min 35 727 / max 40 797; n=3)
- **Key gate failures:** latency primary+fallback; Core7 full-terminal incomplete under short poll
- **Rollback status:** N/A (www/game never promoted; test alias restored to Phase 8)
