# HANSOME Overall Token Score — Accuracy Gate Proposal

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Engine** | `lib/hansome-score/overall.ts` · `1.0.0-overall` |
| **Structural** | v1.1 category weights **unchanged** |
| **Batch** | [`HANSOME_OVERALL_SCORE_BATCH.json`](HANSOME_OVERALL_SCORE_BATCH.json) · **20/20 OK** |
| **Competitor research** | [`TOKEN_SCORE_COMPETITOR_COMPARISON.md`](TOKEN_SCORE_COMPETITOR_COMPARISON.md) |
| **Spec** | [`docs/HANSOME_OVERALL_SCORE_SPEC.md`](../docs/HANSOME_OVERALL_SCORE_SPEC.md) |
| **Unit tests** | `lib/hansome-score/__tests__/overall.test.ts` · **21 passed** |
| **Verdict** | **PASS** |

**Non-goals honored:** no retune toward GeckoTerminal ~34; no force of HANSOME into 40–50; no unpublished competitor weights reverse-engineered; no Week 2B / Explore / Analytics / Just Launched / production deploy.

---

## 1. What each score answers

| Layer | Answers | Must NOT mean |
|-------|---------|----------------|
| **Overall Token Score** | “How does this token look as a whole right now?” (structure + depth + adoption + activity + maturity + analysis coverage) | Safety guarantee, buy/sell signal, “good investment” |
| **Structural Score** | “What structural / transparency risks show on-chain?” (contract, LP ownership, concentration, wallet relationships, launch, creator) | Popularity, volume, holder count, trending |
| **Activity / HANSOME Level** | Market activity label (+ meme presentation) | Safety; HANSOME Level is presentation-only |
| **Data Confidence** | How complete/verifiable the analysis inputs are | Token quality |

**Divergence is expected and desirable.** Example patterns allowed: Structural 85 / Overall 45 (clean but tiny/inactive) or Structural 40 / Overall ~58 capped (hot but structurally weak).

---

## 2. Final Overall formula

```
raw = Σ (component_i × weight_i)
Overall = clamp(0..100, applyStructuralSafetyGate(raw, Structural))
```

### Weights (sum = 1)

| Component | Weight | Role |
|-----------|--------|------|
| Structural | **0.30** | Trap vs transparent — still the largest single input |
| Liquidity depth | **0.20** | Exitability (USD TVL when labeled; else inventory %) — **not** LP ownership |
| Holder adoption | **0.18** | Holder **count** (+ soft top-10 modifier) — **not** Structural safety |
| Activity health | **0.17** | 24h volume + txs only in this axis |
| Maturity | **0.10** | Age unknown-history for users — Overall only |
| Data Confidence | **0.05** | Incomplete analysis should not look polished — **not** quality |

### Safety gate (public principle, not GT weights)

| Condition | Ceiling |
|-----------|---------|
| Structural &lt; 25 | Overall ≤ Structural + 10 |
| Structural &lt; 40 | Overall ≤ Structural + 20 |

### Double-count / domination checks (addressed)

| Risk | Mitigation |
|------|------------|
| Holder weight too large | Weight 0.18; adversarial test: max swing ≤16 when holders 30→50k |
| Liquidity weight too large | Weight 0.20; adversarial test: max swing ≤18 shallow→deep |
| Volume/activity double count | Activity **only** in Overall activity component; Structural has **no** volume/activity category |
| Maturity over-punishes new tokens | Weight 0.10; swing ≤10 young→mature; Structural untouched |
| Data Confidence as quality | Weight **0.05**; swing ≤5 when confidence 20→100 |
| Structural + Overall same risk twice | Structural score is **one** Overall input; LP ownership / concentration deductions live only in Structural, not re-derived in Overall curves |

---

## 3. HANSOME live result (current engine)

