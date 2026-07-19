# Alpaca Hunt-Penalty Strength Review

| Field | Value |
|-------|--------|
| Status | Read-only analysis — **no SettlementLib / deploy changes** |
| Source of truth | `contracts/contracts/game/SettlementLib.sol` + GDS v1.1 §11–12 |
| Sim artifact | `reports/economics/alpaca-penalty-strength-sim.json` |
| Script | `scripts/sim-alpaca-penalty-strength.mjs` |
| Date | 2026-07-20 |

---

## Recommendation (first)

**Adopt Candidate A: π₀ = 0 / 15 / 25 / 35 / 45 (Home → River).**  
**Keep pool split 80 / 10 / 10.** Do **not** adopt B or C. Do **not** raise Cougar pools.

| Goal | Current (0/10/15/22/30) | **A (recommended)** | B | C |
|------|-------------------------|---------------------|---|---|
| Cougar/Common ratio (blend*) | **3.36×** | **4.11×** | 5.12× | 7.46× |
| Band 3×–5× | Yes | **Yes** | Borderline / breaks | Breaks |
| Common still viable | Yes | **Yes (~−18% vs current sim)** | Weak | Poor |
| Trait premium visibility | Mild | **Clear** | Strong / OP risk | Extreme |
| Home meta pressure | Low | Moderate (manageable) | High | Very high |

\*Blend = mean of `random`, `rational`, `cougar_even`, `cougar_high_risk` (800 days each, Rd=400k, 500:50).

**Why A is better than Current:** specials gain clearly visible economic value (Guardian ~+32% vs Common, Runner ~+19%, Lucky ~+13%, King ~+61% in the blend) while Cougar/Common stays inside the desired **3×–5×** band under equal mint. Commons remain playable; River is still chosen in open play; emission cap unchanged (penalties → Treasury).

---

## Formulas used (SettlementLib)

Daily pools (unchanged):

\[
R_d^{A}=0.8 R_d,\quad R_d^{C}=0.1 R_d,\quad R_d^{H}=0.1 R_d
\]

Pre-penalty (huntable + \(C_d(L)\ge 1\)):

\[
\pi^{\mathrm{pre}}=\min\left(0.90,\ \pi^{0}(L)\cdot\frac{A_d(L)+C_d(L)}{A_d(L)+1}\right)
\]

Trait order: King → Runner (\(p=0.30\)) → Lucky (\(p=0.20\)) → Guardian (×0.5) → Common/Farmer.  
Farmer: weight ×1.20 normalized.  
Cougar hunt success: \(L\) huntable and \(A_d(L)\ge 1\). Hunt penalties credit **Treasury**, never Cougar wallets.  
Sim Rd = 400,000 HANSOME/day (R0 band).

Current on-chain π₀ (bps): `0 / 1000 / 1500 / 2200 / 3000`.

---

## Answers to the six questions

### 1. Are current 10%–30% penalties too weak?

**Mildly soft for trait signaling, not broken for economy.**

- Contested-day π is moderate; long-run Common net in prior MC ≈ **532**/day vs Cougar ≈ **1,594**/day (~**3×**).
- Under this sim’s more contested mixes, Common ≈ **467–484**/day and ratio ≈ **3.3×**.
- Penalties are **not** so weak that Cougars fall below 3× at Genesis participation.
- They **are** soft enough that Lucky/Runner average premiums stay single-digit to low-teens vs Common — easy to underfeel in the UI.

**Verdict:** slightly weak for *trait value*, adequate for *Cougar ≥ 3×*.

### 2. Do they make special traits feel insufficiently valuable?

**Partially yes — especially Lucky / Runner.**

Blend premiums vs Common under **Current**:

| Trait | Avg HANSOME/day | Premium vs Common |
|-------|-----------------|-------------------|
| Common | 477 | — |
| Lucky | 508 | **+6.6%** |
| Runner | 523 | **+9.6%** |
| Guardian | 558 | **+17%** |
| Farmer | 571 | **+20%** (weight, not hunt) |
| King | 630 | **+32%** |

Lucky/Runner need contested hunts + RNG; average edge is real but quiet. Strengthening π₀ magnifies the same trait math without new systems.

