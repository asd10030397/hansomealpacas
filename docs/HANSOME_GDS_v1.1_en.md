# HANSOME: Alpacas vs Cougars  
# Game Design Specification v1.1

| Field | Value |
|------|------|
| Document type | Internal Game Design Specification (GDS) |
| Version | v1.1 |
| Status | Design Freeze Candidate |
| Language | English |
| Audience | Developers, auditors, international contributors, future investors |
| Chain | Robinhood Chain |
| Token | HANSOME (fixed supply) |
| Companion document | Traditional Chinese GDS v1.1 (must describe the identical system) |

**This document contains no Solidity or other implementation code.**  
It defines implementable game rules, state machines, formulas, invariants, and edge cases. The Traditional Chinese GDS v1.1 must describe the same system.

---

## 1. Project Overview

### 1.1 Product Definition

HANSOME: Alpacas vs Cougars is an asymmetric, day-settled NFT strategy game on Robinhood Chain. Players hold Alpaca or Cougar NFTs and complete one round per day through **Commit → Reveal → Settlement → Claim**.

### 1.2 Asset and Supply Constraints

| Symbol | Definition | Value |
|------|------|------|
| \(T_{\mathrm{supply}}\) | Total HANSOME supply | \(1{,}000{,}000{,}000\) |
| — | Mintable | No (fixed supply) |
| — | Source of game rewards | Game Treasury only; no additional minting |
| \(P_{\mathrm{ref}}\) | Reference market price (design-time snapshot; not a constant) | \(\approx 0.00000571\) USD / HANSOME |
| \(L_{\mathrm{ref}}\) | Reference liquidity (design-time snapshot) | \(\approx 5{,}930\) USD |

**Invariant I-SUPPLY:** No game operation may increase total HANSOME supply above \(T_{\mathrm{supply}}\) or mint new tokens into the game.

### 1.3 Collection Sizes (Final)

| Collection | Symbol | Count |
|------|------|------|
| Alpacas | \(N_A = 500\) | 500 |
| Cougars | \(N_C = 50\) | 50 |
| Total NFTs | \(N = N_A + N_C\) | 550 |

### 1.4 Design-Time Treasury and Daily Pool Assumptions

| Symbol | Definition | Value |
|------|------|------|
| \(G_0\) | Initial Game Treasury balance (design assumption) | \(300{,}000{,}000\) HANSOME |
| \(R_0\) | Initial fixed daily reward pool | \(400{,}000\) HANSOME / day |

USD values move with market price; long-horizon models use HANSOME units as the primary measure.

### 1.5 Scope

This GDS covers: gameplay, NFTs, map, daily state machine, Commit/Reveal, settlement, reward formulas, traits, treasury, sinks, emission control, randomness, claims, security, edge cases, expansion, and mathematical appendix.  
Out of scope: contract source code, pixel-level UI specs, finalized marketing copy.

---

## 2. Design Philosophy

### 2.1 Core Principles

1. **Fixed supply, zero inflation:** Rewards are paid only from the Game Treasury.  
2. **Fixed daily pool:** Daily emission \(R_d\) is set by the Emission Controller and does not auto-scale with token price.  
3. **Strategy over idle yield:** Location choice and opponent distribution drive payoff dispersion.  
4. **Asymmetric roles:** Alpacas balance weight versus hunt risk; Cougars pursue matching and the Hunting Pool.  
5. **Independent pool model:** Alpaca Pool, Cougar Base Pool, and Hunting Pool are accounted separately; hunting penalties return to the Treasury and are never paid to Cougar wallets.  
6. **Cougar average advantage:** Under full valid participation, expected Cougar rewards strictly exceed the Alpaca equal-split baseline (see Mathematical Appendix).  
7. **Auditable conservation:** Each daily settlement must satisfy reward-pool and treasury conservation invariants.

### 2.2 Non-Goals

- No guaranteed USD ROI for any NFT.  
- No guarantee that any single location is a pure-strategy optimum.  
- No inflation subsidy for price support.

