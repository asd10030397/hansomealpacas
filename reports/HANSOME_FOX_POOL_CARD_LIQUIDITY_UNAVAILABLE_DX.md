# HANSOME — FOX Pool Card Liquidity “Unavailable” Diagnosis

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Diagnose only — Production FOX Liquidity section aggregate OK, per-pool cards “Unavailable” |
| **Token** | FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| **Production** | https://www.hansomealpacas.xyz |
| **Code / deploy** | **NONE** (this task) |
| **Verdict** | **Expected multi-pool presentation path** — not a wrong frontend field; not missing aggregate TVL |

Artifacts:

- Live payload capture: `reports/_tmp-fox-pool-card-dx-scan.json` (and refresh `…-scan2.json`)
- Related: `reports/HANSOME_PR1_MULTI_POOL_LIQUIDITY_PRESENTATION.md`, `reports/HANSOME_PR1_PR2_PR3_PRODUCTION_SMOKE.md`

---

## Answers (verify checklist)

| # | Question | Answer |
|---|----------|--------|
| 1 | Does Production `/api/scan` return `poolLiquidityUsd` (or equivalent) for FOX/WETH? | **Yes at token level** — `liquidityUsd ≈ $97,017` and `lp.lockDistribution.poolLiquidityUsd ≈ $95,520`. **No per-pool USD** on either synthetic position (`valueUsd: null`). API does **not** return a `presentationPools[]` array. |
| 2 | Is the Pool Card still rendering an old field? | **No.** Cards use client-built `pool.liquidityUsd` from `buildPresentationPools` → `formatUsdLiquidity(...) ?? liquidityUnavailable`. Not `valueUsd` / not raw `lockDistribution.poolLiquidityUsd`. |
| 3 | Is the aggregate header using different data than the pool cards? | **Yes (by design).** Header = `sectionLiquidityTotals({ labeledLiquidityUsd: result.liquidityUsd })` → source `labeled_aggregate`. Cards = each `pool.liquidityUsd`, which is forced `null` when presentation pool count ≠ 1. |
| 4 | Expected by design, or regression from PR1? | **Expected for the multi-pool honesty path PR1 defined.** Hoped PR1 outcome for FOX was dust-filter → **1** material card with ~$96k; Production still surfaces **2** presentation pools, so the “Unavailable / Unavailable + section aggregate” branch wins. That branch is intentional, not a field-mapping regression. |
| 5 | If main FOX/WETH liquidity can be determined, why is the card still “Unavailable”? | Token-level Gecko/labeled TVL is known, but PR1 **refuses to attribute** that aggregate onto any card when **≥2** presentation pools exist (no even split). Main FOX/WETH therefore stays Unavailable on the card even though the section banner shows ~$97k. |

---

## Root cause (one verdict)

**Production FOX still has two synthetic v3 presentation pools, so PR1 multi-pool rules null out every card’s `liquidityUsd` while the section banner honestly shows labeled aggregate TVL from `result.liquidityUsd`.**

This is **not** “frontend reading the wrong JSON key.” It is the designed multi-pool presentation path. A secondary gap explains why FOX did not take the single-pool happy path: the FOX/USDG pool is still **1 wei** on-chain (below `MIN_MATERIAL_POOL_TOKEN_BALANCE = 1000`) yet Production LP intelligence still reports `poolsFound: 2` / two `v3-pool:…` stubs — so dust collapse did not activate for this scan payload.

---

## Exact Production API snippets

Captured from `GET https://www.hansomealpacas.xyz/api/scan?address=0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` (HTTP 200).

Cache on refresh sample: `X-Scan-Cache: memory`, `cache.hit=true`, `fullScoreTtlSec=900`, `analysisStages.liquidity=done`.

### Aggregate / labeled TVL

```json
{
  "liquidityUsd": 97017.1804,
  "overview": {
    "symbol": "FOX",
    "address": "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1",
    "lpIntelligence": {
      "poolsDetectedCount": 2,
      "aggregateState": "UNKNOWN_INCOMPLETE",
      "lockDistribution": {
        "available": false,
        "poolLiquidityUsd": 95520.1811,
        "lockedUsd": null,
        "unlockedUsd": null,
        "reason": "Lock percentage unavailable — could not derive reliable current token amounts / USD value for discovered positions (raw L is never used)."
      }
    }
  }
}
```

