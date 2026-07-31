# HANSOME Score — Public Beta GO / NO-GO

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Product** | HANSOME Score Scan (Public Beta) |
| **Deployed to production** | **No** — waiting for explicit user approval |
| **Evidence** | This file · [`HANSOME_PRODUCTION_DEPLOYMENT_READINESS.md`](HANSOME_PRODUCTION_DEPLOYMENT_READINESS.md) · [`HANSOME_SUPPLY_AND_BURN_P2P3_VALIDATION.md`](HANSOME_SUPPLY_AND_BURN_P2P3_VALIDATION.md) · Fast Scan measure |

---

## Final verdict

# PUBLIC BETA: GO

**Conditional on Vercel Production having KV configured before/at deploy.**

Cold UX is no longer a multi-minute blocked HTTP request: **Fast Scan** returns a usable provisional screen in ~12–17s; **Deep Analysis** continues asynchronously (LP / creator / P2–P3) while the client polls. Warm cache remains &lt;2s.

**Do not deploy until the user explicitly approves.**

---

## Latency table (measured 2026-07-28)

| Path | ms | Pass? |
|------|---:|:-----:|
| **Fast Scan TTFR** (`scanTokenFast` ASTEROID) | **~12,390** | ✅ within 5–15s target (post-opt) |
| **Fast Scan TTFR** (HANSOME) | **~17,263** | ⚠ slightly above 15s on warm-deps local; still non-blocking UX |
| **Cold HTTP** (pre–Fast Scan, legacy) | **~297,578** | ❌ superseded — do not block client on deep |
| **Warm memory revisit** | **0** | ✅ |
| **Concurrent 5** same CA (first wave) | wall **~24,832** (1× fast + 4× inflight) | ✅ coalesced |
| **Concurrent 10 / 25** after warm | wall **0** | ✅ |
| **Deep completion** | still **minutes** (LP + creator pages) | ✅ non-blocking; UI shows progress |

P2/P3 enrich CPU on shared transfer pages: **~11–12 ms** (negligible vs Creator pagination).

---

## Checklist

| Item | Status |
|------|--------|
| Fast Scan first usable screen | ✅ metadata, supply, verify, holders, market, P0 burn, provisional scores |
| Deep Analysis async + poll | ✅ `after()` + `/api/scan/status` · stage strip in UI |
| Incomplete → Unknown / Incomplete | ✅ burn windows, LP pending, creator pending |
| Scores labeled provisional until deep | ✅ |
| Same-CA dedupe (fast + deep) | ✅ |
| Cached revisit fast | ✅ |
| P2/P3 PASS | ✅ see P2P3 validation |
| P0/P1 burn accuracy preserved | ✅ |
| Performance MVP cache not removed | ✅ `scan:snapshot:*` + Activity overlay |
| Build / tests | ✅ `npm run build`; `npm run test:scoring` **407/407** |
| `tsc --noEmit` | ✅ ( `_tmp-*` excluded) |
| No secrets client-side | ✅ |
| Public Beta labeling | ✅ scan eyebrow / subtitle |
| KV on Production | ⚠️ verify before deploy |
| Production deploy | ❌ not done |

---

## Architecture (Fast + Deep)

| Piece | Role |
|-------|------|
| `scanTokenFast` | Cheap parallel path (~12s) |
| `scanToken` + `ensureDeepAnalysis` | Full LP / creator / relationships / P2–P3 |
| `getCachedScan` | Cache hit → complete; cold → fast + schedule deep |
| `GET /api/scan` | `maxDuration=60`; `after()` keeps deep alive |
| `GET /api/scan/status` | Poll stages / completed snapshot |
| ScanClient | Show fast result; poll ~3.5s; stage progress |

---

## Explicit non-goals confirmed

- [x] No production deploy
- [x] No Explore / Analytics / Just Launched
- [x] No scoring formula retune
- [x] No breaking P0/P1 or snapshot cache MVP
