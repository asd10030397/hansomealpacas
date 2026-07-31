# HANSOME Score v1 — Frozen Specification (Revised)

| Field | Value |
|-------|-------|
| **Status** | **FROZEN** — historical Week 1 only. Live engine uses [`HANSOME_SCORE_V1_1_SPEC.md`](HANSOME_SCORE_V1_1_SPEC.md) `1.1.0-week1.5` |
| **Version** | `1.0.0-week1` |
| **Week 1 result** | Score **92** preserved historically — do not silently overwrite or retune |
| **Date** | 2026-07-27 |
| **Primary test token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Chain** | Robinhood Chain · chainId **4663** |
| **Related** | [`HANSOME_TAXONOMY_AND_EXPLORE.md`](HANSOME_TAXONOMY_AND_EXPLORE.md), [`HANSOME_MEME_STORY_SPEC.md`](HANSOME_MEME_STORY_SPEC.md) |

---

## 0. Purpose

HANSOME Score helps users assess **structural / on-chain risk and transparency** of a token. It is **not** a popularity contest, price prediction, or rug-or-moon oracle.

**Separate concepts (never mix):**

| Concept | What it measures | Affects Score? |
|---------|------------------|----------------|
| **HANSOME Score** | Structural risk & transparency | — (is the score) |
| **Activity** | Trading / holder activity level | No |
| **Confidence** | Data completeness + token maturity | No (shown beside score) |
| **Category / Trending** | Taxonomy & relative momentum | No — see taxonomy doc |
| **Meme Story (Context)** | “What’s the Meme?” project background | No — Context only; see Meme Story spec |

Category tags, Trending, Explore, and Meme Story are out of Score scope.

---

## 1. Three separate outputs (always shown)

### 1.1 HANSOME Score (0–100)

- Structural / on-chain risk & transparency **only**.
- **NOT** popularity, volume rank, holder count fame, or social buzz.
- Starts at **100**; deductions applied from objective on-chain evidence.
- Floor at **0**; ceiling at **100**.

### 1.2 Activity — Low / Medium / High

- Derived from volume, traders, txs, holder activity (informational).
- Third-party sources (e.g. GeckoTerminal) **OK if labeled** in UI and JSON.
- Does **not** raise or lower HANSOME Score.
- **Presentation:** UI may show branded **HANSOME Level** (e.g. Low → 😐 KINDA HANSOME). Mapping is display-only — see [`HANSOME_LEVEL_PRESENTATION.md`](HANSOME_LEVEL_PRESENTATION.md). Does not change raw Activity, Structural Score, Overall Score, Confidence, or deductions.

### 1.3 Confidence (0–100%)

- Data completeness + token maturity (age / sample coverage).
- New tokens → **high uncertainty via Confidence**, not a fake high Score.
- Missing data → lower Confidence; missing risk signals do **not** invent safety.

---

## 2. Principles (non-negotiable)

1. **Core score inputs** = RPC + Blockscout + self-calculated metrics only.
2. **Third-party** (GeckoTerminal / DexScreener / GoPlus / Birdeye) must **NOT** silently affect core Score. Activity may use them with an explicit `source` label.
3. **HANSOME holdings never increase a token’s Score** (no self-boosting).
4. **Related wallets**: probabilistic wording only (“possible related”, “shared funding pattern”) — never hard “same owner” without on-chain proof of control.
5. **No AI** for rug detection, price prediction, or Score assignment.
6. **Low volume / low holders / small liquidity size ≠ automatic “unsafe”.**
7. **Separate liquidity concerns:**
   - **(A) Size / slippage** → WARNING + Activity context; **not** a heavy Score penalty.
   - **(B) Ownership / withdrawal risk** (unlocked / removable LP) → **may penalize Score**.
8. **Holder count**: do **not** directly penalize new tokens for few holders. Concentration stays in Score; raw count → Activity + age-aware Confidence context.
9. **Trading**: no ordinary low/no-volume penalties in core Score. Wash-trade **patterns** may become risk flags only with objective evidence.
10. **New tokens**: Uncertainty → Confidence, not inflated Score.

---

## 3. Category weights (structural Score)

Base = **100**. Deductions are capped per category. Weights express max deduction budget:

