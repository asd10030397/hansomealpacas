# HANSOME Phase 13E — Runtime Validation

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Candidate** | `dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Scope** | `candidate:dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` unchanged |

## Invariants checked

| Invariant | Result | Evidence |
|-----------|--------|----------|
| `analyzing` ⇒ valid lease **OR** `retryScheduled` **OR** active worker | **MOSTLY HOLD** on BEER Locked samples (`lease=valid`, `inflight=true`) | cert console BEER cold/warm/force |
| Never sticky `analyzing` + `lease=none` + `retry=false` with durable publish missing forever | **HOLD** for BEER after pre-parallel fix | brief streaks tolerated; orphan recovery stamps retry |
| Never process-local inflight hiding missing durable ownership | **HOLD** (13C.1) | `deep_orphan_recovered` + coalesce eviction logs; diagnostics distinguish local vs durable |
| Cleared shell only inside open force txn | **HOLD** | forceLp shows intentional clear then restore; no sticky “LP evidence cleared” terminal on BEER |

## Observed runtime classes

1. **BEER healthy Locked path** — after Known-Pons pre-parallel: `liq=done`, `pos=1`, `lock=LOCKED_VERIFIED_ONCHAIN`, `tid=436637`, `lease=valid`.
2. **Transient lease=none + retry=true** — 13C.1 orphan rearm; not counted as sticky invalid when retry scheduled.
3. **HANSOME / GME / OKC** — long `liq=analyzing` with valid lease (ownership pending); GME/OKC often settle `unknown` without Hook ownership publish — product incomplete, not a lease-model regression.

## Verdict

Runtime lease/orphan model remains **consistent with 13C.1** on the BEER Locked path. Full product runtime certification across Hook tokens is **incomplete** → see 13E STOPPED_WITH_RCA.
