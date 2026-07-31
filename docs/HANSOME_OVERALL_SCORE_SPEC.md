# HANSOME Overall Token Score — Specification

| Field | Value |
|-------|-------|
| **Status** | ACTIVE for engine `1.3.0-overall` (prototype — **no production deploy** until approved) |
| **Version** | `1.0.0-overall` |
| **Date** | 2026-07-27 |
| **Companion** | Structural Score remains [`HANSOME_SCORE_V1_1_SPEC.md`](HANSOME_SCORE_V1_1_SPEC.md) — **category weights unchanged** |
| **Engine** | `lib/hansome-score/overall.ts` |
| **Primary test token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Chain** | Robinhood Chain · chainId **4663** |

---

## 0. Product problem

Ordinary users read a single ~80+ score as “good token overall.” Structural Score correctly ignores popularity, but that leaves clean-but-thin tokens looking excellent. Overall Token Score is the broader assessment shown most prominently; Structural Score remains the structural-risk axis.

**Non-goals**

- Do **not** retune Structural category weights.
- Do **not** retune Overall to match GeckoTerminal GT Score (~34 for HANSOME).
- Do **not** invent unpublished competitor weight tables.
- No token-specific hardcodes (including HANSOME).

---

## 1. Two-layer architecture

| Layer | Name | What it answers | Affects |
|-------|------|-----------------|---------|
| **Overall** | Overall Token Score | “How does this token look as a whole right now?” | Prominent UI number |
| **Structural** | Structural Score (v1.1) | “What structural / transparency risks show on-chain?” | Secondary UI; Overall input |
| Activity | Low / Medium / High | Trading activity label | Informational (+ Overall activity component) |
| HANSOME Level | Branded display of Activity | Meme UI label (e.g. KINDA HANSOME) | **Presentation only** — never feeds Overall / Structural / Confidence / deductions ([`HANSOME_LEVEL_PRESENTATION.md`](HANSOME_LEVEL_PRESENTATION.md)) |
| Data Confidence | 0–100% | Analysis coverage | Shown beside (+ small Overall input) |

Principles:

- **Overall ≠ safety guarantee.**
- **Structural ≠ popularity.**
- Low popularity alone ≠ unsafe (Structural unchanged).
- Clean ERC-20 alone ≠ high Overall.

---

## 2. Overall formula

```
raw = Σ (component_i × weight_i)
Overall = clamp(0..100, applyStructuralSafetyGate(raw, Structural))
```

### 2.1 Weights (sum = 1)

| Component | Weight | Why it belongs |
|-----------|--------|----------------|
| **Structural** | **0.30** | Contract / LP ownership / concentration / relationships / launch / creator still dominate “trap vs transparent.” |
| **Liquidity depth** | **0.20** | Tradable depth matters for ordinary users (exitability). Distinct from Structural LP *ownership*. |
| **Holder adoption** | **0.18** | Holder *count* informs market adoption here — not Structural safety. Light distribution modifier only. |
| **Activity** | **0.17** | 24h volume / txs — “is anyone trading?” GT Score publicly documents market activity as a composite input. |
| **Maturity** | **0.10** | Age reduces unknown-history risk for users. (GT Score removed age from *their* composite; we include it only in Overall, not Structural.) |
| **Data Confidence** | **0.05** | Incomplete analysis should not look polished. |

### 2.2 Component curves (documented thresholds)

**Liquidity depth** — prefer labeled USD reserve (`reserve_in_usd`); else pool inventory % of supply + thin-size warning:

| USD liquidity | Score |
|---------------|-------|
| &lt; $1k | 15 |
| &lt; $5k | 30 |
| &lt; $25k | 45 |
| &lt; $100k | 60 |
| &lt; $500k | 75 |
| &lt; $2M | 88 |
| ≥ $2M | 95 |

Fallback inventory: none → 12; &lt;1% / sizeWarning → 28; &lt;5% → 48; &lt;15% → 68; else → 82.

**Holder adoption**

| Holders | Base |
|---------|------|
| unknown | 35 |
| &lt;20 | 12 |
| &lt;50 | 28 |
| &lt;100 | 40 |
| &lt;250 | 52 |
| &lt;1k | 68 |
| &lt;5k | 82 |
| ≥5k | 92 |

Soft modifier from adjusted top-10 %: ≥80 → −8; ≥60 → −4; &lt;40 → +3.

**Activity health** = `0.7 × volumeScore + 0.3 × txScore` (piecewise on 24h USD volume and tx count).

**Maturity** — piecewise on `tokenAgeDays` (&lt;1d → 10 … ≥365d → 95; unknown → 40).

**Structural / Data Confidence** — pass-through of engine outputs (0–100).

### 2.3 Caps / ceilings

| Gate | Rule |
|------|------|
| Structural &lt; 25 | Overall ≤ Structural + 10 |
| Structural &lt; 40 | Overall ≤ Structural + 20 |

Rationale (public principle, not copied weights): serious structural failures must not be washed out by trading heat — aligned with GeckoTerminal’s documented statement that serious safety flags drag the composite ([CoinGecko Support — GT Score](https://support.coingecko.com/hc/en-us/articles/38381394237593-What-is-the-GT-Score-How-is-the-GT-Score-calculated)).

---

## 3. API / UI

`ScanResponse`:

- `overall` — Overall Token Score (+ component breakdown)
- `score` / `structural` — Structural Score (v1.1; `score` kept for compatibility)
- `activity`, `confidence` — unchanged axes
- `hansomeLevel` — branded presentation of `activity` (display only)

UI: Overall prominent; Structural secondary; keep Activity (shown as branded **HANSOME Level**) + Data Confidence + breakdowns. Raw Activity remains in API; presentation rename does not change weights or formula.

### 3.1 Presentation bands (UI only)

Scan / Explore may color the Overall number with fixed display bands (`lib/hansome-score/overall-band.ts`). Thresholds are presentation-only and **must not** change Overall weights or the formula:

| Range | Label |
|-------|-------|
| 0–19 | VERY WEAK |
| 20–39 | WEAK |
| 40–59 | FAIR |
| 60–79 | GOOD |
| 80–100 | STRONG |

Band colors indicate Overall **tier only** — never SAFE/BUY or SCAM/SELL. Keep the Overall disclaimer in UI.

---

## 4. Change control

- Structural `CATEGORY_CAPS` in `constants.ts` **must not** change under this version.
- Overall weight/threshold changes require a new Overall version + report note.
- Do not retune Overall to match external composites.