### 3. Does Current reliably keep Cougar in 3×–5× at Genesis 500:50?

**Yes.** Across all tested scenarios for Current, ratio stayed **3.12×–3.43×**.

Note: with full Cougar participation, average Cougar pay is sticky near \((R_d^{C}+R_d^{H})/50=1600\) whenever Hunting Pool is fully allocated (typical when any hunts succeed). Ratio moves mainly via Alpaca **net** after π.

### 4. When does the ratio fall below 3× or rise above 5×?

| Condition | Ratio behavior |
|-----------|----------------|
| **Current**, Home-heavy / same-owner avoid | Stays ≈ **3.1×–3.2×** (floor near 3×, rarely below in these runs) |
| **Current**, open contested play | ≈ **3.3×–3.4×** |
| Prior MC home-lean (532 vs 1594) | ≈ **3.0×** (edge of floor) |
| **Below 3×** | Needs Commons to earn more net (weaker π or more Home) **or** Cougars to lose Rh (mass hunt failure / low Cougar participation). Not seen as a systemic Current failure at 500:50 full play. |
| **Above 5×** | **Ladder B** rational (~5.47×); **Ladder C** open play (~6.6×–8.9×) |
| **Above 6×** | Ladder **C** in most non-Home metas |

### 5. Strengthen only the penalty ladder, or also change Cougar pools?

**Penalty ladder only (Candidate A).** Keep **80/10/10**.

Raising Rc/Rh would push ratio up *and* concentrate emission on 9% of supply — unnecessary if A already lands mid-band 3×–5×. Pool changes are a heavier, harder-to-revert lever; π₀ is the surgical tool for trait salience.

### 6. Smallest safe adjustment?

**Candidate A: 0 / 15 / 25 / 35 / 45.**

- Smallest step among tested ladders that clearly lifts trait premiums.
- Keeps blend ratio ~**4.1×** (inside 3×–5×).
- Even under home-flight, ratio stays ~**3.5×–3.8×**.
- Avoid B/C: Commons lose too much in open play; King/Guardian become lopsided; Home meta intensifies.

---

## Candidate ladders (π₀ %)

| Location | Current | A (rec.) | B | C |
|----------|---------|----------|---|---|
| Home | 0 | 0 | 0 | 0 |
| Mountain | 10 | **15** | 20 | 25 |
| Grassland | 15 | **25** | 30 | 40 |
| Forest | 22 | **35** | 45 | 60 |
| River | 30 | **45** | 60 | 80 |

---

## Simulation design

- Genesis: 479 Common + 5 Guardian + 5 Farmer + 5 Lucky + 5 Runner + 1 King; 50 Cougars  
- 800 days / scenario / ladder; deterministic PRNG  
- Scenarios: random; rational reward-seeking; Cougars high-risk; Cougars even; Alpacas hide Home; same-owner split; home-flight mild/strong  
- **Caveat:** location choice is scenario-driven (not full Nash). Home-flight scenarios stand in for endogenous retreat under harsher π.

Under full Cougar participation with Rh usually paid out, **Cougar average ≈ 1,600**/day in almost every cell — ratio differences are almost entirely Alpaca-net driven.

---

## Results summary (blend of open-play scenarios)

| Ladder | Common | Cougar | Ratio | Treasury pen/day | Home share | River share |
|--------|--------|--------|-------|------------------|------------|-------------|
| Current | 477 | 1600 | **3.36×** | ~80k | 18% | 23% |
| **A** | **389** | **1600** | **4.11×** | ~124k | 18% | 22% |
| B | 313 | 1600 | **5.12×** | ~161k | 18% | 23% |
| C | 215 | 1600 | **7.46×** | ~210k | 18% | 23% |

### Trait premiums vs Common (blend)

| Trait | Current | A | B | C |
|-------|---------|---|---|---|
| Guardian | +17% | **+32%** | +52% | +99% |
| Farmer | +20% | +20% | +20% | +20% |
| Lucky | +7% | **+13%** | +21% | +40% |
| Runner | +10% | **+19%** | +14%* | +59% |
| King | +32% | **+61%** | +100% | +194% |

