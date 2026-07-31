# HANSOME Score — Week 1.5 Hardening Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Spec** | [`docs/HANSOME_SCORE_V1_1_SPEC.md`](../docs/HANSOME_SCORE_V1_1_SPEC.md) `1.1.0-week1.5` |
| **Engine** | `lib/hansome-score/**` |
| **Mode** | Local hardening closeout — **Scan not claimed live in production**; no git push |
| **Week 1 historical** | Score **92** under `1.0.0-week1` — **FROZEN** ([`HANSOME_SCORE_WEEK1_REPORT.md`](HANSOME_SCORE_WEEK1_REPORT.md)) |
| **Primary token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · chainId **4663** |
| **Raw re-scan JSON** | [`reports/hansome-score-v1_1-rescan.json`](hansome-score-v1_1-rescan.json) |
| **External target** | **Not used** — did **not** retune toward GeckoTerminal ~34–37 |
| **Verdict** | **PASS** |

---

## 1. Scope — Week 1.5 vs Week 1

| | Week 1 | Week 1.5 (this gate) |
|--|--------|----------------------|
| Spec | `1.0.0-week1` (now historical) | `1.1.0-week1.5` |
| Goal | Prototype Scan + Score / Activity / Confidence split | Close adversarial gaps from external reconciliation |
| Contract risk | **Not scored** | New category (max 25) |
| Missing data | Often **full award** + Confidence-only | Provisional Score deductions + incomplete flags (+ ceiling 85 when critical pair incomplete) |
| LP | HANSOME transparency special-case #47299 | Generic v4 locker registry + Titan + `ownerOf` (same path for all tokens) |
| Concentration / relationships | Softer thresholds; equal-balance mainly | Stricter tiers; funding / deployer-funded / same-block signals |
| Product | Local `/scan` prototype | Engine hardening only — **no Week 2 Explore / taxonomy UI** |
| Out of scope | — | Retune to GT; Titan ops/trading bots; production deploy; inventing tokenomics |

Week 1 Score **92** remains historically frozen. Arithmetic below is **rule hardening**, not a rewrite of Week 1.

---

## 2. What changed in the model

- **Contract risk (max 25)** — mintable, honeypot, taxes, modifiable tax, pause, blacklist/whitelist, proxy+upgrade, owner/admin; incomplete → provisional −10 + Confidence −12; GoPlus labeled supplement only.
- **Missing data ≠ safe** — creator unindexed → provisional **−8** + incomplete; contract+creator both incomplete → **score ceiling 85**; unknown LP never maps to unlocked.
- **Liquidity ownership max 20** (was 25) with explicit lock states: `LOCKED_VERIFIED_ONCHAIN` / `LOCK_DETECTED_EXPIRY_UNKNOWN` / `UNSUPPORTED_LOCKER` / `UNLOCKED_EOA_CONTROLLED` / `UNABLE_TO_DETERMINE` / `NONE` / `MIXED`.
- **Generic locker adapters** under `lib/hansome-score/lp/` (Titan first); HANSOME #47299 uses the same registry path — transparency may corroborate, never silent Score grant without on-chain owner/locker check.
- **Size ≠ Ownership ≠ Lock ≠ Range** — size/slippage → warning/Activity only; Score uses ownership/withdrawal; UI/JSON expose range separately.
- **Holder concentration max 20** — tighter Top-1 (≥5%) and Top-10 (≥40%/50%/…) tiers; raw vs adjusted Top-10 reported.
- **Wallet relationship** — equal-balance + shared funding + deployer-funded + same-block early buys; **soft / probabilistic wording only**.
- **Launch fairness max 10** / **Creator behaviour max 10** (reweighted vs Week 1).
- **Axes unchanged:** Score ≠ Activity ≠ Confidence ≠ Category/Trending; Score never bought with $HANSOME; no AI scoring.

---

## 3. Adversarial / unit test results

Command: `npx vitest run --config vitest.config.ts lib/hansome-score/__tests__/score.test.ts`

| Metric | Result |
|--------|--------|
| Test files | **1 passed** |
| Tests | **27 passed / 0 failed** |
| Duration | ~0.7s |

Coverage exercised (all green):

