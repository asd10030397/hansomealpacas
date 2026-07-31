# HANSOME Scan — Release Notes v1.0.1

| Field | Value |
|-------|--------|
| **Version** | `1.0.1` (intended) |
| **Git tag** | **Not created** |
| **Release status** | **Not promoted** — Phase 13B verdict `RELEASE_ABORTED` |
| **Audited commit** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (unchanged) |

Full certification record: [`reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md`](../reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md).

---

## Intended contents (not live)

Relative to aborted package `v1.0.0` / Phase 12C tip packaging:

- Phase 13A Deep LP runtime recovery (durable lease, orphan analyzing recovery, terminalization)
- Same Score / Titan / Hook / Ownership algorithms (no product algorithm changes in 13A/13B)
- Deployment isolation + promotion guard retained

---

## Why production was not cut over

1. `npm run typecheck` failed on the audited commit (invalid `"bytecode"` test fixture type).  
2. Full live honesty soak for HANSOME Class A / Titan, GME Hook, OKC honest incomplete, and BEER Pons `436637` `LOCKED_VERIFIED_ONCHAIN` was not completed to promote-ready after the typecheck stop.

---

## Rollback

See [`docs/ROLLBACK_V1_0_1.md`](ROLLBACK_V1_0_1.md). No cutover occurred; live tip remains Phase 10P baseline `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`.
