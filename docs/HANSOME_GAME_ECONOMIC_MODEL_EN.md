# HANSOME: Alpacas vs Cougars  
## GameFi Economic Model — Mathematical Analysis

| Field | Value |
|------|------|
| Document | GameFi Economic Model (standalone analysis) |
| Project | HANSOME: Alpacas vs Cougars |
| Chain | Robinhood Chain |
| Game | [https://game.hansomealpacas.xyz/](https://game.hansomealpacas.xyz/) |
| Version | 1.0.0 |
| Status | Analytical companion to GDS v1.1 / implemented contracts |
| Languages | English (this file) · Traditional Chinese (`HANSOME_GAME_ECONOMIC_MODEL_ZH.md`) |

**Disclaimer.** This document explains the **implemented** daily emission and settlement mathematics. It does **not** promise profits, guaranteed yields, or fixed APYs. Outcomes depend on participation, skill, treasury health G, NFT identity (Alpaca / Cougar / traits), and market conditions for `$HANSOME` and NFTs. Nothing herein is investment advice.

**Sources of truth (formulas):** `EmissionController.sol`, `SettlementLib.sol`, `GameTypes.sol`, `GameTreasury.sol`, GDS v1.1. Token **supply** of `$HANSOME` (1,000,000,000 fixed) is unchanged by gameplay emission — rewards are paid from the **GameTreasury** balance, not minted.

---

## Abstract

HANSOME is an asymmetric day-settled GameFi economy on Robinhood Chain. Each day a bounded reward pool R_d is drawn from GameTreasury spendable balance G. That pool is split into Alpaca, Cougar Base, and Hunting sub-pools. Players compete through Commit → Reveal → Settlement → Claim. Emission bands shrink R_d as G falls, protecting longevity. Penalties, dust, and empty-pool remainders return to the Treasury rather than leaking value. The design aims for **two-sided value**: active players earn contingent rewards and utility; the ecosystem retains a sustainable runway, engagement, and token utility without unlimited inflation.

---

## 1. Game Economic Model — Daily Emission

### 1.1 Core relation

```text
R_d = f(G)
```

where:

- G = GameTreasury **spendable** balance of `$HANSOME`  
  G = balance - outstandingClaims
- R_d = that day’s **fixed** reward pool (whole tokens, 18 decimals on-chain)
- f is a **step function** of G relative to fixed reference G_0 (not a floating high-water mark)

### 1.2 Implemented parameters

| Symbol | Value | Role |
|--------|------:|------|
| G_0 | 300,000,000 HANSOME | Band reference (“initial treasury” scale) |
| G_safe | 15,000,000 HANSOME | Safe-mode threshold |
| R_0 | 400,000 HANSOME | Top-band daily pool |

### 1.3 Emission bands (on-chain)

| Condition | Daily pool R_d |
|-----------|-------------------:|
| G ≥ 0.70 G_0 | 400,000 |
| 0.40 G_0 ≤ G < 0.70 G_0 | 280,000 |
| 0.20 G_0 ≤ G < 0.40 G_0 | 160,000 |
| G_safe ≤ G < 0.20 G_0 | 80,000 |
| G < G_safe | 0 (+ Commit paused in implementation) |

Numeric thresholds for G_0 = 300,000,000:

| Band floor | G |
|------------|------:|
| 0.70 G_0 | 210,000,000 |
| 0.40 G_0 | 120,000,000 |
| 0.20 G_0 | 60,000,000 |
| G_safe | 15,000,000 |

### 1.4 Mathematical purpose

1. **No unlimited emission** — R_d is capped per day and cannot grow with “demand” alone.  
2. **Treasury longevity** — as G declines, R_d steps down, extending runway.  
3. **Incentive preservation** — while G ≥ G_safe, a positive pool remains (until safe mode).  
4. **No mint** — settlement never mints `$HANSOME`; it only **reserves** and later **transfers** from GameTreasury.

```text
                    ┌─────────────────┐
                    │  GameTreasury G │
                    └────────┬────────┘
                             │ f(G)
                             ▼
                    ┌─────────────────┐
                    │   Daily pool Rd │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
        Ra = 80%          Rc = 10%          Rh = 10%
      Alpaca Pool      Cougar Base       Hunting Pool
```

---

## 2. Daily Reward Distribution Formula

### 2.1 Pool split (exact)

```text
R_d^A = ⌊ R_d × 0.80 ⌋,
R_d^C = ⌊ R_d × 0.10 ⌋,
R_d^H = ⌊ R_d × 0.10 ⌋
```

```text
splitDust = R_d - R_d^A - R_d^C - R_d^H
```

(`SettlementLib.splitDailyPool` — integer division; dust returns to Treasury via unallocated.)

### 2.2 Conceptual player reward

A useful pedagogical decomposition (maps to on-chain terms below):

```text
Reward_i ≈ (R_pool · W_i / Σ_j W_j) · (1 − π_i) · τ_i
         = pool share × survival/hunt risk × trait effects
```

**On-chain Alpaca (precise):**

1. Location weight w(L) ∈ {1, 2, 3, 5, 8} (Home…River).  
2. Effective weight numerator: Farmer uses 1.20 × w(L), else w(L).  
3. Gross: r_i^(A,gross) = R_d^A · ω_i / Ω_d (last participant absorbs dust).  
4. Penalty rate π_i from location pressure + traits (King / Guardian / Lucky / Runner).  
5. Net credited: r_i^(A,net) = r_i^(A,gross) × (1 − π_i).

**On-chain Cougar (precise):**

1. Base: equal split of R_d^C among valid Cougars.  
2. Hunt: if location huntable and ≥1 Alpaca there, share of R_d^H proportional to Alpaca count at that location; else hunt share 0 and R_d^H → dust/unallocated.

### 2.3 Worked example (illustrative, not a forecast)

Assume R_d = 400,000, so R_d^A=320,000, R_d^C=40,000, R_d^H=40,000.

**Example A — two Alpacas, no Cougars, both at Grassland (w=3), Common class, π=0:**

```text
Ω = 3 + 3 = 6
r_1 = r_2 = 320,000 × (3/6) = 160,000
```

R_d^C+R_d^H become unallocated (no Cougars) and stay in Treasury.

**Example B — one Common Alpaca and one Cougar both at Grassland; Alpaca faces pressure:**

- Alpaca receives gross from R_d^A, then net after π > 0.  
- Cougar receives base R_d^C (alone ⇒ all of it) plus hunt share of R_d^H if hunt succeeds.  
- Penalties from Alpaca return to Treasury (not paid to the Cougar wallet).

---

## 3. Alpaca vs Cougar Economic Model

| Dimension | Alpaca | Cougar |
|-----------|--------|--------|
| Supply (Genesis) | 500 | 50 |
| Pool access | R_d^A (80%) | R_d^C (10%) + R_d^H (10%) |
| Income drivers | Location weight, Farmer +20% weight, trait mitigation of π | Equal base split; hunt share if co-located with Alpacas |
| Primary risk | Hunting penalty π at non-Home locations | Failed hunts (R_d^H dust); competition among Cougars |
| Home | Allowed (safe from hunt π^0=0) | Illegal (invalid day) |
| Traits | King / Guardian / Farmer / Lucky / Runner / Common | None (uniform w^C=1) |

**Demand for gameplay:** Alpacas create “prey density” that makes Hunting Pool meaningful; Cougars create risk that makes location and trait choice meaningful. Neither side’s rewards are automatic — both require valid Commit + Reveal.

---

## 4. Game Theory Analysis

### 4.1 Expected value (decision frame)

For a rational player deciding whether to acquire / play an NFT:

```text
EV = Σ_{s ∈ S} Pr(s) · Reward(s) − Cost
```

where S is the set of plausible day outcomes, and **Cost** may include NFT acquisition, opportunity cost, and gas — **not** protocol fees on rewards (claims are pull transfers of already-reserved amounts).

Players condition on:

- NFT acquisition cost and secondary-market liquidity  
- Skill (location choice, when to risk River vs Home)  
- Survival / hunt probabilities (endogenous to the day’s cohort)  
- Current G and thus R_d band  

**Important:** EV can be negative. High skill does not imply profit after NFT cost.

### 4.2 Population balance (Nash-style intuition)

Let n_A, n_C be active Alpacas and Cougars on a day at overlapping locations.

- **Too many Cougars:** Base pool R_d^C splits thinner; hunt competition rises; Alpacas may hide at Home → fewer successful hunts → R_d^H dust ↑.  
- **Too many Alpacas:** Alpaca gross shares dilute; Cougars enjoy denser hunt targets but Alpacas may spread across locations.  
- **Balanced play:** Risk and reward remain interesting for both sides → higher engagement.

This is **not** a solved closed-form Nash equilibrium claimed by the protocol; it is a qualitative stability argument consistent with the asymmetric pool design (80/10/10).

### 4.3 Conservation identity (protocol invariant)

For each settled day:

```text
R_d = playerTotal          (reserved for claims)
    + P_d^pen              (stays in Treasury)
    + unallocated          (dust + empty pools + failed hunt R_d^H)
```

So emission never “disappears”; unpaid pool mass remains spendable G (except amounts later claimed by players).

---

## 5. Treasury Sustainability Model

### 5.1 Gross runway (informational)

Ignoring sinks, penalty recycling, and band step-downs:

```text
Lifetime_gross ≈ G_0 / R_0
             = 300,000,000 / 400,000
             = 750 days
```

### 5.2 Why actual lifetime differs

| Factor | Effect on runway |
|--------|------------------|
| Emission step-downs | R_d falls as G falls → **longer** calendar life |
| Penalties / unallocated / hunt dust | Stay in Treasury → **slower** net drain than R_d per day |
| Player claims | Reduce balance when paid |
| Token sinks (players → Treasury) | Can **increase** G |
| Safe mode G < G_safe | R_d=0, Commit paused → freeze until rebuilt |
| Activity level | Low participation → more unallocated; high participation → more `playerTotal` reserved |

### 5.3 Protocol design vs launch funding

| Layer | Amount / effect |
|-------|-----------------|
| **Protocol design** (\(G_0\)) | **300,000,000** HANSOME — immutable band **reference** in `GameTypes` / GDS §15 |
| **Launch operations** | **30,000,000** HANSOME — approved Mainnet launch funding (not a change to \(G_0\)) |
| **Initial reward band** | **80,000** HANSOME/day (`G_SAFE ≤ G < 0.20·G0`) |

#### Initial Treasury Funding Source (ops)

- **30,000,000 HANSOME** transferred from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` → GameTreasury at Mainnet launch ceremony.
- One-time **operational** launch funding; wallet **not** hardcoded in Solidity.
- Future top-ups may use this wallet or other approved project treasury wallets.

The protocol is designed for progressive treasury expansion as the ecosystem grows. Additional funding automatically unlocks higher reward bands without requiring any contract upgrades.

Full ops write-up: [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md).

### 5.4 Initial Treasury Strategy

1. Launch begins with **30,000,000** HANSOME — an intentional operational decision (not a change to \(G_0\)).
2. Treasury may be increased later by transferring more `$HANSOME` into GameTreasury.
3. Crossing **60M / 120M / 210M** spendable automatically raises \(R_d\) to **160k / 280k / 400k**.
4. No contract upgrade is required.

### 5.5 Treasury Operations (guidelines — not smart-contract rules)

| Spendable \(G\) | Suggested ops action |
|-----------------|----------------------|
| **30M** | Launch |
| **20M** | Review treasury status |
| **17M** | Prepare additional funding |
| **15M** | SafeMode threshold (on-chain) |

---

## 6. Two-Sided Value Creation

| Players gain | Ecosystem gains |
|--------------|-----------------|
| ↑ Contingent reward opportunities | ↑ Daily active participation |
| ↑ NFT utility (identity + traits) | ↑ Retention via day loop |
| ↑ Competitive / entertainment value | ↑ Demand for Genesis NFTs |
| ↑ Agency (location, side, traits) | ↑ `$HANSOME` utility (claims, sinks) |
| ↑ Transparent, auditable math | ↑ Sustainable emission discipline |

A healthy GameFi economy requires **both** sides: unbounded player extraction without runway destroys the game; a full Treasury with no players creates no culture. HANSOME couples them through G → R_d and asymmetric roles.

---

## 7. Why HANSOME’s Economy Is Designed for Long-Term Sustainability

This section explains **design intent**, not expected returns. Longevity depends on participation, funding of GameTreasury, ops quality, and markets. Nothing here guarantees profit for players or the project.

### 7.1 Comparison with traditional Play-to-Earn (P2E)

| Theme | Typical historical P2E pattern | HANSOME approach (implemented) |
|-------|--------------------------------|--------------------------------|
| Reward source | Often continuous mint / inflationary emissions | Rewards paid from **pre-funded GameTreasury**; `$HANSOME` supply is **fixed** (no gameplay mint) |
| Emission control | Hard to stop once flywheel of “print → sell” starts | R_d = f(G) **step bands** shrink the daily pool as G falls; safe mode can halt Commits |
| Player incentive | Maximize extractable tokens today | Compete for a **bounded** daily pool via Commit / Reveal / skill |
| Ecosystem incentive | Grow users even if emission is unsustainable | Preserve runway so the day loop can remain meaningful longer |
| Risk to holders | Dilution from new mint | Dilution from gameplay mint is **structurally removed**; market risk remains |

Traditional P2E often failed when emissions outran sinks and newcomers funded exits. HANSOME does not claim to eliminate market risk; it **removes unlimited reward minting** as a protocol lever and ties payouts to treasury health.

### 7.2 Fixed-supply token advantage

`$HANSOME` is a **fixed-supply** ERC-20: the full supply was minted once at token deployment; there is no owner mint for gameplay rewards.

| Implication | Why it matters for sustainability |
|-------------|-----------------------------------|
| Settlement never mints | Claiming cannot inflate supply |
| Game rewards = transfers | Every HANSOME paid to players left GameTreasury (or was already outside it) |
| Tokenomics unchanged by this model | Game math does **not** rewrite total supply, taxes, or LP allocation |

Fixed supply does **not** imply price support. It only means the game cannot “print its way” out of a reward schedule.

### 7.3 Treasury-controlled reward emission

Daily emission is gated by spendable treasury balance G:

```text
R_d = f(G),
f is a decreasing step function of G relative to G_0.
```

- High G → larger R_d (up to R_0 = 400,000).  
- Falling G → automatic step-downs (280,000 → 160,000 → 80,000).  
- G < G_safe → R_d = 0 and Commits paused in the implementation.

Penalties, split dust, empty-pool remainders, and failed-hunt R_d^H stay in the Treasury (conservation identity). Sinks can return tokens to G. Together, these mechanisms **slow net drain** relative to a naive “always pay full R_d with no recycling” model — without promising a fixed calendar lifetime.

### 7.4 Player vs ecosystem alignment

| If the design over-favors… | Failure mode | HANSOME counterweight |
|----------------------------|--------------|------------------------|
| Players only | Treasury empties; later cohorts get nothing meaningful | Emission bands + safe mode + no mint |
| Ecosystem / Treasury only | No reason to play; NFTs idle | Positive R_d while G ≥ G_safe; asymmetric pools; pull claims |
| Short-term extraction | Dump pressure after farm | Bounded R_d; rewards require valid play each day |

Alignment means: **active play** is the path to contingent rewards, and **treasury health** is the path to continued emission. Neither side is promised a win; both are constrained by the same G.

### 7.5 Alpaca / Cougar two-sided gameplay economy

Sustainability is not only about G; it is also about **keeping both roles interesting**:

- **Alpacas (80% pool):** Location weight, traits, and hunting risk create strategic depth. Over-hunting pressure pushes Alpacas toward safer locations — which reduces Cougar hunt success.  
- **Cougars (10% + 10% hunt):** Need Alpaca presence to monetize the Hunting Pool; too many Cougars dilute base shares and can starve hunt opportunities.  
- **Feedback loop:** Imbalance reduces EV for the overcrowded side → players may switch roles or locations → engagement stays competitive rather than one-sided farming.

A one-sided “only farm the high APY role” meta is what burned many P2E titles. The 80/10/10 split plus hunt dependency is intended to make **mutual demand for opponents** part of the economy — again without guaranteeing that any role is profitable after NFT cost.

### 7.6 What “long-term” does and does not mean

| This document claims | This document does **not** claim |
|----------------------|----------------------------------|
| Emission is bounded and treasury-linked | Guaranteed years of rewards |
| Fixed supply blocks reward inflation | Guaranteed token price |
| Two-sided play supports retention design | Guaranteed player profit |
| Gross runway at G_0/R_0 ≈ 750 days is an **illustration** | That illustration equals real calendar life |

Sustainability here means **structural resistance to unlimited emission**, not a promise that the economy will always grow or that participants will earn net positive returns.

---

## 8. Example Scenarios

### Scenario A — High treasury health

| Item | Value |
|------|------|
| G | ≥ 210,000,000 (0.70 G_0) |
| R_d | 400,000 |
| Player impact | Maximum designed daily pool |
| Sustainability | Fastest gross drain; still ~hundreds of days at R_0 from G_0 |

### Scenario B — Medium treasury

| Item | Value |
|------|------|
| G | e.g. 120,000,000–210,000,000 |
| R_d | 280,000 (or 160,000 if lower) |
| Player impact | Smaller absolute rewards; competition still matters |
| Sustainability | Step-down automatically extends life |

### Scenario C — Low treasury / protection mode

| Item | Value |
|------|------|
| G | 15,000,000 ≤ G < 60,000,000 → R_d=80,000; G < 15,000,000 → R_d=0 |
| Player impact | Minimal or **no** Commit (safe mode) |
| Sustainability | Protocol prioritizes Treasury recovery (e.g. sinks) over emission |

---

## 9. Claim Path (economic settlement)

```text
Gameplay → finalizeDay (reserve playerTotal from G)
        → creditBatch (book claimable[tokenId])
        → claim / claimMany (Treasury pays $HANSOME to player)
```

RewardDistributor holds **no** token inventory; it only tracks claimable balances. Double-claim is prevented by zeroing claimable before transfer.

---

## 10. Risks (non-exhaustive)

- NFT and token prices are volatile; rewards in HANSOME ≠ fiat profit.  
- Missed Reveal → zero reward for that NFT that day.  
- Safe mode can halt Commits.  
- Population imbalance can compress one side’s EV.  
- Smart-contract / operational / market risks remain.  
- This model does **not** cover off-chain speculation or leveraged products.

---

## 11. References

| Resource | Location |
|----------|----------|
| Live game | https://game.hansomealpacas.xyz/ |
| Litepaper | https://game.hansomealpacas.xyz/litepaper |
| GDS v1.1 (EN) | `docs/HANSOME_GDS_v1.1_en.md` |
| Emission / settlement code | `contracts/contracts/game/EmissionController.sol`, `SettlementLib.sol` |
| Chinese edition | `docs/HANSOME_GAME_ECONOMIC_MODEL_ZH.md` |
| PDF (EN / ZH) | `docs/HANSOME_GAME_ECONOMIC_MODEL_EN.pdf`, `…_ZH.pdf` · also served under `/docs/` on the site |

---

*© HANSOME. Analytical document for education and transparency. Not a prospectus.*