---

## 3. Core Gameplay

### 3.1 Definition of a Round

Integer day index \(d \in \mathbb{Z}_{\geq 0}\) identifies a game day. Each NFT may complete at most one full participation per day (Commit → Reveal → settlement eligibility).

### 3.2 Player Objectives

- **Alpacas:** Maximize same-day net reward under location weight versus hunting risk.  
- **Cougars:** Choose huntable locations likely to contain Alpacas to earn Base Pool and Hunting Pool shares.

### 3.3 Information Structure

- Commit phase: locations private.  
- Reveal phase: locations public.  
- Settlement: deterministic computation over the valid revealed set only.

### 3.4 Independent Pool Model (Final)

Daily effective emission \(R_d\) splits as:

\[
R_d^{A} = 0.8\, R_d,\quad
R_d^{C} = 0.1\, R_d,\quad
R_d^{H} = 0.1\, R_d
\]

with \(R_d^{A} + R_d^{C} + R_d^{H} = R_d\).

- \(R_d^{A}\): Alpaca Pool (Alpacas only).  
- \(R_d^{C}\): Cougar Base Pool (split equally among valid participating Cougars).  
- \(R_d^{H}\): Hunting Pool (successfully hunting Cougars only).  
- Alpaca **hunting penalties** credit the Treasury and are **not** paid to Cougar addresses.

---

## 4. NFT Collections

### 4.1 Alpacas — \(N_A = 500\)

| Type ID | Name | Count | Trait effect (settlement semantics) |
|------|------|------|------|
| `ALPACA_COMMON` | Common | 479 | No special mitigation / bonus |
| `ALPACA_GUARDIAN` | Guardian | 5 | Hunting penalty rate × 0.5 |
| `ALPACA_LUCKY` | Lucky | 5 | With probability \(p_L=0.20\), full immunity to same-day hunting penalty |
| `ALPACA_FARMER` | Farmer | 5 | Effective weight multiplier \(m_F=1.20\) (must be normalized) |
| `ALPACA_RUNNER` | Runner | 5 | With probability \(p_R=0.30\), treated as successful escape (penalty = 0) |
| `ALPACA_KING` | King | 1 | Permanent immunity to hunting penalty |

**Count check:** \(479+5+5+5+5+1=500\).

Each Alpaca NFT has unique `tokenId` \(\in \mathcal{A}\), \(|\mathcal{A}|=500\). Types are mutually exclusive: each Alpaca belongs to exactly one type.

### 4.2 Cougars — \(N_C = 50\)

| Type ID | Name | Count | Weight \(w^C\) |
|------|------|------|------|
| `COUGAR` | Cougar | 50 | 1 (uniform) |

**Count check:** \(50=50\).  
**Full-collection weight sum:** \(W^{C}_{\mathrm{all}} = 50\cdot 1 = 50\).

**All Cougars are identical.** There are no Cougar rarity tiers and no special abilities — every one of the 50 Cougars shares the same artwork and contributes an equal (uniform) weight \(w^C=1\). Cougar weight therefore only sets the even split of \(R_d^{C}\) and \(R_d^{H}\); it never affects the Alpaca Pool.

### 4.3 Ownership and Participation

- Eligibility is bound to the NFT, not wallet identity (one wallet may hold many NFTs).  
- At most one valid Commit per `(tokenId, d)`.

---

## 5. Map System

### 5.1 Location Set

\[
\mathcal{L} = \{\mathrm{Home},\,\mathrm{Mountain},\,\mathrm{Grassland},\,\mathrm{Forest},\,\mathrm{River}\}
\]

Stable integer IDs (fixed at document level):

| `locationId` | Location | Alpaca allowed | Cougar allowed | Weight \(w(L)\) |
|------|------|------|------|------|
| 0 | Home | Yes | **No** | 1 |
| 1 | Mountain | Yes | Yes | 2 |
| 2 | Grassland | Yes | Yes | 3 |
| 3 | Forest | Yes | Yes | 5 |
| 4 | River | Yes | Yes | 8 |

