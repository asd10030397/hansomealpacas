# HANSOME Scan — Version History

| Version | Date | Git | Deploy / tip | Status |
|---------|------|-----|--------------|--------|
| **1.0.1** | 2026-08-01 | audited `a29ae12` on `phase-13a-deep-runtime-recovery`; **tag not created** | Soak Candidate `dpl_14tztaC9rK5x355hhNC1BujHSKyk`; Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | **RELEASE_ABORTED** (Phase 13B) — typecheck gate + incomplete live product cert |
| **1.0.0** | 2026-07-31 | tag `v1.0.0` / `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` | Candidate `dpl_8UJfr8NjZZksF5UnXCLZzmGxPo9a`; Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | **RELEASE_ABORTED** (Phase 13) — packaged, not promoted |
| 0.1.0 (pre-Scan packaging) | — | prior `package.json` | Production tip `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (Phase 10P) | Live production before Scan V1 cutover |

---

## 1.0.1 detail (aborted)

- **Release report:** `reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md`  
- **Release notes:** `docs/RELEASE_NOTES_V1_0_1.md`  
- **Rollback:** `docs/ROLLBACK_V1_0_1.md`  
- **Includes (intended):** Phase 13A deep-runtime recovery on Scan V1 / 12C isolation  
- **Does not include:** Production alias cutover; `v1.0.1` git tag  

### Milestone deployments (reference)

| Role | ID |
|------|----|
| Production tip (live) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Phase 13A / 13B soak candidate | `dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| Phase 13 RC candidate (aborted) | `dpl_8UJfr8NjZZksF5UnXCLZzmGxPo9a` |
| Phase 12C isolation candidate | `dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9` |

---

## 1.0.0 detail

- **Release report:** `reports/HANSOME_V1_RELEASE.md`  
- **Release notes:** `docs/RELEASE_NOTES_V1.md`  
- **Rollback:** `docs/ROLLBACK.md`  
- **Isolation:** `docs/DEPLOYMENT_ISOLATION.md`  
- **Includes:** Scan/Score through Phase 12C isolation infrastructure  
- **Does not include:** Production alias cutover  

---

## Roadmap versions (not shipped)

| Target | Intent |
|--------|--------|
| 1.0.1-live | Fix typecheck fixture; re-certify deep LP + Hook/BEER honesty; promote if gate passes |
| 1.1.x | Wider Hook allowlist; OKC createTx completeness; Redis CAS fence |
