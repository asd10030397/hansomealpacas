# HANSOME Score — External Reconciliation (Pre–Week 2)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Mode** | READ-ONLY validation — **no score retune**, **no Week 2 product work**, **no deploy** |
| **Spec** | [`docs/HANSOME_SCORE_V1_SPEC.md`](../docs/HANSOME_SCORE_V1_SPEC.md) `1.0.0-week1` |
| **Engine** | `lib/hansome-score/**` |
| **Week 1 result** | Score **92**, Activity **Low**, Confidence **90%** |
| **Primary external** | GeckoTerminal GT Security Score **~34.3** (UI shows **34**) |
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · Robinhood **4663** |
| **Pool** | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |

**Verdict (one of three):** **SCORE MODEL NEEDS REVISION**

---

## 1. Our v1 point allocation (exact)

### 1.1 Outputs (never mixed)

| Output | Range | Affects Score? |
|--------|-------|----------------|
| HANSOME Score | 0–100 | — |
| Activity | Low / Medium / High | **No** |
| Confidence | 0–100% | **No** |

Base Score = **100**. Deductions only. Floor 0.

### 1.2 Category caps (max deduction budget)

| Category | Max | What it covers |
|----------|-----|----------------|
| Liquidity ownership / withdrawal risk | **25** | Unlocked / removable / unknown lock — **not** LP size |
| Holder concentration | **25** | Top-1 / Top-10 % (excl. burn + labeled PoolManager) |
| Wallet relationship risk | **15** | Equal-balance clustering (probabilistic) |
| Launch fairness / deployer distribution | **15** | Deployer % + unverified (+3) |
| Creator behaviour | **20** | Large creator sells / transfer-then-sell |
| **Total** | **100** | |

**Explicitly out of Score:** liquidity size/slippage, raw holder count, ordinary low volume, popularity, socials, CoinGecko listing.

### 1.3 Deduction rules (engine = `computeStructuralScore`)

**Liquidity ownership**

| Condition | Points |
|-----------|--------|
| No pool / PoolManager bal ≈ 0 | −8 |
| Unlocked / removable by EOA | −20 |
| Lock unknown (pool exists) | −10 |
| Locked via known locker | **0** |
| HANSOME special: Titan Position NFT #47299 (transparency) | **0** when evidence present |

**Holder concentration** (excl. burn + PoolManager)

| Condition | Points |
|-----------|--------|
| Top-1 ≥ 50% | −25 |
| Top-1 ≥ 30% | −18 |
| Top-1 ≥ 20% | −12 |
| Top-1 ≥ 10% | −6 |
| Top-10 ≥ 80% | +−8 (capped by category) |
| Top-10 ≥ 60% | +−4 |
| Else | **0** |

**Wallet relationship**

| Condition | Points |
|-----------|--------|
| ≥3 top holders share identical balance | −8 |
| Deployer inside that cluster | −5 |
| Insufficient graph | **0** (+ Confidence) |

**Launch fairness**

| Condition | Points |
|-----------|--------|
| Deployer ≥ 20% | −15 |
| Deployer ≥ 10% | −10 |
| Deployer ≥ 5% | −5 |
| Deployer &lt; 5% | **0** |
| Unverified contract | −3 |

**Creator behaviour**

| Condition | Points |
|-----------|--------|
| Large creator sell / transfer-then-sell | −10 to −20 |
| Index unavailable (Week 1 default) | **0 Score** + Confidence −10 |

### 1.4 Confidence penalties (not Score)

Missing meta −25 · missing deployer −15 · thin holders sample −15 · LP lock unknown −10 · no Activity volume −10 · age &lt;24h −15 / &lt;7d −8 · creator not indexed −10 · unverified −5. Floor 5%.

### 1.5 What HANSOME got (Week 1 + re-check)