Huntable locations:

\[
\mathcal{L}^{H} = \mathcal{L}\setminus\{\mathrm{Home}\}
\]

### 5.2 Weight Semantics

- Weights enter the Alpaca Pool allocation numerator.  
- Weights also anchor risk narrative: higher weight maps to higher base hunting-penalty coefficients (see §12).  
- Cougars must not Commit to Home; a Reveal of Home invalidates that Cougar for the day.

---

## 6. Daily Game Flow

### 6.1 Daily State Machine

Each day \(d\) progresses:

```
IDLE → COMMIT_OPEN → COMMIT_CLOSED → REVEAL_OPEN → REVEAL_CLOSED
    → SETTLEMENT → CLAIMABLE → (next day IDLE)
```

| State | Allowed | Forbidden |
|------|------|------|
| `COMMIT_OPEN` | Commit | Reveal / Settle / modify Commit |
| `COMMIT_CLOSED` | (no player writes) | Commit |
| `REVEAL_OPEN` | Reveal | Commit / change location |
| `REVEAL_CLOSED` | (no player writes) | Reveal |
| `SETTLEMENT` | System settlement (once) | Player state mutation |
| `CLAIMABLE` | Claim | Re-settlement |

### 6.2 Timing Windows (Normative recommendation, UTC)

Let day \(d\) UTC bounds be \([t_d, t_{d+1})\).

| Phase | Interval relative to \(t_d\) |
|------|------|
| Commit | \([t_d + 0\mathrm{h},\; t_d + 20\mathrm{h})\) |
| Reveal | \([t_d + 20\mathrm{h},\; t_d + 24\mathrm{h})\) |
| Settlement | Executable from \(t_d + 24\mathrm{h}\) (after Reveal closes) |
| Claim | After settlement completes (until a future protocol migration) |

**Absolute hours may be tuned in implementation, but state order and “Commit is invisible and immutable” semantics must not change.**

### 6.3 Valid Participation Sets

- \(\mathcal{A}_d\): Alpacas with successful Commit and Reveal on day \(d\).  
- \(\mathcal{C}_d\): Cougars with successful Commit and Reveal on day \(d\) and location \(\in \mathcal{L}^{H}\).

Participants outside these sets earn 0 for the day and do not enter weight denominators.

---

## 7. Commit Protocol

### 7.1 Purpose

Hide locations before reveal to reduce copy-trading and sniping.

### 7.2 Commit Payload

Players submit:

\[
\mathrm{commitHash} = H\!\left(\mathrm{tokenId}\,\|\,d\,\|\,\mathrm{locationId}\,\|\,\mathrm{salt}\right)
\]

where:

- \(H\): cryptographic hash (design requirement: collision-resistant, ≥ 256-bit output).  
- `salt`: player-secret randomness with enough entropy to defeat brute force (recommended ≥ 128-bit entropy).  
- Once accepted, a Commit is **immutable and non-cancellable**.

### 7.3 Commit Acceptance Conditions

1. Current day state is `COMMIT_OPEN`.  
2. `tokenId` exists and caller is authorized (owner or approved operator).  
3. No prior Commit for `(tokenId, d)`.  
4. Location plaintext is not validated at Commit time (no plaintext available); legality is enforced at Reveal.

### 7.4 Commit Storage Semantics (Logical)

Record: `commitHash[tokenId][d]`, `committed[tokenId][d]=true`, optional `committer` for audit.

---

## 8. Reveal Protocol

### 8.1 Reveal Inputs

Players submit `(tokenId, d, locationId, salt)`. The system verifies:

\[
H(\mathrm{tokenId}\,\|\,d\,\|\,\mathrm{locationId}\,\|\,\mathrm{salt}) = \mathrm{commitHash}[tokenId][d]
\]

