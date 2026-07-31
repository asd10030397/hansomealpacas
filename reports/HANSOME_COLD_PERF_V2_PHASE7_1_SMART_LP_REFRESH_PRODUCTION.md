# HANSOME — Cold Perf V2 Phase 7.1 Smart LP Refresh Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy attempts** | `dpl_Cq581YYcyRsF4GyNiMwyHWr3uVeA` → rolled back; `dpl_BmYaoS5WJbCGRC3Prtj6evWEKabi` → rolled back |
| **Live tip after rollback** | `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` (Phase 7 Warm Incremental) |
| **Rollback target (pre-Phase-7.1)** | `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` |
| **Alias** | www / game → Phase 7 tip **YES** (restored) |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **ROLLED_BACK** |

---

### 1. Exact pre-deploy Production tip

`dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` (Phase 7 Warm Incremental — verified alias before ship).

### 2. Root cause of forced LP refresh latency

Phase 7 manual `refresh=true` set `forceLiquidityRefresh: true`, which always re-armed Liquidity and ran full `detectMultiVersionLpIntelligence` (v2+v3+v4 probes + ownership/lock revalidation) even when:

- no LP delta existed
- prior MIXED evidence was still fresh
- only price/TVL needed updating

HANSOME baseline wall: **~60.7s**.

### 3. Smart LP decision architecture

New module `lib/hansome-score/lp/smart-refresh.ts`:

- `planSmartLpRefresh(evidence)` → structured outcome + reasons + evidence
- Outcomes: `reuse_all` | `refresh_price_only` | `refresh_pool_state` | `refresh_position_owner` | `refresh_lock_status` | `refresh_new_events` | `full_quick_lp` | `full_revalidation` | `cold_fallback`
- Wired into `scan-deep` liquidity job via `coalesceSmartLpRefresh`
- Manual refresh marks KV key `scan:lp:manual-smart:{chain}:{token}` (cross-isolate)
- Internal `forceLpFullRefresh` / `HANSOME_FORCE_LP_FULL_REFRESH=1` for full revalidation

### 4. Reuse eligibility rules

Reuse ownership/lock only when all hold:

- chain + normalized address match
- LP cache schema `version === 1`
- analysis semantic version compatible (`SCORE_SPEC_VERSION`)
- prior LP payload present / not corrupt
- known Position IDs available
- no invalidation signals
- ownership age ≤ `positionOwnerMs` (10m)
- lock age ≤ `lockClassificationMs` (10m) and expiry not near/passed
- no `forceLpFullRefresh` / reorg / prior partial failure

### 5. Invalidation events

Signals: pool init/add/remove, NFT transfer, locker deposit/withdraw/extend/unlock, ownership transfer, burn, migration, pair discovery, proxy impl change, reorg overlap.

Planner reacts with targeted outcomes (no broad historical scan required to decide).

### 6. Freshness TTLs

| Component | TTL | Why safe |
|-----------|----:|----------|
| pool existence | 24h | Bust on pair/migration signal |
| Position IDs | 6h | Bust on burn / new discovery |
| Position owner | 10m | Short; transfer / TTL / failure |
| Locker owner | 10m | Same band as owner |
| Lock classification | 10m | Near-expiry overrides |
| Lock expiry warning | 24h window | Aggressive refresh near unlock |
| Pool balances | 45s | Market overlay |
| Liquidity amounts | 10m | With owner refresh |
| TVL / price | 45s | Independent of ownership |
| discovery / exhaustive flags | durable | Never silently upgrade Complete |

### 7. Lock-expiry policy

- Far expiry + fresh → reuse
- Within warning window → `refresh_lock_status`
- Passed → mandatory `refresh_lock_status`
- Expiry unknown / permanent → do not invent locked/unlocked
- Unsupported locker → reuse classification when fresh

### 8. Price/TVL separation

`refresh_price_only` / `refresh_pool_state` / `reuse_all` keep prior positions + lock classification; re-run Gecko price/TVL + existing `computeEconomicLockDistribution` USD overlay only. No formula changes.

### 9. Position owner refresh behavior

- Structural reuse: **0** `ownerOf` / `readPosition`
- Selective: only known IDs via `revalidatePositionIds` + `detectV4LpIntelligence` (skip Quick PM + broad Titan + v2/v3)
- Full path: existing multi-version Quick LP

### 10. Locker refresh behavior

Selective uses targeted Titan-by-ID only (`skipBroadTitanSweep`). Full path unchanged. Pons remains excluded/unwired.

### 11. Incomplete discovery behavior

Preserves `discoveryComplete=false`; background exhaustive still scheduled; never upgrades Incomplete→Complete from smart path.

### 12. Concurrency and locking

- Per-token LP refresh lock (`scan:lp:refresh-lock:*`)
- Promise coalescing (`coalesceSmartLpRefresh`)
- Manual-smart mark in KV (survives API → `after()` isolate)
- Existing Deep fencing / scan refresh locks unchanged

### 13. HANSOME before/after manual refresh

| Metric | Phase 7 baseline | 7.1 attempt A | 7.1 attempt B (KV fix) |
|--------|----------------:|-------------:|----------------------:|
| Wall ms | **60,738** | **181,052** (timeout) | **91,739** (timeout) |
| Status at measure end | complete | deep_running | deep_running |
| Lock | MIXED | MIXED | MIXED |
| Score | 53 | 53 (mid) | 52 |
| Smart path evidence | n/a | none (LP skipped) | `lp_refresh_plan` + `smart_lp_selective_ids` |
| Target 5–20s | — | **MISS** | **MISS** |
| Material improvement | — | **NO** | **NO** |

### 14. Acceptance-token measurements

