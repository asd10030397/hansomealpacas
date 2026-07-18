# HANSOME Season Scoring Specification v0.1

| Field | Value |
|------|------|
| Status | **Superseded by v0.1.1** |
| Successor | [`HANSOME_Season_Scoring_Spec_v0.1.1.md`](./HANSOME_Season_Scoring_Spec_v0.1.1.md) |
| Depends on | GDS v1.1 (settlement outcomes) |
| Scope | Off-chain / indexer leaderboard scoring only |
| Non-scope | Gameplay contracts, mint, wallet token balance |

**Abandoned:** fixed-event points (Commit +5, Reveal +5, Survive +10, Hunt +20, Daily +2).

> Use **v0.1.1** for all new work. This v0.1 file is retained for history only.

---

## 1. Principles

1. Rank **Alpacas only vs Alpacas** and **Cougars only vs Cougars** each day.  
2. Commit ∧ Reveal are **eligibility**, not large attendance bonuses.  
3. Wallet score is **normalized** (no unbounded NFT summing).  
4. Wallet **HANSOME balance never** enters any board.  
5. Home must not dominate Season Points merely by being safe.  
6. Binary hunt success must not grant a large flat score.

---

## 2. Eligibility

For token \(i\) on day \(d\):

\[
\mathrm{valid}(i,d) \iff
\mathrm{Commit}(i,d) \wedge \mathrm{Reveal}(i,d) \wedge i \in \mathcal{A}_d \cup \mathcal{C}_d
\]

(as defined in GDS: revealed into the valid participant sets).

Invalid tokens contribute **no** NFT daily score.

---

## 3. Alpaca daily performance metric

Let \(L=\ell(i)\), \(w(L)\) location weight, \(\pi_i\) final penalty rate (GDS §12), \(r_i^{A,\mathrm{net}}\) net HANSOME (GDS §10.3).

\[
\mathrm{underHunt}(i,d) \iff L \in \mathcal{L}^{H} \wedge C_d(L)\ge 1
\]

**Candidate metric (v0.1):**

\[
m_i^{A} =
\begin{cases}
\lambda_{\mathrm{Home}} \cdot r_i^{A,\mathrm{net}} & L=\mathrm{Home} \\[4pt]
r_i^{A,\mathrm{net}} \cdot \bigl(1 + \mu \cdot (1-\pi_i)\bigr) & \mathrm{underHunt}(i,d) \\[4pt]
r_i^{A,\mathrm{net}} & \text{otherwise}
\end{cases}
\]

| Parameter | Starting value | Role |
|------|------|------|
| \(\lambda_{\mathrm{Home}}\) | \(0.35\) | Suppress Home camping on Season board |
| \(\mu\) | \(0.55\) | Reward surviving under actual hunt pressure |

**Open item (see validation report):** high-weight locations can still dominate \(m_i^{A}\) via raw net. A follow-up may residualize by location or damp \(w(L)\) before mainnet.

---

## 4. Cougar daily performance metric

Hunt success (GDS §11.2): \(L\in\mathcal{L}^{H} \wedge A_d(L)\ge 1\).

Hunt score \(\sigma_i = A_d(\ell(i))\) on success, else \(0\).  
Hunting Pool share \(r_i^{C,\mathrm{hunt}}\) as in GDS.

\[
m_i^{C} =
\begin{cases}
\sigma_i + \eta \cdot r_i^{C,\mathrm{hunt}} & \text{success} \\[4pt]
0 & \text{miss}
\end{cases}
\]

| Parameter | Starting value | Role |
|------|------|------|
| \(\eta\) | \(0.15\) | Mild weight on realized hunt payout; \(\sigma\) is primary |

Binary success alone is insufficient: empty-tile misses score \(0\); crowded successful tiles outrank thin ones via \(\sigma\).

---

## 5. Within-role percentile → daily NFT score

Let \(\mathcal{R}_d^{A}=\{i:\mathrm{valid}(i,d)\wedge\mathrm{side}(i)=\mathrm{Alpaca}\}\) (analogous for Cougars).

**Minimum sample size:** if \(|\mathcal{R}_d^{\mathrm{side}}| < n_{\min}\) with \(n_{\min}=5\), every valid token of that side scores **neutral** \(S_i=50\).

**Otherwise — midrank percentile (ties share average rank):**

Sort by \(m_i\) ascending. Tied blocks share midrank \(r\in[0,n-1]\).

\[
S_i^{\mathrm{NFT}}(d) = 100 \cdot \frac{r_i + 0.5}{n} \in (0,100]
\]

