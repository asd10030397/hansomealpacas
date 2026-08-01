# HANSOME Phase 13D — Known-First Bootstrap

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13D — Known-First Bootstrap |
| **Mode** | Discovery / bootstrap / runtime reliability ONLY |
| **Worktree** | `C:\hansomealpacas-phase13a` on `phase-13a-deep-runtime-recovery` |
| **Includes** | Phase 13C recovery txn + Phase 13C.1 lease/orphan fixes |
| **Latest Candidate (13D tip)** | `dpl_GJaLRGrqvSw313LBcUwSusT9ewUz` |
| **13E Candidate (BEER publish fix)** | `dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Candidate URL (13E)** | `https://hansomealpacas-fzas1sfs4-the-67.vercel.app` |
| **Candidate scope** | `candidate:dpl_qXzBSFonvfLidTysYuiRopWALgYR` (`isProductionAlias=false`) |
| **Prior Candidates this phase** | `dpl_3GQu…`, `dpl_3Xxo…`, `dpl_FJaQ…`, `dpl_GJaL…` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **13E follow-on** | BEER Locked **PASS**; overall 13E **STOPPED_WITH_RCA** (HANSOME/GME/OKC) — see 13E report |

Companion:

- `lib/hansome-score/lp/known-bootstrap-resolver.ts`
- `lib/hansome-score/lp/lp-bootstrap-cache.ts`
- `lib/hansome-score/__tests__/phase13d-known-bootstrap.test.ts`
- `reports/data/phase13d_deploy_out.txt`

---

## 1. Priority order

| Priority | Stage | Behavior |
|----------|-------|----------|
| 1 | Known Titan | HANSOME seeds `#47299/#357867/#142938` + Titan locker candidates |
| 2 | Known Pons | BEER `#436637` + PonsLaunchLocker candidate |
| 3 | Known Hook | GME/OKC fixture pool IDs + hook address (discovery only) |
| 4 | Historical Position Index | Discovery cache / checkpoint / persistent snapshot / prior verified IDs |
| 5 | Generic Discovery | Always available fallback |
| 6 | Exhaustive Scan | When prior exhaustiveComplete |

Bootstrap is **always advisory** until on-chain ownership verification. Never stores lock classification as truth.

---

## 2. Deliverables

| Deliverable | Status |
|-------------|--------|
| `KnownBootstrapResolver` (`resolveKnownBootstrap` / `mergeKnownBootstrapInputs`) | **DONE** |
| Bootstrap cache `{scope}:scan:lp:bootstrap:{chainId}:{token}` | **DONE** |
| Diagnostics (`stagesHit`, `nextStage`, `sources`, `completeness`, `idempotentKey`) | **DONE** |
| Completeness flags | **DONE** |
| Never-downgrade verified LP (`preferVerifiedLpAgainstIncomplete`) | **DONE** |
| Wired into `scan-deep` candidatePositionIds + discoverySources | **DONE** |
| Known-Pons early verification path (`tryVerifyKnownPonsBootstrap`) | **DONE** (live Candidate still miss — 13E RCA) |
| Idempotent merge | **DONE** (unit-tested) |
| Preserves 13C recovery + 13C.1 leases | **DONE** (no lease/txn model changes) |

**Not changed:** Score formulas, Titan/Hook scoring semantics, Ownership classification, Lock formulas, UI scoring logic, Deployment isolation rules (12C), Runtime lease model (13C.1).

---

## 3. Tests

| Suite | Result |
|-------|--------|
| `phase13d-known-bootstrap.test.ts` | **PASS** (bootstrap + snapshot + adaptive sections) |
| `phase13c1-beer-invalid-state.test.ts` | **10/10 PASS** |
| `phase13c-force-lp-recovery.test.ts` | **19/19 PASS** |
| `tsc --noEmit` | **PASS** |

---

## 4. Candidate isolation

| Check | Result |
|-------|--------|
| Deploy | `npx vercel deploy --prod --skip-domain --yes` |
| ID | `dpl_3GQuXZtX4RP5zWDT8YnPTx2vo2TH` |
| Health scope | `candidate:dpl_3GQu…` |
| `isProductionAlias` | `false` |
| Production tip (www) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` Ready — **unchanged** |

---

## 5. Verdict

**CODE COMPLETE / LIVE PRODUCT GATE OPEN** — Known-First Bootstrap + Known-Pons early path landed on Candidate with 13C.1 tip. Unit tests PASS. Live BEER Locked publish on Candidate **not yet proven** → Phase 13E **STOPPED_WITH_RCA**.
