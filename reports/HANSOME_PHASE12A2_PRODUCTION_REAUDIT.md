# HANSOME Scan — Phase 12A.2 Production Re-Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Candidate (12A.1)** | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Verdict** | **NOT_READY** |

---

## 1. Summary

Re-audit of Phase 12A.1 honesty / presentation / fence fixes against a live candidate.

| Area | Result |
|------|--------|
| 12A.1 FIX 1–6 (unit / code) | **PASS** |
| Regression (Phase 10 / 11 / 12A.1 / score / presentation / tsc) | **PASS** |
| Live HANSOME / GME / OKC candidate soak | **ABORTED** after scope incident |
| Deployment scope isolation (live) | **FAIL** (pre-12C) |

Unified release outcome: `reports/HANSOME_PHASE12_RELEASE.md` → **PROMOTION_ABORTED**.

Isolation CRITICAL was later fixed in Phase 12C (`reports/HANSOME_PHASE12C_DEPLOYMENT_ISOLATION.md`).

---

## 2. Blockers (at time of 12A.2)

1. **CRITICAL — Candidate shares Production KV scope** — `--prod --skip-domain` inherited `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` (fixed in 12C).
2. **HIGH — OKC `createTx` still null** in Hook fixtures.
3. **HIGH — Hook allowlist = OKC + GME only**.
4. **HIGH — KV generation fence is not Redis CAS**.
5. **HIGH — No safe isolated candidate soak** (blocked by #1).
6. **HIGH — Dirty workspace** with many unaudited paths.

---

## 3. Production confirmation

| Alias | Tip |
|-------|-----|
| www / apex / game | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |

Promoted? **NO**.

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **NOT_READY** |
| **Report** | `reports/HANSOME_PHASE12A2_PRODUCTION_REAUDIT.md` |
| **Follow-up** | Phase 12C isolation → Phase 13 certification |
