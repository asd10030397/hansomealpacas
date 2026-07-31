# HANSOME Scan — v1.0.1 Release Record

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Intended version** | `1.0.1` |
| **Final verdict** | **RELEASE_ABORTED** |
| **Source Phase** | 13B Final Release Recertification |
| **Audited commit** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Tag `v1.0.1`** | **Not created** |
| **Production tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Production tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Promoted?** | **NO** |

Full gate record: [`reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md`](HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md).

---

## Why v1.0.1 was not released

Phase 13B requires zero typecheck failures on the audited artifact. On `a29ae12`, `npm run typecheck` fails in `phase12c-deployment-isolation.test.ts` (`"bytecode"` ∉ `ContractCacheArtifactType`). Promotion and tagging are disallowed.

Unit tests (1033) and production build passed; that is insufficient under the written Part 2 gate.

---

## What would have shipped (if gates passed)

Phase 13A deep-runtime recovery (leases, orphan analyzing recovery) on top of Scan V1 / Phase 12C isolation, as packaged on branch `phase-13a-deep-runtime-recovery`.

---

## Tag policy

- Existing `v1.0.0` @ `f23c7ff…` **not moved**.  
- Preferred successful path remains: create **`v1.0.1`** on the successful release commit after gates pass.  
- Push status: nothing pushed for 13B.
