# Location Reward Audit (Testnet QA)

> **Update 2026-07-20:** Candidate A π₀ is live (`0/1500/2500/3500/4500` bps = 0/15/25/35/45%).  
> Tables below are a historical snapshot of the legacy 10–30% ladder. See  
> `reports/economics/candidate-a-implementation.md` and re-run  
> `scripts/audit-location-rewards.ts` for a fresh report.

Generated: 2026-07-19T15:56:36.749Z  
Source of truth: `SettlementLib.sol` / GDS v1.1.  
Harness: `SettlementLibHarness` (local Hardhat deploy — not a chain write).

## Current location configuration

| Location | Weight \(w\) | Risk (UI label) | π₀ (bps) | UI pressure (demo) | Cougar allowed |
|---|---:|---|---:|---:|:---:|
| Home | 1 | None | 0 | 0 | No |
| Mountain | 2 | Low | 1000 | 22 | Yes |
| Grassland | 3 | Medium | 1500 | 41 | Yes |
| Forest | 5 | High | 2200 | 63 | Yes |
| River | 8 | Extreme | 3000 | 88 | Yes |

Frontend catalog: `data/game/locations.ts` (weights match contract).  
On-chain: `SettlementLib.locationWeight` / `pi0Bps`.

## Reward formulas (GDS / SettlementLib)

Daily pool split: Ra = 80% Rd, Rc = 10% Rd, Rh = 10% Rd.

Alpaca effective weight (Common): ω = w(L) × 100.

Gross (before hunt): G = Ra × ω / Ω (last alpaca receives remainder for conservation).

Hunt pre-penalty (bps): π_pre = min(5000, π₀(L) × (Ad + Cd) / (Ad + 1)).  
Home or Cd=0 → π=0. Common net = G × (1 − π/10000).

Example Rd used below: **100,000 HANSOME**  
→ Ra = 80000.0, Rc = 10000.0, Rh = 10000.0, dust = 0.0  
Five-way Ω = 1900 (weights ×100: 100 + 200 + 300 + 500 + 800).

## Summary table

| Location | Weight | Risk | Pressure (UI) | Reward Multiplier | Example Reward (five Commons, no hunt) |
|---|---:|---|---:|---|---:|
| Home | 1 | None | 0 | w=1 → 5.26% of Ra (five-way) | 4210.52631578947368421 HANSOME |
| Mountain | 2 | Low | 22 | w=2 → 10.53% of Ra (five-way) | 8421.052631578947368421 HANSOME |
| Grassland | 3 | Medium | 41 | w=3 → 15.79% of Ra (five-way) | 12631.578947368421052631 HANSOME |
| Forest | 5 | High | 63 | w=5 → 26.32% of Ra (five-way) | 21052.631578947368421052 HANSOME |
| River | 8 | Extreme | 88 | w=8 → 42.11% of Ra (five-way) | 33684.210526315789473686 HANSOME |

## Simulation results (same NFT / traits / conditions)

**Fixed player:** Common Alpaca, Runner/Lucky fail flags unused.

### A — Five Commons, one per location, no Cougars

Weight is the only differentiator. Higher w → higher share of Ra; Home still earns (safe but small).

| Location | Gross ≈ | Net (no hunt) |
|---|---:|---:|
| Home | 4210.52631578947368421 | 4210.52631578947368421 |
| Mountain | 8421.052631578947368421 | 8421.052631578947368421 |
| Grassland | 12631.578947368421052631 | 12631.578947368421052631 |
| Forest | 21052.631578947368421052 | 21052.631578947368421052 |
| River | 33684.210526315789473684 | 33684.210526315789473686 |

Player total A = 80000.0 (should ≈ Ra; Rc+Rh unallocated).

### B — Same five Commons + one Cougar at each of Mountain–River

Home stays unhunted. Hunt locations take π with Ad=1, Cd=1 → π = π₀ × (1+1)/(1+1) = π₀.

| Location | π (bps) | Net |
|---|---:|---:|
| Home | 0 | 4210.52631578947368421 |
| Mountain | 1000 | 7578.947368421052631579 |
| Grassland | 1500 | 10736.842105263157894737 |
| Forest | 2200 | 16421.052631578947368421 |
| River | 3000 | 23578.947368421052631581 |

### C — Sole Common at location (no Cougars)

Weight irrelevant when alone — every location yields full Ra.

| Location | Net |
|---|---:|
| Home | 80000.0 |
| Mountain | 80000.0 |
| Grassland | 80000.0 |
| Forest | 80000.0 |
| River | 80000.0 |

### D — Sole Common + one Cougar at same location (Home: no cougar)

| Location | pre π (bps) | Net |
|---|---:|---:|
| Home | 0 | 80000.0 |
| Mountain | 1000 | 72000.0 |
| Grassland | 1500 | 68000.0 |
| Forest | 2200 | 62400.0 |
| River | 3000 | 56000.0 |

## Verification checklist

| Check | Result |
|---|---|
| Weights 1/2/3/5/8 | PASS |
| π₀ 0/1000/1500/2200/3000 | PASS |
| Higher risk → higher π₀ / hunted penalty | PASS |
| Home π=0 always | PASS |
| Alone no-hunt: all locs = Ra | PASS |
| Five-way nets increase with weight | PASS |
| Frontend weights match contract | PASS (both 1/2/3/5/8) |

## Inconsistencies / notes

- NOTE (not a bug): UI `pressure` in data/game/locations.ts (0/22/41/63/88) is presentation-only and is NOT the on-chain π₀ (0/1000/1500/2200/3000 bps).

## Recommended balancing changes

**None for on-chain math** — weights, π₀, and 80/10/10 split match GDS v1.1 and `SettlementLib`.

Optional UX (non-economic):

1. Label UI pressure as “risk meter (visual)” so players do not confuse it with π₀ bps.
2. In Explore copy, stress that **alone at any location** earns the same Ra; weight only matters when competing alpacas split the Alpaca Pool.
3. Keep Home as the safe low-weight lane — current incentives (small share, zero hunt) are intentional.

## Timer note (separate from rewards)

Testnet day length for manual QA is configured independently (Commit + Reveal). This audit does not modify emission, R0, or SettlementLib.

At audit time (2026-07-19):

| Field | Value |
|---|---|
| HansomeGame (Testnet) | `0x00ba30dFf570367136471aF8F9EF910BB0C81B60` |
| Day length | 600s (10m) |
| Commit (Choose Location) | 300s (5m) |
| Reveal (Battle Result viewing) | 300s (5m) |
| Mainnet timings | unchanged (20h + 4h) |
