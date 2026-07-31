# HANSOME — Deep Perf V2 Phase 2: Shared Transfer-Index Schema + Helpers

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Phase** | 2 — Shared transfer-index schema + helpers |
| **Plan** | `reports/HANSOME_COLD_PERF_V2_UNIFIED_IMPLEMENTATION_PLAN.md` |
| **Code changed** | **Yes** (helpers only; unused by Production Deep) |
| **Deployed** | **No** |
| **Phase 3+** | **Not started** |
| **Phase 1 LP cache** | **Untouched** |
| **Analytics MVP** | **Untouched** |
| **Verdict** | **PASS** |

---

## 0. Verdict: PASS

Shared `scan:xfer:*` schema + helpers are implemented, unit-tested, and typecheck-clean. Production Fast/Deep paths are **not wired**. No deploy. Stop here pending approval before Phase 3.

---

## 1. Exact schema

### 1.1 Key names

| Key | Value |
|-----|--------|
| `scan:xfer:{chainId}:{token}` | `TransferIndexMeta` (cursors + completeness) |
| `scan:xfer:lock:{chainId}:{token}` | NX coordination lock (`"1:{ts}"` token) |
| `scan:xfer:chunk:{chainId}:{token}:{i}` | Optional bounded recent raw chunk (`i` = 0..5, newest-first) |
| `scan:xfer:derived:creator:{chainId}:{token}` | Bounded creator digest (derived facts) |

`{token}` is checksum-normalized lowercase via `viem.getAddress(...).toLowerCase()`.

Burn product store remains **`scan:burn:*`** (not forked / not redesigned).

### 1.2 `TransferIndexMeta` (v1)

| Field | Type | Purpose |
|-------|------|---------|
| `version` | `1` | Schema version |
| `chainId` | `number` | Chain separation |
| `address` | `string` | Normalized token |
| `headTimestampMs` / `headBlock` | `number \| null` | Newest indexed |
| `tailTimestampMs` / `tailBlock` | `number \| null` | Oldest indexed (genesis progress) |
| `nextPageParams` | `Record<string, string \| number> \| null` | Opaque Blockscout resume cursor |
| `paginationComplete` | `boolean` | Genesis exhausted |
| `pagesFetchedTotal` | `number` | Lifetime pages |
| `transfersIndexed` | `number` | Lifetime counted rows (progress; not raw blob size) |
| `recentChunkCount` | `number` | How many optional chunks stored (≤6) |
| `indexState` | `idle \| indexing \| complete \| failed` | Writer state |
| `generation` | `number` | Stale-writer fence |
| `updatedAt` | `number` | Freshness |
| `lastError` | `string \| null` | Honest last failure (not scored) |

### 1.3 Optional recent chunk (v1)

Bounded raw window only: **max 6 chunks × 50 rows = 300 rows** (`TRANSFER_INDEX_RAW_ROWS_HARD_CAP`). Never full FOX ~113k history.

### 1.4 Derived creator digest (v1)

Bounded evidence (≤40), counts, flags; `indexComplete` must stay honest (helpers do not claim full-index availability). Scoring formulas unchanged — digest is input storage for later phases.

### 1.5 TTL

| Key class | TTL |
|-----------|-----|
| Meta / chunks / creator digest | **7 days** (`TRANSFER_INDEX_KV_TTL_SEC = 604800`) |
| NX lock | **120s** (`TRANSFER_INDEX_LOCK_TTL_SEC`) |

Load soft-drops meta older than **2× TTL**.

### 1.6 Locking + generation

1. Caller acquires `acquireTransferIndexLock(chainId, token)` (Redis `SET NX EX`, test/memory fallback).
2. Caller bumps generation via `beginTransferIndexGeneration` (monotonic `prior.generation + 1`, sets `indexState=indexing`).
3. All persists require `generation >= stored.generation` (`shouldAcceptTransferIndexWrite`); lower → `{ ok: false, reason: "stale_generation" }`.
4. Caller releases `releaseTransferIndexLock`.

One coordinated writer model for Cold recent-first (Phase 4) and Warm incremental resume (Phase 7).

### 1.7 Size gates

