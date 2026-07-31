# HANSOME — Cold Perf V2 Phase 4 Recent-first Pipeline Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Deploy ID** | `dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM` |
| **Rollback (Phase 3 tip)** | `dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **PASS_DEPLOYED** |

---

### 1. Implementation summary

Cold recent-first transfer pipeline on Deep creatorBurn:

1. **Latest pages first** — newest-first `min(6 Blockscout pages, 7-day cursor)`
2. **Early analyze/publish** — `onRecentTier` publishes Creator + Burn with honest Incomplete (`paginationComplete=false`, creator `available=false`) while stages stay `analyzing`
3. **Historical continuation** — remaining pages resume from checkpoint cursor (time-stop uses `pageStartParams` so boundary rows are not skipped)
4. **Background resume** — if genesis still open after stage budget, `scheduleTransferIndexBackgroundRefresh({ forceResume: true })` continues indexing
5. **Never Complete early** — `paginationComplete` / creator `available` only when genesis exhausted (unchanged analyzer honesty)

Paging priority preserved: latest → indexed checkpoint resume → remaining historical. Duplicate recent re-walk avoided on resume.

### 2. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/transfer-index/paging.ts` | Recent-first session, stats, pipeline phases, background forceResume |
| `lib/hansome-score/transfer-index/keys.ts` | `TRANSFER_INDEX_RECENT_TIER_MAX_PAGES=6`, `…_MAX_AGE_MS=7d` |
| `lib/hansome-score/transfer-index/index.ts` | Exports |
| `lib/hansome-score/blockscout.ts` | `pageStartParams` / `resumePageParams` for time-stop handoff |
| `lib/hansome-score/scan-deep.ts` | Wire `recentFirst` + early `creatorBurn:recent` publish |
| `lib/hansome-score/__tests__/transfer-index-recent-first.test.ts` | **New** 12 required cases |
| `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts` | Mock `scheduleTransferIndexBackgroundRefresh` + stats |
| `scripts/_tmp-cold-perf-v2-phase4-*.mjs` | Baseline / benchmark / prod smoke |
| `reports/data/cold_perf_v2_phase4_*.json` | Evidence artifacts |

**Forbidden-file audit: PASS** — no score/weights/burn/LP/lock/creator/security/proxy/contract-cache semantics, API schema, UI, or i18n edits.

### 3. Benchmark before/after

| Condition | Evidence |
|-----------|----------|
| Production Phase 3 tip (before) | Core warm median **~321 ms**; scores HANSOME 53 / FOX 73 / WALLET 76 |
| Recent-first unit proof | Recent tier (6p + 7d stop) **before** historical; resume skips recent re-walk; `rpcPagesThisCall=0` on reuse_hit |
| After deploy (warm Fast) | No material HTTP latency regression on core warm hits |

JSON: `reports/data/cold_perf_v2_phase4_benchmark.json`  
**Do not claim a specific e2e Deep %** — Fast path is cache-dominated; recent-first win is Deep transfer paging / first meaningful Creator+Burn publish.

### 4. Checkpoint statistics

| Metric (unit / instrumentation) | Result |
|---------------------------------|--------|
| Checkpoint resume | `fetchMode=resume`, `stats.checkpointReuse=true` |
| Skipped pages on resume | Prior `pagesFetchedTotal` not re-fetched |
| Cache reuse | `reuse_hit` → `rpcPagesThisCall=0` |
| Concurrent lock miss | `concurrent_reuse`, zero RPC |
| Background historical | Scheduled when `historicalContinuationPending` |

### 5. RPC/page reduction

| Path | Behavior |
|------|----------|
| Cold Deep first useful | Caps first analyze window at **≤6 pages ∩ 7d** before historical |
| Resume / warm complete | Avoids re-walking already-indexed pages |
| Time-stop handoff | Re-fetches boundary page via `resumePageParams` (no silent row loss) |

Proven in vitest; production Deep page counts are isolate/KV dependent.

### 6. Top100 regression

| Check | Result |
|-------|--------|
| Pre-deploy baseline (Phase 3 tip) | **100/100 HTTP 200** |
| Post-deploy hard-field compare | **semantic = 0** (`top100Compared=100`) |
| Core HANSOME/FOX/GME/CASHCAT/PONS/TYGR/WALLET | Hard fields match (PONS provisional `deep_running`→`complete` score progression excluded per Phase 2 policy) |
| Critical/high findings flood | **0** |

JSON: `reports/data/cold_perf_v2_phase4_predeploy_baseline.json`, `cold_perf_v2_phase4_prod_smoke.json`

### 7. Tests

| Suite | Result |
|-------|--------|
| transfer-index-recent-first (12) | **PASS** |
| transfer-index schema / checkpoint / reuse | **PASS** |
| contract-cache | **PASS** |
| score / overall / burn-presentation / supply-burn | **PASS** |
| lp-known-first | **PASS** |
| scan-deep reliability / retry / stage-independence / progress / cache | **PASS** |
| typecheck | **PASS** |

### 8. Production build

**PASS** (local `next build` + Vercel production build).

### 9. Deploy ID

`dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM`

### 10. Alias

**YES** → https://www.hansomealpacas.xyz

### 11. Smoke

Core 7 + Top100 full hard-field + ≥25 sample → **PASS**  
Confirmations: identical hard scan fields; recent-first wired in Deep; checkpoint/contract-cache compatible; no UI/i18n/score-formula changes; no secrets.

### 12. Rollback

**NO** — not required. Target if needed: **`dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n`** (Phase 3 contract cache).

### 13. Remaining limitations

- First meaningful Deep still gated by relationships/liquidity stage order (true parallel is Phase 6).
- FOX-class full genesis remains multi-pass / background; recent tier stays Incomplete by design.
- Warm Fast HTTP latency is snapshot-cache dominated — not a Deep recent-first meter.
- Background historical continuation is best-effort within isolate lifetime.

### 14. Final verdict

**PASS_DEPLOYED**
