# HANSOME — Analytics Admin Secret Reset (Production)

**Date:** 2026-07-29 (UTC+8)  
**Project:** the-67 / hansomealpacas  
**Scope:** Production `ANALYTICS_ADMIN_SECRET` rotate + single redeploy + smoke tests only  
**Auth code changes:** none

## Tip / deploy

| Field | Value |
| --- | --- |
| Previous tip (rollback target, Phase 7 live before this redeploy) | `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ` / `https://hansomealpacas-335rad3kq-the-67.vercel.app` |
| New deploy ID | `dpl_D6cm3iivndCMWMa57vG9XhgzfEVC` / `https://hansomealpacas-7n8blhb8b-the-67.vercel.app` |
| Method | `vercel redeploy` of previous Phase 7 tip with `--target production` (avoids uploading dirty local tree / Phase 7.1 sources) |
| Alias `https://www.hansomealpacas.xyz` | **YES** → `hansomealpacas-7n8blhb8b-the-67.vercel.app` |
| Also aliased | `hansomealpacas.xyz`, `game.hansomealpacas.xyz`, `hansomealpacas.vercel.app` |

Note: Phase 7.1 Smart LP was rolled back separately; this redeploy intentionally rebuilt the Phase 7 tip so Scan/Phase 7 behavior is preserved.

## Env update

| Field | Value |
| --- | --- |
| `ANALYTICS_ADMIN_SECRET` Production | **YES** — removed then re-added (Sensitive); value not recorded here |
| Preview / Development | unchanged / not required (var was Production-only before and after) |
| Secret printed in this report | **NO** |

## Smoke tests (`https://www.hansomealpacas.xyz`)

| Test | Result | Notes |
| --- | --- | --- |
| Wrong secret → `POST /api/analytics/admin/login` | **PASS** | HTTP 401 `{"error":"Unauthorized"}` |
| Correct secret → login | **PASS** | HTTP 200 `{"ok":true}` + `ha_analytics_admin` Set-Cookie |
| `/admin/analytics` | **PASS** | HTTP 200 |
| Dashboard data `GET /api/analytics/stats` | **PASS** | HTTP 200 JSON (`schemaVersion`, today aggregates) |
| Public beacon `POST /api/analytics/visit` | **PASS** | HTTP 200 `ok:true`, `counted:true` |
| Opt-out `POST /api/analytics/opt-out` + visit | **PASS** | Cookie set; visit `excluded:"opt_out"`, `counted:false` |

## Rollback

If needed, promote previous tip:

```text
npx vercel promote https://hansomealpacas-335rad3kq-the-67.vercel.app -y
```

Deployment id: `dpl_FmkQQBdTxosNMK1AofeFmdsg41oQ`  
Note: that tip still has the **old** admin secret in its build-time env snapshot; after rollback, re-apply current Production env via another redeploy/promote of a build that includes the new secret, or re-set env and redeploy again.

## Verdict

**PASS_DEPLOYED**

- Env updated for Production only  
- Single Phase 7 redeploy live on www  
- Admin login + dashboard + beacon + opt-out all PASS  
- No auth code changes; secret not committed or written into this report  