### 8.2 Reveal Acceptance Conditions

1. State is `REVEAL_OPEN`.  
2. Commit exists.  
3. Hash matches.  
4. Not already revealed for the day.  
5. Location legal:  
   - Alpaca: `locationId ∈ {0,1,2,3,4}`  
   - Cougar: `locationId ∈ {1,2,3,4}`

### 8.3 Reveal-Window Information Policy

- Before `REVEAL_CLOSED`, the protocol must not publish live per-location aggregates as an actionable API advantage for players who have not yet revealed (on-chain visibility may still exist; product should disclose this).  
- **Normative requirement:** All reveals occur in one window; settlement runs only after the window closes so strategies are based on the Commit-time information set.

### 8.4 Non-Reveal

If committed but not revealed: NFT ∉ \(\mathcal{A}_d\) or \(\mathcal{C}_d\), reward 0, excluded from denominators.

---

## 9. Settlement Algorithms

### 9.1 Trigger

After `REVEAL_CLOSED`, settlement may be called once. Settlement must be **deterministic**: identical valid reveal sets ⇒ identical results.

### 9.2 Algorithm Outline (Day \(d\))

**Inputs:** revealed locations \(\ell(i)\) for all \(i \in \mathcal{A}_d \cup \mathcal{C}_d\); daily \(R_d\); traits; randomness seed (see §16).

**Steps:**

1. **Emission check:** Read \(R_d\) from Emission Controller; require \(G \ge R_d\). Otherwise apply safe-mode rules (§15).  
2. **Pool split:** \(R_d^{A}, R_d^{C}, R_d^{H}\).  
3. **Location counts:**  
   - \(A_d(L) = |\{i\in\mathcal{A}_d:\ell(i)=L\}|\)  
   - \(C_d(L) = |\{j\in\mathcal{C}_d:\ell(j)=L\}|\)  
4. **Alpaca gross allocation** (§10, including Farmer normalization).  
5. **Hunting penalties** (§12): deduct from Alpaca gross; total penalties \(P_d^{\mathrm{pen}}\) queued to Treasury.  
6. **Cougar Base Pool allocation** (§11.1).  
7. **Hunt success set and Hunting Pool allocation** (§11.2); unallocated remainder \(R_d^{H,\mathrm{dust}}\) returns to Treasury.  
8. **Conservation checks** (§9.3).  
9. **Bookkeeping:** write claimable balances; update Treasury:  
   \[
   G \leftarrow G - R_d + P_d^{\mathrm{pen}} + R_d^{H,\mathrm{dust}} + S_d
   \]  
   where \(S_d\) is same-day Sink credit (may be asynchronous operationally, but daily reports must reconcile).  
10. Mark `settled[d]=true`.

### 9.3 Daily Conservation Invariants

**I-DAY-CONSERVE:**

\[
\sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{net}}
+ \sum_{j\in\mathcal{C}_d} r_j^{C}
+ P_d^{\mathrm{pen}}
+ R_d^{H,\mathrm{dust}}
= R_d
\]

where \(r_j^{C}\) includes Base and Hunt shares. If there is no valid participation, unallocated amounts return fully to Treasury while conservation still holds.

**I-SINGLE-SETTLE:** At most one successful settlement per day.  
**I-NO-MINT:** Settlement never mints tokens.

---

## 10. Alpaca Reward Formula

### 10.1 Effective Weight

For \(i \in \mathcal{A}_d\):

\[
\omega_i =
\begin{cases}
m_F \cdot w(\ell(i)) & \text{if } i \text{ is Farmer}\\
w(\ell(i)) & \text{otherwise}
\end{cases}
\quad(m_F=1.20)
\]

\[
\Omega_d = \sum_{i\in\mathcal{A}_d}\omega_i
\]

If \(\mathcal{A}_d=\emptyset\), then \(R_d^{A}\) returns fully to Treasury and all Alpaca rewards are 0.

### 10.2 Gross Allocation (Farmer Normalization)

