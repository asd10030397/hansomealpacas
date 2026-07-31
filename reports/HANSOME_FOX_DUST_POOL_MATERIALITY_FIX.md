# HANSOME — FOX Dust Pool Materiality + Cache Recompute Fix

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Generic dust / inventory materiality for presentation pools + FOX-only cache invalidation design |
| **Token (proof)** | FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| **Diagnosis** | `reports/HANSOME_FOX_POOL_CARD_LIQUIDITY_UNAVAILABLE_DX.md` |
| **Verdict** | **PASS** |
| **Deploy** | **NO** — stop after this report; wait for approval |

---

## Root cause (one-liner)

**`isMaterialPoolInventory(null) === true` treated failed `balanceOf` as material, so factory-discovered dust pools (e.g. FOX/USDG 1 wei) kept emitting synthetic `v3-pool:…` presentation stubs; with ≥2 stubs, PR1 correctly nulls per-card USD while the section banner still shows labeled aggregate.**

### Exact dust-filter bypass (Step 1 trace)

| Stage | Path | What happened |
|-------|------|----------------|
| 1. V3 factory discovery | `discoverV3Liquidity` → `factory.getPool(token, quote, fee)` | FOX/WETH + FOX/USDG both non-zero → **discovered = 2** |
| 2. Inventory read | `token.balanceOf(pool)` (catch → `null`) | WETH pool: large FOX bal; USDG pool: **1 wei** when RPC succeeds |
| 3. Materiality (pre-fix) | `isMaterialPoolInventory(bal)` | `1n` → false (correct); **`null` → true (bypass)** |
| 4. Synthetic stub | `syntheticUnknownPosition(…)` only after gate | Bypass / stale snapshot kept USDG stub |
| 5. Merge | `detectMultiVersionLpIntelligence` → `lp.positions` | 2 synthetic stubs |
| 6. Presentation | `buildPresentationPools` | count ≠ 1 → every card `liquidityUsd=null` → UI “Unavailable” |

**Confirmed bypass condition:**

```ts
// PRE-FIX (pool-materiality.ts)
if (balance == null) return true; // ← dust survives when balanceOf throws
```

**Not the primary bypass when RPC succeeds:** `1n` already failed the floor (`MIN_MATERIAL_POOL_TOKEN_BALANCE = 1000`). Production’s 2-stub payload is explained by (a) null-auto-keep on a failed inventory read and/or (b) scan snapshot cache (`fullScoreTtlSec=900`) serving a prior 2-stub `lpIntelligence`. LP discovery cache unions `poolIds` but does **not** rehydrate stubs — v3 adapter owns emission.

**Live local RPC proof (post-fix):** USDG pool `tokenBalanceRaw=1`, `quoteBalanceRaw=1` → `materiality=dust`; WETH → `material`; presentation pools = 1.

---

## Fix summary (generic, chain/token agnostic)

