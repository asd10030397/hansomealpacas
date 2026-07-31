# HANSOME Scan — v1.0.1 Release Record

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Intended version** | `1.0.1` |
| **Final verdict** | **RELEASE_ABORTED** |
| **Source Phase** | 13B.1 Certification Hygiene Fix & Final Release Retry |
| **Prior 13B audited commit** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Hygiene commit** | `ca5b3c4009941ae0e0a51528612e948ad0a04095` |
| **Tag `v1.0.1`** | **Not created** |
| **Tag `v1.0.0`** | **Untouched** @ `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` |
| **Soak Candidate** | `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
| **Production tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Production tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Promoted?** | **NO** |

Full gate record: [`reports/HANSOME_PHASE13B1_FINAL_RELEASE_RETRY.md`](HANSOME_PHASE13B1_FINAL_RELEASE_RETRY.md).  
Prior abort (typecheck only): [`reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md`](HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md).

---

## Why v1.0.1 was not released

Phase 13B.1 cleared the Part 3 static gate (`typecheck` / `test:scoring` / `build` all PASS on `ca5b3c4`) and deployed a fresh isolated Candidate. Live soak on HANSOME / BEER / GME / OKC **failed** product certification after forceLp refresh (BEER Locked not recovered; HANSOME POSM/Titan richness not proven; GME `hook_native` incomplete; OKC forced path not fully terminal in budget). Promotion and tagging remain disallowed.

---

## What would have shipped (if gates passed)

Phase 13A deep-runtime recovery + 12C isolation + hygiene type fix (`runtime_bytecode` fixture), as packaged on `phase-13a-deep-runtime-recovery` @ `ca5b3c4`.

---

## Tag policy

- Existing `v1.0.0` @ `f23c7ff…` **not moved**.  
- Create **`v1.0.1`** only after a future full-PASS release cutover.  
- Push status: nothing pushed for 13B.1.
