# HANSOME Scan — Deployment Isolation

| Field | Value |
|-------|--------|
| Phase | 12C |
| Status | Release infrastructure |
| Production tip (do not change unless promoting) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |

This document is the source of truth for **scope resolution**, **candidate soak**, **preview**, **production**, **promotion**, and **rollback**. It does **not** change Hook / Titan / Score / LP / Ownership algorithms.

---

## 1. Scopes

| Scope | Meaning | When |
|-------|---------|------|
| `production` | Shared live KV namespace | Request host is a **production alias** only |
| `candidate:{deploymentId}` | Isolated soak tip | Production *target* deploy without alias (`--prod --skip-domain`) |
| `preview:{deploymentId}` | Isolated preview tip | `VERCEL_ENV=preview` |
| `local` / `local:{id}` | Developer machine | Local / development |

**Production aliases (only):**

- `www.hansomealpacas.xyz`
- `hansomealpacas.xyz`
- `game.hansomealpacas.xyz`

`*.vercel.app` deployment URLs **never** receive `production` scope.

---

## 2. Scope resolution priority

1. **Test override** (`setDeploymentScopeForTests`)
2. **Explicit** `HANSOME_SCAN_DEPLOYMENT_SCOPE`
   - Non-`production` values win (e.g. forced `candidate:…` in tests)
   - Bare `production` is **host-gated**: honored only on production aliases
   - Fixes the bug where `vercel deploy --prod --skip-domain` inherited Production env `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`
3. **Production alias host** → `production`
4. **Preview** (`VERCEL_ENV=preview`) → `preview:{deploymentId}`
5. **Development** → `local`
6. **Vercel production target without alias** → `candidate:{deploymentId}`
7. Fallback → `local` (never silent production)

**Never** infer `production` merely because `--prod` was used.

---

## 3. Runtime assertion

If `deploymentScope === "production"` **and** host is not a production alias → throw `DeploymentScopeIsolationError` and **do not continue**.

API entry points call `bindAndAssertDeploymentScope(request)` so `after()` background workers inherit the same bound host/scope for the invocation.

---

## 4. KV namespace rule

Every durable key **begins with** `deploymentScope`:

```text
{deploymentScope}:scan:snapshot:{chainId}:{token}
{deploymentScope}:scan:xfer:{chainId}:{token}
{deploymentScope}:scan:v3pos:…
{deploymentScope}:scan:v4hook:…
{deploymentScope}:scan:burn:…
{deploymentScope}:scan:contract:…
{deploymentScope}:scan:lp:…
{deploymentScope}:analytics:scan:v1:…
{deploymentScope}:analytics:web:v1:…
```

Rate-limit keys are also scoped (candidates do not share abuse counters with production).

---

## 5. CLI safety matrix

| Intent | Command | Safe? | Notes |
|--------|---------|-------|-------|
| **Preview** | `npx vercel deploy --yes` | ✅ | Scope `preview:{dpl}`; no aliases |
| **Candidate** | `npx vercel deploy --prod --skip-domain --yes` | ✅ (after 12C) | Scope `candidate:{dpl}`; **must** use `--skip-domain` |
| **Candidate without skip-domain** | `npx vercel deploy --prod --yes` | ❌ **UNSAFE** | May assign production domain aliases — **disallowed** for soak |
| **Production promote** | `npx vercel alias set <url> www…` (+ apex + game) | ⚠️ gated | Only after promotion guard PASS + explicit human approval |
| **Rollback** | `npx vercel alias set <rollback-url> www…` (+ apex + game) | ✅ | Restore known tip |

### Disallowed combinations

- Candidate soak **without** `--skip-domain`
- Promoting when candidate `deploymentScope === production`
- Setting `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` on Preview
- Expecting `*.vercel.app` to use production KV
- Changing www / apex / game aliases during isolation work

---

## 6. Health / debug

```text
GET /api/scan/health
```

Returns: `deploymentId`, `deploymentScope`, `environment`, `isProductionAlias`, `buildId`, `gitCommit`, `cacheNamespace`.

Headers: `X-Scan-Deployment-Scope`, `X-Scan-Cache-Namespace`.

Also exposed on Scan responses: `X-Scan-Deployment-Scope` (GET + POST).

---

## 7. Promotion guard

Before any alias cutover:

```bash
node scripts/phase12c-promotion-guard.mjs --candidate-url https://<candidate>.vercel.app
```

Aborts (exit 2) if candidate scope equals production or is not `candidate:*` / `preview:*`.

**Guard does not promote.** Alias cutover remains a separate, explicit step.

---

## 8. Candidate workflow (recommended)

```bash
# 1) Deploy candidate (never assigns custom domains)
npx vercel deploy --prod --skip-domain --yes

# 2) Verify health
npx vercel curl https://<candidate>.vercel.app/api/scan/health --yes

# Expect: deploymentScope = candidate:dpl_… ; isProductionAlias = false

# 3) Promotion guard (still no alias)
node scripts/phase12c-promotion-guard.mjs --candidate-url https://<candidate>.vercel.app

# 4) DO NOT promote unless a later phase explicitly requests cutover
```

---

## 9. Preview workflow

```bash
npx vercel deploy --yes
npx vercel curl https://<preview>.vercel.app/api/scan/health --yes
# Expect: deploymentScope = preview:dpl_…
```

Preview ≠ Candidate ≠ Production namespaces.

---

## 10. Rollback (production aliases)

Current rollback / production tip:

`dpl_995JvbHVDTsv4mSP77rJqeas8GEA` → `https://hansomealpacas-hp5h51664-the-67.vercel.app`

```bash
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app www.hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app hansomealpacas.xyz
npx vercel alias set https://hansomealpacas-hp5h51664-the-67.vercel.app game.hansomealpacas.xyz
```

Verify: `npx vercel inspect www.hansomealpacas.xyz`

---

## 11. Code entry points

| Path | Role |
|------|------|
| `lib/hansome-score/deployment-scope.ts` | Resolution, assertion, KV helpers, promotion guard helpers, health info |
| `app/api/scan/health/route.ts` | Health endpoint |
| `scripts/phase12c-promotion-guard.mjs` | CLI promotion abort |
| `lib/hansome-score/__tests__/phase12c-deployment-isolation.test.ts` | Unit tests |

---

## 12. Historical bug (fixed in 12C)

`vercel deploy --prod --skip-domain` inherits the **Production** environment, including `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`. Pre-12C code treated that explicit value as authoritative, so candidates wrote into the live production KV namespace.

**Fix:** bare `production` override is ignored unless the request host is a production alias; deployment URLs resolve to `candidate:{deploymentId}`.