\*Runner variance across seeds/scenarios; directionally rises with π₀ when contested.

### Scenario grid — Cougar/Common ratio

| Scenario | Current | A | B | C |
|----------|---------|---|---|---|
| random | 3.31 | 4.01 | 4.91 | **7.11** |
| rational | 3.43 | 4.27 | **5.47** | **8.93** |
| cougar_high_risk | 3.35 | 4.11 | 5.09 | **6.59** |
| cougar_even | 3.34 | 4.08 | 5.04 | **7.58** |
| alpaca_home | 3.16 | 3.67 | 4.15 | 4.54 |
| same_owner_split | 3.18 | 3.71 | 4.18 | 4.65 |
| home_flight_mild | 3.21 | 3.81 | 4.44 | 5.22 |
| home_flight_strong | 3.12 | 3.55 | 3.79 | 4.24 |

### Qualitative flags

| Ladder | Home becomes dominant? | River unattractive? | Special OP? | Sustainable in 3×–5×? |
|--------|------------------------|---------------------|-------------|------------------------|
| Current | No (unless players choose Home) | No | No | **Yes** |
| **A** | Risk rises; flight scenarios still OK | Still chosen in open play | King strong but unique (1/500) | **Yes** |
| B | Likely without UX push to risk | River painful | Guardian/King hot | **Borderline** |
| C | Strong Home meta expected | River often a trap | King/Guardian extreme | **No** |

Reward concentration (pool share): Cougars still receive 20% of Rd by design; penalties increase Treasury clawback, not Cougar wallets. Total emission remains capped by Rd.

---

## Alignment with prior baseline (532 / 1,594 / ~3×)

Prior Genesis Monte Carlo (home-leaning mix) reported Common ≈532, Cougar ≈1594, ratio ≈3.0× under Current π₀. This review’s open-play mix is harsher on Commons (~477), so Current ratio prints ~3.3× here. Both agree: **Current sits at the bottom of the desired band**, not above it.

Equal mint (0.015 ETH both) ⇒ reward ratio ≈ ROI/ETH ratio. Holding **3×–5×** remains the right product band (see equal-mint ROI note).

---

## Exact recommended configuration

```text
π⁰(Home)      = 0
π⁰(Mountain)  = 0.15   (1500 bps)
π⁰(Grassland) = 0.25   (2500 bps)
π⁰(Forest)    = 0.35   (3500 bps)
π⁰(River)     = 0.45   (4500 bps)

Pools: Ra / Rc / Rh = 80% / 10% / 10%  (unchanged)
MAX_PRE_PENALTY     = 90%              (unchanged)
Trait order / p_R / p_L               (unchanged)
```

### Why this beats Current

1. **Trait value:** Lucky/Runner/Guardian premiums become clearly readable without new mechanics.  
2. **Cougar band:** Blend ~4.1×; scenario range ~3.5×–4.3× — centered in 3×–5×, not stuck on the 3× floor.  
3. **Commons:** Still earn meaningful HANSOME; not pushed into a Home-only prison (unlike B/C).  
4. **Risk locations:** Still worth weight-seeking; River hurts more when contested but is not a wipe at Ad≈Cd.  
5. **Treasury / cap:** Higher clawback, same Rd ceiling — no inflation.  
6. **Scope:** One table change later; no pool redesign, no SettlementLib edit in this review.

### Explicitly reject

- **B (0/20/30/45/60):** ratio often ≥5× in contested play; Commons too soft.  
- **C (0/25/40/60/80):** ratio 6×–9×; King ~3× Common; Home meta.  
- **Raising Rc/Rh now:** wrong lever while π₀ can do the job.

---

## Implementation note (not done here)

**Adopted 2026-07-20:** Candidate A is live in SettlementLib + GDS + UI. See `reports/economics/candidate-a-implementation.md` and `candidate-a-10k-validation.json`.

---

## Appendix — per-ladder Common / specials / Cougar (blend)

See JSON: `reports/economics/alpaca-penalty-strength-sim.json` → `summary[]` and `results.<Ladder>.scenarios.*`.