### Presentation pools (API positions — synthetic stubs)

```json
{
  "positionCounts": {
    "detected": 2,
    "material": 2,
    "locked": 0,
    "unlocked": 0,
    "unknown": 2
  },
  "uniswapVersions": {
    "byVersion": {
      "v3": {
        "poolsFound": 2,
        "positionsFound": 2,
        "detail": "v3: 2 pool(s) via factory.getPool — position NFT/locker analysis incomplete."
      }
    }
  },
  "positions": [
    {
      "positionNftId": "v3-pool:0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685:10000",
      "poolId": "0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685",
      "currency0": "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1",
      "currency1": "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
      "fee": 10000,
      "liquidity": "1",
      "valueUsd": null,
      "amount0Raw": null,
      "amount1Raw": null,
      "lockState": "UNABLE_TO_DETERMINE",
      "dataSource": "uniswap_v3_factory.getPool — NPM position/locker enumeration incomplete"
    },
    {
      "positionNftId": "v3-pool:0x765657607a7e1a0D822513c0233F2fEE793D6ed0:500",
      "poolId": "0x765657607a7e1a0D822513c0233F2fEE793D6ed0",
      "currency0": "0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1",
      "currency1": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      "fee": 500,
      "liquidity": "1",
      "valueUsd": null,
      "amount0Raw": null,
      "amount1Raw": null,
      "lockState": "UNABLE_TO_DETERMINE",
      "dataSource": "uniswap_v3_factory.getPool — NPM position/locker enumeration incomplete"
    }
  ]
}
```

Pair mapping (from `RH_QUOTE_TOKENS`):

| Pool | Quote | Label (UI) |
|------|-------|------------|
| `0x9C49…8685` fee 10000 | WETH `0x0Bd7…AD73` | FOX / ETH |
| `0x7656…6ed0` fee 500 | USDG `0x5fc5…d168` | FOX / USDG |

### On-chain inventory check (live RPC, diagnose only)

| Pool | FOX `balanceOf(pool)` | Material gate (≥ 1000 raw)? |
|------|------------------------|-----------------------------|
| FOX/WETH `0x9C49…` | `69698871398667624951837075` (~6.97e7 FOX) | **Yes** |
| FOX/USDG `0x7656…` | `1` (1 wei) | **No** |

So the USDG stub is economically dust. A successful materiality filter on a fresh v3 probe should drop it and leave **one** presentation pool — which would attach labeled TVL to that card. Production’s LP payload still has **two** stubs, so the UI never enters that path.

Likely reasons the dust stub still appears (secondary; not required for the card-Unavailable explanation):

1. `isMaterialPoolInventory(null) === true` — if `balanceOf` throws during the scan, the dust pool is kept.
2. Complete scan snapshot cache (`fullScoreTtlSec=900`, `X-Scan-Cache: memory`) can keep serving a 2-pool `lpIntelligence` once computed.
3. LP discovery cache **unions** `poolIds` across runs (does not by itself rehydrate synthetic cards; v3 adapter still owns stub emission).

---

## Frontend field mapping

Presentation is **client-side only**. API → `ScanClient` → `LiquiditySection`.

| UI surface | Component | JSON / derived path |
|------------|-----------|---------------------|
| Section Aggregate “Pool Liquidity” (~$97k banner) | `LiquiditySection` multi-pool branch | `result.liquidityUsd` → `sectionLiquidityTotals({ pools, labeledLiquidityUsd })` → `totals.totalLiquidityUsd` when `source === "labeled_aggregate"` |
| Per-pool “Pool Liquidity: …” | Same, each `<li>` card | `buildPresentationPools({ lp: overview.lpIntelligence, liquidityUsd: result.liquidityUsd })[i].liquidityUsd` → `formatUsdLiquidity` or `s.liquidityUnavailable` (“Unavailable”) |
| Single-pool card path (not used for FOX today) | Same, `single` branch | `pools[0].liquidityUsd` (only set when presentation count === 1) |
| Lock Distribution USD (HANSOME-style; FOX unavailable) | Lock Dist block | `lp.lockDistribution.lockedUsd` / `unlockedUsd` (FOX: `available=false`) |
| Labeled pool TVL (not shown as card USD when multi) | Used only as section labeled aggregate input | `result.liquidityUsd` and (separately stored) `lp.lockDistribution.poolLiquidityUsd` |
| Position economic value | Not used for pool card liquidity line | `position.valueUsd` (always `null` on FOX synthetic stubs) |

