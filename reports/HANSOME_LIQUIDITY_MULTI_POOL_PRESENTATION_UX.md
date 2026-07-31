# HANSOME — Multi-Pool Liquidity Presentation UX

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Presentation copy / state only — replace misleading “Unavailable” when total TVL is known |
| **Deploy** | **YES** — Production `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` (see `HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX_PRODUCTION_SMOKE.md`) |
| **Scoring / Lock / Liquidity math** | **Unchanged** |

Related:

- `reports/HANSOME_FOX_POOL_CARD_LIQUIDITY_UNAVAILABLE_DX.md`
- `reports/HANSOME_PR1_MULTI_POOL_LIQUIDITY_PRESENTATION.md` (if present)
- Design (item 3, not implemented): `reports/HANSOME_LIQUIDITY_PRESENTATION_USD_MATERIALITY_DESIGN.md`

---

## Problem

When multiple material presentation pools exist, PR1 correctly **withholds per-card USD** (never splits labeled aggregate). Cards previously rendered:

> Pool Liquidity: **Unavailable**

…even when the section banner already showed a known Total Liquidity. That read as a data failure, not an intentional attribution rule.

---

## What changed

| Surface | Before | After |
|---------|--------|-------|
| Multi-pool card, total known, per-pool null | `Pool Liquidity: Unavailable` | `Pool Liquidity: Included in Total Liquidity` + subtitle + info tooltip |
| Multi-pool card, total unknown | `Unavailable` | **Unchanged** (`Unavailable`) |
| Single-pool card with labeled USD | Shows USD | **Unchanged** |
| Section aggregate banner | Shows total | **Unchanged** |
| Scoring / lock detection / USD calc | — | **No changes** |

### When the new copy appears

All of the following must be true (helper `isPerPoolLiquidityAttributionWithheld`):

1. Presentation pool count **> 1**
2. Section `totalLiquidityUsd` is known (`> 0`, finite) — usually labeled aggregate
3. That card’s `liquidityUsd` is null (attribution withheld)

Otherwise the card keeps the prior path (`formatUsdLiquidity` or `Unavailable`).

---

## Copy (i18n)

| Key | EN | ZH |
|-----|----|----|
| `poolLiquidityIncludedInTotal` | Included in Total Liquidity | 已包含於總流動性 |
| `poolLiquidityIncludedInTotalSubtitle` | Liquidity is distributed across multiple detected pools. | 流動性分布於多個流動池，因此無法可靠分配至單一池。 |
| `poolLiquidityIncludedInTotalTooltip` | Total liquidity is known, but HANSOME does not assign that total to any single pool when multiple material pools are detected — splitting the aggregate would be misleading. | 總流動性已知，但偵測到多個實質流動池時，HANSOME 不會將總額分配至任一單一池，以免造成誤導。 |

Tooltip uses the existing scan UI pattern: small circular `i` button with native `title` / `aria-label` (same as Uniswap capability / HANSOME Level info).

---

## Files touched

| File | Change |
|------|--------|
| `lib/hansome-score/lp/presentation.ts` | Add `isPerPoolLiquidityAttributionWithheld` (presentation-only predicate) |
| `components/scan/ScanClient.tsx` | Multi-pool card branch: new copy + tooltip when withheld |
| `content/i18n/types.ts` | New scan string keys |
| `content/i18n/en.ts` | EN copy |
| `content/i18n/zh.ts` | ZH copy |
| `lib/hansome-score/__tests__/lp-presentation.test.ts` | Assert withheld true (FOX multi + labeled TVL) / false (no labeled TVL) |

---

## Verification

| Check | Result |
|-------|--------|
| `vitest` `lp-presentation.test.ts` | **PASS** (10/10) |
| `tsc --noEmit` | **PASS** |
| Scoring weights / lock adapters / materiality classifier | **Not modified** |

---

## Confirmation

- **No scoring changes**
- **No lock detection changes**
- **No liquidity calculation changes**
- **No USD materiality threshold implemented** (design-only report separate)
- **Deployed** to Production after gates + smoke — see `reports/HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX_PRODUCTION_SMOKE.md`
