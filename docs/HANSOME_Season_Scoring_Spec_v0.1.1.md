# HANSOME Season Scoring Specification v0.1.1

| Field | Value |
|------|------|
| Status | **APPROVED** (production direction; indexer not live yet) |
| Supersedes | `HANSOME_Season_Scoring_Spec_v0.1.md` |
| Depends on | GDS v1.1 |
| Scope | Off-chain / indexer leaderboard scoring only |
| Non-scope | Gameplay contracts, mint, wallet token balance; **historical season browsing / archives / past-season APIs** (future update) |
| Product priority | Current **active season** leaderboard only until Season 1 is stable in production |

**Abandoned:** fixed-event points (Commit +5, Reveal +5, Survive +10, Hunt +20, Daily +2).

**Locked in this revision (accepted 2026-07-19):**

1. Wallet daily score = mean of up to **K = 3** actives (not sum, not best-K); deterministic over-cap rule.  
2. Season score = mean over full **L = 90** days; inactive days = **0**.  
3. River balancing via **within-location relative performance** (not a River nerf).

Companion validation: `reports/leaderboard/season-scoring-validation-v0.1.1.md`.

---

## 1. Principles

1. Rank Alpacas only vs Alpacas; Cougars only vs Cougars.  
2. Commit ∧ Reveal are eligibility only — not large attendance bonuses.  
3. Wallet scores are normalized (no unbounded NFT summing).  
4. Wallet HANSOME balance never enters any board.  
5. No single location may be an always-optimal Season strategy.  
6. Binary hunt success must not grant a large flat score.  
7. Season Points reward **relative decision quality**, not raw GDS payout level.

---

## 2. Eligibility

\[
\mathrm{valid}(i,d) \iff
\mathrm{Commit}(i,d) \wedge \mathrm{Reveal}(i,d) \wedge i \in \mathcal{A}_d \cup \mathcal{C}_d
\]

Owner for day \(d\) = ERC-721 owner at **Reveal close**.

---

## 3. Alpaca daily score (v0.1.1 — within-location percentile)

### 3.1 Motivation

v0.1 used a global function of net HANSOME. Because \(w(L)\) drives gross allocation, **River** had E[\(S\)] ≈ 90 vs Home ≈ 15 — an always-optimal location for Season Points, which is not “good decision-making.”

**Nerfing River’s weight is rejected** (would fight the GDS economy).

**Chosen fix:** score each Alpaca against peers who chose the **same location that day**. Expected score is then ~50 at every location; rank comes from outperforming others who made the same choice (execution, traits, congestion luck) — not from the location label.

### 3.2 Local performance input

For Alpaca \(i\) at \(L=\ell(i)\):

\[
\mathrm{underHunt}(i,d) \iff L\in\mathcal{L}^{H} \wedge C_d(L)\ge 1
\]

\[
\tilde{m}_i^{A} =
\begin{cases}
r_i^{A,\mathrm{net}} \cdot \bigl(1 + \mu\cdot(1-\pi_i)\bigr) & \mathrm{underHunt}(i,d) \\[4pt]
r_i^{A,\mathrm{net}} & \text{otherwise}
\end{cases}
\]

| Parameter | Value | Role |
|------|------|------|
| \(\mu\) | \(0.55\) | Prefer surviving under hunt pressure **within** the same location cohort |

Home has \(\mathrm{underHunt}=\mathrm{false}\), so \(\tilde{m}=r^{\mathrm{net}}\) only (no safety bonus for Season).

### 3.3 Within-location midrank percentile

Let \(\mathcal{R}_d^{A}(L)=\{i\in\mathcal{A}_d:\ell(i)=L\}\), \(n_L=|\mathcal{R}_d^{A}(L)|\).

- If \(n_L < n_{\min}\) with \(n_{\min}=5\): every member scores **neutral** \(S_i^{\mathrm{NFT}}(d)=50\).  
- Else: midrank percentile of \(\tilde{m}_i^{A}\) **within** \(\mathcal{R}_d^{A}(L)\):

\[
S_i^{\mathrm{NFT}}(d) = 100 \cdot \frac{r_i^{(L)} + 0.5}{n_L}
\]

Ties share average midrank. No second global percentile stage.

