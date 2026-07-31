# HANSOME — Deep Perf V2 Phase 1: Persistent LP Discovery Cache

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Phase 1 only — persistent LP discovery cache (KV) |
| **Design** | `reports/HANSOME_DEEP_SCAN_PERFORMANCE_V2_DESIGN.md` §5.2 / §7 |
| **Deploy** | **No** |
| **Verdict** | **PASS** |

---

## Verdict

**PASS** — Token-agnostic `scan:lp:{chainId}:{token}` discovery cache is implemented, unit-tested, and benchmarked. Proven Position NFT IDs / pool IDs / versions / locker candidates persist across simulated isolates; every use revalidates on-chain; lock classification is never stored as truth; stale IDs are dropped; `discoveryComplete` stays honest.

---

## Implementation summary

### What shipped

1. **`LpDiscoveryCache` (v1)** in `lib/hansome-score/lp/position-cache.ts`
   - Memory (per isolate) + KV (`@vercel/kv` / Upstash) + test Map backend
   - Soft KV TTL 24h; memory soft TTL 6h; **always revalidate on use**
2. **`detectV4LpIntelligence`** loads cache before known-first; persists proven IDs after revalidation; drops definitive stale IDs; never promotes unproven PM candidates
3. **Budget gate** — when `exhaustiveDiscovery !== true`, do not fall into ~190s PM history (matches Deep `allowExhaustive` / ≥200s soft budget signal)
4. **`detectMultiVersionLpIntelligence`** unions pool IDs + Uniswap versions into the same cache key
5. HANSOME seeds remain **bootstrap only**; no FOX / Top-100 token-specific seeds

### Schema

```
scan:lp:{chainId}:{tokenLower} → LpDiscoveryCache
```

| Field | Purpose |
|-------|---------|
| `version` | `1` |
| `chainId` / `address` | Scope |
| `poolIds[]` | Pools/pairs seen |
| `versions[]` | `v2` \| `v3` \| `v4` |
| `positionIds[]` | Proven Position NFT IDs only |
| `lockerCandidates[]` | Titan / known locker **addresses** (not lock state) |
| `exhaustiveComplete` | Last pass ran exhaustive PM discovery |
| `knownVerifiedAt` | Last successful known-first wall time |
| `updatedAt` | Soft TTL anchor |

**Never persisted:** `lockState`, `aggregateState`, `lockedPct`, `unlockedPct`, `lockDistribution`, position lock classification rows.

---

## Tests

| Suite | Result |
|-------|--------|
| `lp-discovery-cache` (read/write, cross-isolate KV sim, stale replace, no lock-truth, FOX no seeds) | **PASS** |
| `lp-known-first` / `lp-mixed` / `lp-multi-version` / `scan-deep-stage-independence` | **PASS** (26 tests) |

Harness: `lib/hansome-score/_tmp-lp-discovery-cache-measure.ts`  
Raw: `reports/hansome-lp-discovery-cache-measure.json`

---

## Benchmarks (local Node, Map-backed KV cross-isolate sim)

| Token | First / populate | Repeat known-first | Positions (before→after cache) | Lock Dist | Notes |
|-------|-----------------:|-------------------:|--------------------------------|:---------:|-------|
| **HANSOME** | **4.8s** (seeds) | **4.0s** | 3→3 (`cached_position_ids`) | **yes** | MIXED; `discoveryComplete=false` honest |
| **FOX** | **54s** exhaustive populate | **5.1s** | 0→0 | no | No v4 positions in PM window; pool/locker cache kept; **~10.6×** vs populate |
| **CASHCAT** | **105s** exhaustive | **6.9s** | 0→**3** proven IDs | no* | **~15.3×**; repeat uses `cached_position_ids` |
| **PONS** | **54s** exhaustive | **4.7s** | 0→0 | no | **~11.3×** avoids re-paying PM pages |
| ASTEROID / CATE / LEMON.FUN (Top-20 reps) | ~4–5s known-first | ~4–5s | 0 | no | Pool versions cached; no Position NFT hits without exhaustive |

\*CASHCAT positions revalidate but known-first “sufficient” (MIXED/seeds) not met → Lock Dist USD path still unavailable; completeness remains honest.

### Stale-position revalidation

Injected bogus `#999999999` alongside HANSOME seeds → after on-chain revalidation **dropped**; `#47299` / `#357867` / `#142938` retained.

### HANSOME repeat vs FOX

| | HANSOME repeat | FOX repeat (after populate) |
|--|---------------:|----------------------------:|
| Wall | **~4.0s** | **~5.1s** |
| Lock Dist | available | unavailable (0 proven IDs in PM window) |
| RPC shape | revalidate 3 known IDs | Titan + pool probes only (no PM history) |

Primary Phase 1 win for FOX-class: **do not re-pay exhaustive PM rediscovery** on every isolate when budget is known-first-only; when proven IDs exist (CASHCAT), repeat is **~15×** faster.

---

## Freezes held

| Freeze | Held? |
|--------|:-----:|
| No scoring changes | yes |
| No Burn changes | yes |
| No lock semantics / MIXED / ALL_LOCKED rules | yes |
| No risk-threshold changes | yes |
| No Deep retry/fencing redesign | yes |
| No Analytics changes | yes |
| No Explore / UI features | yes |
| No timeout increases | yes |
| No FOX / Top-100 token-specific seeds | yes |
| **No deploy** | yes |

---

## Files changed

- `lib/hansome-score/lp/position-cache.ts` — KV-backed `LpDiscoveryCache`
- `lib/hansome-score/lp/detect.ts` — load/persist/revalidate/stale drop; exhaustive budget gate
- `lib/hansome-score/lp/multi.ts` — persist pool versions
- `lib/hansome-score/__tests__/lp-discovery-cache.test.ts` — *(new)*
- `lib/hansome-score/__tests__/lp-known-first.test.ts` — test KV cleanup
- `lib/hansome-score/_tmp-lp-discovery-cache-measure.ts` — *(new)* harness
- `reports/hansome-lp-discovery-cache-measure.json` — raw timings
- `reports/HANSOME_DEEP_PERF_V2_PHASE1_LP_CACHE.md` — *(this file)*

---

## Residual risks

1. **FOX Lock Dist** still needs proven Position NFT IDs (not present in bounded PM window in this run). Cache correctly stores empty `positionIds` + pools; async/exhaustive discovery (later phases) must find IDs once.
2. **Known-first “sufficient”** still requires seeds-satisfied or MIXED locked+removable — tokens with only unlocked (or only locked) cached IDs revalidate quickly but may not early-return Lock Dist USD until MIXED/seeds rules are met (unchanged semantics).
3. **Production KV** not exercised in this harness (Map stand-in). Real Upstash write size is small (ID lists), but first Production deploy should smoke one HANSOME + one CASHCAT-class token.
4. Phase 2+ (shared transfer index, independent jobs, prewarm) **not** implemented — as approved.

---

## Confirmations

- [x] Phase 1 only
- [x] Code implementation complete
- [x] Report written
- [x] Freezes held
- [x] **No deploy**