| Construct | Expectation | Result |
|-----------|-------------|--------|
| Clean fixed-supply + locked LP | Can still score high | Pass |
| Mintable | −18 contract | Pass |
| Honeypot | Category cap −25 | Pass |
| ≥50% tax | Heavy tax tier | Pass |
| Unlocked LP | −20 | Pass |
| Top-1 ≥50% | Concentration max −20 | Pass |
| Creator dump (indexed) | −10 | Pass |
| Missing creator | Provisional −8 + incomplete | Pass |
| Coordinated cluster (multi-signal) | Wallet cap 15 | Pass |
| Contract + creator incomplete | Ceiling ≤85 | Pass |
| Hostile missing-data-only | Score **&lt; 80** | Pass |
| Construct A stealth rug | Score **&lt; 80** | Pass |
| NatSpec must not false-positive honeypot/tax | Clean | Pass |
| Top-10 ~59% not zero deduction | ≥ −4 | Pass |
| `UNABLE_TO_DETERMINE` ≠ unlocked | −12 | Pass |

**Key:** Hostile / incomplete tokens can no longer land **80–90+** merely from missing data or unchecked contract risk.

---

## 4. HANSOME v1.1 re-scan results

**Scanned at:** `2026-07-27T12:47:02.732Z`  
**Spec version:** `1.1.0-week1.5`  
**Raw JSON:** [`reports/hansome-score-v1_1-rescan.json`](hansome-score-v1_1-rescan.json)  
**CLI:** `npx tsx lib/hansome-score/_tmp-live-scan.ts`

### 4.1 Key fields

| Field | Week 1 (frozen) | Week 1.5 re-scan |
|-------|-----------------|------------------|
| **Score version** | `1.0.0-week1` | `1.1.0-week1.5` |
| **HANSOME Score** | **92** | **78** |
| **scoreCeilingApplied** | *(n/a)* | `null` |
| **incompleteCategories** | *(implicit via Confidence)* | `["creator_behaviour"]` |
| **Activity** | Low (geckoterminal) | **Low** (geckoterminal · vol24h ≈ **$51.43** · txs24h = **3**) |
| **Confidence** | **90%** | **90%** (−10 creator behaviour not indexed) |
| Contract risk status | Unscored | **`analyzed`** — mintable/honeypot/tax/owner/pausable/blacklist/proxy all **false / 0** |
| LP aggregate | locked (transparency + evidence) | **`LOCKED_VERIFIED_ONCHAIN`** — LOCKED — VERIFIED ON-CHAIN |
| LP evidence | Project transparency + on-chain check | `on_chain_verified` via `positionManager.ownerOf + TitanLockerManagerV2.getTokenLockData` |
| Position | #47299 → 2027-07-15 | **#47299** · unlock **2027-07-15T03:38:00Z** · **inRange=false** · **removableByEoa=false** |
| poolId | `0x1165…1a0d` | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |
| Ownership risk note | Locked LP | Verified on-chain lock via known locker registry |
| Concentration (adj) | Top non-pool ~6%; Top-10 Score 0 | top1Adj **~5.98%** · top10Adj **~35.40%** · top10Raw **~45.02%** |
| Relationship | Equal-balance −8 | Equal-balance (−6) + shared funding (−5); soft wording |
| Holders / transfers | 92 / 1091 | 92 / 1091 |

### 4.2 Deductions (100 → 78)

| Points | Category | Code | Reason |
|--------|----------|------|--------|
| **−3** | holder_concentration | `top1_ge_5` | Largest non-pool holder ~6.0% (≥5% tier; new in v1.1) |
| **−6** | wallet_relationship | `equal_balance_cluster` | Possible related wallets (probabilistic): 18 identical balances |
| **−5** | wallet_relationship | `shared_funding_pattern` | Shared funding pattern (probabilistic): 5 top holders |
| **−8** | creator_behaviour | `creator_behaviour_unindexed` | Sell/transfer index unavailable — **provisional** (unknown ≠ safe) |
| **Total** | | | **−22 → Score 78** |

### 4.3 Categories at zero (earned, not defaulted)

| Category | Applied | Why zero is earned |
|----------|---------|---------------------|
| Contract risk | **0 / 25** | Verified ABI/source analyzed → clean (status `analyzed`, not incomplete) |
| Liquidity ownership | **0 / 20** | Generic path: `ownerOf(47299)` → Titan child + unlock in future → `LOCKED_VERIFIED_ONCHAIN` |
| Launch fairness | **0 / 10** | Deployer &lt;5%; verified |

### 4.4 categoryTotals

```json
{
  "contract_risk": 0,
  "liquidity_ownership": 0,
  "holder_concentration": 3,
  "wallet_relationship": 11,
  "launch_fairness": 0,
  "creator_behaviour": 8
}
```

**Week 1 → 1.5 score delta:** **92 → 78 (−14)**.

---

## 5. Interpretation

