# HANSOME Scan — Version History

| Version | Date | Git | Deploy / tip | Status |
|---------|------|-----|--------------|--------|
| **1.0.1** | 2026-08-01 | hygiene `ca5b3c4` on `phase-13a-deep-runtime-recovery` (from `a29ae12`); **tag not created** | Soak Candidate `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW`; Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | **RELEASE_ABORTED** (Phase 13B.1) — live product soak failed after typecheck hygiene PASS |
| **1.0.1-attempt-13B** | 2026-08-01 | audited `a29ae12`; **tag not created** | Soak Candidate `dpl_14tztaC9rK5x355hhNC1BujHSKyk`; Production tip remains `dpl_995…` | **RELEASE_ABORTED** (Phase 13B) — typecheck gate |
| **1.0.0** | 2026-07-31 | tag `v1.0.0` / `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` | Candidate `dpl_8UJfr8NjZZksF5UnXCLZzmGxPo9a`; Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | **RELEASE_ABORTED** (Phase 13) — packaged, not promoted |
| 0.1.0 (pre-Scan packaging) | — | prior `package.json` | Production tip `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (Phase 10P) | Live production before Scan V1 cutover |

---

## 1.0.1 detail (aborted — Phase 13B.1)

- **Release report:** `reports/HANSOME_PHASE13B1_FINAL_RELEASE_RETRY.md`  
- **Prior 13B report:** `reports/HANSOME_PHASE13B_RELEASE_RECERTIFICATION.md`  
- **Release notes:** `docs/RELEASE_NOTES_V1_0_1.md`  
- **Rollback:** `docs/ROLLBACK_V1_0_1.md`  
- **Includes (intended):** Phase 13A deep-runtime recovery + type fixture hygiene on Scan V1 / 12C isolation  
- **Does not include:** Production alias cutover; `v1.0.1` git tag  

### Milestone deployments (reference)

| Role | ID |
|------|----|
| Production tip (live) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Phase 13B.1 soak candidate | `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
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
| 1.0.1-live | Re-certify BEER Locked + HANSOME POSM/Titan + GME Hook after forceLp; promote if gate passes |
| 1.1.x | Wider Hook allowlist; OKC createTx completeness; Redis CAS fence |