\[
r_i^{A,\mathrm{gross}} = R_d^{A}\cdot\frac{\omega_i}{\Omega_d}
\]

**I-FARMER-NORM:** \(\sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{gross}} = R_d^{A}\) whenever \(\Omega_d>0\). Farmer +20% must not cause over-emission.

### 10.3 Net Allocation

After hunting penalty:

\[
r_i^{A,\mathrm{net}} = r_i^{A,\mathrm{gross}}\cdot(1-\pi_i)
\]

with effective penalty rate \(\pi_i\in[0,1]\) (§12).

\[
P_d^{\mathrm{pen}} = \sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{gross}}\cdot\pi_i
\]

**I-PENALTY-TREASURY:** \(P_d^{\mathrm{pen}}\) must return to the Game Treasury and must not be paid to Cougars.

---

## 11. Cougar Reward Formula

### 11.1 Base Pool

All Cougars are identical, so every Cougar carries the same uniform weight \(w^C(j)=1\).

\[
W_d^{C} = \sum_{j\in\mathcal{C}_d} w^C(j) = |\mathcal{C}_d|
\]

If \(W_d^{C}=0\) (no valid Cougars), then \(R_d^{C}\) returns to Treasury. Otherwise the Base Pool is split equally:

\[
r_j^{C,\mathrm{base}} = R_d^{C}\cdot\frac{1}{|\mathcal{C}_d|}
\]

### 11.2 Hunt Success Predicate

Cougar \(j\in\mathcal{C}_d\) at location \(L=\ell(j)\) **succeeds** if and only if:

\[
L\in\mathcal{L}^{H}\ \wedge\ A_d(L)\ge 1
\]

Success set: \(\mathcal{C}_d^{+} = \{j\in\mathcal{C}_d:\text{success}\}\).

### 11.3 Hunting Pool Allocation

Hunt score for each success (uniform weight, so it depends only on how many Alpacas are at the location):

\[
\sigma_j = w^C(j)\cdot A_d(\ell(j)) = A_d(\ell(j))
\]

\[
\Sigma_d = \sum_{j\in\mathcal{C}_d^{+}}\sigma_j
\]

If \(\Sigma_d=0\) (no successes), then \(R_d^{H,\mathrm{dust}}=R_d^{H}\) and all hunt shares are 0.  
Otherwise:

\[
r_j^{C,\mathrm{hunt}} =
\begin{cases}
R_d^{H}\cdot\dfrac{\sigma_j}{\Sigma_d} & j\in\mathcal{C}_d^{+}\\
0 & \text{otherwise}
\end{cases}
\]

\[
R_d^{H,\mathrm{dust}} = R_d^{H} - \sum_{j\in\mathcal{C}_d} r_j^{C,\mathrm{hunt}}
\]

(In integer implementations, dust returns to Treasury.)

### 11.4 Total Cougar Reward

\[
r_j^{C} = r_j^{C,\mathrm{base}} + r_j^{C,\mathrm{hunt}}
\]

### 11.5 Expected Advantage (Full Valid Participation, Pre-Penalty Approximation)

If \(|\mathcal{A}_d|=500\), \(|\mathcal{C}_d|=50\), Hunting Pool fully allocated, penalties ignored:

\[
\bar{r}^{A} = \frac{0.8 R_d}{500},\quad
\bar{r}^{C} = \frac{0.2 R_d}{50}
= 2.5\,\bar{r}^{A}
\]

If all hunts fail: \(\bar{r}^{C}=\dfrac{0.1 R_d}{50}=1.25\,\bar{r}^{A}\) (still strictly above Alpaca equal-split gross). Penalties reduce Alpaca net and widen the relative gap without changing independent-pool accounting.

---

## 12. Trait Resolution

### 12.1 Base Penalty Rates

Base penalty coefficient \(\pi^{0}(L)\):

