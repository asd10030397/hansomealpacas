# HANSOME — Deep Retry Race / Terminal-State Fencing

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Race fencing only — **no deploy** |
| **Diagnosis** | `reports/HANSOME_FOX_DEEP_RUNTIME_DIAGNOSIS.md` |
| **Verdict** | **PASS** |

---

## Root cause

Deep settle and `onProgress` writers persisted snapshots without a generation fence. A late Deep worker could overwrite a newer attempt’s KV state, including regressing `deepRetryCount` (observed Production FOX: **2 → 1**). That re-enabled `isDeepRetryable` / Collecting after the auto-retry budget was exhausted. Stale recovery released the lock but did not retire the generation or clear coalescing `inflight`, so orphaned enrich could still rewrite terminal `partial` back into `deep_running`.

---

## New state machine

```
fast_ready / deep_running (attemptId = G)
        │
        ▼
   Deep attempt G settles partial/failed
        │  deepRetryCount = max(kv, bumped)  // monotonic
        ▼
   retryCount < MAX(2)? ──yes──► re-arm (new attemptId = G')
        │                         deep_running + analyzing gaps
        │                         (done stages preserved)
        no
        ▼
   terminal partial/failed (Collecting = false)
        │
        ├── stale onProgress/settle from G or older → NO-OP
        ├── stale recover → retire attemptId, clear inflight
        └── manual Refresh → new attemptId + deepRetryCount = 0
```

| Event | Generation | Retry budget |
|-------|------------|--------------|
| Start / re-arm | new `deepAttemptId` | unchanged |
| Settle partial | keep current id until re-arm | `max(kv, prior+1)` |
| Exhausted (`count ≥ 2`) | current id stays; writers fenced | no auto re-arm |
| Stale recover | **retire** → new unused id | bump monotonic |
| Manual Refresh | new id via `rearmPartialForDeepRetry` | **reset to 0** |

---

## Fencing strategy

1. **`deepAttemptId`** on `ScanResponse` — opaque generation per Deep attempt.
2. **`assignDeepAttempt` / `rearmPartialForDeepRetry`** — stamp a new id when starting or re-arming.
3. **`shouldAcceptDeepProgress`** — reject mismatched ids; reject revival of exhausted terminal into `deep_running` / `fast_ready`.
4. **`shouldAcceptDeepSettle`** — reject older generations; settle path uses **`mergeMonotonicDeepRetryCount`**.
5. **`persistFencedDeepProgress` / `persistFencedDeepSettle`** in `scan-cache.ts` — all Deep writers go through the fence.
6. **`recoverStaleDeepIfNeeded`** — `retireDeepAttempt` + `inflight.delete` + lock release; old promise `finally` is identity-safe (`inflight.get(key) === promise`).
7. **`rearmAndContinueIfRetryable`** — no-op if the settling job’s id is no longer authoritative or budget is exhausted on KV.
8. **Manual refresh** — unchanged intent: new generation + `deepRetryCount: 0`.

---

## Tests

| Test | Result |
|------|--------|
| retryCount 2 → stale attempt settles → remains 2 | **PASS** |
| terminal partial → stale onProgress → remains terminal | **PASS** |
| new generation → old settles → new remains authoritative | **PASS** |
| retry exhausted → no automatic re-arm | **PASS** |
| manual Refresh → new generation may restart | **PASS** |
| stale recovery retires generation | **PASS** |
| monotonic merge never regresses | **PASS** |
| rearm preserves done LP / Fast stages | **PASS** |
| Existing `scan-progress` / `scan-cache` / reliability / stage-independence | **PASS** |

**Command:**

```bash
npm run test:scoring -- lib/hansome-score/__tests__/scan-deep-retry-race.test.ts \
  lib/hansome-score/__tests__/scan-progress.test.ts \
  lib/hansome-score/__tests__/scan-deep-reliability.test.ts \
  lib/hansome-score/__tests__/scan-cache.test.ts \
  lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts
```

**Results:** 5 files, **28 tests passed** (26 + 2 stage-independence).

---

## Verdict

### **PASS**

---

## Confirmations

- [x] **No deploy**
- [x] **No scoring / LP / Burn / Creator math changes**
- [x] **No timeout increases** to hide the race (`DEEP_SCAN_MAX_EXECUTION_MS`, stage budgets, stale threshold unchanged)
- [x] Fast results and `done` Lock Distribution stages preserved across re-arm
- [x] FOX performance tuning **not** mixed into this fix

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/types.ts` | `deepAttemptId` field |
| `lib/hansome-score/scan-progress.ts` | Generation helpers + fence predicates; rearm assigns id |
| `lib/hansome-score/scan-cache.ts` | Fenced persist/settle; recover retires gen + clears inflight; identity-safe inflight clear; rearm guard |
| `lib/hansome-score/index.ts` | Re-exports |
| `lib/hansome-score/__tests__/scan-deep-retry-race.test.ts` | **New** concurrency/regression tests |
| `lib/hansome-score/__tests__/scan-progress.test.ts` | Assert rearm mints new attempt id |
| `reports/HANSOME_DEEP_RETRY_RACE_FENCING.md` | This report |

---

## Residual risk

- Multi-isolate (separate Vercel instances) still race at KV read-modify-write; fencing is correct per generation id, but without a compare-and-swap KV primitive two isolates could still interleave if they shared an id (they should not after re-arm). Monotonic `max()` remains the safety net for retry count.
- Hung workers are not aborted mid-RPC; they only no-op on write after generation retire. CPU/RPC may continue until the soft/hard budget ends.
- Score stage `partial` vs `done` inconsistency noted in the FOX diagnosis is unchanged (out of scope).

---

## FOX performance (out of scope for this PR)

Investigation-only notes from the diagnosis (no code changes here):

- FOX has ~113k transfers and no HANSOME known-position seeds → Lock Dist known-first often soft-fails inside the 180s liquidity budget; exhaustive PM discovery needs ≥200s soft budget.
- Burn/creator share a 120s budget that includes up to 40 Blockscout transfer pages — routinely soft-fails on FOX-scale history.
- Soft budgets and UX “~2–4 minutes” copy can understate multi-attempt wall time; that is a performance/UX follow-up, **not** fixed by this race fence.
- Recommended follow-up (separate PR): earlier known-first publish for non-seeded tokens and/or not blocking Burn UI on a full 40-page crawl inside one soft budget — keep math honest/`partial` when incomplete.

