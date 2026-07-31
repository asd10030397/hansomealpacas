# HANSOME Scan — Phase 10P Production Promotion & Live Cutover

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Deployment only (no scan semantics / lock / scoring / discovery changes) |
| **Validated code reference** | `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN` (Phase 10C-5 tip) |
| **New Production tip** | **`dpl_995JvbHVDTsv4mSP77rJqeas8GEA`** |
| **URL** | `https://hansomealpacas-hp5h51664-the-67.vercel.app` |
| **Git commit (workspace HEAD at deploy)** | `6667f9565736cacf761b75f542d414940973ff35` |
| **Environment** | Production |
| **Deployment scope** | **`production`** |
| **Rollback target** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **NPM tokenId** | `436637` |
| **Approved locker** | PonsLaunchLocker `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| **Verdict** | **PASS_DEPLOYED** |

---

## 1. Exact pre-deploy live tip / rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`hansomealpacas-n6zq9i37h-the-67.vercel.app`).

Confirmed via `vercel inspect www.hansomealpacas.xyz` immediately before cutover. Aliases pre-promote:

| Alias | Tip |
|-------|-----|
| `www.hansomealpacas.xyz` | baseline |
| `hansomealpacas.xyz` | baseline |
| `game.hansomealpacas.xyz` | baseline |
| `hansomealpacas.vercel.app` | baseline (later temp-aliased for gates) |

Rollback target remains **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`**.

---

## 2. Production env — `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`

| Check | Result |
|-------|--------|
| Set on Production | **YES** (`vercel env add HANSOME_SCAN_DEPLOYMENT_SCOPE production`) |
| Preview has override | **NO** (Preview env list has no `HANSOME_SCAN_DEPLOYMENT_SCOPE`) |
| Secrets printed | **NO** |

Scope resolution after env set + fresh deploy:

| Surface | Observed scope |
|---------|----------------|
| New Production tip (temp alias) | **`production`** (`X-Scan-Deployment-Scope: production`) |
| Validated candidate tip `dpl_ASg9…` | **`candidate:dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`** (via `vercel curl`) |
| Preview (no override) | remains `candidate:{deploymentId}` by code default |

---

## 3. New Production-scope deployment

| Field | Value |
|-------|--------|
| Method | `npx vercel deploy --prod --skip-domain --yes` (after env set) |
| Deployment ID | **`dpl_995JvbHVDTsv4mSP77rJqeas8GEA`** |
| URL | `https://hansomealpacas-hp5h51664-the-67.vercel.app` |
| Target | Production |
| ReadyState | READY |
| Git commit | `6667f9565736cacf761b75f542d414940973ff35` |
| Deployment scope | **`production`** |
| Reused prior tip as final proof | **NO** — fresh deploy after env set |

Build restored cache from validated code tip `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`. No product code changes in this phase (deployment-only; gate harness wait/retry hardening only).

Artifact: `reports/data/phase10p_candidate.json`, `reports/data/phase10p_deploy_out.txt`.

---

## 4. Temp alias / authenticated access

| Step | Result |
|------|--------|
| Temp alias | `hansomealpacas.vercel.app` → `hansomealpacas-hp5h51664-the-67.vercel.app` |
| JSON access | **200** |
| Scope header | **`production`** |
| www/apex/game during gates | **unchanged** on baseline until Step 9 |

---

## 5. BEER Cold 3/3 (production scope)

| Run | terminalState | lockState | tokenId | owner | pos/lock complete | scope | unique gen |
|----:|---------------|-----------|---------|-------|-------------------|-------|------------|
| 1 | SUCCESS_TERMINAL | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | production | `d_ms7kmixo_el9d2etg` |
| 2 | SUCCESS_TERMINAL | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | production | `d_ms7kpugr_l26gmbjw` |
| 3 | SUCCESS_TERMINAL | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | production | `d_ms7kui1z_zoqg9xwh` |

| Metric | Result |
|--------|--------|
| Cold | **3/3 PASS** |
| Unique generations | **3** |
| Production scope | **3/3** |

Artifact: `reports/data/phase10p_beer_cold_warm.json`.

---

## 6. BEER Warm 3/3 (production scope)

| Run | lockState | tokenId | owner | pos/lock complete | terminalState | scope |
|----:|-----------|---------|-------|-------------------|---------------|-------|
| 1–3 | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | SUCCESS_TERMINAL | production |

