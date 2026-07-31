# HANSOME — PR1 Multi-pool Liquidity Presentation + Dust Handling

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Presentation + dust materiality only |
| **Verdict** | **PASS** |
| **Deploy** | **NO** |

Token reference: FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` (diagnosis only — no FOX hardcodes).

---

## Summary

| Requirement | Result |
|-------------|--------|
| Multi-pool must not show all unavailable when aggregate TVL known | **PASS** — `sectionLiquidityTotals` surfaces labeled aggregate at section level |
| Prefer aggregate and/or per-pool only where reliable | **PASS** — per-pool USD only when exactly one presentation pool |
| Do NOT split aggregate evenly across pools | **PASS** — multi-pool cards keep `liquidityUsd=null` |
| Generic dust/materiality threshold | **PASS** — `MIN_MATERIAL_POOL_TOKEN_BALANCE = 1000` (inventory wei), not address-based |
| 1 wei pools filtered | **PASS** — v2/v3 adapters skip non-material inventory |
| Do not infer lock from pool TVL / raw L | **PASS** — lock path unchanged; synthetic → UNKNOWN |
| Lock Unknown without Position NFT/locker evidence | **PASS** |

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/lp/pool-materiality.ts` | **New** — generic inventory materiality helper |
| `lib/hansome-score/lp/adapters/v3.ts` | Skip empty + dust inventories |
| `lib/hansome-score/lp/adapters/v2.ts` | Same materiality gate |
| `lib/hansome-score/lp/presentation.ts` | Single-pool USD attribution; `sectionLiquidityTotals` |
| `components/scan/ScanClient.tsx` | Multi-pool section aggregate banner; avoid duplicate bottom totals |
| `lib/hansome-score/__tests__/pool-materiality.test.ts` | **New** |
| `lib/hansome-score/__tests__/lp-presentation.test.ts` | FOX / HANSOME / CATE-PONS-CASHCAT cases |

---

## Before / after (FOX UI mapping)

| Surface | Before | After (dust filtered → 1 material pool) | After (if 2 material pools remain) |
|---------|--------|------------------------------------------|-------------------------------------|
| Pool count | 2 (WETH + 1-wei USDG) | 1 material (FOX/WETH) | 2 |
| Per-pool Pool Liquidity | Unavailable / Unavailable | **~$96.4k** on main card | Unavailable / Unavailable (honest) |
| Section liquidity | Hidden (no comparable per-pool USD) | N/A (single-card path) | **Labeled aggregate ~$96.4k** above list |
| Lock Status | Unknown | Unknown | Unknown |
| Lock % / ALL_LOCKED | Not claimed | Not claimed | Not claimed |

API fields (unchanged semantics):

- `liquidityUsd` / Gecko labeled TVL → presentation only
- `lp.aggregateState` stays `UNKNOWN_INCOMPLETE` without verified Position NFT locks
- `lockDistribution.available` remains false for synthetic stubs

---

## Tests

```
vitest run lib/hansome-score/__tests__/lp-presentation.test.ts \
           lib/hansome-score/__tests__/pool-materiality.test.ts
→ 12 passed
```

Covered:

- FOX main pool meaningful liq after dust filter
- Dust 1 wei filtered by materiality
- Multi-pool: no even USD split; section labeled aggregate
- No false LOCKED / ALL_LOCKED from TVL + synthetic stubs
- HANSOME single MIXED no regress
- CATE-like single unknown + USD
- PONS/CASHCAT-style multi without labeled TVL stays unavailable

---

## Freeze confirmation

- [x] No Score / Burn / LP lock semantics changes
- [x] No risk threshold changes
- [x] No Unknown/Partial honesty weakenings
- [x] No timeout inflation
- [x] No FOX-specific hardcodes
- [x] No V3 NPM enumeration
- [x] **NO deploy**

---

## Gate

**PR1 = PASS.** Proceed to PR2 (Transfer Index Progress Checkpointing).