- Score moved **down** because v1.1 **stops awarding silence**: creator behaviour now costs provisional **−8**, concentration adds **−3** for ~6% top-1, and relationship adds shared-funding **−5** on top of a slightly retuned equal-balance signal (−6 vs Week 1’s −8 alone).
- **Missing data is no longer treated as safe** for creator behaviour (incomplete flag + Score provisional). Contract risk for HANSOME is **analyzed**, not incomplete — clean fixed-supply surface earned 0 honestly.
- Lock honesty: aggregate is **LOCKED_VERIFIED_ONCHAIN** with on-chain evidence level; Position #47299 is **out of range** and **not EOA-removable** — range/size are reported without collapsing into “LP safe.”
- Contract risk honesty: mint/tax/honeypot/owner/pause/blacklist/proxy evaluated from verified ABI/source; GoPlus present as labeled supplement only.
- Confidence stayed **90%** because the dominant completeness gap remains creator indexing (−10 Confidence), consistent with Score’s provisional creator deduction.

---

## 6. Relation to external GeckoTerminal ~37

- External reconciliation verdict (**SCORE MODEL NEEDS REVISION**) drove this hardening — **not** a mandate to match GT.
- GT ~34–37 **mixes activity / pool health / holders** into one composite; HANSOME Score remains **structural risk & transparency only**.
- Live Activity stays **Low** from labeled `geckoterminal` (~$51 / 3 txs) and **does not feed Score**.
- Axes remain separated: **Score ≠ Activity ≠ Confidence ≠ Category/Trending**.
- Score **78** is still far from GT ~37 by design; **no retune** was applied to close that gap.

---

## 7. Verdict checklist (vs V1.1 SPEC)

| Acceptance item | Evidence | Status |
|-----------------|----------|--------|
| Contract risk category implemented & exercised on live HANSOME | Live `contractRisk.status=analyzed`, clean flags | **PASS** |
| Missing data ≠ safe (provisional / incomplete / ceiling rules) | Live `creator_behaviour_unindexed` −8 + incomplete; tests for ceiling & hostile missing-data | **PASS** |
| Stricter concentration | Live `top1_ge_5` −3; Top-10 tiers in engine + tests | **PASS** |
| Related-wallet signals (soft wording) | Live equal-balance + shared-funding; probabilistic reasons | **PASS** |
| Uniswap v4 LP/lock intelligence (Size ≠ Ownership ≠ Lock ≠ Range) | Live aggregate lock + ownership note + range `inRange=false` + pool size fields; size not in Score | **PASS** |
| Generic locker adapters / Titan registry; #47299 via same path | `lib/hansome-score/lp/registry.ts` + detect; live dataSource `ownerOf + getTokenLockData` | **PASS** |
| Adversarial / unit tests pass | **27 / 27** | **PASS** |
| Report honest about incomplete data / evidence levels | Incomplete creator; evidence `on_chain_verified`; blind spots §8 | **PASS** |
| No claim Score = safety or = activity/trending | Disclaimers + Activity labeled separate | **PASS** |
| No retune to GT ~37; axes separated | Score 78 vs Activity Low; §6 | **PASS** |
| No production “Scan is live” claim | Local prototype mode | **PASS** |

### **Verdict: PASS**

Week 1.5 hardening items are implemented, tested, and evidenced on a live HANSOME re-scan. Remaining gaps are incremental (not critical unimplemented v1.1 requirements).

---

## 8. Gate for Week 2

**Gate: OPEN (PASS)** — Week 2 product work (taxonomy / Explore / etc.) may proceed in a **separate** session when requested.

**Do not start Week 2 from this closeout.** This report stops here.

### Non-blocking follow-ups (not Week 1.5 FAIL blockers)

1. Creator sell/transfer index (remove provisional −8 when dumps can be scored).
2. Broader Position NFT discovery beyond Titan/seeded IDs (MIXED may under-report).
3. Honeypot / tax beyond ABI heuristics (optional simulation).
4. Persist scan snapshots for history/Confidence.

---

## 9. Engine readiness (verified)

| Module | Present |
|--------|---------|
| `contract-risk.ts` | Yes |
| `lp/detect.ts`, `lp/registry.ts`, `lp/titan.ts` | Yes |
| `score.ts` v1.1 weights / incomplete / ceiling | Yes (`SCORE_SPEC_VERSION = 1.1.0-week1.5`) |
| `scan.ts` end-to-end wiring | Yes |
| `relationship.ts` multi-signal | Yes |
| `__tests__/score.test.ts` adversarial suite | Yes (27 passed) |
