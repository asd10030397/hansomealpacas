# HANSOME Analytics MVP

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Status** | Implemented (code only) |
| **Deployed** | **NO** |
| **Source plan** | [`HANSOME_ANALYTICS_AND_DISCOVERY_PLAN.md`](./HANSOME_ANALYTICS_AND_DISCOVERY_PLAN.md) — Analytics MVP slice only |
| **Hard freeze** | Production Scan baseline (score / deep / LP / burn / creator / retry / cache) unchanged |

---

## 1. Implementation plan — planned vs shipped

| Planned (MVP slice) | Shipped |
|---------------------|---------|
| A) Vercel Web Analytics for site traffic, uniques, `/scan` pageviews | Yes — `@vercel/analytics` in root layout |
| B) Privacy-minimal KV counters on successful `/api/scan` | Yes — `lib/scan-analytics.ts` + `after()` hook |
| Non-blocking writes; Scan never fails on analytics errors | Yes |
| No dashboard UI / no `/explore` | Yes (out of scope) |
| Visitor HMAC / footer stats / Most Searched UI | **Not shipped** (later phases in discovery plan) |
| Ranking formula / public stats API | **Not shipped** |

---

## 2. What is stored / not stored

### Stored (KV, prefix `analytics:scan:v1:`)

| Data | Notes |
|------|-------|
| Total successful Scan count | Integer counter |
| Unique normalized contract addresses | Redis SET membership |
| Per-CA scan hit count | Integer + all-time ZSET score |
| Last searched timestamp per CA | ISO-8601 string |
| Hourly / daily hit & total buckets | TTL’d for 24H / 7D aggregation |

### Not stored

- IP addresses / `x-forwarded-for`
- Wallet addresses
- User-Agent, cookies, or visitor hashes
- Raw request bodies / personal identifiers
- Failed / invalid-address Scan attempts

### Vercel Web Analytics (dashboard, not our KV)

Pageviews and visitor metrics are processed by Vercel’s analytics product when enabled on the project. We do **not** mirror those into KV.

---

## 3. KV key schema

Prefix: `analytics:scan:v1` (isolated from `scan:*`, `forum:*`, `hansome:cv:v1:*`).

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `analytics:scan:v1:meta` | JSON | — | `{ schemaVersion: 1, updatedAt }` |
| `analytics:scan:v1:total` | int | — | All-time successful scans |
| `analytics:scan:v1:uniq` | SET | — | Unique lowercase CAs |
| `analytics:scan:v1:hits:{addr}` | int | — | Per-CA all-time hits |
| `analytics:scan:v1:last:{addr}` | string ISO | — | Last successful search time |
| `analytics:scan:v1:rank:all` | ZSET | — | Most searched (score = hits) |
| `analytics:scan:v1:h:{yyyyMMddHH}:{addr}` | int | 48h | Hourly per-CA hits |
| `analytics:scan:v1:h:{yyyyMMddHH}:_total` | int | 48h | Hourly total scans |
| `analytics:scan:v1:d:{yyyyMMdd}:{addr}` | int | 8d | Daily per-CA hits |
| `analytics:scan:v1:d:{yyyyMMdd}:_total` | int | 8d | Daily total scans |

Helpers: `hourBucketsForLast24h()`, `dayBucketsForLast7d()` sum buckets for window reads (no public API yet).

Requires existing `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or Upstash equivalents). No new secrets.

---

## 4. How Web Analytics is wired

1. Dependency: `@vercel/analytics`
2. Component: `components/VercelWebAnalytics.tsx` → `<Analytics />` from `@vercel/analytics/react`
3. Mounted in `app/layout.tsx` (App Router root) beside existing optional Plausible/GA (`components/Analytics.tsx`)
4. **Dashboard provides:** total traffic, unique visitors, path breakdown (including `/scan` and `/scan/[address]`)
5. **We store:** nothing for Web Analytics in app KV — enable **Web Analytics** in the Vercel project settings after deploy approval

---

## 5. Non-blocking guarantee

```
GET|POST /api/scan success
  → scheduleAfterDeep(...)        // existing
  → scheduleScanAnalytics(addr)   // new
       → after(() => scheduleSuccessfulScanAnalytics(addr))
            → void recordSuccessfulScan(...).catch(warn)
```

- Hook runs only after `getCachedScan` succeeds (errors skip analytics).
- Uses Next.js `after()` so writes continue after the response (same pattern as deep analysis).
- `recordSuccessfulScan` is fully try/caught; returns `false` on failure; never throws to the route.
- Invalid CA normalization → no write.
- Missing KV env → no-op (`false`), Scan still succeeds.

---

## 6. Tests / build results

| Check | Result |
|-------|--------|
| `vitest run lib/scan-analytics.test.ts` | **PASS** (10 tests) |
| `npm run typecheck` | **PASS** |
| `npm run build` (local) | **FAIL** — compile OK; prerender flake on `/` or `/scan` (`TypeError: … webpack-runtime … 'call'`). Same class of local flake noted in `ROBINHOOD_TOP20_FULL_REGRESSION.md` (Vercel cloud build previously OK). Reproduced even with `VercelWebAnalytics` temporarily unmounted → **not introduced by Analytics MVP logic**. |
| Deploy | **NO** |

Covered: normalize CA, aggregation keys, increment path, invalid skip, KV-down isolation, schedule non-throw.

---

## 7. Scan baseline freeze confirmation

**No behavioral changes** to scoring, deep orchestration, LP, burn, creator, retry/fencing, or scan-cache logic.

| File | Change |
|------|--------|
| `lib/hansome-score/scan-cache.ts` | Untouched |
| Score / deep / LP / burn / creator / progress modules | Untouched |
| `app/api/scan/route.ts` | **Import only** of `scheduleSuccessfulScanAnalytics` + `after()` schedule on success; Scan compute path unchanged |
| `/explore`, analytics dashboard UI, Just Launched, Week 2B | Untouched |

---

## 8. How to verify after future deploy approval

1. Enable **Vercel → Project → Analytics → Web Analytics**.
2. Confirm deploy includes `@vercel/analytics` (root layout).
3. Browse homepage + `/scan` (+ optional address scan); confirm pageviews in Vercel Analytics.
4. Hit successful `/api/scan?address=0x…` with KV linked; in Upstash/KV:
   - `GET analytics:scan:v1:total` increments
   - `SISMEMBER analytics:scan:v1:uniq {lowercaseCA}`
   - `ZREVRANGE analytics:scan:v1:rank:all 0 9 WITHSCORES`
5. Force KV failure (optional staging): Scan API must still return 200 with score payload.
6. Confirm no IP/wallet keys under `analytics:scan:v1:*`.

---

## 9. Files changed

- `package.json` / `package-lock.json` — `@vercel/analytics`
- `components/VercelWebAnalytics.tsx` — new
- `app/layout.tsx` — mount Vercel Web Analytics
- `lib/scan-analytics.ts` — new KV helper
- `lib/scan-analytics.test.ts` — unit tests
- `app/api/scan/route.ts` — non-blocking success hook
- `vitest.config.ts` — include new test file
- `.env.example` — docs only (no new secrets)
- `reports/HANSOME_ANALYTICS_MVP.md` — this report

---

## 10. Residual notes

- Vercel project **Web Analytics toggle** is required after deploy; the package alone does not enable the dashboard.
- Existing Plausible/GA remain optional via `NEXT_PUBLIC_*` env vars.
- No public stats API or UI in this MVP.
- Cache hits still count as successful scans (search interest), by design.
- Local `npm run build` prerender flake is a known workspace issue; confirm cloud build on next approved deploy.