Cached warm second-scans on Core7 (attempt A smoke): measured; no false `ALL_LOCKED`; HANSOME MIXED preserved on snapshot. Full smart-refresh wall for HANSOME did **not** improve.

### 15. ownerOf/readPosition calls before/after

| Path | Expected | Observed in prod |
|------|----------|------------------|
| Phase 7 force refresh | Full multi-version revalidate | ~60.7s complete |
| 7.1 structural reuse | ~0 ownerOf | Not proven on successful complete |
| 7.1 selective | ownerOf for known IDs only | Sources showed `smart_lp_selective_ids`; job stayed `analyzing` until measure timeout |

### 16. Locker calls before/after

Selective path intended targeted Titan-by-ID only; not fully verified on a completed warm refresh in Production.

### 17. Blockscout pages before/after

CreatorBurn `head_overlap_refresh` dominated timelines; pages often `0` while stalled. LP path did not reduce wall when sibling stages stalled.

### 18. Smart vs full refresh comparison

Unit: `smartLpSemanticEqual` helper + planner tests (MIXED preserved). Production smart vs full equality on completed same-state refresh: **not proven** (Deep did not complete within measure window).

### 19. Progress sequence

Implemented actions: `lp_refresh_plan` → `lp_cache_validate` → `lp_event_delta_check` → owner/lock reuse|refresh → `lp_price_refresh` → `lp_checkpoint_update` → `lp_background_exhaustive` → `lp_final_validation`.

Prod B observed `lp_refresh_plan` then sibling-stage `watchdog_stall` (relationships/creatorBurn). Incomplete discovery capped below fake 100%.

### 20. Core 7 results

Attempt A cached Core7: no false `ALL_LOCKED`; HANSOME MIXED + incomplete. Refresh wall gate failed.

### 21. Top-100 semantic validation

Attempt A sample 25: **semanticDrift = 0**.

### 22. Smart/full semantic equality

Unit helper PASS. Live completed equality: **NOT PROVEN** (gate fail).

### 23. Tests

| Suite | Result |
|-------|--------|
| smart-lp-refresh (30 cases) | **PASS** |
| LP Quick / cache / known-first / mixed / multi / presentation | **PASS** |
| warm-incremental / deep-parallel / stage-independence | **PASS** |
| transfer-index / progress / stalled-progress / analysis-progress | **PASS** |
| score / creator / burn / holder / supply-burn / scan-cache / position-value | **PASS** |

Pons locker adapter tests not required (adapter excluded).

### 24. Typecheck

`tsc --noEmit` → **PASS**

### 25. Production build

`next build` → **PASS** (local + Vercel)

### 26. Deploy ID

Attempts (not live):

- `dpl_Cq581YYcyRsF4GyNiMwyHWr3uVeA`
- `dpl_BmYaoS5WJbCGRC3Prtj6evWEKabi`

Live after rollback: `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ`

### 27. Alias status

www.hansomealpacas.xyz + game.hansomealpacas.xyz → **Phase 7 tip** (restored)

### 28. Rollback target

`dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` — **applied**

### 29. Analytics/admin smoke

Attempt A: public 200 PASS; admin unauthorized 401/403 PASS; opt-out PASS.

### 30. Game visual smoke

`scripts/game-landing-visual-smoke.mjs` → **PASS**, screenshot diff **0.00%** (during attempt A window)

### 31. Remaining limitations / why rolled back

1. **Deploy gate failed**: HANSOME manual refresh did not materially improve (worse / timed out vs 60.7s).
2. **First ship**: in-process manual-refresh flag did not cross Vercel isolates → Liquidity often skipped; CreatorBurn hit `watchdog_stall`.
3. **Second ship (KV mark)**: Smart LP armed (`lp_refresh_plan`, selective IDs) but Deep stayed `deep_running` ~90s+ with liquidity still `analyzing` and relationship/creatorBurn stalls — wall still dominated by non-LP / hung Deep work.
4. **Score observed 52** on incomplete refresh snapshots vs baseline 53 — not accepted as semantic equality proof.
5. Code remains in workspace for a follow-up that must prove completed refresh wall in 5–20s band (or honest miss) **and** no sibling-stage stall before re-ship.

### 32. Final verdict

**ROLLED_BACK**

---

### Files changed (workspace; not live)

| Path | Role |
|------|------|
| `lib/hansome-score/lp/smart-refresh.ts` | **New** — planner, TTLs, locks, coalesce, KV manual mark |
| `lib/hansome-score/lp/detect.ts` | Selective ID / skip Quick / skip broad Titan flags |
| `lib/hansome-score/scan-deep.ts` | Smart LP job branches + progress |
| `lib/hansome-score/scan-cache.ts` | Manual smart mark on refresh; no force-all ownership |
| `lib/hansome-score/warm-incremental.ts` | Progress action ids for Smart LP |
| `lib/hansome-score/__tests__/smart-lp-refresh.test.ts` | **New** 30 cases |
| `scripts/_tmp-cold-perf-v2-phase7_1-prod-smoke.mjs` | Prod smoke |
| `scripts/_tmp-phase71-hansome-refresh-only.mjs` | Focused remeasure |
| `reports/data/cold_perf_v2_phase7_1_*.json` | Evidence |

**Forbidden-file audit: PASS** — no score/weights/burn/lock math, holders, creator attribution, security, proxy semantics, token contracts, website analytics modules, admin auth, game assets, or Pons wiring.

### Evidence

- `reports/data/cold_perf_v2_phase7_1_prod_smoke.json`
- `reports/data/cold_perf_v2_phase7_1_hansome_refresh.json`
- `reports/data/cold_perf_v2_phase7_1b_hansome_refresh.json`
- `reports/_tmp-vercel-deploy-cold-perf-v2-phase7_1.log`
- `reports/_tmp-vercel-deploy-cold-perf-v2-phase7_1b.log`
