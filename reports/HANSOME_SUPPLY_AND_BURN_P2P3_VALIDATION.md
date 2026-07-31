# HANSOME Scan — Supply & Burn Intelligence P2+P3 Validation

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | P2 (burn activity history) + P3 (historical supply reduction) |
| **Verdict** | **PASS** |
| **Deploy** | Not done (per request) |

---

## Verdict: PASS

P2/P3 meet the product rules:

- Burned 24H / 7D / 30D / all-time only when the transfer index covers that window
- Incomplete → **Unknown / Incomplete** (never silent partial-as-full)
- Only allowlisted dead/burn address inflows count
- Dead-address inventory ≠ proven `totalSupply` reduction
- P2/P3 informational only — no Structural / Overall boost
- Privileged/admin burn Contract Risk from P0/P1 unchanged
- Burn history cached under `scan:burn:*` (no forum/vault key collision)
- Shared Creator Behaviour transfer pages — no second full pagination on cold scan

---

## Completeness methodology

Blockscout token transfers are newest-first.

| Window | Complete when |
|--------|----------------|
| **24H / 7D / 30D** | `paginationComplete` **or** oldest indexed transfer timestamp ≤ window start |
| **All-time** | `paginationComplete` only (exhausted `next_page_params`) |
| **Any window** | Fetch failed with 0 pages → **unknown** |

If incomplete: amounts are `null` → UI **Unknown / Incomplete**. Partial sums are never shown as full window totals.

| Field | Reliability |
|-------|-------------|
| Last burn | Reliable when transfer **head** indexed (newest-first); none + all-time complete → “None observed”; none + incomplete → Unknown |
| Burn tx count | Only when all-time complete |
| Proven supply reduction | Burn-method `Transfer` **to zero address** only — never inferred from `0xdead` balances |
| Historical reduction status | `verified` / `partial` / `unknown` per evidence + completeness |

---

## Live Robinhood Chain samples (probe 2026-07-28)

| Token | Known Burned (P0) | Windows | Last burn | Proven reduction | Notes |
|-------|-------------------|---------|-----------|------------------|-------|
| **HANSOME** | 0% | All **complete**, 0 burned | None | Unknown | Clean baseline; full index ~22 pages |
| **PONS** | ~21.8% | All **incomplete** → Unknown/Incomplete | Observed in head | Unknown | High activity; 40-page cap |
| **TYGR** | ~7.0% | All **incomplete** → Unknown/Incomplete | — | Unknown | Same completeness honesty |

P3 stays Unknown on these samples (dead inventory / transfers without burn-method-to-zero proof).

---

## Latency impact (P2/P3 enrich)

P2/P3 run on the **same** transfer pages as Creator Behaviour.

| Sample | Shared transfer pages | P2/P3 enrich CPU | Extra vs prior path |
|--------|----------------------|------------------|---------------------|
| HANSOME | ~131s (22 pages) | **~11 ms** | Negligible |
| TYGR | ~231s (40 pages) | **~12 ms** | Negligible |

Cached `/scan` hits: burn history rides snapshot + optional `scan:burn:*` overlay (no re-pagination).

---

## Unit tests

`npm run test:scoring -- lib/hansome-score/__tests__/supply-burn.test.ts` → green (P0–P3 + window completeness + no score boost).

---

## Blind spots

1. High-activity tokens often hit the 40-page cap → windows stay Incomplete (correct).
2. P3 cannot prove reduction without burn-method-to-zero events / ABI path.
3. Incremental `scan:burn:*` head refresh updates recent inflows; deep genesis still gated by pagination budget.
4. Fast Scan path (separate work) may defer P2/P3 to deep phase — Incomplete until deep finishes.

---

## Explicit confirmations

- [x] No score boost from voluntary burns / burned %
- [x] Incomplete → Unknown / Incomplete
- [x] Performance MVP snapshot cache not removed
- [x] No production deploy
- [x] No Explore / Analytics / Just Launched
