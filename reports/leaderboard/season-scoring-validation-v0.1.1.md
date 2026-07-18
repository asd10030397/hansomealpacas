# Season Scoring Validation Report v0.1.1

| Field | Value |
|------|------|
| Spec | `docs/HANSOME_Season_Scoring_Spec_v0.1.1.md` |
| Prior | v0.1 — APPROVE WITH CHANGES |
| GDS | v1.1 |
| Simulation | ~1,800 days loc stats · 90-day strategy & wallet cohorts |
| Date | 2026-07-19 |

**No production scoring code. No contracts / deploy / IPFS.**

---

## 1. Verdict

# APPROVE

Pending your explicit sign-off.

All three locked changes are implemented in the spec and validated:

1. Wallet = mean of ≤ **K=3** actives (tokenId order; not sum / not best-K)  
2. SeasonScore = mean over full **L=90** with **zeros** on inactive days  
3. River dominance resolved by **within-location percentile** (not a River nerf)

---

## 2. Locked assumptions (confirmed in sims)

| Rule | Result |
|------|--------|
| Mean ≤ K actives | Used for all wallet seasons below |
| Full-season zeros | Skip-bad-days ratio **0.63–0.84** (skipping **hurts**) |
| Not best-K / not sum | Enforced in harness |

---

## 3. River balancing — candidates compared

### 3.1 Problem under v0.1 (global net metric)

| Location | E[daily \(S\)] | Top-decile rate |
|------|------|------|
| Home | 14.7 | 0% |
| Mountain | 37.6 | 0% |
| Grassland | 54.6 | 0% |
| Forest | 71.7 | ~0.7% |
| River | **89.7** | **~34%** |

Always-River season mean ≈ **85** vs Always-Home ≈ **14** → River is an always-optimal Season strategy.

Location-median **residual** of net did **not** fix this (River E still ≈ 89): residuals stay ordered with weight because within-River variance does not erase cross-location level effects after a second global percentile.

### 3.2 Chosen solution: within-location percentile

Score each Alpaca only against peers at the **same location** that day (midrank percentile of risk-adjusted net).

| Location | E[daily \(S\)] | Top-decile rate |
|------|------|------|
| Home | **50.0** | ~1.0% |
| Mountain | **50.0** | ~2.8% |
| Grassland | **50.0** | ~2.7% |
| Forest | **50.0** | ~2.7% |
| River | **50.0** | ~2.7% |

**Pure strategies (90-day season, full-L zeros, eligible only):**

| Strategy | Season mean (withinLoc) | vs v0.1 |
|------|------|------|
| Always River | **47.6** | was 85.2 |
| Always Home | **47.4** | was 13.9 |
| Mixed locations | 44.9 | — |
| High-risk mix | 45.0 | — |

Always-River ≈ Always-Home. Neither location label dominates Season Points.

**Interpretation:** Season board rewards beating peers who chose the same tile (execution / traits / micro-congestion). Location still matters for **Earnings** (GDS economics unchanged). This is decision-quality scoring, not a weight nerf.

---

## 4. NFT-count ratios (withinLoc + mean≤K + full-L zeros)

| Bucket | Mean SeasonScore | Ratio to 1 NFT |
|------|------|------|
| 1 NFT | ~40.6 | 1.00× |
| 3 NFT | ~49.6 | ~1.22× |
| 6 NFT | ~50.0 | ~1.23× |

**Note:** Residual ~1.2× is **attendance insurance** (more NFTs → fewer all-zero days under full-L averaging), not linear pay-to-rank. Summing is gone. Accepted for v0.1.1; monitor on testnet.

---

## 5. Skip-bad-days (withinLoc)

| Mode | Mean | Ratio skip/full |
|------|------|------|
| Play through | ~44.9 | 1.00 |
| Zero out bottom ~40% active days | ~28.2 | **0.63** |

Skipping hurts. Locked full-season denominator works.

---

## 6. Side balance

Alpaca and Cougar daily scores remain separate ladders (means ≈ 50 within each role’s percentile). No raw cross-role comparison.

---

## 7. Parameter table (v0.1.1)

| Param | Value | Status |
|------|------|------|
| K | 3 | Locked |
| Over-cap rule | Lowest tokenIds | Locked |
| L | 90 | Locked |
| Inactive day | 0 | Locked |
| D_min (listing) | 25 | Locked |
| Alpaca daily method | Within-location midrank percentile | Locked (this revision) |
| μ (under-hunt within loc) | 0.55 | Starting |
| Cougar η | 0.15 | Starting |
| n_min | 5 | Locked |

---

## 8. Confidence

| Claim | Confidence |
|------|------|
| River label dominance removed | **High** |
| Home not Season-dominant | **High** |
| Full-L zeros stop skip exploits | **High** |
| mean≤K stops linear NFT stacking | **High** |
| ~1.2× multi-NFT attendance residual | **Medium** — acceptable watch item |
| Live-meta stability of within-loc n_min | **Medium** — re-check on testnet |

---

## 9. Gate

| Decision | Meaning |
|------|------|
| **APPROVE** | Recommended — implement production scoring only after your sign-off |
| APPROVE WITH CHANGES | Not required for River; optional later work on attendance residual |
| REJECT | Not recommended |

**Report recommendation: APPROVE**

Waiting for your explicit approval before any production scoring implementation.