Token: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`  
Scanned: 2026-07-27T13:47:05Z (batch)

| Metric | Value |
|--------|-------|
| **Overall Token Score** | **52** (FAIR band) |
| **Structural Score** | **75** |
| **Liquidity USD** | ~$16,154 |
| **Holders** | 92 |
| **Activity** | Low |
| **HANSOME Level** | 😐 KINDA HANSOME |
| **Maturity** | ~15.9 days |
| **Data Confidence** | 71% (Medium) |
| **LP aggregate** | **MIXED** (3 positions: 1 Titan locked + 2 EOA unlocked) |

### Overall components

| Component | Score |
|-----------|------:|
| Structural | 75 |
| Liquidity depth | 45 |
| Holder adoption | 43 |
| Activity | 19 |
| Maturity | 55 |
| Data Confidence | 71 |

Weighted ≈ `0.30×75 + 0.20×45 + 0.18×43 + 0.17×19 + 0.10×55 + 0.05×71` ≈ **52**.

### Structural deductions (current corrected logic)

| Code | Points | Notes |
|------|-------:|-------|
| `lp_mixed` | −8 | MIXED ownership — **not** false “fully locked” |
| `top1_ge_5` | −3 | Top holder concentration |
| `equal_balance_cluster` | −6 | Primary wallet signal; `shared_funding_pattern` **merged** (no double stack) |
| `creator_behaviour_unindexed` | −8 | Provisional — transfer index incomplete at batch page cap |

### Why 52 is reasonable (not a target)

- Structural **75** reflects clean-ish contract surface with MIXED LP + cluster + provisional creator — not a “perfect” structure.
- Overall is pulled down by **activity 19**, **holders 43**, **liquidity 45** while maturity/confidence are mid.
- Gap Structural−Overall = **23** — exactly the “structurally cleaner than the market is thick” story.
- **Not** tuned to GT ~34 or a 40–50 wish band; 52 is the formula output.

---

## 4. Cross-token comparison (20 Robinhood tokens)

Sorted by Overall descending. Full machine JSON: [`HANSOME_OVERALL_SCORE_BATCH.json`](HANSOME_OVERALL_SCORE_BATCH.json).

| Tag | Symbol | Overall | Structural | Liq USD | Holders | Activity / Level | Age (d) | Data Conf | LP | Main drivers |
|-----|--------|--------:|-----------:|--------:|--------:|------------------|--------:|----------:|----|--------------|
| high_cashcat | CASHCAT | **84** | 75 | ~2.8M | 34034 | High / VERY HANSOME | 38.7 | 53 | UNKNOWN_INCOMPLETE | deep liq + activity + holders |
| high_tendies | TENDIES | **82** | 75 | ~774k | 10247 | High / VERY HANSOME | 38.6 | 53 | UNKNOWN_INCOMPLETE | deep liq + activity |
| high_index | Index | **77** | 67 | ~1.06M | 9577 | High / VERY HANSOME | 24.5 | 53 | UNKNOWN_INCOMPLETE | activity; some structural |
| high_cate | CATE | **74** | 74 | ~558k | 2648 | High / VERY HANSOME | 0.5 | 37 | UNKNOWN_INCOMPLETE | hot but very young; low confidence |
| med_tygr | TYGR | **74** | 75 | ~160k | 2229 | High / VERY HANSOME | 6.9 | 52 | UNKNOWN_INCOMPLETE | young + active |
| med_yolo | YOLO | **73** | 69 | ~301k | 3231 | High / VERY HANSOME | 12.3 | 52 | UNKNOWN_INCOMPLETE | active |
| med_roar | ROAR | **69** | 69 | ~72k | 2170 | High / VERY HANSOME | 4.0 | 53 | UNKNOWN_INCOMPLETE | young |
| high_pons | PONS | **66** | 70 | ~1.8M | — | High / VERY HANSOME | — | 20 | UNKNOWN_INCOMPLETE | incomplete holders/confidence |
| asteroid | ASTEROID | **63** | 63 | ~56k | 863 | High / VERY HANSOME | 6.2 | 42 | UNKNOWN_INCOMPLETE | mid depth |
| **hansome_primary** | **HANSOME** | **52** | **75** | **~16k** | **92** | **Low / KINDA** | **15.9** | **71** | **MIXED** | **low activity, thin holders, MIXED LP** |
| thin_cable | CABLE | **50** | 55 | ~3.9k | 148 | High / VERY HANSOME | 1.1 | 56 | UNKNOWN_INCOMPLETE | active but thin/young/structural |
| high_stonkbroker | STONKBROKER | **48** | 70 | — | — | Low / KINDA | — | 21 | UNKNOWN_INCOMPLETE | Structural≫Overall (inactive / incomplete) |
| new_toth | TOTH | **42** | 72 | ~2.7k | 3 | Medium / HANSOME | ~0 | 63 | UNKNOWN_INCOMPLETE | clean-ish structure, tiny market |
| low_omnibook | OMNIBOOK | **42** | 62 | ~5.2k | 5 | Medium / HANSOME | ~0 | 62 | NONE | tiny |
| new_hooddog | Hooddog | **38** | 72 | ~2.7k | 2 | Low / KINDA | ~0 | 63 | UNKNOWN_INCOMPLETE | Structural≫Overall |
| new_sasanka | Sasanka | **37** | 58 | ~0 | 34 | Medium / HANSOME | ~0 | 59 | UNKNOWN_INCOMPLETE | dust liq |
| new_gme | GME | **36** | 62 | ~2.7k | 3 | Medium / HANSOME | ~0 | 49 | UNKNOWN_INCOMPLETE | new/thin |
| new_meta | META | **35** | 62 | ~2.7k | 2 | Low / KINDA | ~0 | 49 | UNKNOWN_INCOMPLETE | new/thin |
| new_mythosbet | MYTHOSBET | **34** | 62 | ~2.7k | 2 | Low / KINDA | ~0 | 49 | UNKNOWN_INCOMPLETE | new/thin |
| low_cablev3 | CableV3 | **32** | 62 | ~2.7k | 3 | Low / KINDA | ~0 | 49 | UNKNOWN_INCOMPLETE | new/thin |

### Sanity archetypes observed

| Archetype | Example | Pattern |
|-----------|---------|---------|
| Structurally cleaner, tiny/inactive | **HANSOME** S75 / O52; **Hooddog** S72 / O38 | Overall correctly lower |
| Active/liquid, weaker structure | **STONKBROKER** S70 / O48 (inactive drag); **Index** S67 / O77 (market lifts Overall) | Axes diverge both ways |
| Mature/high-activity/high-liquidity | **CASHCAT** O84, **TENDIES** O82 | Top of table |
| New / insufficient data | **CableV3 / MYTHOSBET / META** O32–35; **PONS** Conf 20 | Overall stays low; confidence honest |
| Concentrated / thin / MIXED | **HANSOME** MIXED; **CABLE** thin+young S55/O50 | Not rewarded as “strong overall” |

---

## 5. Sensitivity / adversarial tests

Suite: `npm run test:scoring -- lib/hansome-score/__tests__/overall.test.ts` → **21 passed**.

Covered:

- Weights sum to 1; Structural `CATEGORY_CAPS` regression unchanged  
- Clean-but-thin young profile → Overall &lt; 80  
- Established high-activity → Overall ≥ 80  
- Raising activity / holders / liquidity moves Overall up  
- High Structural + thin market → Overall much lower (Δ ≥ 25)  
- Structural &lt; 25 cannot be washed by volume (ceiling)  
- Holder / liquidity / maturity / confidence domination bounds  
- Activity not present in Structural categories  
- Archetypes: clean-thin vs hot-risky (gated) vs mature-liquid  

---

## 6. Competitor methodology (comparison only)

See [`TOKEN_SCORE_COMPETITOR_COMPARISON.md`](TOKEN_SCORE_COMPETITOR_COMPARISON.md).

- **Numeric composites:** GT Score, TokenSniffer, RugCheck; DEX Screener Trending ≠ safety  
- **Signals-only:** GoPlus API  
- HANSOME publishes **its own** Overall weights; does **not** claim GT equivalence  

---

## 7. UI integration readiness

Already wired in engine/API (`scan.ts` → `overall` + `structural` + bands helper).  
UI may show Overall prominently with FAIR/GOOD/… bands; Structural secondary.  
**Production deploy still requires product approval** — this gate is methodology PASS, not a ship order.

---

## 8. Known limitations (non-blocking for PASS)

1. Many non-HANSOME tokens report `UNKNOWN_INCOMPLETE` LP — v2/v3/v4 lock decode still partial; correctly lowers Data Confidence and must not claim “all LP locked.”  
2. HANSOME creator index still hit provisional −8 at batch page cap — honest incomplete, not a forced Overall knob.  
3. Labeled USD liquidity depends on GeckoTerminal; when missing, inventory fallback applies.  

These are discovery/coverage gaps, not Overall formula failures.

---

## 9. Verdict: **PASS**

| Criterion | Result |
|-----------|--------|
| Methodology coherent (two layers, published weights, gates) | **Yes** |
| Cross-token ranking common-sense | **Yes** (hot/liquid top; new/thin bottom; HANSOME mid Overall with higher Structural) |
| Unit / adversarial tests | **21/21 pass** |
| Latest HANSOME MIXED LP + wallet merge used | **Yes** |
| No GT / 40–50 retune | **Yes** (HANSOME Overall **52**) |
| Ready for UI integration (not production deploy) | **Yes** |

**REVISE not required** for this gate. Future optional tuning (e.g. deeper LP USD aggregation, creator index completeness) can proceed without blocking the two-layer product definition.
