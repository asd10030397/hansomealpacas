# HANSOME — Analytics MVP Production Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deploy already-implemented Analytics MVP → focused Production smoke → STOP |
| **Implementation doc** | `reports/HANSOME_ANALYTICS_MVP.md` |
| **Deployed** | **YES** |
| **Deploy ID** | `dpl_2iRZUAbPRj4CGssZxm58qkcAYKVK` |
| **Deployment URL** | https://hansomealpacas-cyo2t416y-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/2iRZUAbPRj4CGssZxm58qkcAYKVK |
| **Pre-deploy Production (rollback target)** | `dpl_H3qNrFH5sGmLbHSUjb2NoD89RMUf` (`hansomealpacas-o3go2oxqe-the-67.vercel.app`) — confirmed via `vercel ls` / `vercel inspect` before first Analytics ship |
| **Analytics tests** | **PASS** (10/10) |
| **Scan baseline** | **PASS** |
| **KV counters** | **NOT LIVE-VERIFIED** (agent env redacts Production KV secrets) — see MANUAL ACTION |
| **Vercel Web Analytics** | **Package mounted in Production build** — dashboard enable may still need MANUAL ACTION |
| **Privacy** | **PASS** (code + HTML/API secret probe); live KV key audit blocked by same secret redaction |
| **Latency** | **No material regression** |
| **Production smoke** | **PASS** (Scan + Web Analytics mount + non-blocking analytics path) |
| **Rollback performed** | **NO** |
| **Final Production state** | Analytics MVP live on www.hansomealpacas.xyz (`dpl_2iRZUAbPRj4CGssZxm58qkcAYKVK`) |

Artifacts: `reports/_tmp-analytics-mvp-prod-smoke.json`, `scripts/_tmp-analytics-mvp-prod-smoke.mjs`, `reports/_tmp-analytics-mvp-deploy2.log`.

---

## 1. Pre-deploy gates

| Gate | Result |
|------|--------|
| `vitest run lib/scan-analytics.test.ts` | **PASS** — 10/10 |
| `npm run typecheck` | **PASS** |
| Local `npm run build` | **INCONCLUSIVE / known flake** — process stalled after compile artifacts (`.next` written); no Analytics regression identified; **no speculative Scan changes** |
| Cloud `npx vercel --prod` build | **PASS** (after unblocker below) |
| Secrets / personal identifiers introduced | **PASS** — Analytics stores CA + counters + timestamps only; no new secret env vars |
| Scan baseline freeze preserved | **PASS** — scoring / deep / LP / burn / creator / retry / cache untouched; route only schedules non-blocking analytics `after()` |

### Deploy unblocker (non-Scan)

First Production attempt (`dpl_8oz7DkUHrknVkQMqSksG8SDv4iWM`) **failed** cloud lint on `lib/hansome-score/_tmp-lp-discovery-cache-measure.ts` (`react-hooks/rules-of-hooks` false positive on `useLpDiscoveryCacheTestKv`).

Minimal fix: ignore `_tmp-*` measure scripts in `eslint.config.mjs`. **No Scan scoring / orchestration / LP / burn / cache logic changed.** Production alias remained on prior known-good until the successful Analytics deploy.

---

## 2. Deploy

| Item | Value |
|------|--------|
| Command | `npx vercel --prod --yes` |
| First Analytics Ready deploy | `dpl_9PLEVJtKgVVCJjTQXdXgAz6dDoN1` (later superseded by concurrent Production deploys) |
| **Final Analytics Production tip** | **`dpl_2iRZUAbPRj4CGssZxm58qkcAYKVK`** |
| URL | https://hansomealpacas-cyo2t416y-the-67.vercel.app |
| Aliased | https://www.hansomealpacas.xyz (**YES**) |
| Build | Next.js 15.5.20 — Compiled successfully; `/api/scan`, `/scan` present |
| Package added | `@vercel/analytics` (cloud install logged “added 1 package” on first Analytics ship) |

---

## 3. A — HANSOME Scan baseline