| Cap | Value |
|-----|------:|
| Meta max JSON | 16 KiB |
| Creator digest max JSON | 48 KiB |
| Chunk max JSON | 96 KiB |
| Rows / chunk | 50 |
| Recent chunks | 6 |
| Raw rows hard cap | 300 |

---

## 2. Raw vs derived stored

| Store | Contents | FOX-scale policy |
|-------|----------|------------------|
| **Meta** | Cursors, counts, state, generation | Always (tiny) |
| **Creator digest** | Derived bounded evidence + counts | Preferred derived product |
| **`scan:burn:*`** | Existing burn product (unchanged) | Keep separate |
| **Recent chunks** | Optional newest ≤6 pages raw | Optional; capped |
| **Full transfer history** | — | **Forbidden in Redis v1** |

---

## 3. Estimated FOX KV footprint

FOX counters: **~112,913 transfers** (~113k). Blockscout page size **50**.

| Scenario | Estimate |
|----------|---------:|
| Meta only | **~0.4 KB** (measured 384 B) |
| Meta + creator digest (40 evidence) | **~7.6 KB** |
| Meta + digest + 6×50 recent chunks (cold recent tier max) | **~95 KB** (measured 97,390 B) |
| **Full raw 113k in Redis (forbidden)** | **~37.7 MB** (~350 B/row) |
| Ratio (bounded vs full raw) | **~1:406** |

**Conclusion:** Derived-first + optional ≤300-row recent window stays **≪ 1 MB** per FOX token; never approaches full-history Redis storage.

---

## 4. Files changed

### New

| Path | Role |
|------|------|
| `lib/hansome-score/transfer-index/types.ts` | Schema types |
| `lib/hansome-score/transfer-index/keys.ts` | Key builders, TTL/caps |
| `lib/hansome-score/transfer-index/sanitize.ts` | Sanitize / fence / empty meta |
| `lib/hansome-score/transfer-index/lock.ts` | NX lock helpers |
| `lib/hansome-score/transfer-index/kv.ts` | Load/persist meta, chunks, digest |
| `lib/hansome-score/transfer-index/index.ts` | Public barrel |
| `lib/hansome-score/__tests__/transfer-index.test.ts` | Phase 2 unit tests |
| `reports/HANSOME_DEEP_PERF_V2_PHASE2_TRANSFER_INDEX.md` | This report |

### Explicitly not modified

- `lib/hansome-score/lp/position-cache.ts` and related LP KV (Phase 1)
- `lib/scan-analytics.ts` / Analytics surfaces
- `lib/hansome-score/scan-deep.ts`, `scan-fast.ts`, `blockscout.ts`, `creator.ts`, `supply-burn/*`, `relationship.ts` (no Phase 4/7 wiring)

---

## 5. Tests / results

| Suite | Result |
|-------|--------|
| `lib/hansome-score/__tests__/transfer-index.test.ts` | **PASS** (schema round-trip, sanitize, corrupt KV, NX lock, stale generation, oversized, address normalize, chain separation, FOX footprint) |
| `scan-deep-retry-race.test.ts` | **PASS** |
| `scan-progress.test.ts` | **PASS** |
| `scan-deep-stage-independence.test.ts` | **PASS** |
| `scan-deep-reliability.test.ts` | **PASS** |
| `scan-cache.test.ts` | **PASS** |
| `scan-fast.test.ts` | **PASS** |
| Aggregate relevant set | **7 files / 52 tests PASS** |
| `npm run typecheck` | **PASS** |

---

## 6. Confirmations

- [x] Phase 2 only — schema + helpers  
- [x] **NO deploy**  
- [x] **NO Phase 3** (contract cache) / **NO Phase 4** (recent-first) / **NO incremental resume / parallel / prewarm**  
- [x] Production Fast Scan + Production Deep behavior **unchanged** (helpers unused by orchestration)  
- [x] Phase 1 LP cache **untouched**  
- [x] Analytics MVP **untouched**  
- [x] Hard freeze: no scoring / Burn / LP / risk / Unknown→Safe / timeout / token hardcoding changes  
- [x] `deepAttemptId` fencing suites still green  
- [x] Full FOX raw history **not** stored in Redis  

---

## 7. Gate

| | |
|--|--|
| **Verdict** | **PASS** |
| **Next** | **STOP** — wait for explicit approval before Phase 3 or any deploy |
