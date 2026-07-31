# HANSOME — Data Confidence / Analysis Coverage Redesign

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Engine** | `1.2.0-data-confidence` |
| **Spec** | [`docs/HANSOME_SCORE_V1_1_SPEC.md`](../docs/HANSOME_SCORE_V1_1_SPEC.md) §9A |
| **Raw live scan** | [`reports/hansome-score-week2a-hansome.json`](hansome-score-week2a-hansome.json) |
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · chainId **4663** |
| **Mode** | Local only — no deploy / push |

---

## 1. Why the old ~90% was misleading

Old Confidence was essentially `100 − flat penalties`. A single missing creator index cost **−10** → **90%**, even when:

- LP discovery had found a Titan lock but not all material Position NFTs
- Creator history was not fully indexed
- No honeypot sell/swap simulation existed
- Wallet graphs were top-holder samples only

**Unknown ≠ verified. Partial detection ≠ complete coverage.** Flat −10 could not express that.

---

## 2. Methodology (v1.2)

Data Confidence = **weighted average** of five dimension scores (0–100).  
It measures **how complete and verifiable the data behind the analysis is**.  
It does **not** indicate token quality, safety, or the probability that Score is correct.

### Weights (documented; not token-tuned)

| Dimension | Weight | Rationale |
|-----------|--------|-----------|
| Liquidity / position discovery | **25%** | Incomplete v4 enumeration can hide withdrawal surface; one locked NFT ≠ locked liquidity |
| Creator behaviour | **22%** | Unindexed creator history is a major dump / transfer-then-sell blind spot |
| Contract analysis | **22%** | Privilege surface; missing ABI or no sell simulation leaves material unknowns |
| Holder data | **16%** | Concentration needs supply + adequate holder sample |
| Wallet relationship | **15%** | Graphs are probabilistic and usually sampled |

Bands: **High** ≥ 75 · **Medium** 45–74 · **Low** &lt; 45.

### Critical completeness rules (engine)

- `discoveryComplete === false` / `UNKNOWN_INCOMPLETE` / pool with zero enumerated positions → **Liquidity** hard-capped well below ~100%
- Creator not indexed → Creator dimension **~18 (Low)**, not aggregate −10
- No honeypot swap simulation → Contract incomplete (−15), even if ABI looks clean
- Sampled wallet graph → Wallet soft-capped (production max ~68 before funding gaps)

LP principle cross-link: incomplete position discovery → low **liquidity coverage** (independent of Score ownership deductions). See Spec §4 / §9A.3.

---

## 3. HANSOME — objective recalculation (live)

Scanned at `2026-07-27T13:07:12.655Z`. **No target number** — result follows methodology + live discovery signals.

| | Value |
|--|-------|
| **Aggregate Data Confidence** | **88%** · band **High** |
| Contract | High / **85%** (incomplete: no honeypot swap simulation) |
| Liquidity | High / **95%** (`discoveryComplete=true`, aggregate **MIXED**, 3 positions; −5 lock-% unavailable across ranges) |
| Holders | High / **100%** (92 holders, top-20 sample) |
| Wallet Analysis | Medium / **58%** (sampled top 12; funders 7/12) |
| Creator History | High / **94%** (indexed, 22 pages, pagination complete) |

### Live context that drives these numbers

- Creator index **cleared** (status `indexed`) — Week 1.5 rescan had creator **incomplete**, which alone produced old Confidence **90**.
- LP detector reports **MIXED** with positions `#47299` locked + `#357867` / `#142938` EOA-removable, and marks **`discoveryComplete=true`** when locked+removable are both found — Liquidity coverage therefore legitimately High under current discovery signals (not “one Titan lock = fully locked”).
- Remaining drag vs 100%: sampled wallet graph + no sell/swap honeypot simulation + lock-% not comparable across concentrated ranges.

### Counterfactual (methodology check)

If the **same** contract meta existed but creator were still unindexed **and** LP discovery incomplete (`discoveryComplete=false` / `UNKNOWN_INCOMPLETE`), aggregate would land **well below ~90%** (regression test enforces &lt; 75). That was the failure mode of the old model.

---

## 4. What changed vs old Confidence 90%

| | Old (v1.1 flat) | New (v1.2 dimensions) |
|--|-----------------|------------------------|
| Model | `100 − penalties` | Weighted coverage dimensions |
| Missing creator | −10 → still **~90%** | Creator **~18%** → large aggregate pull |
| Incomplete LP discovery | Often only −10 “lock unknown” | Liquidity capped (≤52 / ≤42 when unknown-incomplete) |
| Breakdown UI | Percent only | Per-dimension band + % + notes |
| Label | Confidence | **Data Confidence** |
| API | `{ percent, penalties }` | `+ band, dimensions[], weights` |

Score category weights were **not** changed for this redesign.

**Public Scan UI:** methodology weights (22% / 25% / 16% / 15% / 22%) are hidden from the default view and only shown under **Advanced Details** / **查看技術細節** — so ordinary users see Analysis Coverage language, not scoring math.

---

## 5. Test results

```text
npx vitest run --config vitest.config.ts \
  lib/hansome-score/__tests__/score.test.ts \
  lib/hansome-score/__tests__/week2a.test.ts \
  lib/hansome-score/__tests__/lp-mixed.test.ts
```

| Metric | Result |
|--------|--------|
| Test files | **3 passed** |
| Tests | **48 passed / 0 failed** |

Regression coverage added:

1. Complete/clean fixture can still score **High** Data Confidence (≥85)
2. Liquidity incomplete alone → liquidity ≤55 and aggregate drops materially
3. Missing creator **+** incomplete LP discovery → aggregate **&lt; 75** (cannot still be ~90%)
4. Documented weights exposed on result (sum = 1)

---

## 6. Files touched

- `lib/hansome-score/confidence.ts` — dimensional engine
- `lib/hansome-score/types.ts` — `ConfidenceDimension` / band / weights
- `lib/hansome-score/constants.ts` — `DATA_CONFIDENCE_WEIGHTS`, version `1.2.0-data-confidence`
- `lib/hansome-score/scan.ts` — wallet-graph coverage inputs + wording
- `lib/hansome-score/index.ts` — exports
- `lib/hansome-score/__tests__/score.test.ts` — Data Confidence regressions
- `lib/hansome-score/_tmp-live-scan.ts` — print breakdown
- `components/scan/ScanClient.tsx` — Data Confidence + breakdown UI
- `content/i18n/{en,zh,types}.ts` — soft-voice i18n
- `docs/HANSOME_SCORE_V1_1_SPEC.md` — §9A methodology
- `reports/HANSOME_DATA_CONFIDENCE_REDESIGN.md` — this report
- `reports/hansome-score-week2a-hansome.json` — live scan artifact