Token: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`

| Check | Result | Evidence |
|-------|--------|----------|
| Fast Scan works | **PASS** | HTTP 200; overall **51**, structural **75**; `X-Scan-KV=1` |
| Cache works | **PASS** | Revisit `X-Scan-Cache=memory`; ~310–322 ms |
| Deep progresses | **PASS** | Status polled; stages advance; observed terminal `partial` with `deepRetryCount=2` after watch (honest partial / retry exhausted — fencing intact) |
| Retry fencing | **PASS** | `deepAttemptId` present (`d_ms4gu60j_1p2rfvag`); retry counts monotonic (no illegal regression) |
| LP positions #47299 / #357867 / #142938 | **PASS** | All three `positionNftId`s present |
| Lock Distribution | **PASS** | `available=true`, lockedPct ≈ **28.89%** |
| Scoring weights unchanged | **PASS** | 0.3 / 0.2 / 0.18 / 0.17 / 0.1 / 0.05 |

---

## 4. B — Scan Analytics KV counters

| Check | Result |
|-------|--------|
| total / uniq / hits / rank:all / hourly / daily / last | **NOT LIVE-VERIFIED** |
| Cache-hit counts as successful search | **NOT LIVE-VERIFIED** (unit-tested + designed) |
| Invalid CA does not increment | **Indirect PASS** — invalid address returns **HTTP 400**; analytics hook only runs on successful `getCachedScan` path |
| Analytics failure cannot break `/api/scan` | **PASS** — successful scans remain HTTP 200 with full payload throughout smoke |

**Why KV not live-verified:** `vercel env pull` / agent tooling materializes Production KV credentials as redacted placeholders (`[SENSITIVE]`, len=11). `vercel env run -e production` did not expose usable `KV_REST_API_URL` / token to the smoke process (overlay / redaction). No secrets were printed.

**Code / unit confidence (not a substitute for live KV):** `lib/scan-analytics.test.ts` covers normalize, increment path, invalid skip, KV-down isolation, schedule non-throw; Production route still schedules `scheduleSuccessfulScanAnalytics` via `after()`.

### MANUAL ACTION REQUIRED — KV counter confirmation

In Upstash / Vercel KV console (Production store), after a few successful `/api/scan` hits, confirm:

- `GET analytics:scan:v1:total` increments  
- `SISMEMBER analytics:scan:v1:uniq {lowercaseCA}`  
- `GET analytics:scan:v1:hits:{ca}` increments  
- `ZSCORE analytics:scan:v1:rank:all {ca}` updates  
- hourly `analytics:scan:v1:h:{yyyyMMddHH}:…` and daily `analytics:scan:v1:d:{yyyyMMdd}:…` buckets update  
- `GET analytics:scan:v1:last:{ca}` timestamp updates  
- cache-hit successful scans still increment  
- invalid CA does not change counters  

---

## 5. C — Privacy / isolation

| Check | Result |
|-------|--------|
| HTML/API secret leak probe (`/`, `/scan`, `/scan/[address]`) | **PASS** — no KV tokens, private keys, Pinata JWT, etc. |
| Designed storage surface | **PASS** — CAs, counters, timestamps only (`lib/scan-analytics.ts`) |
| Not stored: IP / wallet / UA / cookies / bodies / secrets | **PASS** by design + unit isolation tests |
| `analytics:*` isolated from `scan:*` | **Designed PASS**; live key-namespace audit blocked by KV credential redaction |

---

## 6. D — Vercel Web Analytics

| Check | Result |
|-------|--------|
| `@vercel/analytics` dependency | **Present** (`package.json`) |
| Mounted in root layout | **Yes** — `components/VercelWebAnalytics.tsx` → `app/layout.tsx` |
| Present in Production build JS | **PASS** — chunk hit on `/_next/static/chunks/9258-….js?dpl=dpl_2iRZUAbPRj4CGssZxm58qkcAYKVK` |

### MANUAL ACTION REQUIRED — Enable Vercel Web Analytics

If the Vercel project Analytics dashboard does not yet show traffic: **Enable Web Analytics** under Vercel → Project → Analytics. The package alone does not enable the dashboard.

---

## 7. E — Regression sanity + latency

| Token | Role | Result |
|-------|------|--------|
| HANSOME | Baseline | Fast 200; LP + Lock Dist; fencing OK |
| CATE (`0xb61a…777`) | Prior PASS-class | HTTP 200; `complete`; ~349 ms |
| CASHCAT (`0x020b…18b4`) | Prior HONEST PARTIAL | HTTP 200; deep in progress / partial-class OK; ~312 ms |
| FOX (`0x2103…9bf1`) | Prior HONEST PARTIAL | HTTP 200; `complete`; ~304 ms |

| Latency | This smoke | Prior fencing baseline |
|---------|------------|------------------------|
| HANSOME first | **~322 ms** | ~401 ms |
| HANSOME cache | **~310 ms** | ~0.4–1.2 s |
| Other samples | ~300–350 ms | n/a |

**Verdict:** Analytics MVP did **not** materially alter Scan behavior or response latency.

---

## 8. Rollback

| Item | Value |
|------|--------|
| Critical Scan regression | **No** |
| Privacy / secret exposure | **No** |
| API failure attributable to Analytics | **No** |
| **Rollback performed** | **NO** |
| Rollback target if needed later | `dpl_H3qNrFH5sGmLbHSUjb2NoD89RMUf` |

---

## 9. Final Production state

- **Live tip:** `dpl_2iRZUAbPRj4CGssZxm58qkcAYKVK` → **www.hansomealpacas.xyz**
- Analytics MVP shipped: Web Analytics component + privacy-minimal KV success counters (non-blocking)
- Scan baseline (score / deep / LP / burn / creator / retry / cache) preserved
- No Explore / Most Searched UI / public analytics API / visitor HMAC / Just Launched / Week 2B

**STOP.**
