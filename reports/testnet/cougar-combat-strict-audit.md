# Cougar Combat Strict Audit (Testnet QA)

Generated: 2026-07-19T17:00:00.000Z (approx)  
Scope: Testnet only. No emission / R0 / SettlementLib formula changes. Mainnet untouched.

## 1. Test configuration

| Item | Value |
|---|---|
| HansomeGame | `0x4752E3c8D885A14CEfF0b30aE10a243eCC05b450` |
| Chain | Robinhood Testnet `46630` |
| Day length | **120s** |
| Commit (Choose Location) | **60s** |
| Reveal / Battle Result | **60s** |
| Location | Grassland (`locationId=2`) |
| Live battles | **5** (gas-paying) |
| Offline sims | **1000 + 1000** (SettlementLibHarness, no txs) |

Artifacts:

- `reports/testnet/cougar-combat-live-5.json`
- `reports/testnet/cougar-combat-offline-1000.json`
- `reports/testnet/nft-identity-mapping-audit.json`

## 2. Tokens tested (live)

| Token | Species (settlement) | Class | Role |
|---:|---|---|---|
| #1 | Alpaca | King | Immune to hunt penalty |
| #11 | Alpaca | Common | Full π |
| #12 | Alpaca | Guardian | π/2 |
| #13 | Alpaca | Farmer | Full π + weight ×1.2 |
| #14 | Alpaca | Lucky | Bernoulli escape |
| #15 | Alpaca | Runner | Bernoulli escape |
| #16 | Cougar | None | Rc + Rh when Ad≥1 |

All seven committed + revealed to **Grassland** each live day.

## 3. GDS hunting model (important)

SettlementLib does **not** zero Alpaca rewards on a “kill”.

When Cougars are present at a huntable location:

1. Alpaca shares of \(R_d^A\) are computed from weights.  
2. A location penalty \(\pi\) (bps) is applied → net = gross × (1 − π/10000).  
3. Penalty mass returns to **treasury** (`pen`), not to Cougar wallets.  
4. Cougars receive \(R_d^C\) equal-split + \(R_d^H\) when `Ad(location) ≥ 1` (deterministic — **no separate hunt RNG**).  
5. Runner / Lucky use day-seed Bernoulli only to **zero their own π**.

So “Alpacas still received rewards with Cougars present” is **expected** — they receive **reduced** nets, not survival-full nets.

Grassland with Ad=6, Cd=1 → \(\pi_0=1500\), \(\pi = 1500 × (6+1)/(6+1) = 1500\) bps (**15%**).

## 4. Live battle results (5 days)

All five days: `ok=true`, `adL=6`, `cdL=1`, `prePenaltyBps=1500`, resolve succeeded, **bugs: none**.

Claimable was **not claimed between days**, so totals accumulate. Per-day delta is constant:

| Role | Approx reward / day (HANSOME) | Notes |
|---|---:|---|
| King | 10,322.58 | 0% penalty |
| Common | 8,774.19 | 15% penalty → **Common < King** ✓ |
| Cougar | 16,000.00 | Rc + Rh for the day’s pool |

Ratio Common/King ≈ **0.85** (= 1 − 0.15) — proves hunt pressure applied on-chain.

Sample day 4 (first row in suite after redeploy cadence):

| Token | Species | Class | Hunted pressure | Penalty bps | Outcome | Reward (cumulative read) |
|---:|---|---|---|---:|---|---:|
| #1 | Alpaca | King | yes | 0 | Survived (King immune) | 10322.58 |
| #11 | Alpaca | Common | yes | 1500 | Hunted — penalty | 8774.19 |
| #16 | Cougar | — | — | 0 | Hunt success (Rh eligible) | 16000.00 |

Full per-token logs: see `cougar-combat-live-5.json`.

## 5. Offline simulations (1000 × 2 cases)

Harness: `SettlementLibHarness.settle` · Rd = 100,000 HANSOME · Grassland.

### Case A — 1 Cougar vs 6 Alpacas (1000 battles)

| Metric | Value |
|---|---|
| Pre-penalty | 1500 bps |
| Hunt pressure | 100% when Cd≥1 (deterministic) |
| Escape/immune rate | ~25% (King always + Runner/Lucky RNG) |
| Avg Alpaca reward | ~11,978 |
| Avg Cougar reward | **20,000** (= Rc 10k + Rh 10k) |
| Avg pen / battle | ~8,129 |
| Control (0 Cougars) | pen = 0, Alpaca total = 80,000 (full Ra) |

By class (avg net): King 12903 > Guardian 11935 > Runner ~11575 > Lucky ~11328 > Common 10968; Farmer 13161 (weight boost despite full π).

### Case B — 3 Cougars vs 6 Alpacas (1000 battles)

| Metric | Value |
|---|---|
| Pre-penalty | 1928 bps |
| Avg Alpaca reward | ~11,578 (lower than 1-cougar case) |
| Avg Cougar reward | ~6,666.67 (Rc+Rh split 3 ways) |
| Avg pen / battle | ~10,531 |

**Conclusion:** More Cougars → higher Alpaca penalty mass, lower per-Cougar hunt payout. Matches GDS.

## 6. NFT identity mapping audit

### Root cause of “#29 Common showed Cougar image”

On Testnet before collection reveal:

1. **Settlement / gameplay identity** uses FY Testnet deck (`testnetAssigned540`) when unrevealed.  
2. **Pinata metadata** for sale IDs is still the production packaging map and **can disagree** on Side.

| Token | Deck (settlement) | Metadata | Issue |
|---:|---|---|---|
| #16 | **Cougar** | Alpaca Common + alpaca art | Settlement Cougar, art Alpaca |
| #29 | **Alpaca Common** | **Cougar** + cougar-packaged art | Settlement Alpaca, art Cougar |

Also: UI previously fell back to `/pixel/cougar/mint/image/cougar.png` whenever metadata image was missing — unsafe for Alpacas.

### Fix applied (presentation only)

`hooks/game/useOwnedGenesisNfts.ts`:

- Side-aware image fallback (Alpaca vs Cougar).  
- Reject metadata image when metadata Side ≠ settlement Side (deck/on-chain).

Settlement math unchanged.

## 7. Bugs found

| ID | Severity | Status |
|---|---|---|
| Hunt “not applying” perception | Clarification | **Not a SettlementLib bug** — penalty model, not kill-to-zero |
| Live on-chain hunt pressure | — | **Verified OK** (Common < King by ~15%) |
| #29 / #16 art vs species mismatch | High (UX) | **Fixed** in owned-NFT image resolver |
| Metadata ↔ Testnet deck Side drift | High (UX) | Documented; image gated on Side agreement |

## 8. Recommendations

1. Keep Testnet deck as settlement source of truth until Genesis reveal.  
2. Prefer side-gated art (done) or generate Testnet-specific metadata images for densified IDs #11–#16.  
3. In Battle Result copy, say **“Hunted — penalty applied (−X%)”** instead of implying 0 reward.  
4. Restore longer Testnet timers after this QA (current deploy is 60s+60s for speed).  
5. Do **not** change SettlementLib / emission for this finding.

## 9. Pipeline checklist

| Step | Result |
|---|---|
| A. Participant load (id/species/class/location) | Pass (live + deck) |
| B. Cougar included + Rh when Ad≥1 | Pass |
| C. Alpaca outcomes / abilities | Pass (King/Guardian/Runner/Lucky/Farmer paths) |
| D. Reward correctness vs GDS | Pass (penalty + Cougar Rc/Rh) |
| Offline 1000 sims | Pass |
| Live 5 battles | Pass (0 bugs) |