| Category | Max deduction | Notes |
|----------|---------------|-------|
| Liquidity ownership / withdrawal risk | **25** | Unlocked / removable / unknown lock status |
| Holder concentration (not raw count) | **25** | Top-1 / Top-10 share of supply (excl. known burn + labeled pool when identifiable) |
| Wallet relationship risk | **15** | Probabilistic clustering of top holders / deployer links |
| Launch fairness / deployer distribution | **15** | Deployer retained share, sniper-like early concentration |
| Creator behaviour (sells / transfers) | **20** | Large creator dumps / silent transfers after launch |
| **Total max** | **100** | |

**Liquidity SIZE is not in this table.** Size/slippage → warning flags + Activity only.

Week 1 may use incomplete signals (e.g. creator sells not fully indexed); missing signals → no deduction + lower Confidence, never assumed safe.

---

## 4. Deduction rule table (v1)

### 4.1 Liquidity ownership / withdrawal risk (max 25)

| Condition | Deduction | Evidence |
|-----------|-----------|----------|
| No LP / pool balance detectable for token | **8** | PoolManager `balanceOf(token)` ≈ 0 and no known pool id |
| LP position known **unlocked / removable** by EOA | **20** | Position NFT owned by EOA or ops wallet |
| LP lock status **unknown** (pool exists) | **10** | Pool balance > 0 but no verified lock |
| LP locked via known locker (time-locked) | **0** | Verified lock contract + unlock date |
| Partial lock / mixed positions | **5–15** | Documented in breakdown |

**HANSOME Week 1 special case:** Official Position NFT #47299 locked via TitanLockerManagerV2 until 2027-07-15 → ownership risk deduction **0** when that evidence is present (from project transparency data + on-chain check if available). Still report lock as data source.

### 4.2 Holder concentration (max 25)

Exclude from concentration math when labeled: burn addresses (`0x0`, `0xdead`), and when known, Uniswap v4 PoolManager as AMM inventory (circulating LP, not a “whale wallet”).

| Condition | Deduction |
|-----------|-----------|
| Top-1 holder ≥ 50% of remaining supply | **25** |
| Top-1 ≥ 30% | **18** |
| Top-1 ≥ 20% | **12** |
| Top-1 ≥ 10% | **6** |
| Top-10 ≥ 80% | **+8** (capped by category max) |
| Top-10 ≥ 60% | **+4** |
| Else | **0** |

Raw holder count is **not** a deduction.

### 4.3 Wallet relationship risk (max 15)

| Condition | Deduction | Wording |
|-----------|-----------|---------|
| ≥3 top-20 holders share identical balance + similar funding pattern | **8** | “Possible related wallets (probabilistic)” |
| Deployer still holds and appears among clustered top holders | **5** | “Deployer linked to concentrated cluster (probabilistic)” |
| Insufficient graph data | **0** | Lower Confidence |

Week 1: clustering is **heuristic** (equal balances among EOAs in top holders). Never claim common ownership.

### 4.4 Launch fairness / deployer distribution (max 15)

| Condition | Deduction |
|-----------|-----------|
| Deployer current balance ≥ 20% supply | **15** |
| Deployer ≥ 10% | **10** |
| Deployer ≥ 5% | **5** |
| Deployer &lt; 5% or zero | **0** |
| Contract not verified on explorer | **+3** (cap category) |

### 4.5 Creator behaviour (max 20)

| Condition | Deduction |
|-----------|-----------|
| Evidence of large creator sell (&gt;5% supply) post-launch | **15–20** |
| Material creator transfers to fresh EOAs then sell | **10–15** |
| No sell/transfer index available | **0** + Confidence penalty |

Week 1: creator-behaviour may often be **unavailable** → score uses other categories; Confidence drops.

---

## 5. Risk flags & warnings (non-Score)

Shown separately; may appear even when Score is high.

| Flag | Type | Affects Score? |
|------|------|----------------|
| Low / thin liquidity (size) | **WARNING** | No (unless ownership risk also true) |
| Low holder count | **INFO** (age-aware) | No |
| Low / no volume | **INFO** | No |
| Unlocked LP | **RISK** | Yes (ownership category) |
| Possible related wallets | **RISK** | Yes (relationship category) |
| Unverified contract | **RISK** | Yes (launch fairness) |
| Incomplete data | **INFO** | Confidence only |

---

## 6. Activity rules (Low / Medium / High)

Inputs (any available; label sources):

- 24h volume (USD) — third-party OK if labeled
- 24h tx count / unique traders — third-party OK if labeled
- Transfer count / holder activity from Blockscout counters
- Age-aware: brand-new tokens default toward Low unless volume evidence exists