Clipping: already in \((0,100]\); no further winsorization in v0.1.

---

## 6. Wallet daily score

Let \(A_w(d)\) be the set of valid tokens owned by wallet \(w\) at **Reveal close** for day \(d\) (see §10 transfers).

**Chosen aggregation (validated):** mean of up to \(K\) actives — **not** unbounded sum, **not** mean of best \(K\).

\[
A_w^{\le K}(d) =
\begin{cases}
A_w(d) & |A_w(d)| \le K \\
\text{the }K\text{ members of }A_w(d)\text{ with smallest tokenId} & |A_w(d)| > K
\end{cases}
\]

\[
S_w(d) =
\begin{cases}
0 & A_w(d)=\emptyset \\[4pt]
\dfrac{1}{|A_w^{\le K}(d)|}\sum_{i\in A_w^{\le K}(d)} S_i^{\mathrm{NFT}}(d) & \text{otherwise}
\end{cases}
\]

| Parameter | Starting value |
|------|------|
| \(K\) | \(3\) |

**Why not mean-of-best-\(K\):** simulations show ~1.28× advantage for 6-NFT wallets vs 1-NFT.  
**Why tokenId selection when over cap:** deterministic; removes cherry-picking the day’s best performers without a designated slate UX.

---

## 7. Season score (primary board)

Season length \(L\) days (index \(d=1..L\)).

\[
\mathrm{SeasonScore}(w) = \frac{1}{L}\sum_{d=1}^{L} S_w(d)
\]

Inactive days contribute \(S_w(d)=0\) (full-season denominator). This removes “skip bad days” inflation.

**Eligibility to appear on the ranked Season board:**

\[
\#\{d: A_w(d)\ne\emptyset\} \ge D_{\min}
\]

| Parameter | Starting value |
|------|------|
| \(L\) | \(90\) |
| \(D_{\min}\) | \(25\) |

Hard reset to 0 each season. No point decay if hard reset is used.

---

## 8. Special leaderboards

### 8.1 Hunter (Cougar-only)

Per valid Cougar day: \(h_i(d)=\sigma_i\) (0 on miss).  
Daily wallet Hunter score: same \(K\)-cap mean as §6 over Cougar actives only.  
Season Hunter: \((1/L)\sum h_w(d)\) with zeros on inactive days.

### 8.2 Survivor (Alpaca-only)

Only days with \(\mathrm{underHunt}(i,d)\). Home **never** qualifies.

\[
\mathrm{surv}_i(d) =
\begin{cases}
(1-\pi_i)\cdot S_i^{\mathrm{NFT}}(d) & \mathrm{underHunt}(i,d) \\
\text{undefined (omit)} & \text{otherwise}
\end{cases}
\]

Season Survivor: mean of defined day scores; require \(\ge D_{\min}^{\mathrm{surv}}\) under-hunt active days (start: 15).

### 8.3 Earnings

Cumulative **gameplay** HANSOME credited to tokens (claims / settled accruals), **within role**:

- Alpaca Earnings board  
- Cougar Earnings board  

Or a single UI with a role toggle. Never merge raw A+C into one absolute ladder. Never use wallet token balance.

---

## 9. Anti-exploit notes (normative intent)

| Attack | Mitigation |
|------|------|
| Buy more NFTs | \(K\)-cap mean; over-cap uses lowest tokenIds |
| Wallet split | Each wallet normalized independently; split reduces concentration but also splits eligibility grind — acceptable; sybil farming addressed by \(D_{\min}\) + full-season zeros |
| Self-hunt / feed | Allowed by GDS; Season uses within-role outcomes — feeding dilutes own Alpaca percentile while boosting Cougar \(\sigma\) on another wallet; no extra LB bonus for collusion beyond GDS economics |
| Home camping | \(\lambda_{\mathrm{Home}}\); Survivor excludes Home |
| Always River | Open item — may need location residualization in v0.1.1 |
| Skip bad days | Full-season average with zeros |
| NFT transfer mid-season | Score for day \(d\) attributes to owner at **Reveal close** for that day; prior days stay with prior owner |
| Wallet HANSOME | Forbidden input |

---

## 10. Implementation gate

Production indexer / UI scoring code must not ship until this spec (or a successor version) receives an explicit **APPROVE** or **APPROVE WITH CHANGES** (changes applied) in the validation report.

Companion report: `reports/leaderboard/season-scoring-validation-v0.1.md`
