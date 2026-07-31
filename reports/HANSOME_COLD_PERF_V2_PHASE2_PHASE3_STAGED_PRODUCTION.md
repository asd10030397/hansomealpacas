# HANSOME — Cold Perf V2 Phase 2 + Phase 3 Staged Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Pipeline** | Stage A (Phase 2 transfer-index) → Stage B (Phase 3 contract cache) |
| **Combined ship** | **No** — separate deploy tips |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |

---

# Stage A — Phase 2 Transfer-Index Wiring

| Field | Value |
|-------|--------|
| **Deploy ID** | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` |
| **Previous tip (rollback)** | `dpl_38ZyALv1m91mkm4F6axjkjN1wGey` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **Verdict** | **PASS_DEPLOYED** |

### 1. Implementation summary

Cold-path transfer-index reuse: validate status `complete|incomplete|stale|rebuilding`; Fast peeks + background refresh only; Deep reuse / head-refresh / resume / rebuild; Relationships prefer indexed head page.

### 2. Files changed

`transfer-index/validate.ts` (new), `paging.ts`, `index.ts`, `scan-cache.ts`, `scan-deep.ts`, `transfer-index-reuse.test.ts`, stage-independence mock, benchmark/smoke scripts + JSON under `reports/data/cold_perf_v2_phase2_*`.

### 3. Forbidden-file audit

**PASS** — no score/burn/LP/lock/creator/security/UI/i18n/API schema edits.

### 4. Tests

transfer-index schema + checkpoint + reuse; scan-deep/reliability/retry/cache/fast; typecheck **PASS**.

### 5. Top100 regression

Pre-deploy 100/100 HTTP 200; post-deploy complete scores HANSOME 53 / FOX 73 unchanged; sample smoke **PASS**.

### 6. Benchmark

Pre-deploy core warm median ~282 ms; reuse proof `reuse_hit ⇒ rpcPagesThisCall=0`. No material latency regression.

### 7. Build

Local + Vercel production build **PASS**.

### 8. Deploy ID

`dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz`

### 9. Alias

**YES** → www.hansomealpacas.xyz

### 10. Smoke

`cold_perf_v2_phase2_prod_smoke.json` → **PASS**

### 11. Rollback

**NO** — tip kept as Stage B known-good.

### 12. Remaining limitations

Full genesis indexing still budget-bound on FOX-class; warm wins require prior Deep checkpoint. Status `stale` forces head refresh ≤5 pages.

### 13. Final verdict

**PASS_DEPLOYED**

Detail: `reports/HANSOME_COLD_PERF_V2_PHASE2_COMPLETION_PRODUCTION.md`

---

# Stage B — Phase 3 Contract Cache

| Field | Value |
|-------|--------|
| **Deploy ID** | `dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n` |
| **Rollback (Phase 2 known-good)** | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **Verdict** | **PASS_DEPLOYED** |

### 1. Implementation summary

Production-safe static contract cache (`lib/hansome-score/contract-cache.ts`) keyed by chainId + normalized address + schema version + analyzer version + artifact type + bytecode hash.

Caches: runtime bytecode (in bundle), verified ABI/source metadata, proxy **heuristic** result (ABI/source only).  
Does **not** cache mutable holders/supply/liquidity/locks.  
Unresolved proxy stays Unknown (`isProxy=null`); never cached as permanent No.  
RPC/explorer failures do not poison positive entries (short negative TTL only).  
Cache failure → uncached fallback; concurrent rebuilds deduped.

Wired into `scanTokenFast` via `resolveContractStaticAfterBytecode` after parallel bytecode read — `analyzeContractRisk` semantics unchanged.

### 2. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/contract-cache.ts` | **New** cache module |
| `lib/hansome-score/scan-fast.ts` | Wire resolve after bytecode |
| `lib/hansome-score/__tests__/contract-cache.test.ts` | **New** 18 required cases |
| `reports/data/cold_perf_v2_phase3_*.json` | Baseline + smoke |

### 3. Forbidden-file audit

**PASS** — no scoring/bytecode classifier/proxy semantics/burn/security/holder/creator/liquidity/lock/adapters/API/UI changes. Only cache + Fast I/O wiring + tests/docs.

### 4. Tests

| Suite | Result |
|-------|--------|
| contract-cache (18 cases) | **PASS** |
| Phase 2 transfer-index suites | **PASS** |
| supply-burn, score, burn-presentation | **PASS** |
| scan reliability / retry / cache / progress | **PASS** |
| typecheck | **PASS** |
| production build | **PASS** |

### 5. Top100 regression

| Check | Result |
|-------|--------|
| Pre-deploy baseline (Phase 2 tip) | 100/100 HTTP 200 |
| Post-deploy hard-field compare | **semantic = 0** |
| Core HANSOME/FOX/GME/CASHCAT/PONS/TYGR/WALLET | scores + burn + proxy identical |
| Critical/high findings flood | **0** |

JSON: `reports/data/cold_perf_v2_phase3_predeploy_baseline.json`, `cold_perf_v2_phase3_prod_smoke.json`

### 6. Benchmark

| Condition | Evidence |
|-----------|----------|
| (1) Production baseline (Phase 2 tip) | Core warm hits; HANSOME 53 / FOX 73 / WALLET 40 |
| (2) Cold cache (miss→populate) | Unit: first call `state=miss` + explorer fetch |
| (3) Warm cache | Unit: second call `state=hit`, `explorerAvoided=true`, `fetchSmart` not called |

Latency: snapshot-cache dominates Fast HTTP; **do not claim a specific % e2e improvement**. Proven avoided work = Blockscout smart-contract GET on warm contract-cache hit (unit instrumentation). No material regression observed on core warm repeats (`X-Scan-Cache-Hit: 1`).

### 7. Build

**PASS** (local + Vercel).

### 8. Deploy ID

`dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n`

### 9. Alias

**YES** → www.hansomealpacas.xyz

### 10. Smoke

Core 7 + Top100 full hard-field + ≥25 sample → **PASS** (`cold_perf_v2_phase3_prod_smoke.json`). Unknown proxy preserved (GME/WALLET `proxy=null`). No secrets.

### 11. Rollback

**NO** — not required. Target if needed: **`dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz`** (Phase 2).

### 12. Remaining limitations

- No on-chain EIP-1967 implementation resolver (unchanged product semantics); cache stores heuristic only.
- Creation bytecode not separately sourced from explorer today (runtime bytecode is the hash key).
- Negative/incomplete ABI entries use 60s TTL only.
- Warm explorer avoidance is isolate/KV dependent; first isolate after deploy still populates.

### 13. Final verdict

**PASS_DEPLOYED**

---

## Pipeline summary

| Stage | Deploy ID | Rollback target | Verdict |
|-------|-----------|-----------------|---------|
| **A Phase 2** | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` | `dpl_38ZyALv1m91mkm4F6axjkjN1wGey` | **PASS_DEPLOYED** |
| **B Phase 3** | `dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n` | `dpl_AfMi1qkEt4NYa1cGoZCNDwzob9fz` | **PASS_DEPLOYED** |

**Live tip:** `dpl_6jLqPkNGzpPTvSSFnbeoK8E8Ev3n` @ https://www.hansomealpacas.xyz
