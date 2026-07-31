# HANSOME Scan — Latency / Performance Audit (Post Cache MVP)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Verdict** | **PASS (with caveats)** — warm path meets &lt;2s; cold remains multi-minute |
| **Harness** | `lib/hansome-score/_tmp-cache-mvp-measure.ts`, `_tmp-http-cache-measure.ts`, prior staged `_tmp-latency-audit.ts` |
| **Raw** | `reports/hansome-scan-cache-mvp-measure.json` (+ HTTP JSON when available) |
| **Cache impl** | `lib/hansome-score/scan-cache.ts` · `/api/scan` · SSR peek |
| **Deployed** | **No** |

---

## Verdict summary

| Gate | Result |
|------|--------|
| Warm cached scan &lt;1–2s | **PASS** — in-process memory **~0 ms** (p50/p95/worst) |
| Same-CA dedupe under concurrency | **PASS** — n=5/10/25 direct all memory hits, wall **0 ms** |
| Cold scan usable (progressive UI) | **PASS with caveat** — cold ≈ **298 s**; page no longer SSR-blocks; client shows progress |
| Failures not cached as success | **PASS** |
| Supply & Burn in snapshot | **PASS** (P0+P1 fields present on cold response) |
| Activity overlay 30–60s | **Implemented** (45s TTL; does not recompute Structural/Overall) |

---

## Measured numbers (HANSOME · chainId 4663)

### Post-MVP (direct `getCachedScan`, local Node, KV unset → memory)

| Scenario | ms | Notes |
|----------|---:|-------|
| **Cold** | **297,578** | `source=fresh`; Overall 52; Supply&Burn burnFunction=`no` |
| **Warm #1–5** | **0 / 0 / 0 / 0 / 0** | `hit=true` `source=memory` |
| **Warm p50 / p95 / worst** | **0 / 0 / 0** | Target &lt;2000 ms — **met** |
| **Manual refresh #1** | **332,723** | Full rescan (`refresh=1`) |
| **Manual refresh #2** | *(rate-limit fix)* | Pre-fix bug: 60s cooldown expired during ~333s scan. **Fixed**: cooldown marked **after** successful refresh. Unit test asserts `refreshDenied`. |
| **Concurrency 5u** | wall **0**, p50 **0** | All memory hits |
| **Concurrency 10u** | wall **0**, p50 **0** | All memory hits |
| **Concurrency 25u** | wall **0**, p50 **0** | All memory hits |

### Pre-MVP staged breakdown (reuse agent 44499fa0 / finish harness)

| Stage | ms |
|-------|---:|
| TOTAL staged wall | ~314,484 |
| Uniswap v2/v3/v4 discovery | ~191,214 |
| Creator history indexing | ~105,603 |
| Holder funding graph | ~5,471 |
| Wave1 parallel (BS/Gecko/GoPlus) | ~6,482 |
| RPC token meta | ~868 |
| **Supply & Burn dead balances** | **~517** |
| **Supply & Burn mechanism CPU** | **~1** |
| Overall/Structural calc | ~2 |

Warm path **before** cache: ~326,214 ms (full re-scan every time).

### Post-MVP HTTP `/api/scan` (local Next :3013, KV unset → memory)

| Scenario | ms | Notes |
|----------|---:|-------|
| Client cold wait | ~306,090 | Client `fetch failed` near ~300s; server scan still completed (joined via inflight) |
| Warm (joined inflight) | **51,553** | `hit=true` `source=inflight` Overall **55** |
| Warm memory | **36 / 37** | `source=memory` — **&lt;2s PASS** |
| HTTP conc **5u** | wall **80**, p50 **76**, worst **77**, ok **5/5** | all memory |
| HTTP conc **10u** | wall **126**, p50 **119**, worst **120**, ok **10/10** | all memory |
| HTTP conc **25u** | wall **275**, p50 **261**, worst **262**, ok **25/25** | all memory |

Raw: `reports/hansome-scan-http-cache-measure.json`.

### Isolated upstream probes (pre-MVP)

| Probe | ms |
|-------|---:|
| RPC | ~893 |
| Blockscout holders | ~3,263 |
| Blockscout token | ~2,280 |
| GeckoTerminal | ~507 |
| GoPlus | ~639 |

---

## Bottlenecks (ordered)

1. **Uniswap multi-version LP discovery** (~190s) — dominant cold cost  
2. **Creator transfer pagination** (~106s, up to 40 Blockscout pages)  
3. **Blockscout wave1 + funding graph** (~5–12s combined)  
4. **RPC / Supply & Burn dead balances** (~0.5–1s) — not material vs LP/creator  
5. **GeckoTerminal / Activity overlay** (~0.5s) — acceptable for 45s overlay TTL  

Timeout risks: Vercel Hobby 10s / Pro default 60s insufficient for cold; route sets `maxDuration = 300`. Cold still can approach that ceiling under RPC/BS congestion.

---

## Cache architecture (shipped)

| Feature | Behavior |
|---------|----------|
| Snapshot keys | `scan:snapshot:4663:{addr}`, `scan:meta:…`, `scan:lock:…`, `scan:rl:addr:…`, `scan:rl:ip:…` |
| Full Score TTL | **15 min** |
| Stale serve | Up to **60 min** + background refresh |
| Activity/price overlay | **45 s** — updates `activity` / `hansomeLevel` / `liquidityUsd` only |
| Timestamps | `scannedAt`, `scoreComputedAt`, `activityUpdatedAt` |
| Dedupe | In-process `inflight` Promise map + KV/memory refresh lock (`NX`) |
| KV | `@vercel/kv` when `KV_REST_API_*` / `UPSTASH_REDIS_REST_*` set; else memory |
| Failures | Thrown errors → HTTP 500 `no-store`; **never** written to snapshot |
| Supply & Burn | Inside full structural snapshot (P0+P1) |

See [`HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md) (status: MVP implemented, not deployed).

---

## Estimated improvement

| Path | Before | After |
|------|--------|-------|
| Repeat refresh / same CA | ~300s every time | **~0–50 ms** memory (or KV RTT when cross-instance) |
| Concurrent same CA | N × full scans | **1** full scan + N−1 waiters/hits |
| New CA first visit | ~300s (page frozen on SSR) | ~300s analysis, **UI progressive** (no SSR full wait) |

---

## Accuracy / integrity notes

- Structural / Overall / Supply & Burn frozen until full TTL or deliberate refresh  
- Activity overlay does **not** silently rewrite Overall Score  
- Unknown tri-states cached as scanned (honest); never coerced to No  
- Rate-limited refresh returns prior snapshot + `cache.refreshDenied`  

---

## Follow-ups (not blocking audit PASS)

1. Confirm **KV env on Vercel Production** before public traffic (cross-instance warm).  
2. Optional: shorten cold via parallel LP/creator (accuracy-preserving).  
3. HTTP multi-instance stampede re-measure after KV is enabled.  