**Property:** for each location with \(n_L\ge n_{\min}\), mean daily score among participants ≈ 50. River cannot dominate by label alone.

---

## 4. Cougar daily score

Unchanged in spirit from v0.1; still within-role (global among Cougars).

\[
m_i^{C} =
\begin{cases}
\sigma_i + \eta \cdot r_i^{C,\mathrm{hunt}} & A_d(\ell(i))\ge 1 \\[4pt]
0 & \text{miss}
\end{cases}
\qquad \sigma_i=A_d(\ell(i))
\]

| Parameter | Value |
|------|------|
| \(\eta\) | \(0.15\) |

Then midrank percentile among all valid Cougars that day → \(S_i^{\mathrm{NFT}}(d)\in(0,100]\), with \(n_{\min}=5\) → neutral 50.

---

## 5. Wallet daily score (locked)

Let \(A_w(d)\) = valid tokens owned by wallet \(w\) at Reveal close on day \(d\).

\[
A_w^{\le K}(d) =
\begin{cases}
A_w(d) & |A_w(d)| \le K \\
\text{\(K\) members of \(A_w(d)\) with smallest tokenId} & |A_w(d)| > K
\end{cases}
\]

\[
S_w(d) =
\begin{cases}
0 & A_w(d)=\emptyset \\[4pt]
\dfrac{1}{|A_w^{\le K}(d)|}
\sum_{i\in A_w^{\le K}(d)} S_i^{\mathrm{NFT}}(d) & \text{otherwise}
\end{cases}
\]

| Parameter | Value | Forbidden |
|------|------|------|
| \(K\) | **3** | sum; mean of best‑K |

---

## 6. Season score (locked)

\[
\mathrm{SeasonScore}(w) = \frac{1}{L}\sum_{d=1}^{L} S_w(d)
\]

Inactive days: \(S_w(d)=0\).

| Parameter | Value |
|------|------|
| \(L\) | **90** |
| \(D_{\min}\) (listing eligibility) | **25** active days |

Hard reset each season.

---

## 7. Special leaderboards

| Board | Definition |
|------|------|
| **Season** | \(\mathrm{SeasonScore}\) above (cross-role via within-role daily scores) |
| **Hunter** | Cougar-only; season mean of \(K\)-capped daily means of \(\sigma\)-based \(S^{\mathrm{NFT}}\) (or raw \(\sigma\) percentile — same pipeline) |
| **Survivor** | Alpaca-only; only \(\mathrm{underHunt}\) days; Home never qualifies; mean of \((1-\pi_i)\cdot S_i^{\mathrm{NFT}}\) on those days; require \(\ge 15\) under-hunt days |
| **Earnings** | Separate Alpaca / Cougar cumulative gameplay HANSOME; never wallet balance |

---

## 8. Anti-exploit (v0.1.1)

| Attack | Mitigation |
|------|------|
| Linear NFT stacking | Mean ≤ K=3, tokenId selection |
| Best-K cherry pick | Forbidden |
| Home camping (Season) | Within-loc scoring; Home E[\(S\)]≈50, not inflated by safety |
| Always River (Season) | Within-loc scoring; E[\(S\)\|River]≈50; always-River ≈ always-Home in sims |
| Skip bad days | Full-\(L\) zeros — skipping **lowers** season mean |
| Transfers | Reveal-close owner |
| Wallet HANSOME | Forbidden |
| Multi-NFT attendance insurance | Residual: more NFTs → fewer all-zero days under full-\(L\) average (~1.2× in sims). Accepted residual for v0.1.1; monitor on testnet |

---

## 9. Implementation gate

**Approved** as production scoring direction (2026-07-19).

| Stage | Status |
|------|------|
| Spec approval | **Done** |
| Module + unit tests (`lib/game/scoring`, `scoringVersion = "v0.1.1"`) | **Done** — see `reports/leaderboard/scoring-implementation-v0.1.1.md` |
| Integration review + edge-case / L=90 replay tests | **Done** — see `reports/leaderboard/scoring-integration-review-v0.1.1.md` |
| Live leaderboard cutover (replace Demo ranks) | **NO-GO** until cutover checklist + explicit enablement |

Do **not** wire the Demo leaderboard to this module until the cutover checklist in the integration review is complete and cutover is explicitly approved.
