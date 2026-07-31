# HANSOME Scan — Release Notes v1.0.1

| Field | Value |
|-------|--------|
| **Version** | `1.0.1` (intended) |
| **Git tag** | **Not created** |
| **Release status** | **Not promoted** — Phase 13B.1 verdict `RELEASE_ABORTED` |
| **Hygiene commit** | `ca5b3c4009941ae0e0a51528612e948ad0a04095` |
| **Prior audited commit** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (unchanged) |

Full certification record: [`reports/HANSOME_PHASE13B1_FINAL_RELEASE_RETRY.md`](../reports/HANSOME_PHASE13B1_FINAL_RELEASE_RETRY.md).

---

## Intended contents (not live)

Relative to aborted package `v1.0.0` / Phase 12C tip packaging:

- Phase 13A Deep LP runtime recovery (durable lease, orphan analyzing recovery, terminalization)
- Certification hygiene: valid `ContractCacheArtifactType` fixture (`runtime_bytecode`)
- Same Score / Titan / Hook / Ownership algorithms (no product algorithm changes in 13A/13B/13B.1)
- Deployment isolation + promotion guard retained

---

## Why production was not cut over

1. Phase 13B stopped on `npm run typecheck` (`"bytecode"` fixture). Fixed in 13B.1 @ `ca5b3c4`; static gates green.  
2. Phase 13B.1 Candidate soak (`dpl_HmF5…`) failed live product certification after forceLp: BEER Pons Locked / HANSOME POSM-Titan richness / GME Hook class incomplete; OKC forced settle incomplete in soak budget.

---

## Rollback

See [`docs/ROLLBACK_V1_0_1.md`](ROLLBACK_V1_0_1.md). No cutover occurred; live tip remains Phase 10P baseline `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`.