| Level | Heuristic (Week 1) |
|-------|---------------------|
| **Low** | Volume &lt; $1k/24h **or** txs &lt; 20/24h **or** missing volume with low transfer velocity |
| **Medium** | Between Low and High |
| **High** | Volume ≥ $50k/24h **and** txs ≥ 100/24h (or strong labeled third-party equivalent) |

Exact thresholds may be tuned; UI must show `source` (e.g. `geckoterminal`, `blockscout-counters`).

**HANSOME Level (presentation):** branded labels map from raw Activity and never feed Score. Catalog and rules: [`HANSOME_LEVEL_PRESENTATION.md`](HANSOME_LEVEL_PRESENTATION.md).

---

## 7. Confidence rules (0–100%)

Start at **100%**, subtract:

| Gap | Penalty |
|-----|---------|
| Missing totalSupply / decimals / symbol | **−25** |
| Missing deployer | **−15** |
| Holders sample &lt; 10 or holders_count unknown | **−15** |
| LP ownership / lock status unknown | **−10** |
| No Activity volume source | **−10** |
| Token age &lt; 24h | **−15** |
| Token age &lt; 7d | **−8** |
| Creator behaviour not indexed | **−10** |
| Contract unverified | **−5** |

Floor **5%**. UI copy: “Confidence reflects data completeness and maturity — not how ‘good’ the token is.”

---

## 8. Data sources

| Source | Used for | May affect Score? |
|--------|----------|-------------------|
| Robinhood RPC | `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf` (PoolManager, deployer) | Yes |
| Blockscout API | Deployer, holders list, holders_count, transfers_count, verification | Yes |
| Project transparency (`content/transparency.ts`) | Label known HANSOME wallets; LP lock metadata for HANSOME | Labels + HANSOME lock evidence only |
| GeckoTerminal (optional) | Activity volume / txs | **Activity only** |
| DexScreener / GoPlus / Birdeye | Not in Week 1 core | Must not silently affect Score |
| AI / LLM | **Forbidden** for Score | — |

**Explorer:** `https://robinhoodchain.blockscout.com/`  
**RPC:** from `lib/chain.ts` / `NEXT_PUBLIC_RPC_URL`  
**HANSOME pool id (Week 1 hardcoded):** `POOL_ID` in `lib/chain.ts`  
**PoolManager (Robinhood):** `0x8366a39CC670B4001A1121B8F6A443A643e40951`

---

## 9. UI wording

- Title outputs as cards: **Score**, **HANSOME Level** (branded Activity), **Confidence**.
- Score subtitle: “Structural risk & transparency — not popularity.”
- Related wallets: “Possible related wallets (probabilistic — not proof of common ownership).”
- Liquidity size: “Thin liquidity warning — size alone does not mean unsafe.”
- Disclaimer (required): Not financial advice; Score is a prototype heuristic; DYOR; no AI prediction.
- Never show “Safe” / “Rug” as absolute labels. Prefer “Higher structural risk” / “Fewer structural red flags in available data.”

---

## 10. Week 1 implementation scope

**In scope:** `/scan` paste CA → server fetch → Score + Activity + Confidence + deductions + flags + sources; shareable `/scan/[address]`; HANSOME as fixed primary test.

**Out of scope:** `/explore`, Trending ranking UI, category assignment UI, Meme Story UI (Week 1), paid promotion, production deploy, launchpad contracts, AI scoring.

### Out of scope / separate layers

| Layer | Relation to Score |
|-------|-------------------|
| Taxonomy / Category / Tags | Separate — never feeds Score |
| Trending / Explore | Separate — never feeds Score |
| **Meme Story / “What’s the Meme?”** | **Context only** — never feeds Score, Activity, Trending, or Confidence |

Full Meme Story rules: [`HANSOME_MEME_STORY_SPEC.md`](HANSOME_MEME_STORY_SPEC.md).  
Taxonomy / Explore / Trending roadmap: [`HANSOME_TAXONOMY_AND_EXPLORE.md`](HANSOME_TAXONOMY_AND_EXPLORE.md).

---

## 11. Change control

Edits to weights or deduction thresholds after freeze require an explicit version bump (`1.0.1+`) and a note in `reports/HANSOME_SCORE_WEEK*_REPORT.md`. Do not silently retune to make HANSOME “look better.”

**Production caching (planned):** Live engine follows v1.1+ specs; Scan serving/TTL design is documented in [`reports/HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](../reports/HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md) (does not alter this frozen Week 1 formula).
