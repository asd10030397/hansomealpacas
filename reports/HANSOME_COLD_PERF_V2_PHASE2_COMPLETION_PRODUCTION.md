# HANSOME — Cold Perf V2 Phase 2 Completion (Production)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Stage** | A — Phase 2 transfer-index Cold-path wiring |
| **Deployed** | **YES** |
| **Production deploy ID** | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` |
| **Previous known-good (rollback)** | `dpl_38ZyALv1m91mkm4F6axjkjN1wGey` (Burn Explainability) |
| **Alias** | https://www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Final verdict** | **PASS_DEPLOYED** |

---

## 1. Implementation summary

Completed Cold-path transfer-index wiring on top of Phase 2 schema + PR2 checkpointing:

| Path | Behavior |
|------|----------|
| **Validate** | Explicit status `complete \| incomplete \| stale \| rebuilding` |
| **Fast** | Peek transfer-index; background refresh only when needed; **no** Fast response mutation |
| **Deep** | Reuse complete+fresh (0 Blockscout pages); stale → head refresh ≤5; incomplete → resume; corrupt/version mismatch → rebuild |
| **Relationships** | Prefer index chunk-0 early buys (skip duplicate page-1 GET when present) |
| **Honesty** | Never report stale as `reuseStatus=complete`; genesis `paginationComplete` preserved for analyzers |

---

## 2. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/transfer-index/validate.ts` | **New** status / reuse evaluation |
| `lib/hansome-score/transfer-index/paging.ts` | Reuse / head-refresh / rebuild / background schedule / early-from-index |
| `lib/hansome-score/transfer-index/index.ts` | Export completion APIs |
| `lib/hansome-score/scan-cache.ts` | Fast/warm peek + `scheduleTransferIndexBackgroundRefresh` |
| `lib/hansome-score/scan-deep.ts` | Relationships reuse indexed head |
| `lib/hansome-score/__tests__/transfer-index-reuse.test.ts` | **New** required lifecycle tests |
| `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts` | Mock `loadEarlyTransfersFromIndex` |
| `scripts/_tmp-cold-perf-v2-phase2-*.mjs` | Benchmark / Top100 / smoke |
| `reports/data/cold_perf_v2_phase2_*.json` | Machine results |

**Forbidden untouched:** score, burn classification, LP/lock, creator formulas, security thresholds, UI/i18n, API schema.

---

## 3. Benchmark before/after

| Metric | Pre-deploy Production (baseline) | After (proof) |
|--------|----------------------------------|---------------|
| Core cold median | 334 ms (snapshot-cache dominated) | Warm hit `X-Scan-Cache-Hit: 1` on repeats |
| Core warm median | 282 ms | Same band; no material regression |
| Transfer-index RPC pages on complete+fresh | n/a (unwired) | **`rpcPagesThisCall=0`** (`reuse_hit`) — vitest proof |
| Stale complete | n/a | Head refresh ≤5 pages; `reuseStatus` not complete while stale |
| Incomplete | PR2 resume | Resume preserved |

JSON: `reports/data/cold_perf_v2_phase2_benchmark.json`

---

## 4. Cache statistics

| Status | Meaning |
|--------|---------|
| `complete` | Genesis exhausted + head fresh → pure reuse |
| `incomplete` | Partial progress / resume cursor |
| `stale` | Genesis complete but head aged → head refresh |
| `rebuilding` | Missing / corrupt / version mismatch / force |

---

## 5. RPC reduction

Proven locally: complete+fresh path does **not** call `fetchTokenTransfersPaged`. Concurrent lock holders return cached chunks without double-paging. Relationships skip Blockscout page-1 when chunk-0 exists.

---

## 6. Top100 regression

| Check | Result |
|-------|--------|
| Pre-deploy Top100 Fast capture | **100/100 HTTP 200** |
| Post-deploy core complete scores | HANSOME **53→53**, FOX **73→73** |
| Post-deploy sample (≥20) | **25/25 HTTP 200**, no secrets |
| Unit cached↔rebuild transfer identity | **PASS** |
| Semantic regressions (hard fields / complete locks) | **0** |

Note: deep_running provisional score ±2 (GME/CASHCAT) attributed to Deep progression, not transfer-index semantics.

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `transfer-index*.test.ts` (schema + checkpoint + reuse) | **PASS** (35+) |
| scan-deep stage / reliability / retry-race / cache / fast | **PASS** |
| scan-progress, burn-presentation, lp-discovery-cache | **PASS** |
| `npm run typecheck` | **PASS** |

Required coverage: cache reuse, stale, partial, corruption, rebuild, retry, timeout, version mismatch, concurrent, deep reuse — **PASS**.

---

## 8. Production build

`npm run build` → **PASS** (Next.js 15.5.20). Vercel remote build **PASS**.

---

## 9. Deploy ID

`dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz`

---

## 10. Alias

`www.hansomealpacas.xyz` → live tip **YES** (`vercel inspect`).

---

## 11. Smoke

`scripts/_tmp-cold-perf-v2-phase2-prod-smoke.mjs` → **PASS**  
JSON: `reports/data/cold_perf_v2_phase2_prod_smoke.json`

---

## 12. Rollback

| Item | Value |
|------|--------|
| Rollback performed | **NO** |
| Target if needed | `dpl_38ZyALv1m91mkm4F6axjkjN1wGey` |
| **Stage B known-good (this tip)** | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` |

---

## 13. Final verdict

**PASS_DEPLOYED**