| \(L\) | \(\pi^{0}(L)\) |
|------|------|
| Home | 0 |
| Mountain | 0.10 |
| Grassland | 0.15 |
| Forest | 0.22 |
| River | 0.30 |

Pressure adjustment: if \(L\in\mathcal{L}^{H}\) and \(C_d(L)\ge 1\):

\[
\pi^{\mathrm{pre}}_i = \min\left(0.90,\ \pi^{0}(L)\cdot\left(1+\frac{C_d(L)-1}{A_d(L)+1}\right)\right)
\]

If \(C_d(L)=0\) or \(L=\mathrm{Home}\): \(\pi^{\mathrm{pre}}_i=0\).

### 12.2 Trait Order (Fixed)

For each Alpaca \(i\), resolve \(\pi_i\) in this order:

1. If type is **King**: \(\pi_i=0\); stop.  
2. Else compute \(\pi^{\mathrm{pre}}_i\).  
3. **Runner:** draw \(\rho_i^{R}\). If \(\rho_i^{R}=1\) (probability \(p_R=0.30\)), then \(\pi_i=0\); stop.  
4. **Lucky:** draw \(\rho_i^{L}\). If \(\rho_i^{L}=1\) (probability \(p_L=0.20\)), then \(\pi_i=0\); stop.  
5. **Guardian:** \(\pi_i = 0.5\cdot\pi^{\mathrm{pre}}_i\).  
6. **Common / Farmer:** \(\pi_i = \pi^{\mathrm{pre}}_i\).  
   (Farmer affects \(\omega_i\) only, not penalty rate directly.)

**I-TRAIT-ORDER:** Trait resolution order is protocol-global; no ambiguous parallelism.

### 12.3 Cougar Traits

Cougars have **no traits and no special abilities**. All 50 Cougars are identical and each enters §11 with the same uniform weight \(w^C=1\).

---

## 13. Treasury Accounting

### 13.1 Definition

Game Treasury balance \(G\) is the HANSOME budget allocated to the game—distinct from market cap, DEX liquidity, and team wallets.

### 13.2 Allowed Movements

| Direction | Event |
|------|------|
| Decrease | Daily pool draw \(R_d\); (none other by default in this GDS) |
| Increase | Hunting penalties \(P_d^{\mathrm{pen}}\); Hunting Pool dust; Token Sinks \(S\); unallocated pool returns |

### 13.3 Invariants

**I-TREASURY-NONNEG:** \(G\ge 0\) always.  
**I-REWARDS-FROM-G:** \(R_d \le G\) outside safe mode; see §15 for safe mode.

---

## 14. Token Sink

### 14.1 Sink Catalog (Final List)

Players spend HANSOME that **returns to the Game Treasury** (not a forced market sell):

| Sink ID | Purpose |
|------|------|
| `UPGRADE` | NFT upgrades |
| `ITEM` | Items |
| `SHIELD` | Shields |
| `SEASON_ENTRY` | Season entry |
| `TRAIT_REROLL` | Trait rerolls |

### 14.2 Accounting

Each Sink amount \(s>0\): \(G \leftarrow G+s\) (funded by player payment).  
**This version does not freeze per-Sink unit prices** (locked later in an economy appendix or ops table). The GDS freezes only the “returns to Treasury” semantics.

### 14.3 Relationship to Emission

Sinks increase \(G\) and extend runway; they do not automatically raise \(R_d\) unless Emission Controller rules explicitly say so.

---

## 15. Emission Controller

### 15.1 Initial Parameters

\[
R_0 = 400{,}000,\quad G_0 = 300{,}000{,}000
\]

Thresholds are relative to **initial treasury** \(G_0\) (not a floating high-water mark):

| Condition | Daily pool \(R_d\) |
|------|------|
| \(G \ge 0.70\,G_0\) | \(400{,}000\) |
| \(0.40\,G_0 \le G < 0.70\,G_0\) | \(280{,}000\) |
| \(0.20\,G_0 \le G < 0.40\,G_0\) | \(160{,}000\) |
| \(G_{\mathrm{safe}} \le G < 0.20\,G_0\) | \(80{,}000\) |
| \(G < G_{\mathrm{safe}}\) | \(R_d = S_d^{\mathrm{net}}\) (same-day Sink net recovery; no fixed pool) |

