# HANSOME Scan — Phase 13B.1 Certification Hygiene Fix & Final Release Retry

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13B.1 — Certification Hygiene Fix and Final Release Retry |
| **Final verdict** | **RELEASE_ABORTED** |
| **Branch** | `phase-13a-deep-runtime-recovery` |
| **Prior audited commit (13B)** | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| **Hygiene commit** | `ca5b3c4009941ae0e0a51528612e948ad0a04095` |
| **Worktree** | `C:\hansomealpacas-phase13a` |
| **Soak Candidate** | `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
| **Candidate URL** | `https://hansomealpacas-kpb6rjnp6-the-67.vercel.app` |
| **Production tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Production tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Release / production-target tip after soak** | **NOT CREATED** (aborted before Part 7) |
| **Promoted www / apex / game?** | **NO** |
| **Tag `v1.0.1`** | **Not created** |
| **Tag `v1.0.0`** | **Untouched** @ `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` |

Companion docs:

- `reports/HANSOME_V1_0_1_RELEASE.md`
- `docs/RELEASE_NOTES_V1_0_1.md`
- `docs/ROLLBACK_V1_0_1.md`
- `docs/VERSION_HISTORY.md`
- `docs/DEPLOYMENT_ISOLATION.md`
- Soak artifact: `reports/data/phase13b1_candidate_soak.json`

---

## 1. Part 1 — Minimal type fix

| Check | Result |
|-------|--------|
| File | `lib/hansome-score/__tests__/phase12c-deployment-isolation.test.ts` |
| Change | Both `artifactType: "bytecode"` → `"runtime_bytecode"` |
| Scope | Test fixture only (no algorithm / Score / Titan / Hook / LP / ownership / UI / isolation changes) |
| Commit | `ca5b3c4` — `fix(test): use valid contract cache artifact type` (1 file, +2/−2) |

---

## 2. Part 2 — Clean commit identity

| Check | Result |
|-------|--------|
| Worktree | `C:\hansomealpacas-phase13a` on `phase-13a-deep-runtime-recovery` |
| Old audited SHA | `a29ae1236b56e7e3f6f6c7da9e837f7227a282d4` |
| New hygiene SHA | `ca5b3c4009941ae0e0a51528612e948ad0a04095` |
| Unrelated WIP | Main developer tree remains dirty; release worktree kept free of those changes |
| Stashes | Left aside (`phase13-aside-non-scan-tracked`, `temp-deploy-stash`); not applied |

---

## 3. Part 3 — Static gates

| Suite | Result | Detail |
|-------|--------|--------|
| `npm run typecheck` | **PASS** | Exit 0 (prior 13B blocker cleared) |
| `npm run test:scoring` | **PASS** | **115** files / **1033** tests |
| `npm run build` | **PASS** | Next.js production build |

**Part 3 STOP?** No — proceeded.

---

## 4. Part 4 — Fresh isolated candidate

