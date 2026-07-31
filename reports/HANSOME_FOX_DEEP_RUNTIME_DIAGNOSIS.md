# HANSOME — FOX Deep Runtime / Retry-State Diagnosis

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Root-cause diagnosis only — **no deploy, no code changes** |
| **Production** | https://www.hansomealpacas.xyz |
| **Symptom** | Progressive Deep UI correctly shows **Collecting**, but FOX Liquidity + Burn stayed Collecting **>4 minutes** |

---

## FOX CA used

| Field | Value |
|-------|-------|
| **Address** | `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| **Name / Symbol** | Robin Hood / **FOX** |
| **Chain** | Robinhood Chain `4663` |
| **Fast liquidity (USD)** | ~**$96,892.51** (matches prior UI “Pool Liquidity: $96,893”) |
| **Holders / transfers** | **3,104** holders · **112,913** transfers (Blockscout counters on Fast snapshot) |
| **Deployer** | `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB` |

Source: live Production `/api/scan` + `/api/scan/status` (2026-07-28 ~03:32–03:36 UTC+8).

---

## Classification

**Primary: combination**

1. **expected slow processing** — FOX is a high-transfer, multi-pool meme; Deep work is legitimately multi-minute  
2. **stage budget too small** — soft budgets (`liquidity` 180s, `creatorBurn` 120s) under a 270s attempt wall often soft-fail before Lock Dist / P2–P3 finish  
3. **upstream RPC/Blockscout delay** — Burn/creator path pages up to **40** Blockscout transfer pages against **~113k** transfers  
4. **retry loop bug** (race) — late Deep writer can **lower** `deepRetryCount` after budget exhaustion (observed **2 → 1**), re-arming Collecting  
5. **stuck worker** (secondary) — `deepInflight=true` while snapshot already terminal `partial`  
6. **stale KV state** (secondary) — snapshot aged from prior session (`deepStartedAt` / `scannedAt` on 2026-07-27 UTC)

Not copy-only. Collecting duration is driven by runtime budgets + retries + a concurrent-settle race.

---

## Exact timeline (observed + reconstructed)

### A) Snapshot provenance (KV / memory)

| Timestamp (UTC) | Event |
|-----------------|-------|
| `2026-07-27T18:15:23.630Z` | Fast Scan stamped (`scannedAt` / `scoreComputedAt`) |
| `2026-07-27T19:25:16.973Z` | Last Deep re-arm marker (`deepStartedAt`) — ~70 min after Fast (refresh / retry, not continuous from TTFR) |
| After that | Deep attempts settle Liquidity / Creator / Burn as **soft-fail `partial`**; disclaimers include stage timeouts **and** stale-recovery wording |

### B) Intended Deep attempt model (from code)

| Step | Behavior | Wall budget |
|------|----------|-------------|
| Fast result | `fast_ready` / Fast body served | seconds |
| Deep attempt 1 | `deep_running`; stages → analyzing; `deepRetryCount` still 0 until settle | ≤ **270s** (`DEEP_SCAN_MAX_EXECUTION_MS`) |
| Stage progress | relationships → liquidity (known-first) → creatorBurn (P2/P3) | soft: rel 45s / liq 180s / creatorBurn 120s |
| Timeout / partial | `analysisStatus=partial`, `bumpDeepRetryCount` → 1 | — |
| Deep retry 1 | `rearmPartialForDeepRetry` → stages analyzing again, new `deepStartedAt` | ≤ **270s** |
| Settle | bump → `deepRetryCount=2` | — |
| Deep retry 2 | only if `deepRetryCount < 2` before settle — **exhausted when count reaches 2** | ≤ **270s** if started |
| Terminal | honest `partial` / unavailable — `isDeepCollecting=false` | — |
| Zombie guard | if stuck `deep_running` ≥ **360s** (`DEEP_STALE_THRESHOLD_MS`) → recover + bump | — |

UI liquidity estimate ceiling is **240s** (`DEEP_STAGE_ESTIMATE_MS.liquidity`); progress panel already has `deepAnalysisStillAnalyzing` when exceeded, but section copy can still show “Estimated time: ~2–4 minutes”.

### C) Live Production status series (diagnosis window)

Polled `GET /api/scan/status?address=0x2103faa9…` every ~15s:

| # | Local time (UTC+8) | `analysisStatus` | `deepInflight` | `deepRetryCount` | Stages (liq/burn/creator/score) | Notes |
|---|--------------------|------------------|----------------|------------------|----------------------------------|-------|
| 0 | 03:32:40 | `partial` | **true** | **2** | partial / partial / partial / partial | Exhausted budget; worker still flagged |
| 1 | 03:35:15 | `partial` | **true** | **2** | … / score **partial** | ageMs≈65 (snapshot rewrite) |
| 2 | 03:35:31 | `partial` | **true** | **1** ← regression | … / score **done** | Late Deep settle **overwrote** retry count **2→1** |
| 3 | 03:35:46 | `partial` | **true** | **2** | … / score **done** | Count bumped back to 2 |
| 4 | 03:36:01 | `partial` | **false** | **2** | … / score **done** | Inflight cleared |
| 5–6 | 03:36:17–32 | `partial` | false | **2** | stable | Terminal idle |

Raw series: `reports/_tmp-fox-status-series.json`.

### D) What the user likely experienced (>4 min Collecting)

1. Fast ready (pool ~$96.9k visible).  
2. Deep attempt runs; Liquidity + Burn show Collecting (correct UX).  
3. Work exceeds UX estimate (~2–4 min) because attempt wall is **270s** and retries re-arm analyzing.  
4. Liquidity soft-times out **without** known-first Lock Dist; Burn/creator soft-time out on Blockscout paging.  
5. Auto-retry re-arms Collecting again (up to budget).  
6. Race window (observed) can briefly make `deepRetryCount < MAX` again → another Collecting cycle.  
7. Eventually honest terminal `partial` with Unavailable copy — when race settles and inflight clears.

---

## Field checklist (Production FOX)

| Field | Value at diagnosis |
|-------|--------------------|
| **analysisStages** | contract/holders/market/relationships **done**; liquidity/creator/burn **partial**; score **partial→done** (path-dependent) |
| **analysisStatus** | **`partial`** (terminal when `deepRetryCount=2` and not re-armed) |
| **deepInflight** | **true for minutes after terminal**, then **false** (stuck/orphan worker) |
| **Retry counts** | **`deepRetryCount` 2** (exhausted); **observed regression to 1** then back to 2 |
| **Last progress / start ts** | `deepStartedAt=2026-07-27T19:25:16.973Z`; snapshot `ageMs` jumped (rewrites while inflight) |
| **Worker still running?** | **Yes briefly** (`deepInflight=true`) after terminal partial; then cleared |
| **LP known-first reached?** | **NO** — `positions=[]`, `knownPositionsVerified` absent/false, `lockDistribution.available=false`, timeout reason |
| **Burn P2/P3 worker?** | **Did not finish** — supply-reduction / burn-history “did not finish in time”; Fast P0/P1 only |
| **Re-arm correct?** | **Mostly** (`rearmPartialForDeepRetry` + `MAX_DEEP_AUTO_RETRIES=2`), but **broken under concurrent settle**: count can drop and re-enable `isDeepRetryable` |

### LP known-first note

`knownPositionSeeds(FOX)` returns **`[]`** (seeds are HANSOME-only). Exhaustive PM discovery only when liquidity soft budget ≥ **200s**; default attempt leaves **180s** → known-first path without HANSOME seeds must finish inside that window or soft-fail. FOX never published Lock Dist.

### Burn path note

Deep `creatorBurn` shares one 120s budget: `fetchTokenTransfersPaged(maxPages=40)` + creator analysis + `enrichSupplyBurnWithHistory`. With **~113k** transfers, Blockscout paging routinely exhausts the soft budget → both creator and burn stay Collecting until soft-fail `partial`.

---

## Can Collecting continue indefinitely today?

**YES (conditionally) — not by design, but via race.**

| Path | Infinite? | Why |
|------|-----------|-----|
| Happy path (`deepRetryCount` monotonic, single writer) | **NO** | `isDeepRetryable` requires `deepRetryCount < 2`; then `isDeepCollecting` false for terminal `partial` |
| Concurrent / orphaned Deep finish | **YES risk** | Late `bumpDeepRetryCount(enriched)` persists enriched’s **stale lower count** (observed **2→1**), re-enabling re-arm + Collecting |
| Orphaned `onProgress` while KV already terminal | **YES risk** | Can rewrite `deep_running` / analyzing over honest partial; UI Collecting keys off `isDeepCollecting` / stage analyzing |
| Manual refresh | **Re-opens budget** | Refresh sets `deepRetryCount: 0` and re-arms (by design, not infinite unless user keeps refreshing) |
| Stuck `deep_running` alone | **Bounded ~360s** | `recoverStaleDeepIfNeeded` — but recovery does **not** clear `inflight`, so orphaned work can rewrite afterward |

So: **hard terminal is intended, but not airtight.** Collecting can outlive a single 2–4 minute estimate easily (expected), and can **re-enter** Collecting after apparent exhaustion when writers race.

---

## Hard terminal condition gaps

1. **No generation / attempt id** — late Deep jobs overwrite KV without `max(existingRetry, newRetry)`.  
2. **`recoverStaleDeepIfNeeded` clears lock + `backgroundRefresh` but not `inflight`** — orphaned enrich continues and may persist.  
3. **`onProgress` unconditionally persists** — can clobber terminal partial.  
4. **Score stage inconsistency** — stale/hard settle → `score=partial`; clean enrich partial finalize → `score=done`.  
5. **Per-section estimate copy** — progress panel has “still analyzing” after ceiling; Liquidity/Burn section strings can still say “~2–4 minutes” while Collecting continues (UX gap for later; not root cause of runtime).

---

## Recommended fix direction (do **not** deploy in this turn)

1. **Monotonic retry + fencing** — persist `deepAttemptId` / generation; ignore `onProgress` / settle from older attempts; on settle use `deepRetryCount = max(kv, bumped)`.  
2. **Abort orphaned work** — on stale recover, clear `inflight` **or** mark generation cancelled so late writers no-op.  
3. **FOX-scale budgets / ordering** — keep math unchanged; consider earlier known-first publish for non-seeded tokens and/or not blocking Burn UI on full 40-page crawl inside one soft budget (still honest partial if incomplete).  
4. **UX copy (later)** — when stage exceeds estimate, replace “Estimated time: ~2–4 minutes” with EN/ZH “Still analyzing — more on-chain data…”; optional `Retry attempt N/2`.  
5. **Do not change** scoring / LP / Burn formulas for this fix.

---

## Confirmations

- [x] Diagnosis only — **no deploy**
- [x] **No code changes** in this turn
- [x] Scoring / LP / Burn math untouched
- [x] Production APIs inspected (read-only polls; no intentional refresh that resets budget for “fix”)
- [x] UX copy noted for later, not implemented here

### Artifacts

- `reports/_tmp-fox-scan.json` — full Production scan snapshot  
- `reports/_tmp-fox-status-series.json` — status poll series showing retry regression  
