# HANSOME Scan — Phase 12C Deployment Isolation & Release Infrastructure

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Mode** | Release infrastructure ONLY (no Hook / Titan / Score / LP / Ownership / UI / Lock logic) |
| **Verdict** | **DEPLOYMENT_ISOLATION_COMPLETE** |
| **Production tip (www / apex / game)** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Candidate** | `dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9` |
| **Candidate URL** | `https://hansomealpacas-p1upua7po-the-67.vercel.app` |
| **Preview** | `dpl_3P87gwx7XGscy6TwtUT2cUd9dQiZ` |
| **Preview URL** | `https://hansomealpacas-f5n072ne6-the-67.vercel.app` |
| **Promote www / apex / game?** | **NO** |
| **Docs** | `docs/DEPLOYMENT_ISOLATION.md` |

---

## 1. Architecture

Phase 12C makes deployment scope a **runtime host + metadata** decision, not an inherited Production env flag.

| Layer | Role |
|-------|------|
| `lib/hansome-score/deployment-scope.ts` | Scope resolution, host bind, runtime assertion, KV helpers, promotion guard helpers, health info |
| `app/api/scan/health/route.ts` | Debug/health endpoint |
| `bindAndAssertDeploymentScope(request)` | API entry + `after()` worker inheritance |
| `scopedKvKey` / family key builders | Every durable KV key begins with `deploymentScope` |
| `scripts/phase12c-promotion-guard.mjs` | Abort promote when scopes collide |
| `docs/DEPLOYMENT_ISOLATION.md` | CLI matrix, promotion, rollback |

### Scopes

| Scope | Use |
|-------|-----|
| `production` | Production aliases only |
| `candidate:{deploymentId}` | `--prod --skip-domain` soak |
| `preview:{deploymentId}` | Vercel Preview |
| `local` | Local / unknown |

### Bug fixed

Pre-12C: `vercel deploy --prod --skip-domain` inherited Production env `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`, so candidates wrote into the live Production KV namespace (Phase 12A.2 CRITICAL).

Post-12C: bare `production` override is **host-gated**. Deployment URLs resolve to `candidate:{dpl}` even when Production env still contains `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`.

---

## 2. Scope Resolution

Priority:

1. Test override  
2. Explicit `HANSOME_SCAN_DEPLOYMENT_SCOPE` (bare `production` only if host is a production alias)  
3. Production alias host → `production`  
4. `VERCEL_ENV=preview` → `preview:{dpl}`  
5. Development → `local`  
6. Vercel production *target* without alias host → `candidate:{dpl}`  
7. Fallback → `local` (never silent production)

**Never** infer production merely because `--prod` was used.  
**Never** grant production to `*.vercel.app`.

Production aliases:

- `www.hansomealpacas.xyz`
- `hansomealpacas.xyz`
- `game.hansomealpacas.xyz`

---

## 3. Runtime Assertions

`assertProductionScopeHostSafety`:

- If `deploymentScope === "production"` **and** host ∉ production aliases → throw `DeploymentScopeIsolationError` (HTTP 500; do not continue).

Wired on:

- `GET/POST /api/scan`
- `GET /api/scan/status`
- `GET /api/scan/health`
- analytics visit/stats + fox-cache-invalidate (scope bind)

Background `after()` workers inherit the same bound host/scope for the invocation.

---

## 4. Namespace Verification

Canonical form: `{deploymentScope}:{family}:…`

| Family | Example |
|--------|---------|
| Scan snapshot / meta / lock / LP result | `{scope}:scan:snapshot:{chainId}:{token}` |
| Transfer index | `{scope}:scan:xfer:…` |
| V3 pos | `{scope}:scan:v3pos:…` |
| V4 hook | `{scope}:scan:v4hook:…` |
| Burn / contract / LP discovery / smart-refresh | `{scope}:scan:burn|contract|lp:…` |
| Scan + web analytics | `{scope}:analytics:scan:v1:…` / `{scope}:analytics:web:v1:…` |
| Rate limits | `{scope}:scan:rl:…` |

Unit proof: production vs `candidate:dpl_iso` keys differ for snapshot, xfer, lp, hook, v3, contract, analytics.

Live proof:

| Surface | `deploymentScope` / `cacheNamespace` |
|---------|--------------------------------------|
| Candidate health | `candidate:dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9` |
| Production `/api/scan/status` (www) | `production` |

→ **Candidate ≠ Production** (no shared namespace).

---

## 5. Deployment Matrix

| Intent | Command | Safe? |
|--------|---------|-------|
| Preview | `npx vercel deploy --yes` | ✅ |
| Candidate | `npx vercel deploy --prod --skip-domain --yes` | ✅ (after 12C) |
| Candidate without `--skip-domain` | `npx vercel deploy --prod --yes` | ❌ may assign custom domains |
| Promote | `vercel alias set` to www/apex/game | ⚠️ human + guard only |
| Rollback | alias set to `dpl_995…` URL | ✅ |