**Safe threshold (locked herein):** \(G_{\mathrm{safe}} = 15{,}000{,}000\) HANSOME.

### 15.2 Safe Mode

When \(G < G_{\mathrm{safe}}\):  
- Do not draw a fixed \(R_d\).  
- **This specification:** pause Commit until \(G\ge G_{\mathrm{safe}}\); only Sinks are accepted to rebuild Treasury.

### 15.3 Zero-Recycle Gross Runway (Informational)

\(G_0 / R_0 = 750\) days (ignoring Sinks, penalty returns, and step-downs).

---

## 16. Randomness

### 16.1 Stochastic Events

- Lucky immunity rolls  
- Runner escape rolls  

### 16.2 Design Requirements

1. Not biasable by players before settlement.  
2. Replay-verifiable for each `(d, tokenId, purpose)`.  
3. Must not rely on a predictable block hash alone as the sole entropy source.

**Normative:** Use a verifiable random function (VRF) or equivalent beacon; bind:

\[
\mathrm{seed}_{d} \rightarrow \rho_i^{\mathrm{purpose}} = \mathrm{Bernoulli}(p\mid \mathrm{seed}_d,\,tokenId,\,\mathrm{purpose})
\]

### 16.3 Determinism

Given seed and valid participation set, full settlement is deterministically reproducible.

---

## 17. Claim Rules

### 17.1 Model

**Pull** payments: after settlement, accumulate `claimable[tokenId]` (owner aggregates are optional UX; token-level audit is canonical).

### 17.2 Rules

1. Day rewards become claimable only after `settled[d]=true`.  
2. The same `(tokenId, d)` reward must never be credited twice.  
3. Claims may batch multiple unclaimed days.  
4. Claims do not mutate settled allocations.  
5. **Final lock:** `claimable` is booked per `tokenId`; unclaimed balances transfer with the NFT.

---

## 18. Security Considerations

### 18.1 Mechanism Layer

| Risk | Mitigation |
|------|------|
| Post-commit location change | Commits immutable |
| Reveal-window copy trading | Shared window + post-close settlement |
| Short salts | Require high-entropy salt |
| Double claim | Settled flags + monotonic claimable payouts |
| Non-reveal griefing | Non-reveals excluded from denominators |
| RNG manipulation | VRF / beacon |
| Over-emission | Conservation invariants + Farmer normalization |
| Treasury drain | Emission steps + safe threshold |
| Same-owner Alpaca+Cougar coordination | Allowed but self-dilutes hunt shares; not a consensus bug |

### 18.2 Economic Layer

- No USD payoff guarantees.  
- Reference price and liquidity are informational only and never enter formulas.

### 18.3 Operational Layer

- \(G_0\), \(R_0\), and thresholds are protocol parameters; changes require a formal versioned unfreeze (v1.1 is a freeze candidate).

---

## 19. Edge Cases

| # | Case | Required handling |
|------|------|------|
| E1 | No valid Alpacas | \(R_d^{A}\) → Treasury; Cougars may still settle their pools |
| E2 | No valid Cougars | \(R_d^{C}+R_d^{H}\) → Treasury |
| E3 | Cougars present but all \(A_d(L)=0\) | All hunts fail; \(R_d^{H}\) → Treasury; Base Pool still pays |
| E4 | All Alpacas at Home | No successful hunts; hunting portion as E3 |
| E5 | Extreme congestion at one location | Congestion reduces per-head gross; penalties may rise |
| E6 | Farmer is sole Alpaca | Normalization: receives entire \(R_d^{A}\) gross |
| E7 | Alpaca King at River | Penalty rate 0; still enters weight denominator |
| E8 | Cougar reveals Home | Reveal fails; not in \(\mathcal{C}_d\) |
| E9 | Commit without Reveal | Reward 0 |
| E10 | \(G<R_d\) but above safe threshold | Must not occur if controller is correct; refuse settlement and alert |
| E11 | Safe mode | Pause Commit until \(G\ge G_{\mathrm{safe}}\) |
| E12 | Integer division dust | Dust → Treasury; never orphaned |
| E13 | Duplicate Commit same day | Reject |
| E14 | Reveal after settlement | Reject |
| E15 | Day with \(R_d=0\) | No allocation; day state may still advance |

