# HANSOME — PR2 Transfer Index Progress Checkpointing

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Deep creatorBurn paging checkpoint + resume |
| **Verdict** | **PASS** |
| **Deploy** | **NO** |

Depends on: PR1 PASS · Phase 2 schema at `lib/hansome-score/transfer-index/*`

---

## Summary

| Requirement | Result |
|-------------|--------|
| Persist progress incrementally during paging | **PASS** — meta + chunk after each page via `onPage` |
| Persist pages / transfers / head-tail / cursor / generation / completeness | **PASS** — `TransferIndexMeta` fields |
| Fence stale writers (generation model) | **PASS** — `beginTransferIndexGeneration` + `shouldAcceptTransferIndexWrite` |
| Timeout/partial progress reusable | **PASS** — soft-fail stamps `pagesFetched` from checkpoint |
| Retry resumes (not page 1) | **PASS** — `startNextPageParams` from meta |
| Burn + Creator share same index | **PASS** — single `fetchTokenTransfersWithCheckpoint` |
| Complete only at genesis/end | **PASS** — `paginationComplete` only when `next_page_params` null |
| Burn window semantics unchanged | **PASS** |
| Partial ≠ clean Creator | **PASS** — `available=false` / incomplete while not complete |

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/transfer-index/paging.ts` | **New** — checkpoint fetch + progress loader |
| `lib/hansome-score/transfer-index/keys.ts` | `MAX_RECENT_CHUNKS` 6 → **40** (Deep ≤40 pages; still ≪ 113k) |
| `lib/hansome-score/transfer-index/index.ts` | Export paging APIs |
| `lib/hansome-score/blockscout.ts` | `startNextPageParams`, `onPage`, `shouldContinue`, return `nextPageParams` |
| `lib/hansome-score/scan-deep.ts` | Wire checkpoint fetch; soft-fail surfaces persisted N |
| `lib/hansome-score/__tests__/transfer-index-checkpoint.test.ts` | **New** |
| `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts` | Mock transfer-index |

---

## Checkpoint timeline (FOX-class)

| Step | Before | After |
|------|--------|-------|
| Mid-fetch timeout | In-memory only → `pagesFetched=0` | Meta/chunks persisted each page |
| Soft-fail publish | Zeros / stubs | `pagesFetched=N`, `transfersIndexed=M`, incomplete |
| Auto-retry / Refresh | Restart page 1 | Resume `nextPageParams` |
| Stale writer | Could overwrite | `stale_generation` reject |
| Genesis not reached | Risk of false complete | Stays `indexing` / `paginationComplete=false` |

---

## Tests

```
vitest run transfer-index*.test.ts scan-deep-stage-independence \
           scan-deep-reliability scan-deep-retry-race
→ all passed (checkpoint suite + deep reliability)
```

Covered: timeout leaves N≠0; resume cursor; stale reject; no double-count; incomplete stays incomplete; FOX-scale provisional; HANSOME complete-when-exhausted.

---

## Freeze confirmation

- [x] No Score / Burn window semantics / lock rules changes
- [x] No timeout inflation (budgets unchanged)
- [x] Creator remains provisional when incomplete
- [x] **NO deploy**

---

## Gate

**PR2 = PASS.** Proceed to PR3 (Heavy-Token Collecting UX).