| Metric | Result |
|--------|--------|
| Warm | **3/3 PASS** |

---

## 7. BEER Forced 10/10 (production-scope tip)

**Tip:** `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`  
**Access:** temp alias `hansomealpacas.vercel.app`  
**Scope:** `production` on all runs

| Metric | Result |
|--------|--------|
| Terminal SUCCESS_TERMINAL | **10/10** |
| LOCKED_VERIFIED_ONCHAIN | **10/10** |
| tokenId `436637` / owner Pons | **10/10** |
| positionDiscoveryComplete / lockAnalysisComplete | **10/10** |
| Unique generations | **10** |
| Partial terminals | **0** |
| Production scope | **10/10** |

Artifact: `reports/data/phase10p_beer_forced10.json` (console: `phase10p_beer_forced10_console3.txt`).

Prior attempts on the same tip had intermittent wait-timeouts under status-poll race; final gate run **PASS** with unique gens and all identity invariants.

---

## 8. Smoke — HANSOME / BEER / Core7 / Top100 spot / Analytics / Admin / Game

Pre-promote on production-scope tip (`hansomealpacas.vercel.app`):

| Surface | Result |
|---------|--------|
| BEER | **PASS** — production scope, Locked verified, tokenId 436637, Pons |
| HANSOME | **PASS** — HTTP 200, production scope, score served |
| Core7 (HANSOME/PRIMARY/FOX/GME/CASHCAT/PONS/TYGR) | **7/7** HTTP 200 + production scope |
| Top100 spot (3 addrs) | **PASS** HTTP 200 |
| Analytics visit API | **PASS** HTTP 200 |
| Admin analytics page | **PASS** HTTP 200 |
| Game page | **PASS** HTTP 200 |
| www home (pre-cutover baseline) | **PASS** HTTP 200 |
| /scan page | **PASS** HTTP 200 |

Artifact: `reports/data/phase10p_smoke.json`.

---

## 9. Alias promotion (www / apex / game)

Executed **only after** Cold/Warm/Forced + smoke gates passed:

| Alias | Result |
|-------|--------|
| `www.hansomealpacas.xyz` | → `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `hansomealpacas.xyz` (apex) | → `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `game.hansomealpacas.xyz` | → `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `hansomealpacas.vercel.app` | already on new tip (gate alias retained) |

Confirmed via `vercel inspect www.hansomealpacas.xyz` → `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`.

---

## 10. Post-promotion verification

| Check | Result |
|-------|--------|
| www scope | **`production`** (header + body) |
| apex scope | **`production`** |
| www BEER Locked verified | **PASS** — tokenId 436637, owner Pons, pos/lock complete true, SUCCESS_TERMINAL |
| game HTTP | **200** |
| Candidate tip scope untouched | **`candidate:dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`** |
| Production cache independent | Production BEER gen `d_ms7olsmb_lrqd6jb2` on www (not candidate namespace) |

Artifact: `reports/data/phase10p_post_promote.json`.

---

## 11. Rollback status

| Item | Value |
|------|-------|
| Rollback performed | **NO** |
| Rollback target (available) | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Trigger conditions observed | None (no score/creator/holder/burn/market hard drift gate failure; no false Locked/Unknown; scope match production) |

---

## 12. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_DEPLOYED** |
| New deployment ID | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Deployment scope | `production` |
| Validated code reference | `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN` |
| BEER cold 3/3 | **PASS** |
| BEER warm 3/3 | **PASS** |
| BEER forced 10/10 | **PASS** (unique gens, production scope) |
| Smoke | **PASS** |
| Aliases www / apex / game | **PROMOTED** |
| Candidate cache | **untouched** |
| Production cache | **populated independently** |
| www BEER Locked verified | **PASS** |
| Rollback | N/A (not required) |
| Smart LP | off |
| Adapters | Pons only |
| Semantics frozen | YES (deployment-only) |

### Artifacts

| Artifact | Path |
|----------|------|
| Tip cfg | `reports/data/phase10p_candidate.json` |
| Deploy log | `reports/data/phase10p_deploy_out.txt` |
| Cold/warm | `reports/data/phase10p_beer_cold_warm.json` |
| Forced 10/10 | `reports/data/phase10p_beer_forced10.json` |
| Smoke | `reports/data/phase10p_smoke.json` |
| Post-promote | `reports/data/phase10p_post_promote.json` |