This phase:

| Role | ID | URL |
|------|----|-----|
| Preview | `dpl_3P87gwx7XGscy6TwtUT2cUd9dQiZ` | `https://hansomealpacas-f5n072ne6-the-67.vercel.app` |
| Candidate | `dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9` | `https://hansomealpacas-p1upua7po-the-67.vercel.app` |
| Production tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | `https://hansomealpacas-hp5h51664-the-67.vercel.app` |

Custom domain aliases **not** cut over.

---

## 6. Worker Isolation

- Request handlers call `bindAndAssertDeploymentScope` before scan/deep/`after()`.
- Scope is cached on the request context for the invocation.
- Workers therefore write only under the request’s scope (candidate/preview/local/production-alias).
- Unit: “workers preserve scope via request bind” **PASS**.

---

## 7. Promotion Guard

```bash
node scripts/phase12c-promotion-guard.mjs --candidate-url https://hansomealpacas-p1upua7po-the-67.vercel.app
```

**Result:** PASS — `candidate:dpl_DVRasmnd…` ≠ `production`; `promote: false`.

Guard aborts (exit 2) if candidate scope is `production` or equals production namespace. It does **not** perform alias cutover.

---

## 8. Tests

`lib/hansome-score/__tests__/phase12c-deployment-isolation.test.ts` (+ related suites):

| Case | Result |
|------|--------|
| Preview ≠ Candidate | **PASS** (unit) |
| Candidate ≠ Production | **PASS** (unit + live) |
| Production == aliases only | **PASS** (unit) |
| Deployment URL never production (even with env=production) | **PASS** (unit + live) |
| Workers preserve scope | **PASS** (unit) |
| KV namespaces differ | **PASS** (unit) |
| Promotion guard aborts shared scope | **PASS** (unit + live CLI) |
| Runtime assertion fires off-alias | **PASS** (unit) |
| Related Phase 10C-4 / 11E / 12A.1 / transfer / analytics / lp-discovery | **PASS** (129 tests) |

---

## 9. Verification

### Live Candidate health

```json
{
  "ok": true,
  "deploymentId": "dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9",
  "deploymentScope": "candidate:dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9",
  "environment": "production",
  "isProductionAlias": false,
  "cacheNamespace": "candidate:dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9",
  "boundHost": "hansomealpacas-p1upua7po-the-67.vercel.app"
}
```

### Live Production status (www)

- `X-Scan-Deployment-Scope: production`
- Body `deploymentScope: "production"`
- Tip still `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`

### Preview

- Deployed: `dpl_3P87gwx7XGscy6TwtUT2cUd9dQiZ`
- Live `/api/scan/health` **500** due to **pre-existing Preview env** conflict: `NEXT_PUBLIC_GAME_CHAIN_ID=46630` with Mainnet Production guard in instrumentation — **not** a deployment-scope bug.
- Preview ≠ Candidate isolation covered by unit tests (`preview:{dpl}` vs `candidate:{dpl}`).

### Health endpoint path

`GET /api/scan/health`

---

## 10. Remaining Risks

1. **Preview live health blocked** by Preview Game env (`46630` + mainnet guard). Fix Preview env separately; isolation code path is unit-covered.  
2. **`--prod --skip-domain` still moves** the automatic project alias `hansomealpacas-the-67.vercel.app` to the new production-target tip (observed → candidate). Custom domains www/apex/game remain on `dpl_995…`. Prefer unique deployment URLs for soak; do not treat `*-the-67.vercel.app` as production.  
3. **Production tip still runs Phase 10P key shapes** until a future promote of 12C code; isolation today is Candidate namespace ≠ Production namespace (different scope strings + different code).  
4. On eventual promote, Production cold-starts under `{scope}:…` key form — expected; plan invalidation/warm as needed.  
5. Dirty workspace still large — ship audits should continue to use clean trees for product promotes.

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **DEPLOYMENT_ISOLATION_COMPLETE** |
| **Report** | `reports/HANSOME_PHASE12C_DEPLOYMENT_ISOLATION.md` |
| **Docs** | `docs/DEPLOYMENT_ISOLATION.md` |
| **Candidate ID** | `dpl_DVRasmndMMNHC2GcQuvZoNVuxyH9` |
| **Preview ID** | `dpl_3P87gwx7XGscy6TwtUT2cUd9dQiZ` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (confirmed unchanged on www/apex/game) |
| **Evidence Candidate ≠ Production** | Candidate health `candidate:dpl_DVR…` vs www status `production` |
| **Health path** | `/api/scan/health` |
| **Promoted?** | **NO** |
