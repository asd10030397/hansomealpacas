# HANSOME — Phase 11F — Hook Position Valuer

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Scope** | Value Hook Native positions via StateView L + CLMM amounts + optional USD |
| **Score / Titan lock / Production tip** | **Unchanged** |
| **Candidate** | See parent `HANSOME_PHASE11FGH_HOOK_INTELLIGENCE_ENGINE.md` |
| **Verdict** | **PARTIAL_PASS_NOT_DEPLOYED** (parent) |

---

## 1. Implementation summary

| Path | Role |
|------|------|
| `lib/hansome-score/lp/hook-position-valuer/` | Types, CLMM valuation, aggregates, StateView port |
| Consumes | Phase 11E `HookPositionIndexState` |
| Forbidden | PoolManager ERC-20 balances; `StateView.getLiquidity` as total Hook L |

---

## 2. Valuation schema

`HookPositionValuation` per key: live L, amounts raw/normalized, optional USD, `valuationComplete` (amounts), `stateViewValidated`.

`HookPositionValuationSummary`: hook-owned / foreign USD buckets, `hookValuationComplete`, `priceDataComplete`, `valuedAtBlock`, `stale`.

---

## 3. GME live

| Field | Value |
|-------|--------|
| Positions valued | **8** (salts 0…7) |
| `hookValuationComplete` | **true** |
| Σ amount0 raw | `3301159541566026169624` |
| Σ amount1 raw | `4917906647880299175769354538` |
| USD | Incomplete (numeraire/token prices unavailable in driver) — amounts kept |
| Terminal | `SUCCESS_PARTIAL` (pricing) |

---

## 4. OKC live

Index incomplete → valuation incomplete; no inventory-based amounts.

---

## 5. Honesty

- Zero live L excluded from economic totals
- Missing price ≠ zero
- Active in-range L ≠ total Hook inventory
