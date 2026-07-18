# Season Scoring Validation Report v0.1

| Field | Value |
|------|------|
| Spec | `docs/HANSOME_Season_Scoring_Spec_v0.1.md` |
| GDS | v1.1 |
| Simulation | 2,000 settlement days · ~793k Alpaca player-days · ~79k Cougar player-days |
| Wallet cohorts | 300 wallets × {1,3,6} NFTs × 90-day seasons |
| Date | 2026-07-19 |

**No gameplay contracts were modified. No production scoring code was shipped.**

---

## 1. Verdict

# APPROVE WITH CHANGES

The within-role percentile model is the correct production direction. Fixed-event scoring remains **rejected**.

Ship production scoring only after the changes in §7 are applied (or explicitly accepted as residual risk).

---

## 2. Formulas under test

As specified in v0.1:

- Alpaca metric \(m^A\) with \(\lambda_{\mathrm{Home}}=0.35\), \(\mu=0.55\)
- Cougar metric \(m^C=\sigma+\eta r^{\mathrm{hunt}}\) on success, else \(0\)
- Midrank percentile → \(S^{\mathrm{NFT}}\in(0,100]\); \(n_{\min}=5\Rightarrow S=50\)
- Wallet aggregations compared: **sum**, **meanBestK**, **meanAllCap (≤K)**
- Season: mean of daily wallet scores (see §5 for skip-day issue)

---

## 3. Expected scores & variance

### 3.1 Daily NFT scores (within-role percentile)

| Side | Mean | Std | p10 | p50 | p90 |
|------|------|------|------|------|------|
| Alpaca | 50.0 | 28.2 | 14.0 | 52.7 | 89.5 |
| Cougar | 50.0 | 27.5 | 12.5 | 50.0 | 87.0 |

**Side balance:** mean role gap ≈ 0 by construction (separate ladders). This satisfies “do not compare raw Alpaca vs Cougar outcomes.”

### 3.2 Location → Alpaca daily score (Season skill signal)

| Location | E[\(S^{\mathrm{NFT}}\)] | n |
|------|------|------|
| Home | **14.6** | 230k |
| Mountain | 37.5 | 134k |
| Grassland | 54.6 | 137k |
| Forest | 71.6 | 132k |
| River | **89.7** | 160k |

- Home top-decile rate: **0%** — Home camping is **not** a Season-dominant strategy.  
- River top-decile rate: **~32%** — high-weight chase remains strong.

---

## 4. NFT-count comparison (90-day seasons)

Ratio = mean season score(k NFT) / mean season score(1 NFT).

| Aggregation | 3 NFT / 1 | 6 NFT / 1 | Verdict |
|------|------|------|------|
| Unbounded **sum** | ~2.39× | ~4.71× | **Reject** — pay-to-rank |
| **meanBestK** (K=3) | ~1.01× | ~1.28× | Soft reject — still buys optionality |
| **meanAllCap** (≤K actives) | ~0.99× | ~0.99× | **Prefer** |

**Recommendation:** use **mean of up to K=3 actives**; if more than K valid that day, take the **K smallest tokenIds** (deterministic). Do **not** use mean-of-best-K.

---

## 5. Participation / skip-bad-days

Experiment: play all days vs keep only days ≥ p40 of that wallet’s day scores; require \(D_{\min}=25\).

| Mode | Mean season score | Eligible rate | Lift |
|------|------|------|------|
| Play all days | ~50.0 | — | 1.0× |
| Skip bottom ~40% days | ~69.0 | ~100% | **~1.38×** |

With \(L=90\) and \(D_{\min}=25\), skippers remain eligible and inflate the mean-of-active-days statistic.

**Required change:** SeasonScore must use the **full-season denominator**:

\[
\mathrm{SeasonScore}(w)=\frac{1}{L}\sum_{d=1}^{L} S_w(d)
\quad\text{with }S_w(d)=0\text{ if inactive.}
\]

Keep \(D_{\min}=25\) only as a **listing eligibility** floor, not as the averaging window.

---

## 6. Special boards (design check)

| Board | Check |
|------|------|
| Hunter | Uses \(\sigma\) / relative hunt quality — not flat +20 per success |
| Survivor | Home never enters (`underHunt=false`); under-hunt samples abundant in sim (~140k / 500 days) |
| Earnings | Must stay **role-split**; GDS Cougar earn advantage (~1.25–3×) is structural |

---

## 7. Changes required before APPROVE

1. **Wallet aggregation = meanAllCap (K=3)**, not meanBestK.  
2. **Season average over full \(L\) with zeros** for inactive days.  
3. **Location dominance open item:** add v0.1.1 candidate that residualizes Alpaca metric by location (or risk-adjusts so pure River spam is not ~90 mean score) and re-simulate.  
4. Document transfer rule in indexer: owner at **Reveal close**.  
5. Do not show fixed +5/+10/+20 in product UI (already removed in frontend pass).

Starting parameters after changes:

| Param | Value | Confidence |
|------|------|------|
| K | 3 | High |
| L | 90 | Medium-high |
| D_min (listing) | 25 | Medium — revisit after live attendance |
| \(\lambda_{\mathrm{Home}}\) | 0.35 | Medium |
| \(\mu\) | 0.55 | Medium |
| \(n_{\min}\) | 5 | High |

---

## 8. Exploit summary

| Exploit | Status under v0.1 + §7 changes |
|------|------|
| More NFTs linear score | Mitigated (cap mean ≈1.0×) |
| Best-K cherry pick | Avoided by rejecting meanBestK |
| Home camping Season | Mitigated (E[S]≈14.6) |
| Always River | **Residual risk** — change #3 |
| Skip bad days | Mitigated by full-L zeros |
| Wallet HANSOME | Forbidden |
| Transfers | Attribute by Reveal-close owner |
| Self-hunt / feed | No LB-specific bonus beyond GDS; monitor on testnet |

---

## 9. Confidence

| Claim | Confidence |
|------|------|
| Fixed-event model must not ship | **High** |
| Within-role percentile is correct frame | **High** |
| meanAllCap K=3 is fair vs NFT count | **High** |
| Exact \(\lambda,\mu,\eta\) for mainnet | **Medium** — needs live mixes |
| River dominance without residualization | **High** that it exists in current \(m^A\) |

---

## 10. Gate

| Decision | Meaning |
|------|------|
| **REJECT** | Do not implement fixed-event points |
| **APPROVE WITH CHANGES** | Implement percentile model only after §7 items 1–3 are in the next spec revision |
| **APPROVE** | Reserved for post–v0.1.1 sign-off |

**Current gate status: APPROVE WITH CHANGES**