Key code paths:

```1114:1125:components/scan/ScanClient.tsx
  const pools = buildPresentationPools({
    lp,
    tokenSymbol,
    tokenAddress,
    liquidityUsd,
  });
  // ...
  const totals = sectionLiquidityTotals({
    pools,
    labeledLiquidityUsd: liquidityUsd,
  });
```

```157:193:lib/hansome-score/lp/presentation.ts
  // Attribute labeled TVL to a pool card only when presentation has exactly one pool.
  const presentationPoolCount = byPool.size;
  const reliableSinglePoolUsd =
    presentationPoolCount === 1 &&
    liquidityUsd != null &&
    Number.isFinite(liquidityUsd) &&
    liquidityUsd > 0
      ? liquidityUsd
      : null;
  // ...
      liquidityUsd: reliableSinglePoolUsd,
```

```1338:1382:components/scan/ScanClient.tsx
      ) : pools.length > 1 ? (
        // section banner from totals.totalLiquidityUsd
        // cards: formatUsdLiquidity(pool.liquidityUsd) ?? s.liquidityUnavailable
```

Call site wiring:

```2628:2632:components/scan/ScanClient.tsx
      <LiquiditySection
        lp={overview.lpIntelligence}
        // ...
        liquidityUsd={result.liquidityUsd ?? null}
```

---

## PR1 design vs Production observation

| Path | PR1 intent | Production FOX |
|------|------------|----------------|
| Dust filtered → 1 material pool | Attach ~$96k on the **main card** | **Not taken** — still 2 synthetic pools in API |
| 2+ material presentation pools | Cards **Unavailable**; section **labeled aggregate** | **Taken** — matches user report (~$97k header, both cards Unavailable) |
| Even split of aggregate onto cards | Forbidden | Correctly not done |
| Lock Unknown without NPM / locker evidence | Keep Unknown | `UNKNOWN_INCOMPLETE` / cards Unknown |

Smoke caveat already noted raw `poolsDetectedCount=2` with presentation-layer dust handling; live evidence shows dust collapse **did not** reduce FOX to one presentation pool in the served payload, so users see the honest multi-pool Unavailable cards.

---

## What this is / is not

| Claim | Verdict |
|-------|---------|
| Missing Production TVL | **No** — `liquidityUsd` / `poolLiquidityUsd` present |
| Frontend stale field (`valueUsd` etc.) | **No** — correct `pool.liquidityUsd` presentation field |
| Aggregate vs cards different sources | **Yes** — labeled aggregate vs per-pool reliable USD |
| Lock / scoring regression | **No** — lock still Unknown; raw L unused |
| Card Unavailable despite known main-pool TVL | **Yes, by multi-pool attribution rule** |
| Dust filter fully effective on this FOX payload | **No** — 1-wei USDG pool still present as a card |

---

## Confirmations

- [x] **NO code changes** in this task  
- [x] **NO deploy** in this task  
- [x] Diagnosis written to `reports/HANSOME_FOX_POOL_CARD_LIQUIDITY_UNAVAILABLE_DX.md`

---

## Optional follow-ups (out of scope — not implemented)

1. Ensure dust materiality always drops 1-wei pools even when `balanceOf` fails (or re-check inventory before emitting synthetic stubs).  
2. After a successful 1-pool presentation, FOX main card would show labeled ~$97k without changing lock semantics.  
3. Do **not** split aggregate TVL evenly across multi-pool cards (PR1 freeze).  
4. Bust / recompute FOX scan snapshot after dust fix so `X-Scan-Cache` does not keep a 2-pool `lpIntelligence`.
