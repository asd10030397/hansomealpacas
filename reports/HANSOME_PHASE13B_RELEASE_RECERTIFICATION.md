# HANSOME Scan — Phase 13B Final Release Recertification & Conditional Production Cutover

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13B — Final Release Recertification & Conditional Production Cutover |
| **Final verdict** | **RELEASE_ABORTED** |
| **Audited branch** | `phase-13a-deep-runtime-recovery` |
| **Audited commit** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Code tip under docs** | `1a59a08038821e13af1198112cf2956fdc310b1c` |
| **Soak Candidate** | `dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| **Candidate URL** | `https://hansomealpacas-aa4xqec98-the-67.vercel.app` |
| **Production tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Production tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **Tag created** | **NO** (`v1.0.1` not created) |

Companion docs:

- `reports/HANSOME_V1_0_1_RELEASE.md`
- `docs/RELEASE_NOTES_V1_0_1.md`
- `docs/ROLLBACK_V1_0_1.md`
- `docs/VERSION_HISTORY.md`
- `docs/DEPLOYMENT_ISOLATION.md`

---

## 1. Clean artifact identity

| Check | Result | Evidence |
|-------|--------|----------|
| Worktree | **PASS** | Clean worktree `C:\hansomealpacas-phase13a` at HEAD `a29ae12` (restored one dirty report edit before certification) |
| Branch | **PASS** | `phase-13a-deep-runtime-recovery` |
| Commit | **PASS** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| Unrelated stash restored | **PASS** | Stashes remain aside (`phase13-aside-non-scan-tracked`, `temp-deploy-stash`); none applied |
| Untracked release pollution | **PASS** | Release worktree porcelain empty at gate time |
| Reproducible local production build | **PASS** | `npm run build` exit 0 on audited commit |
| Candidate maps to audited commit | **PARTIAL** | Candidate Ready from Phase 13A worktree deploy; CLI health `buildId`/`gitCommit` = `null` (known CLI deploy limitation) — cannot cryptographically prove SHA via health |
| Health fields present | **PASS** (values) | `deploymentId`, `deploymentScope`, `buildId`, `gitCommit` exposed; build/git null |
| Candidate scope | **PASS** | `candidate:dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| Production aliases tip | **PASS** | www / apex / game → `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Production scope on aliases | **N/A on tip** | Live tip lacks `/api/scan/health` (Phase 10P tip → 404 HTML); production scope enforced only after promote of 12C+ tip |

**Identity STOP?** No hard identity mismatch that alone aborts. Proceeded to Part 2.

---

## 2. Test totals

| Suite | Result | Detail |
|-------|--------|--------|
| Vitest `npm run test:scoring` | **PASS** | **115** files / **1033** tests |
| Phase 10 Titan / Pons / BEER (in scoring suite) | **PASS** | included |
| Phase 10 cache / terminal / bounded settlement | **PASS** | included |
| Phase 11A–11H ownership / evidence / Hook stack | **PASS** | included |
| Phase 12A.1 honesty/presentation | **PASS** | included |
| Phase 12C deployment isolation | **PASS** (runtime tests) | included; **type errors in test fixtures** (below) |
| Phase 13A deep runtime recovery | **PASS** | included |
| Score / LP presentation / multi-version | **PASS** | included |
| `npm run typecheck` | **FAIL** | 2 errors |
| `npm run build` | **PASS** | Next.js production build |

### Typecheck failure (hard Part 2 gate)

```
lib/hansome-score/__tests__/phase12c-deployment-isolation.test.ts(175,7): error TS2322:
  Type '"bytecode"' is not assignable to type 'ContractCacheArtifactType'.
lib/hansome-score/__tests__/phase12c-deployment-isolation.test.ts(202,7): error TS2322:
  Type '"bytecode"' is not assignable to type 'ContractCacheArtifactType'.
```

`ContractCacheArtifactType` allows `runtime_bytecode | verified_abi_source | proxy_heuristic | analysis_bundle`. Test fixtures use invalid literal `"bytecode"`. Vitest does not typecheck; Next build still succeeded.

**Part 2 required:** zero typecheck failure → **FAIL → STOP**.

---

## 3. Candidate soak table

Full force-refresh certification matrix was **not completed** after Part 2 hard stop. Spot-check on soak Candidate (status poll via `vercel curl`, no alias move):