---

## 20. Future Expansion

The following must **not** break v1.1 invariants unless a new specification version is issued:

- New locations or seasonal map modifiers  
- Guild / alliance scoring  
- Cosmetic NFTs (no economic weight)  
- Sink price lists and seasonal cadence  
- Multi-day quests (must not mint)  
- Versioned governance parameter tweaks (\(R_0\), thresholds)  

**Explicitly forbidden expansions:** minting HANSOME; paying hunting penalties to Cougars (breaking the independent pool model); removing Farmer normalization.

---

## 21. Mathematical Appendix

### 21.1 Symbol Table

| Symbol | Meaning |
|------|------|
| \(d\) | Game day |
| \(R_d\) | Daily reward pool |
| \(R_d^{A},R_d^{C},R_d^{H}\) | Three-way pools |
| \(w(L)\) | Location weight |
| \(\omega_i\) | Alpaca effective weight |
| \(\Omega_d\) | Sum of Alpaca effective weights |
| \(\pi_i\) | Alpaca effective penalty rate |
| \(P_d^{\mathrm{pen}}\) | Total penalties (to Treasury) |
| \(w^C(j)\) | Cougar weight (uniform, all \(=1\)) |
| \(\sigma_j\) | Hunt score |
| \(G,G_0,G_{\mathrm{safe}}\) | Treasury and safe threshold |
| \(m_F,p_L,p_R\) | 1.20, 0.20, 0.30 |

### 21.2 Pool Identities

\[
R_d^{A}+R_d^{C}+R_d^{H}=R_d
\]

\[
\sum r_i^{A,\mathrm{gross}}=R_d^{A}
\quad(\Omega_d>0)
\]

\[
\sum r_i^{A,\mathrm{net}}+P_d^{\mathrm{pen}}=R_d^{A}
\]

\[
\sum r_j^{C,\mathrm{base}}=R_d^{C}
\quad(W_d^{C}>0)
\]

\[
\sum r_j^{C,\mathrm{hunt}}+R_d^{H,\mathrm{dust}}=R_d^{H}
\]

### 21.3 Base-Pool Advantage Bound

\[
\frac{R_d^{C}/N_C}{R_d^{A}/N_A}=\frac{0.1}{0.8}\cdot\frac{500}{50}=1.25
\]

### 21.4 Frozen Parameter Table (v1.1)

| Parameter | Value |
|------|------|
| \(N_A,N_C\) | 500, 50 |
| Pool ratios | 0.8 / 0.1 / 0.1 |
| \(R_0\) | 400,000 |
| \(G_0\) | 300,000,000 |
| \(G_{\mathrm{safe}}\) | 15,000,000 |
| Step \(R\) | 400k / 280k / 160k / 80k |
| \(W^{C}_{\mathrm{all}}\) | 50 |
| Location weights | 1, 2, 3, 5, 8 |
| \(\pi^{0}\) | 0, 0.10, 0.15, 0.22, 0.30 |
| \(m_F,p_L,p_R\) | 1.20, 0.20, 0.30 |

---

## Document Control

| Version | Notes |
|------|------|
| v1.1 | Design freeze candidate: independent three-way pools, penalties to Treasury, Farmer normalization, emission steps and safe threshold locked |

**End of Document — HANSOME Game Design Specification v1.1 (English)**
