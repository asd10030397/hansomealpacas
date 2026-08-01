# HANSOME Phase 13E.2 — Stress Certification & Release Readiness

| Field | Value |
|-------|--------|
| **Date** | 2026-08-02 |
| **Phase** | 13E.2 — Stress Certification & Release Readiness |
| **Final verdict** | **READY_FOR_RELEASE_CANDIDATE** |
| **Worktree** | `C:\hansomealpacas-phase13a` |
| **Candidate (baseline)** | `dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| **Candidate URL** | `https://hansomealpacas-lg3uppz12-the-67.vercel.app` |
| **Candidate scope** | `candidate:dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` (`isProductionAlias=false`) |
| **Redeployed for 13E.2?** | **NO** — reused 13E.1 tip (health confirmed) |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **Tagged v1.0.1?** | **NO** |
| **13F RC produced?** | **NO** — STOP here; Phase 13F owns RC |

Evidence:

- `reports/data/phase13e2_stress_cert.json` — **VERDICT PASS**
- `reports/data/phase13e2_stress_console.txt`
- `reports/data/phase13e2_typecheck.txt` / `phase13e2_test_scoring.txt` / `phase13e2_build.txt`
- `scripts/phase13e2-stress-cert.mjs`
- Prior product gate: `reports/HANSOME_PHASE13E1_HANSOME_GME_OKC_RECOVERY.md`

---

## 1. Stress volumes (PART 1)

| Token | Cold | Warm | Force | Matrix |
|-------|------|------|-------|--------|
| **HANSOME** | **20/20** | **20/20** | **20/20** | **PASS** |
| **BEER** | **10/10** | **10/10** | **10/10** | **PASS** |
| **GME** | **10/10** | **10/10** | **10/10** | **PASS** |
| **OKC** | **10/10** | **10/10** | **10/10** | **PASS** |

Total product-gated executions: **150** (+ 8 concurrency pairs).

---

## 2. Concurrency (PART 2)

| Check | Result |
|-------|--------|
| Concurrent refresh+status pairs | **8/8 PASS** |
| Race → zombie / orphan | **0** |
| Production scope bleed | **0** |
| Sticky cleared under race | **0** |
| Stale overwrite (matrix globals) | **0** |
| Generation regression (matrix) | **0** |
| Cross-token gen ID reuse hints | 3 (informational — same numeric `lpGeneration` across different tokens; **not** same-token stale overwrite) |

---

## 3. Force refresh (PART 3)

| Token | Force | Product body retained | Sticky cleared |
|-------|-------|------------------------|----------------|
| HANSOME | 20/20 | Titan/PosM `#47299` (+3 positions) | **0** |
| BEER | 10/10 | Locked `#436637` / Pons | **0** |
| GME | 10/10 | `hook_native` (no Titan lock claim) | **0** |
| OKC | 10/10 | `hook_native` + honest incomplete | **0** |

Recovery txn / commit / rollback / `stale_forced_refresh` did not surface sticky cleared shells or empty overwrites of verified bodies under Candidate force spacing (45s gap).

---

## 4. Runtime (PART 4)

| Class | Count |
|-------|------:|
| Zombie lease | **0** |
| Orphan analyzing (persistent) | **0** |
| Hung deep (≥420s analyzing) | **0** |
| Invalid lease / retry deadlock | **0** (no zombie+no-retry class) |
| Production scope hits | **0** |

---

## 5. Cache / Known-First (PART 5)

| Check | Result |
|-------|--------|
| Known-First loss hints (verified body → cleared empty) | **0** |
| Stale overwrite hints (force emptied prior verified body) | **0** |
| Generic rediscovery overwriting verified publish | **Not observed** |

---

## 6. Product honesty (PART 6)

| Token | Honesty gate |
|-------|----------------|
| **HANSOME** | Durable PosM/Titan body (`LOCKED_VERIFIED_ONCHAIN` / multi-position) across cold/warm/force |
| **BEER** | `#436637` + Pons owner `LOCKED_VERIFIED_ONCHAIN` |
| **GME** | `hook_native`; no Titan badge; no false Titan Locked; Hook intel / salts path |
| **OKC** | `hook_native` + `UNKNOWN_INCOMPLETE` / unable-to-determine only — never invents Titan Locked |

---

## 7. Typecheck / tests / build (PART 7)

| Gate | Result |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm run test:scoring` | **PASS** — 119 files / **1086/1086** tests |
| `npm run build` | **PASS** |

### Test fix applied during 13E.2 (no product redesign)

`phase10c3-version-probe-budget.test.ts` — hung v3 probe heartbeats prevent stall terminate; test now advances past adaptive **maxBudgetMs** under faked `Date` + timers. Orchestration/test-only; Score / Ownership / Lock formulas unchanged.

---

## 8. Isolation / promotion (STOP)

| Check | Result |
|-------|--------|
| Candidate isolated | **YES** (`isProductionAlias=false`) |
| Production tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` Ready |
| Aliases changed | **NO** |
| Production deploy | **NOT performed** |
| v1.0.1 tag | **NOT created** |

**STOP before cutover.** Phase **13F** produces Release Candidate separately.

---

## 9. Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **READY_FOR_RELEASE_CANDIDATE** |
| **Report** | `reports/HANSOME_PHASE13E2_STRESS_CERTIFICATION.md` |
| **Candidate** | `dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` unchanged |
| **Stress pass rates** | HANSOME **60/60**; BEER **30/30**; GME **30/30**; OKC **30/30**; concurrency **8/8** |
| **Runtime / cache globals** | zombies/orphans/hung/sticky/prod-scope/known-first-loss/stale-overwrite/gen-regression all **0** |
| **RCA** | **N/A** (not STOPPED) |
| **Next** | Phase **13F** RC only — do **not** promote from this phase |