| Item | Value |
|------|--------|
| Command | `npx vercel deploy --prod --skip-domain --yes` |
| Deployment ID | `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
| URL | `https://hansomealpacas-kpb6rjnp6-the-67.vercel.app` |
| Health `deploymentScope` | `candidate:dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
| `isProductionAlias` | `false` |
| Promotion guard | **PASS** (`promote: false`) |
| Reused old candidate? | **NO** (not `dpl_14tzta…` / not aborted `dpl_5qx3y…`) |
| Production KV writes | **None observed** (candidate namespace only) |
| Custom domain aliases during soak | **Unchanged** → `hansomealpacas-hp5h51664-the-67.vercel.app` = `dpl_995…` |
| Known debt | `--prod --skip-domain` moved project alias `hansomealpacas-the-67.vercel.app` to the new tip (12C known risk); www/apex/game untouched |

---

## 5. Part 5 — Live soak (HANSOME / BEER / GME / OKC)

Harness: `scripts/_tmp-phase13b1-soak.mjs` via `vercel curl` with quoted URLs (`refresh=1&forceLp=1`).  
Artifact: `reports/data/phase13b1_candidate_soak.json` (`pass: false`).

| Token | Terminal? | Orphan analyzing? | Scope | Product / honesty | Gate |
|-------|-----------|-------------------|-------|-------------------|------|
| **HANSOME** | Mixed (cold#2 terminal `partial`; force cycle timed out while still running / cleared) | **NO** (leases / recovery observed mid-flight) | `candidate:dpl_HmF5…` | Score **77** but `ownershipClass` ≠ `posm_nft`; positions/pools **0** after forceLp clear; Titan/POSM richness **not** re-proven | **FAIL** |
| **BEER** | Partial / cleared after force | **NO** sticky orphan at recorded snaps (retries exhausted / cleared body) | candidate | Required `LOCKED_VERIFIED_ONCHAIN` / tokenId **436637** / Pons owner / discovery+lock complete **NOT** met; detail stayed “LP evidence cleared…” | **FAIL** |
| **GME** | **YES** (`partial`) both forced + cold#2 | **NO** | candidate | Honesty: no Titan badge, no generic lock%, no false Locked — **PASS**; `ownershipClass=hook_native` / Hook intel when index completes — **FAIL** | **FAIL** |
| **OKC** | Forced cycle **not** terminal in window; cold#2 **YES** | **NO** | candidate | No fabricated complete; honesty OK on cold#2; may remain incomplete — forced cycle did not fully settle in soak budget | **FAIL** (overall token pass false) |

Isolation during soak:

| Check | Result |
|-------|--------|
| Candidate health scope | **PASS** |
| Promotion guard | **PASS** |
| www / apex / game tip | **PASS** still `dpl_995…` |

---

## 6. Part 6 — Release gate

| Gate | Result |
|------|--------|
| Clean hygiene commit + static typecheck/tests/build | **PASS** |
| Fresh candidate isolation | **PASS** |
| Live product soak HANSOME/BEER/GME/OKC | **FAIL** |
| No Critical / High correctness blockers for promote | **FAIL** — product cert incomplete after forceLp |
| Rollback target confirmed | **PASS** `dpl_995…` |

**Decision:** **STOP — do not promote.**

---

## 7–10. Parts 7–10 (not entered)

| Step | Status |
|------|--------|
| Fresh Production-target deploy from audited commit | **NOT CREATED** |
| Alias cutover www / apex / game | **NOT PERFORMED** |
| Post-promotion validation / ≥3 runs | **N/A** |
| Tag `v1.0.1` | **NOT CREATED** |
| Push | **None** |
| Rollback executed | **N/A** (no cutover) |

---

## 11. Blocking this release

1. **CRITICAL — BEER Pons Locked not certified on Candidate**  
   After `refresh=1&forceLp=1`, LP body remained cleared / `UNKNOWN_INCOMPLETE`; tokenId `436637` + `LOCKED_VERIFIED_ONCHAIN` + discovery/lock complete flags not observed in soak terminals.

2. **HIGH — HANSOME Class A / Titan richness not certified**  
   Structural score 77 returned, but post-forceLp snapshots showed empty positions/pools and null `ownershipClass` (not `posm_nft`).

3. **HIGH — GME Hook product class incomplete**  
   Honesty gates held (no Titan badge / no generic lock% / no false Locked), but `hook_native` ownership + Hook intelligence completion not proven.

4. **MEDIUM — OKC forced cycle did not fully terminalize in soak budget**  
   cold#2 honesty terminal OK; forced path `terminal=false` in recorded gate — not promote-ready under strict all-modes PASS.

### Known accepted debt (unchanged)

- OKC `createTx` null / Hook allowlist limited  
- KV generation fence not Redis CAS  
- CLI deploy health `buildId` / `gitCommit` null  
- `--prod --skip-domain` may move project alias `*-the-67.vercel.app`  
- Developer main workspace remains dirty with unrelated WIP  

---

## 12. Final verdict

**RELEASE_ABORTED**

Aliases unchanged. Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`. Hygiene typefix is on `ca5b3c4` and static gates are green; live product certification failed → no Part 7 deploy, no cutover, no `v1.0.1` tag.

### Unblock for next attempt

1. On a fresh Candidate from `ca5b3c4` (or successor), recover BEER Locked publish after forceLp (must not remain cleared / `missing_scan_meta` exhausted).  
2. Re-prove HANSOME `posm_nft` + non-empty Titan/POSM LP body after completed refresh.  
3. Re-prove GME `hook_native` + Hook intel when index completes.  
4. Ensure OKC forced+cold paths both terminate honestly within soak budget.  
5. Only then: Part 7 production-target tip → guard → cutover → tag `v1.0.1`.