| Rule | Behavior |
|------|----------|
| Negligible raw inventory (1 wei) | **dust** — not a presentation pool |
| Both sides | Classify with scanned-token + quote `balanceOf` when available |
| USD | Optional floor (`MIN_MATERIAL_POOL_USD = 1`) when reliable USD exists — never from raw L |
| Existence ≠ material | Factory hit alone does not emit a card |
| Inventory read fail | **`inventory_unknown`** internally — not auto-material, no equal card prominence |
| Counts | **discovered** (pools[]) / **material** / **dust** / **inventory_unknown**; presentation stubs **only for material** |
| Lock / Score / Burn | Unchanged — synthetics still `UNABLE_TO_DETERMINE`; no ALL_LOCKED from TVL |

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/lp/pool-materiality.ts` | `classifyPoolInventoryMateriality`; null ≠ material; both-sides + optional USD |
| `lib/hansome-score/lp/adapters/types.ts` | `materiality`, `quoteBalanceRaw` on `VersionPoolHit` |
| `lib/hansome-score/lp/adapters/v3.ts` | Discover all factory hits; stub only material |
| `lib/hansome-score/lp/adapters/v2.ts` | Same pattern |
| `lib/hansome-score/lp/adapters/v4.ts` | Tag existing v4 pools `materiality: "material"` |
| `lib/hansome-score/lp/multi.ts` | `poolDetected` from material stubs / inventory_unknown (not dust-only) |
| `components/scan/ScanClient.tsx` | Headline uses **presentation** pool count; discovered stays in technical details |
| `lib/hansome-score/__tests__/pool-materiality.test.ts` | Classifier + null-bypass regression |
| `lib/hansome-score/__tests__/v3-pool-materiality-adapter.test.ts` | **New** — FOX fixture: discovered 2 / presentation 1; null → unknown |
| `lib/hansome-score/__tests__/lp-presentation.test.ts` | FOX discovered=2 + material card USD; TYGR/CASHCAT single-pool |
| `lib/hansome-score/_tmp-fox-dust-materiality-verify.ts` | **New** — local RPC proof + FOX key print / post-approval invalidate helper |

---

## Before / after (API → presentation)

### Before (Production capture)

| Metric | Value |
|--------|-------|
| `uniswapVersions.byVersion.v3.poolsFound` | 2 |
| `positions` (synthetic stubs) | 2 (WETH + USDG) |
| `positionCounts.material` | 2 |
| Presentation cards | 2 → both `liquidityUsd=null` → Unavailable |
| Section aggregate | ~$97k labeled (`labeled_aggregate`) |
| Lock | `UNKNOWN_INCOMPLETE` / Unknown |

### After (local RPC + fixtures)

| Metric | Value |
|--------|-------|
| Discovered v3 pools | **2** (material=1, dust=1, inventory_unknown=0) |
| Material presentation stubs / cards | **1** (FOX/WETH only) |
| FOX/USDG | Omitted from cards (`dust`) |
| Card Pool Liquidity | Labeled ~$95–97k when `liquidityUsd` present (fixture $96,400) |
| Lock | Unknown — no false ALL_LOCKED |
| Score / Burn | Unchanged |

Illustrative post-fix LP slice:

```json
{
  "poolsDetectedCount": 2,
  "positions": [
    {
      "positionNftId": "v3-pool:0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685:10000",
      "poolId": "0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685",
      "lockState": "UNABLE_TO_DETERMINE",
      "valueUsd": null
    }
  ],
  "uniswapVersions": {
    "byVersion": {
      "v3": {
        "poolsFound": 2,
        "positionsFound": 1,
        "detail": "v3: 2 discovered pool(s) … (material=1, dust=1, inventory_unknown=0) …"
      }
    }
  }
}
```

UI mapping:

| Surface | Mapping |
|---------|---------|
| Headline pool count | `buildPresentationPools(…).length` (material cards) |
| FOX/WETH card liquidity | single-pool path → `result.liquidityUsd` |
| Dust USDG | no card |
| Technical “pools per version” | discovered `poolsFound` (may stay 2) |
| Lock | still Unknown without NPM/locker evidence |

---

## Cache invalidation (FOX only — post-approval; **not executed**)

Do **not** globally flush Production. After deploy approval, invalidate FOX scan/LP keys only. Transfer-index (`scan:xfer:*`) untouched.

| Key | Purpose |
|-----|---------|
| `scan:snapshot:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | Full scan snapshot (`lpIntelligence` + stages) |
| `scan:meta:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | Snapshot meta / TTL |
| `scan:lock:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | In-flight deep lock (optional) |
| `scan:lp:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | LP discovery inputs (poolIds union) |

Helper (print only by default):

```bash
npx tsx lib/hansome-score/_tmp-fox-dust-materiality-verify.ts --invalidate-print
# After deploy approval ONLY:
# npx tsx lib/hansome-score/_tmp-fox-dust-materiality-verify.ts --invalidate-exec
```

Local recompute (already run — PASS):

```bash
npx tsx lib/hansome-score/_tmp-fox-dust-materiality-verify.ts
```

Result: `discovered=2`, `material=1`, `dust=1`, `presentationPools=1`, labeled USD on FOX/ETH card, lock UNKNOWN.

---

## Regression results

| Suite | Result |
|-------|--------|
| `pool-materiality.test.ts` | PASS |
| `v3-pool-materiality-adapter.test.ts` | PASS |
| `lp-presentation.test.ts` (FOX / HANSOME / CASHCAT / PONS / TYGR) | PASS |
| `lp-multi-version.test.ts` | PASS |
| `lp-discovery-cache.test.ts` | PASS |
| `scan-deep-retry-race.test.ts` | PASS |
| `liquidity-coverage-model.test.ts` | PASS |
| `scan-cache.test.ts` / `lp-known-first` / `scan-deep-reliability` | PASS |
| `npm run typecheck` | PASS |
| Local FOX RPC verify script | PASS |
| `npm run build` | Not completed in this session (local `next build` hung with no compile output; killed — **not** a deploy). Typecheck + LP/presentation/cache tests green. |

Covered behaviours:

- 1 wei dust not material / not a card  
- `balanceOf` null → `inventory_unknown`, not presentation stub  
- Discovered 2 / material presentation 1 / labeled TVL on single card  
- Multi-material still no even USD split  
- No false ALL_LOCKED from synthetics + TVL  
- HANSOME MIXED / CASHCAT / PONS / TYGR presentation paths unchanged in intent  

---

## Freeze confirmation

- [x] No Score / Burn / LP lock semantics changes  
- [x] No aggregate TVL split across cards  
- [x] No infer lock from TVL / raw L  
- [x] No FOX-specific hardcodes in production adapters  
- [x] No V3 NPM enumeration  
- [x] Transfer-index untouched  
- [x] **NO Production invalidate executed**  
- [x] **NO deploy**  

---

## Gate

**PASS.** Ready for deploy approval + FOX-only cache invalidate + Production smoke.

**STOP.** Waiting for approval before any deploy or live KV delete.
