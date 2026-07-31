# HANSOME Score Public Beta — Production Smoke Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Deploy** | `dpl_HYF11CDydCxmiY9yPP7YJViqYCwV` |
| **Production URL** | https://www.hansomealpacas.xyz |
| **Deployment URL** | https://hansomealpacas-1663r1xl0-the-67.vercel.app |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/HYF11CDydCxmiY9yPP7YJViqYCwV |
| **Result** | **PASS WITH CAVEATS** |

---

## KV / env preflight (Step 0)

| Check | Result |
|-------|--------|
| `KV_REST_API_URL` (Production) | **Present** (Encrypted) |
| `KV_REST_API_TOKEN` (Production) | **Present** (Encrypted) |
| `KV_URL` / `REDIS_URL` / read-only token | Present (Encrypted) |
| `NEXT_PUBLIC_RPC_URL` | Present |
| `NEXT_PUBLIC_EXPLORER` | Present |
| `NEXT_PUBLIC_CHAIN_ID` | Present |
| Runtime `cache.kvConfigured` on `/api/scan` | **`true`** (`X-Scan-KV: 1`) |

**READY TO DEPLOY blocked by KV?** No — proceeded.

Secret values were not printed.

---

## Deploy (Step 1)

- Command: `npx vercel --prod --yes` (linked project `the-67/hansomealpacas`)
- First attempt failed (`fetch failed` uploading ~69MB); `.vercelignore` tightened to exclude bulk non-app paths (`reports`, `contracts`, `marketing-assets`, `mobile`, secrets, etc.), then redeploy succeeded
- Build: Next.js 15.5.20 — `/api/scan`, `/api/scan/status`, `/scan`, `/scan/[address]` present
- Aliased to **https://www.hansomealpacas.xyz**

---

## Smoke results

| # | Case | Timing | Result | Notes |
|---|------|-------:|--------|-------|
| 1 | HANSOME CA `0x2C38…0875` | **8,276 ms** TTFR | **PASS** | Fast Scan; Overall **51**, Structural **77**, provisional; `X-Scan-Phase: fast`, `deep_running`; Supply&Burn P0/P1 present; LP lock pending |
| 2 | Cached revisit (HANSOME) | **626 ms** | **PASS** | `cache.hit=true`, `source=memory`, KV configured |
| 2b | Cached revisit (LEMON via KV) | **358 ms** | **PASS** | `hit=true`, `source=kv` |
| 3 | New CA (LEMON.FUN) | **10,221 ms** | **PASS** | Overall **70**, Structural **74**, provisional; status poll `deepInflight=true` |
| 4 | Invalid CA | **314 ms** | **PASS*** | Error JSON returned, no hang; HTTP **500** (not 400) — see caveats |
| 5 | Concurrent same-CA ×8 (CASHCAT) | wall **17,697 ms** | **PASS** | Mix of `fast` + `inflight` coalesce; all 200; Overall **85** |

\*Functional pass (fails closed with message); status-code mismatch is a non-blocking caveat.

### Feature checks

| Check | Result |
|-------|--------|
| Fast Scan usable provisional TTFR | **PASS** (~8–10s cold) |
| Deep analysis status polling / stages | **WARN** — `deep_running` + stages stuck at liquidity/creator/relationships `analyzing` for **≥15–17 min** on HANSOME/LEMON/CASHCAT; deep **not observed complete** in smoke window |
| Cached revisit fast | **PASS** (&lt;1s) |
| Last Updated | **PASS** (API `scannedAt` / `scoreComputedAt` populated; UI copy is client-hydrated) |
| Supply & Burn P0–P1 | **PASS** (dead inventory + mechanisms on Fast) |
| Supply & Burn P2–P3 | **PENDING / honest Unknown** until deep finishes (expected while deep incomplete) |
| Locked/Unlocked liquidity $ and % | **PENDING** — `lockDistribution.available=false`, reason “Deep LP analysis pending” |
| Overall / Structural scores | **PASS (provisional)** — finalize-to-complete **not observed** |
| Secrets exposed client-side | **PASS — none** (no KV/Upstash/relayer/vault tokens in API JSON or HTML; earlier `sk_` hit was false positive on `contract_risk_analyzed`) |
| Vercel production errors | **PASS** for happy path; logs show expected errors only for invalid-address probes |

---

## Verdict

**PASS WITH CAVEATS** — Public Beta **Fast Scan + cache + KV** path is live and usable on production.

### Caveats (do not silently treat as full deep-complete)

1. **Deep analysis finalization not confirmed** within ~15–17 minutes of observation. Locked/Unlocked $/% and burn P2/P3 history stayed pending. Aligns with readiness note that cold deep can take minutes and is subject to Vercel `after()` / plan limits — **follow up if deep never completes for users**.
2. Invalid address returns **500** instead of **400** (viem `InvalidAddressError` message path).
3. Concurrent cold same-CA across isolates may still run more than one Fast Scan (partial coalesce via `inflight`); not a stampede of full deep stamps observed in wall time.
4. Deploy required a larger `.vercelignore` so CLI upload succeeds; keep bulk/ops/secrets excluded from Vercel uploads.

### Critical issues requiring immediate STOP / hotfix?

**None blocking Fast-path Public Beta.** Deep non-completion is the main production risk to monitor; **no blind patching applied** in this deploy session.

---

## Confirmations

- [x] Deployed to Production
- [x] KV verified on Production + runtime
- [x] Secrets not exposed client-side
- [x] Scoring formulas unchanged
