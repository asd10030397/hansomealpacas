# HANSOME Scan — Phase 12 Unified Release

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Workflow** | 12A.2 re-audit → 12B promote gate → cutover (gated) |
| **Candidate (12A.1)** | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |
| **Production tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Production tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Final status** | **PROMOTION_ABORTED** |

---

## 1. Phase 12A.2 results

| Item | Result |
|------|--------|
| Report | `reports/HANSOME_PHASE12A2_PRODUCTION_REAUDIT.md` |
| Verdict | **NOT_READY** |
| 12A.1 FIX 1–6 (honesty / presentation / reorg / fence) | **PASS** (code + unit) |
| Regression (Phase 10 / 11 / 12A.1 / score / presentation / tsc) | **PASS** |
| Live HANSOME / GME / OKC candidate soak | **ABORTED** after scope incident |
| Deployment scope isolation (live) | **FAIL** |

### Blockers (every item)

1. **CRITICAL — Candidate shares Production KV scope**  
   `dpl_FH9…` was deployed with `--prod --skip-domain` and inherits `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`. Live `vercel curl` showed `deploymentScope: "production"` on the candidate. A GME scan during re-audit wrote into the production namespace; www and candidate then showed the same cleared LP / deep_running state (`LP evidence cleared for full refresh`). Isolation required by Phase 10C-4 / 12B is not held for this candidate workflow.

2. **HIGH — OKC `createTx` still null** in `HOOK_POOL_FIXTURES` (12A High #7).

3. **HIGH — Hook allowlist = OKC + GME only** (12A High #8); cannot claim RH-wide Hook Intelligence readiness.

4. **HIGH — KV generation fence is not Redis CAS** (12A High #5); multi-instance last-write-wins risk remains.

5. **HIGH — No safe isolated candidate soak** of Hook Intelligence under `candidate:{dpl}` (blocked by #1).

6. **HIGH — Dirty workspace** with many modified/untracked paths; promoting would risk shipping unaudited diffs.

**Gate rule:** 12A.2 verdict must be exactly `READY_FOR_PRODUCTION`. Observed: `NOT_READY` → **STOP**.

---

## 2. Phase 12B production promotion gate

| Check | Result |
|-------|--------|
| Current Production = `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | **PASS** |
| Candidate latest / audited | Present (`dpl_FH9…`) but **not isolation-safe** |
| Production aliases unchanged before cutover | **PASS** (no cutover) |
| Candidate build matches audit | N/A — promote blocked |
| Build reproducible / clean workspace | **FAIL** (dirty tree) |
| No pending migrations | N/A / not applicable |
| No failed tests / build (unit + tsc) | **PASS** unit/tsc; live soak failed |
| Deployment scope isolation preserved | **FAIL** |

**12B decision:** **STOP — PROMOTION_ABORTED** (12A.2 not READY_FOR_PRODUCTION; 12B isolation check would also fail).

---

## 3. Promotion details

| Action | Performed? |
|--------|------------|
| Promote candidate → `www.hansomealpacas.xyz` | **NO** |
| Promote candidate → `hansomealpacas.xyz` | **NO** |
| Promote candidate → `game.hansomealpacas.xyz` | **NO** |
| Alias cutover commands | **Not run** |

---

## 4. Production deployment id

| Role | ID |
|------|----|
| **Live Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Rollback target (unchanged) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Audited-but-not-promoted candidate | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |

---

## 5. Alias verification

| Alias | Tip after workflow |
|-------|--------------------|
| `www.hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `game.hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |

Confirmed via `npx vercel inspect` after abort decision.

---

## 6. Regression

| Layer | Result |
|-------|--------|
| Unit Phase 10 / 11 / 12A.1 / score / presentation | **PASS** |
| `tsc --noEmit` | **PASS** |
| Post-promote live HANSOME / GME / OKC | **N/A** (no promote) |
| Note | Candidate GME audit scan disturbed production-scoped GME cache; tip/code unchanged (Phase 10P). Deep recovery expected under existing Production tip. |

---

## 7. Known limitations (still open)

1. Hook allowlist = OKC + GME only.  
2. OKC createTx / createBlock missing → perpetual Hook index/lock incomplete.  
3. Foreign discovery off by default.  
4. KV generation fence not Redis CAS.  
5. Hook RPC client explicit timeouts missing.  
6. POST `/api/scan` deployment-scope header parity.  
7. `--prod --skip-domain` candidates inherit Production `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` → **unsafe for soak** until env/workflow fixed.  
8. Side-by-side Unknown Lock Status vs Hook Principal Locked (intentional separation).  
9. Production tip remains Phase 10P — Hook Intelligence not live on www/game.

---

## 8. Rollback procedure

No alias cutover occurred. If a future promote fails:

```text
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app www.hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app game.hansomealpacas.xyz
```

Rollback deployment id: **`dpl_995JvbHVDTsv4mSP77rJqeas8GEA`**.

Verify with `npx vercel inspect www.hansomealpacas.xyz` (expect that id).

---

## 9. Final production status

| Item | Value |
|------|--------|
| **Status** | **PROMOTION_ABORTED** |
| **12A.2** | **NOT_READY** |
| **12B** | Not entered / failed gate |
| **Promoted?** | **NO** |
| **Tip before** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Tip after** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Primary report** | `reports/HANSOME_PHASE12_RELEASE.md` |
| **Re-audit detail** | `reports/HANSOME_PHASE12A2_PRODUCTION_REAUDIT.md` |

### Minimal next steps (not executed here)

1. Fix candidate deploy env so soak uses `candidate:{deploymentId}` (do not set Production-scope override on skip-domain candidates).  
2. Redeploy clean audited tree; re-run 12A.2 with isolated live fixtures.  
3. Only then reopen 12B.
