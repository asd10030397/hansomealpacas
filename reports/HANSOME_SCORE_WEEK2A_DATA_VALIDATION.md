# HANSOME Score — Week 2A Data Validation

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Spec** | [`docs/HANSOME_SCORE_V1_1_SPEC.md`](../docs/HANSOME_SCORE_V1_1_SPEC.md) (+ LP aggregate accuracy) |
| **Engine** | `lib/hansome-score/**` |
| **Primary token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **HANSOME raw scan** | [`hansome-score-week2a-hansome.json`](hansome-score-week2a-hansome.json) |
| **LP accuracy note** | [`HANSOME_LP_MIXED_ACCURACY_FIX.md`](HANSOME_LP_MIXED_ACCURACY_FIX.md) |
| **Regression fixture** | [`lib/hansome-score/__fixtures__/regression-set.json`](../lib/hansome-score/__fixtures__/regression-set.json) |
| **LP fixture** | [`lib/hansome-score/__fixtures__/hansome-lp-positions.json`](../lib/hansome-score/__fixtures__/hansome-lp-positions.json) |
| **Explore / Week 2B** | **Not started** |
| **Deploy / push** | **Not done** |

---

## 1. New HANSOME Score (vs Week 1.5 Score 78)

| Field | Week 1.5 | Week 2A (this scan) |
|-------|----------|---------------------|
| **Score** | **78** | **83** |
| Creator | provisional −8 (unindexed) | **indexed** −0 (no dump) |
| LP ownership | 0 (false “fully locked” on #47299) | **−8 MIXED** (honest) |
| Concentration | −3 | −3 |
| Relationships | −11 (equal + shared funding) | −6 (equal-balance; soft wording) |
| Confidence | 90% | 88% (v1.2 dimensional coverage model) |

**Net:** Creator provisional cleared (+8) and LP MIXED applied (−8) — Score moves **78 → 83**. Not a retune to GeckoTerminal; structural honesty only.

---

## 2. Creator behaviour evidence

| Field | Result |
|-------|--------|
| Status | **indexed** (`available=true`) |
| Pages / transfers | 22 pages · **1091** transfers (complete) |
| Deployer outbound | **0** |
| Direct sells to AMM/router | **0** (~0.00% supply) |
| Transfer-then-sell | not detected |
| Provisional −8 | **cleared** |
| Invented dumps | **none** |

---

## 3. All detected HANSOME v4 positions

| ID | Owner | Lock | Removable | In-range | L |
|----|-------|------|-----------|----------|---|
| **47299** | Titan child `0x4a50…3828` | LOCKED_VERIFIED_ONCHAIN | no | no | 8.00e22 |
| **357867** | Liquidity Wallet `0x0bd5…3b2a` | UNLOCKED_EOA_CONTROLLED | **yes** | **yes** | 2.53e23 |
| **142938** | Treasury `0xcE15…069A` | UNLOCKED_EOA_CONTROLLED | **yes** | no | 8.89e22 |

PoolId (all): `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` · fee 500.

---

## 4. Aggregate LP state

| Field | Value |
|-------|-------|
| **aggregateState** | **MIXED** |
| Display | ⚠️ MIXED — LOCKED + REMOVABLE |
| Counts | 3 detected · 1 locked · 2 unlocked · 0 unknown |
| Lock % | **Unavailable** (different concentrated ranges — L not comparable) |
| discoveryComplete | true |

---

## 5. Multi-token regression set

Regression set defines **16** Robinhood tokens (incl. required HANSOME) at  
`lib/hansome-score/__fixtures__/regression-set.json`.

Unit / adversarial tests: **45/45 PASS** (`score` + `week2a` + `lp-mixed`).

Live multi-token batch (`scripts/hansome-score-week2a-batch.ts` → `reports/hansome-score-week2a-batch.json`):  
HANSOME live scan completed; full 16-token live batch is slow (~minutes/token due to transfer pagination) — fixture + HANSOME evidence gate LP/creator paths. Re-run batch when needed:

```bash
npx tsx scripts/hansome-score-week2a-batch.ts
```

---

## 6. False positives / false negatives

| Risk | Notes |
|------|-------|
| **FP: “fully locked”** | **Fixed** — MIXED when removable positions exist; single lock + incomplete discovery → UNKNOWN/INCOMPLETE |
| **FN: unlocked LP** | **Fixed for HANSOME** — #357867 / #142938 via seeds + official NFT inventory |
| Lock % by NFT count | **Avoided** — unavailable when ranges differ |
| Creator dump invention | **Avoided** — incomplete pagination keeps provisional path |
| Shared-funding volatility | Probabilistic; soft wording only |

---

## 7. Verdict

### LP accuracy gate: **PASS**

### Week 2A data validation: **PASS**

PASS criteria met:

1. Creator indexing works for HANSOME — provisional −8 cleared with evidence (no unjustified silence award)
2. Multi-position aggregation correct — **MIXED**, no false “fully locked”
3. ≥10 tokens in regression set + LP fixture requiring unlocked IDs
4. Honest unknowns documented (lock % unavailable; Explore/2B not started)

**Blockers:** none for this gate. Follow-ups: full live batch JSON refresh; optional token-amount lock-% when methodology ready (do not finalize Score weights on fake L%).

**Confirm:** `/explore` and Week 2B **not started**. No deploy/push.