| Category | Applied | Why |
|----------|---------|-----|
| Liquidity ownership | **0 / 25** | Transparency + lock tx → `locked` (Titan #47299 → 2027-07-15) |
| Holder concentration | **0 / 25** | PoolManager excluded; top-1 excl-pool ~**6.0%**; top-10 excl-pool ~**35.4%** (below −6 / −4 thresholds) |
| Wallet relationship | **−8 / 15** | 18 equal-balance EOAs (`equal_balance_cluster`) |
| Launch fairness | **0 / 15** | Deployer ~**0.57%**; verified |
| Creator behaviour | **0 / 20** | Index not built → no deduction |
| **Score** | **92** | 100 − 8 |
| Activity | Low | GT ~$51 / 3 txs (labeled; not Score) |
| Confidence | 90% | −10 creator behaviour only |

**Categories that scored full / near-full by default for HANSOME:**

- Liquidity ownership: full (special-case lock knowledge; arbitrary tokens would often get −10 unknown).
- Holder concentration: full (thresholds + PoolManager exclusion).
- Launch fairness: full (low deployer %, verified).
- Creator behaviour: full points retained **by absence of data** (Confidence absorbs uncertainty — Score does not).

---

## 2. External assessments (live fetch)

### 2.1 GeckoTerminal — GT Security Score **34.29** (UI **34**)

Source: pool page HTML + `GET …/pools/{pool}/info` token attributes (2026-07-27).

| Field | Value |
|-------|-------|
| **gt_score** | **34.2857** |
| **gt_score_details.pool** | 50.667 |
| **gt_score_details.transaction** | **0.0** |
| **gt_score_details.creation** | 50.0 |
| **gt_score_details.info** | 80.0 |
| **gt_score_details.holders** | **15.0** |
| gt_verified | true |
| is_honeypot | false |
| holders.count | 92 |
| holders.top_10 % | **45.1414** |
| holders 11–30 / 31–50 / rest | 35.0854 / 18.579 / 1.1942 |
| mint_authority / freeze_authority | null |
| developer_holding_percentage | null |
| Pool `locked_liquidity_percentage` | **null** (API) |
| 24h vol / txs | ~$51.43 / 3 |
| Liquidity (reserve_in_usd) | ~$16,216 |
| Age | ~15 days |

**Interpretation:** GT blends **market activity + pool health + holders + info + age**. `transaction: 0` alone crushes the composite. This is **not** the same construct as HANSOME Score (structural-only). User’s “~37” matches this band (live **34**).

GT docs (CoinGecko Help): GT Score mixes liquidity/volume/traders **and** safety/supply; strength in one area can offset weakness in another. Our Activity already maps the volume/tx piece separately as **Low**.

### 2.2 GoPlus Token Security API (chainId **4663**)

`GET https://api.gopluslabs.io/api/v1/token_security/4663?contract_addresses=0x2C38…`

| Field | GoPlus value | Notes |
|-------|--------------|-------|
| is_open_source | **1** | Matches Blockscout verified |
| is_honeypot | **0** | Matches GT / source |
| is_mintable | **0** | Matches fixed-supply source |
| is_proxy | **0** | OK |
| transfer_pausable | **0** | OK |
| cannot_buy | **0** | OK |
| is_blacklisted / is_whitelisted | **0** | OK |
| owner_percent / owner_balance | **0** | No Ownable owner |
| creator_percent | **0.005662** (~0.57%) | Matches RPC deployer bal |
| creator_address | `0xfeff…691f` | Matches Blockscout |
| holder_count | **92** | Matches Blockscout |
| buy_tax / sell_tax / transfer_tax | **""** (empty) | Not numeric 0 — incomplete |
| **is_in_dex** | **0** | **STALE / wrong** — Uniswap v4 pool live |
| **holders[]** | **2 dust contracts** (~1 wei) | **STALE** — not live top holders |
| top10 % | **not returned usefully** | Prior report of ~76% was stale vs live ~45% |

GoPlus does **not** currently return a single 0–100 “score” for this chain response; contract flags are mostly green, but **DEX/holder indexing is unreliable** on Robinhood 4663.

### 2.3 Birdeye

Public overview call returned **401 Unauthorized**. No Birdeye security tab data captured without API key.

### 2.4 Other ~37 scores

No other public composite near ~37 found beyond GT. The reported external ~37 is explained by **GT Security Score ~34**.

---

## 3. Live on-chain / Blockscout truth (2026-07-27)

| Fact | Value | Source |
|------|-------|--------|
| Contract verified | **true** (`HansomeAlpacas.sol`) | Blockscout smart-contract |
| Mintability | **Not mintable post-deploy** — constructor `_mint` once; `MAX_SUPPLY` constant; no `mint` in ABI | Source + ABI |
| Owner / Ownable | **None** | Source (plain OZ ERC20) |
| Tax | **0** (no transfer fee hooks) | Source |
| Honeypot / blacklist / pause | **None in source** | Source |
| totalSupply | **1,000,000,000** | RPC |
| Holders | **92** | Blockscout counters |
| Transfers | **1091** | Blockscout counters |
| Deployer | `0xfEff679d14f7D1a2F343095680430e4c96dE691F` | Blockscout |
| Deployer balance | ~**5,662,063** (~**0.57%**) | RPC |
| PoolManager bal | ~**114,191,368** (~**11.42%**) | RPC |
| Top-10 **raw** (incl. PoolManager) | ~**45.02%** | Blockscout holders page |
| Top-10 **excl. PoolManager** | ~**35.40%** | Recalc |
| Top-1 excl. PoolManager | ~**5.98%** | Recalc |
| Equal-balance cluster (non-pool) | **18** wallets same raw balance | Recalc |
| LP lock | TitanLockerManagerV2 `createPositionLock` tx `0x8ac188…bcf3` @ 2026-07-15; Position NFT **#47299**; unlock **2027-07-15** | Blockscout + transparency |
| GT locked_liquidity_percentage | **null** | GT may not see Titan/v4 lock |

---

## 4. Side-by-side signal table

| Signal | HANSOME Score | External Service | Current On-chain Reality | Explanation |
|--------|---------------|------------------|--------------------------|-------------|
| Composite score | **92** | GT **34.3**; GoPlus no single score | N/A (composite) | Different definitions: we omit activity/size/age/info; GT weights them heavily (`transaction: 0`, `holders: 15`) |
| Honeypot | **Not checked in Score** | GT false; GoPlus `0` | Not a honeypot (plain ERC20) | Structural signal missing from our engine — luckily clean for HANSOME |
| Mintable | **Not checked in Score** | GoPlus `0` | Not mintable | Same gap — should be Score-relevant |
| Owner / renounce | Launch fairness uses deployer **balance %** only | GoPlus owner 0 | No Ownable | We never score “owner can mint/pause” because we don’t parse privileges |
| Buy/sell tax | **Not checked** | GoPlus empty; GT no tax flag | 0% tax in source | Empty GoPlus tax ≠ confirmed 0; source confirms 0 |
| Top-10 % | **0 deduction** (excl. pool ~35%) | GT top10 **45.14%** → holders component **15** | Raw ~**45%**; excl. pool ~**35%** | Fair for our rules; GT likely includes PoolManager; old GoPlus ~76% was stale |
| Holders count | Info flag only if &lt;50; **no Score hit** | GT uses holders in composite | **92** | Spec intentional; GT treats sparse holders as health signal |
| is_in_dex / pool | PoolManager bal → lock path | GoPlus **is_in_dex=0** (wrong); GT pool live | Uniswap v4 pool + ~11.4% in PoolManager | Do **not** trust GoPlus DEX flag on 4663 |
| LP lock | **0** deduction (`locked`) | GT `locked_liquidity_percentage: null` | Titan lock #47299 verified on-chain | We hardcode HANSOME lock via transparency; GT under-awards lock |
| Deployer share | **0** (&lt;5%) | GoPlus creator_percent ~0.57% | ~0.57% | Aligned |
| Related / cluster wallets | **−8** | Not in GT details | 18 equal-balance EOAs | We do penalize; GT may fold into holders score |
| Creator dumps | **0** (unavailable) | Not visible in these APIs | Not fully indexed by us | Free Score points; only Confidence −10 |
| Liquidity **size** | Warning only (not Score) | GT pool component ~50.7; ~$16k TVL | ~$16k | Spec split size vs ownership — users may still read our 92 as “safe” |
| Volume / txs | Activity **Low** (not Score) | GT transaction **0** | ~$51 / 3 txs | Explains most of 92 vs 34 gap |
| Contract verified | No deduction | GT verified; GoPlus open source | Verified | Aligned |
| Confidence | **90%** | N/A | Creator index gap real | Confidence correctly reduced; Score still high |

---

## 5. Adversarial test (harsh)

**Question:** Can a clearly bad token still score **80–90+** under v1?

**Yes.** Engine gaps + “missing data → no deduction” make it easy.

### Construct A — “stealth rug template” → **~90**

| Fact | Our v1 effect |
|------|----------------|
| Mintable / honeypot / 50% tax / owner pause | **Ignored** (not in Score) |
| Pool exists, LP lock unknown (non-HANSOME Week 1 path) | **−10** only |
| Top-1 = 9.5%, Top-10 = 59% (many unrelated EOAs) | **0** concentration (thresholds not met) |
| Deployer currently holds 4.9% (rest already distributed to dump wallets) | **0** launch fairness |
| No equal-balance cluster | **0** relationship |
| Creator already dumped 30% but index unavailable | **0** creator behaviour |
| Contract verified | **0** |
| **Score** | **100 − 10 = 90** |
| Confidence | Lower (lock unknown, creator missing) — but UI still shows a high Score |

### Construct B — unlocked LP, concentrated, no creator index → **~72–80**

| Fact | Effect |
|------|--------|
| LP unlocked | −20 |
| Top-10 = 90% with top-1 = 9% | −8 only (no top-1 tier) |
| Creator dumps unavailable | 0 |
| **Score** | **72** |

Still can land **80** if concentration stays just under 60% top-10 and top-1 &lt; 10% while LP is unlocked (−20 → **80**).

### Construct C — HANSOME-shaped ops cluster without lock knowledge

Arbitrary token with PoolManager inventory + 18 equal-balance ops wallets + unknown lock:

−10 (unknown LP) −8 (cluster) = **82**, with mint/tax unchecked.

### Root failure modes

1. **Default-award on missing creator behaviour** (up to **+20** retained points).
2. **No contract-risk category** (mint / tax / honeypot / privileged owner) despite claiming “structural risk.”
3. **Soft unknown-LP penalty (−10)** vs unlocked (−20); Week 1 lock detection mostly HANSOME-hardcoded.
4. **Loose concentration floors** (Top-10 can be ~59% with **0** points; Top-1 can be ~9.9% with **0**).
5. **Related-wallet heuristic is weak** (equal balances only) — coordinated unequal dumps score 0.
6. High Score + separate Low Activity is correct per spec, but **users/externals will compare 92 to GT 34** and treat ours as inflated “safety.”

HANSOME itself is **not** Construct A (clean contract + real lock). The issue is **model falsifiability**, not “HANSOME is a rug.”

---

## 6. Conclusion

### **SCORE MODEL NEEDS REVISION**

Evidence:

1. **Apples-to-oranges does not fully excuse 92 vs 34.** GT’s `transaction: 0` and thin liquidity correctly sit in our **Activity / warnings**, not Score — that part of the gap is intentional. Remaining gap: GT still scores holders/pool/creation while we award **full points** on concentration and lock (HANSOME special-case), and we **skip** contract-risk checks that GoPlus/GT treat as core safety.
2. **Missing-data defaults inflate Score.** Creator behaviour (max 20) is systematically free in Week 1; Confidence −10 is too weak a substitute for a 0–100 “structural risk” number.
3. **Adversarial constructs score 80–90+** with unlocked/unknown LP, high coordinated risk, and/or hostile contract features never inspected.
4. **GoPlus holder/DEX fields are stale on 4663** — do **not** retune Score toward GoPlus composites; fix our own blind spots instead.
5. For HANSOME **under current frozen rules**, the arithmetic **92 = 100 − 8** is correctly applied — the problem is the **rules award too many defaults**, not a bug in the HANSOME scan path.

**Do not change Score to match GT 34.** Prefer version bump + rule fixes (below) before Week 2 product scope.

---

## 7. Recommended rule fixes for Week 2 (recommendations only — do not implement here)

Priority order:

1. **Add Contract risk category (suggested max 20–25)**  
   Deduct for: mintable / unlimited mint, transfer tax &gt;0 / modifiable tax, honeypot / cannot_sell, pausable / blacklist, proxy+privileged upgrade, owner privileges. Prefer RPC+source/ABI; GoPlus only as labeled secondary with staleness guards.

2. **Stop default-awarding creator behaviour**  
   Options: (a) index Blockscout transfers and score dumps; (b) until indexed, cap Score ceiling (e.g. max 85) or apply provisional −10 Score (not only Confidence).

3. **Generic LP lock detection**  
   Position NFT ownership → known locker ABIs (Titan etc.). Remove HANSOME-only hardcode as sole path to `locked`. Keep transparency as label/boost-evidence, not silent free pass without on-chain check.

4. **Tighten concentration**  
   Consider Top-10 ≥ 40% / 50% tiers; optionally report **raw** Top-10 (incl. PoolManager) as a warning while Score uses excl-pool; document both.

5. **Stronger relationship / inventory clustering**  
   Funding-graph or labeled ops inventory concentration (still probabilistic wording). Equal-balance alone under-detects uneven ops holdings.

6. **UI honesty**  
   Never imply “safe.” Show: Score + Activity + Confidence + “contract checks incomplete” when mint/tax not evaluated. Optional: display GT Activity/GT Score as third-party **comparison**, clearly non-feeding.

7. **Version bump**  
   Any weight/threshold change → `1.0.1+` / Week 2 report note. **Do not silent-retune to look closer to GT.**

---

## 8. Data capture appendix

| Source | Captured |
|--------|----------|
| GT pool page | Score **34**, Security Scorecard **34/100**, honeypot none, verified pool |
| GT `/pools/.../info` | `gt_score` 34.2857 + detail breakdown; top_10 45.1414% |
| GoPlus `/token_security/4663` | Contract flags green; `is_in_dex=0`; holders stale |
| Birdeye | 401 — unavailable |
| RPC | supply, PoolManager, deployer balances |
| Blockscout | verified source, holders page, counters, lock tx `createPositionLock` |
| Week 1 report | Score 92 / Activity Low / Confidence 90% |

**Scanned / fetched at:** 2026-07-27 (session).

---

## 9. Executive summary (ZH + EN)

### 中文

外部 ~37 主要是 **GeckoTerminal GT Score ≈ 34**（非 GoPlus 單一分數）。GT 把成交量/池子健康/持倉分布混進同一分；我們的 92 是「結構風險」且刻意不扣低量、薄流動性。HANSOME 鏈上事實偏乾淨（已驗證、不可增發、無稅、部署者 ~0.57%、Titan 鎖倉 #47299、原始 Top10 ~45%）。但 v1 **對缺失資料預設給滿分**（尤其創作者行為 −0）、**完全不檢查 mint/稅/蜜罐等合約風險**，且未知 LP 只扣 10——對抗測試下惡意幣仍可打到 **80–90+**。結論：**SCORE MODEL NEEDS REVISION**（不要為了貼近 GT 而改分數；先修規則）。

### English

The external ~37 is live **GeckoTerminal GT Score ≈ 34.3** (not a GoPlus composite). Most of the 92 vs 34 gap is definitional: GT zeros **transaction** activity and punishes holder/pool components; our Score correctly excludes ordinary volume/size. HANSOME’s on-chain structure is largely clean, and **92 follows frozen v1 math** (−8 cluster only). Still, v1 **default-awards large categories when data is missing**, **never scores mint/tax/honeypot/owner privileges**, and soft-penalizes unknown LP — a bad token can still land **80–90+**. Verdict: **SCORE MODEL NEEDS REVISION** (recommendations only; do not retune to match externals; do not start Week 2 product work from this alone).