| Token | Terminal? | `liquidity` | Orphan analyzing? | Scope | Notes |
|-------|-----------|-------------|-------------------|-------|-------|
| **HANSOME** | **YES** (`partial`) | `done` | **NO** | `candidate:dpl_14tzta…` | Score structural **77**; `ownershipClass=null`; positions **0**; aggregate `UNKNOWN_INCOMPLETE` — **Class A / Titan product richness not re-certified** |
| **GME** | Prior 13A: terminal `partial` / `liquidity=partial` | — | 13A: **NO** | candidate | 13B full force soak **not re-run** after typecheck abort |
| **OKC** | Prior 13A: terminal `partial` / `liquidity=done` | — | 13A: **NO** | candidate | 13B full force soak **not re-run** |
| **BEER** | **NOT CERTIFIED in 13B** | — | — | — | Required `LOCKED_VERIFIED_ONCHAIN` / tokenId **436637** / discovery+lock complete **not proven** in 13B |

Isolation:

| Check | Result |
|-------|--------|
| Candidate health scope | **PASS** `candidate:dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| `isProductionAlias` | **false** |
| Promotion guard | **PASS** (`promote: false`, exit 0) |
| www tip unchanged during soak | **PASS** `dpl_995…` |

---

## 4. Production-target deployment ID

| Item | Result |
|------|--------|
| Fresh production-target deploy from audited commit | **NOT CREATED** |
| Reason | Aborted at Part 2 (typecheck) before Part 4 |

---

## 5. Promotion guard

| Surface | Result |
|---------|--------|
| Soak candidate `dpl_14tzta…` | **PASS** — scopes isolated; guard does not promote |
| Fresh release tip | **N/A** (not deployed) |

---

## 6. Pre-cutover verdict

| Gate | Result |
|------|--------|
| Clean artifact verified | **PASS** (with known null git metadata) |
| Candidate isolation | **PASS** |
| All regressions / typecheck / build | **FAIL** (typecheck) |
| HANSOME/GME/OKC/BEER soak terminal + honesty | **FAIL / INCOMPLETE** |
| No orphaned analyzing (spot + 13A) | **PASS** on observed HANSOME / 13A fixtures |
| No Critical / High correctness blockers | **FAIL** — typecheck gate; incomplete live product cert |
| Rollback target confirmed | **PASS** `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |

**Decision:** **STOP — do not promote.**

---

## 7. Alias cutover

| Action | Performed? |
|--------|------------|
| `www.hansomealpacas.xyz` | **NO** |
| `hansomealpacas.xyz` | **NO** |
| `game.hansomealpacas.xyz` | **NO** |
| Previous / new / timestamp | N/A — no cutover |

---

## 8. Post-promotion scans

Not entered (no promote).

---

## 9. Repeated soak

Not entered (no promote).

---

## 10. Analytics / admin / game smoke

Not entered on production aliases (no promote). Candidate-only health verified.

---

## 11. Version tag

| Item | Result |
|------|--------|
| `v1.0.0` | **Untouched** @ `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` |
| `v1.0.1` | **Not created** |
| Branch / tag push | **None** |

---

## 12. Rollback target

| Item | Value |
|------|--------|
| Rollback / live tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| URL | `https://hansomealpacas-hp5h51664-the-67.vercel.app` |
| Rollback executed? | **N/A** (no cutover) |

Procedure remains `docs/ROLLBACK.md` / `docs/ROLLBACK_V1_0_1.md`.

---

## 13. Remaining limitations / blockers

### Blocking this release

1. **CRITICAL — `npm run typecheck` fails on audited commit `a29ae12`**  
   Invalid `"bytecode"` artifactType in `phase12c-deployment-isolation.test.ts` (lines 175, 202). Fix is a one-literal test change to `"runtime_bytecode"` (or other valid enum), then re-run typecheck + full cert from the new clean commit. Not applied in 13B (would change audited identity).

2. **HIGH — Live product certification incomplete for promote**  
   HANSOME spot status shows terminal runtime (`liquidity=done`, no orphan) but empty positions / null ownership / no Titan verified lock body. BEER Pons `436637` / `LOCKED_VERIFIED_ONCHAIN` not proven in 13B. GME/OKC not fully re-soaked after Part 2 stop.

### Known accepted debt (unchanged)

3. OKC `createTx` null / Hook incomplete possible  
4. Hook allowlist = OKC + GME only  
5. KV generation fence not Redis CAS  
6. CLI deploy health `buildId` / `gitCommit` null  
7. `--prod --skip-domain` may move project alias `*-the-67.vercel.app`  
8. Developer main workspace remains dirty with unrelated WIP (release worktree is clean)

---

## 14. Final verdict

**RELEASE_ABORTED**

Aliases unchanged. Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`. No `v1.0.1` tag.

### Unblock for next attempt

1. Fix test fixture artifactType literals → `"runtime_bytecode"` (certification hygiene only).  
2. Commit on clean branch; re-run `typecheck` + `test:scoring` + `build` (all green).  
3. Fresh candidate soak HANSOME/GME/OKC/BEER with honesty matrix.  
4. Fresh production-target deploy + promotion guard + cutover only if every gate PASSes.
