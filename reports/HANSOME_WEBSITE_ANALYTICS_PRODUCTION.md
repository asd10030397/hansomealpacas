# HANSOME — Website Analytics Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Track** | **A — Website Analytics** |
| **Deploy ID** | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` |
| **Alias** | www.hansomealpacas.xyz / hansomealpacas.xyz / game.hansomealpacas.xyz → **YES** |
| **Rollback (pre–Track A tip)** | `dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM` (Phase 4 recent-first) |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **PASS_DEPLOYED** |

---

## 1. Implementation summary

First-party website analytics for page views, unique visitors, unique IPs (hashed), sessions, top pages, referrers, and optional country codes from Vercel edge headers.

- **Ingest:** non-blocking client beacon → `POST /api/analytics/visit`
- **Identity:** first-party cookies `ha_vid` (90d UUID) + `ha_sid` (30m); never wallet-linked; no fingerprinting
- **IP:** trusted Vercel headers only → normalize IPv4/IPv6 → HMAC-SHA256 with `ANALYTICS_IP_SALT` → store hash only
- **Dedupe:** race-safe `SET NX` + TTL; daily + all-time keys; 5s PV debounce per visitor+pathname
- **Exclusions:** bots/smoke UAs, preview (`VERCEL_ENV` / `*.vercel.app`), localhost, API/assets/`_next`, opt-out cookie
- **Dashboard:** private `/admin/analytics` gated by `ANALYTICS_ADMIN_SECRET`
- **Privacy:** `/privacy` disclosure + opt-out; coexists with Scan KV (`analytics:scan:v1:*`) and `@vercel/analytics`

---

## 2. Storage model

Prefix: `analytics:web:v1:` on existing Vercel KV (`KV_REST_API_*`).

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `day:{date}:pv\|uv\|uip\|sessions\|bots` | Daily aggregates | ~40d |
| `all:pv\|uv\|uip\|sessions\|bots` | All-time aggregates | none |
| `uv:{date}:{visitorHash}` / `uv:all:{hash}` | Visitor dedupe | 48h / ~100d |
| `uip:{date}:{ipHash}` / `uip:all:{hash}` | IP dedupe | 48h / ~400d |
| `session:{date}:{sessionHash}` | Session dedupe | 48h |
| `pv:{date}:{pathname}` + page UV/UIP | Per-page | ~40d / 48h dedupe |
| `day:{date}:pages\|refs\|countries` | ZSET tops | ~40d |
| `debounce:{date}:{visitorHash}:{pathname}` | Refresh debounce | 5s |
| `meta` | `{ schemaVersion, updatedAt }` | — |

**Never stored:** raw IP, wallet, fingerprint, individual browsing history.

---

## 3. Dedupe logic

| Scenario | Result |
|----------|--------|
| Same IP + same visitor + rapid refresh | PV debounced; UV once/day; UIP once/day |
| Same IP + two visitor IDs | UV=2, UIP=1 |
| Two IPs + same visitor | UV=1, UIP=2 |
| Bots / smoke UA | Excluded; `day:{date}:bots` incremented |
| Preview / localhost | Excluded |

Unique counters use atomic `SET NX` before `INCR` (race-safe).

---

## 4. Privacy controls

- No raw IP persistence or logging in analytics path
- HMAC salt `ANALYTICS_IP_SALT` (server-only)
- Visitor cookie rotates/expires ~90 days
- Opt-out cookie `ha_analytics_opt_out` via `/privacy` + `POST /api/analytics/opt-out`
- Dashboard never returns IPs, hashes, visitor IDs, or wallets
- Country only from `x-vercel-ip-country` (ISO-2), never precise geolocation

---

## 5. Files changed (Track A)

| Path | Role |
|------|------|
| `lib/website-analytics/*` | Core: keys, IP, filter, KV, record, stats, auth |
| `lib/website-analytics/__tests__/website-analytics.test.ts` | 17 unit tests |
| `app/api/analytics/visit/route.ts` | Ingest |
| `app/api/analytics/stats/route.ts` | Admin stats |
| `app/api/analytics/admin/login/route.ts` | Admin cookie gate |
| `app/api/analytics/opt-out/route.ts` | Opt-out |
| `app/admin/analytics/page.tsx` | Dashboard UI |
| `app/privacy/page.tsx` | Privacy disclosure |
| `components/WebsiteAnalyticsBeacon.tsx` | Client beacon |
| `components/PrivacyOptOut.tsx` | Opt-out control |
| `app/layout.tsx` | Mount beacon |
| `sections/FooterSection.tsx` + i18n | Privacy link |
| `.env.example` | Document required secrets |
| `vitest.config.ts` | Include new tests |
| `scripts/_tmp-website-analytics-prod-smoke.mjs` | Prod smoke |
| `reports/data/website_analytics_prod_smoke.json` | Smoke evidence |

**Forbidden-file audit (Track A intent): PASS** — no intentional changes to scan score/weights, LP/burn/lock semantics, or holder explainability UI as part of this track.

---

## 6. Tests

| Check | Result |
|-------|--------|
| `vitest` website-analytics | **17 PASS** (incl. 15 required scenarios) |
| `vitest` scan-analytics coexistence | **10 PASS** |
| Typecheck | **PASS** |
| Scenarios covered | IP/visitor dedupe, shared IP, IP change, IPv6 normalize, trusted proxy, spoofed XFF ignored, bot/preview/debounce, race NX, outage fallback, no raw IP, admin auth, retention TTL |

---

## 7. Production build

| Check | Result |
|-------|--------|
| Local `npm run build` | **PASS** |
| Vercel cloud build | **PASS** |

---

## 8. Deploy ID

`dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb`

(Intermediate Track A deploys during secret/smoke loops: `dpl_AYFxVDTTZHF5mfvqdrAWKNkeqbAH`, `dpl_AXv8DhzNQqfQzoh4uaSx2aqeQLsu`.)

---

## 9. Alias

| Host | Live tip |
|------|----------|
| www.hansomealpacas.xyz | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` |
| hansomealpacas.xyz | same |
| game.hansomealpacas.xyz | same |

---

## 10. Smoke

Evidence: `reports/data/website_analytics_prod_smoke.json` — **PASS**

| Check | Result |
|-------|--------|
| Public `/`, `/scan`, `/privacy` 200; no secret leak | PASS |
| Same identity refresh → PV debounce | PASS |
| Bot UA excluded | PASS |
| Dashboard 401 without auth | PASS |
| Admin login + stats (PV/UV/UIP, no PII) | PASS |
| Opt-out endpoint | PASS |
| Scan API still responds | PASS |

Sample post-smoke totals (UTC day): PV/UV/UIP updating; botsExcluded incremented for smoke UAs.

---

## 11. Rollback

| Item | Value |
|------|--------|
| Rolled back? | **NO** |
| Target if needed | `dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM` |
| Rule | On Track A failure only — do **not** roll back later Track B deploys |

---

## 12. Final verdict

**PASS_DEPLOYED**

### Required Production env vars

| Var | Purpose |
|-----|---------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Storage (already linked) |
| `ANALYTICS_IP_SALT` | HMAC salt for IP / opaque id hashes |
| `ANALYTICS_ADMIN_SECRET` | `/admin/analytics` gate |

Optional: `ANALYTICS_DISABLED=1` kill-switch.

### Remaining limitations

- Unique visitors/IPs are estimates (NAT/VPN); dashboard labels accordingly
- Page UV/UIP over multi-day windows are sums of daily uniques (may over-count across days)
- `vercel env pull` redacts secrets — rotate + redeploy when smoke needs a known admin secret
- Country distribution only when Vercel sends `x-vercel-ip-country`
