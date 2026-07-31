# HANSOME Scan / Score — Baseline Freeze

| Field | Value |
|-------|-------|
| **Status** | **FROZEN** |
| **Freeze date** | 2026-07-27 |
| **Source artifact** | [`hansome-score-week2a-hansome.json`](hansome-score-week2a-hansome.json) |
| **scannedAt** | `2026-07-27T15:11:05.312Z` |
| **Engine version** | `1.3.0-overall` |
| **Token** | HANSOME · `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · chainId `4663` |
| **Lock Distribution verify** | [`HANSOME_LOCK_DISTRIBUTION_LIVE_VERIFY.md`](HANSOME_LOCK_DISTRIBUTION_LIVE_VERIFY.md) — **PASS** |

---

## Frozen headline numbers (HANSOME)

| Axis | Value |
|------|-------|
| **Overall Token Score** | **55** |
| **Structural Score** | **83** |
| **Activity level** | **Low** |
| **HANSOME Level** | KINDA HANSOME (`kinda_hansome`) |
| **Data Confidence** | **89%** (band: High) |
| **LP aggregate** | **MIXED** → UI **PARTIALLY LOCKED** |
| Activity 24h volume (Gecko) | ≈ $51.43 |
| Activity 24h txs | 3 |

Overall components (reference only — not retuned by this freeze):

| Component | Score |
|-----------|------:|
| structural | 83 |
| liquidityDepth | 45 |
| holderAdoption | 43 |
| activity | 19 |
| maturity | 55 |
| dataConfidence | 89 |

---

## Lock Distribution (frozen from verify PASS)

| Field | Value |
|-------|-------|
| available | `true` |
| method | `token_amounts` |
| lockedUsd / lockedPct | ≈ $4639.15 / 28.884% |
| unlockedUsd / unlockedPct | ≈ $11422.05 / 71.116% |
| totalPositionUsd | ≈ $16061.20 |
| poolLiquidityUsd | ≈ $15940.62 |
| reconciledWithPool | `true` |
| #47299 | LOCKED · ≈ $4639.15 |
| #357867 | UNLOCKED · ≈ $9991.25 |
| #142938 | UNLOCKED · ≈ $1430.81 |

---

## Freeze policy (Week 2B)

- **Scan/Score baseline is frozen** at the numbers above for regression reference.
- **No weight retunes** during Week 2B (Structural `CATEGORY_CAPS`, Overall weights, Data Confidence weights).
- **No Overall formula changes** during Week 2B unless the user explicitly asks.
- Week 2B work is **Category + Meme Story metadata** only — must not feed Score / Activity / Trending / Confidence.

---

## Supply & Burn Intelligence (P0+P1) — FROZEN

| Field | Value |
|-------|-------|
| **Status** | **FROZEN** into Scan baseline |
| **Validation** | [`HANSOME_SUPPLY_AND_BURN_P0P1_VALIDATION.md`](HANSOME_SUPPLY_AND_BURN_P0P1_VALIDATION.md) — **PASS** |
| **Scope** | P0 (dead inventory) + P1 (burn mechanisms) only |

Frozen product rules (do not expand without explicit ask):

| Rule | Frozen behavior |
|------|-----------------|
| Known burned | Allowlisted dead addresses only (`0x0`, `0xdead`, etc.) via `balanceOf` |
| Burn Function / Automatic / Admin | Yes \| No \| Unknown — Unknown never silently becomes No |
| Privileged / admin burn | Contract Risk only (−12 blacklist band); not a positive signal |
| Voluntary burn / burned % | **No** Structural or Overall Score boost |
| Supply permanently reduced | Always Unknown in P0/P1 |
| P2 / P3 | **Not in baseline** — no 24H/7D/all-time burn windows; no event-proven supply reduction |

Primary UI labels (display): Total Supply · Known Burned · Supply Excluding Known Burns (when known burned > 0) · Burn Function · Automatic Burn · Admin Burn.

---

## Spec pointers

| Doc | Role |
|-----|------|
| [`docs/HANSOME_OVERALL_SCORE_SPEC.md`](../docs/HANSOME_OVERALL_SCORE_SPEC.md) | Overall Token Score |
| [`docs/HANSOME_SCORE_V1_1_SPEC.md`](../docs/HANSOME_SCORE_V1_1_SPEC.md) | Structural Score |
| [`docs/HANSOME_TAXONOMY_AND_EXPLORE.md`](../docs/HANSOME_TAXONOMY_AND_EXPLORE.md) | Category / Explore roadmap |
| [`docs/HANSOME_MEME_STORY_SPEC.md`](../docs/HANSOME_MEME_STORY_SPEC.md) | Meme Story (Context) |
| LP multi-version / MIXED | `lib/hansome-score/lp/*`, Week 2A reports |
| [`reports/HANSOME_SCORE_WEEK2A_DATA_VALIDATION.md`](HANSOME_SCORE_WEEK2A_DATA_VALIDATION.md) | Week 2A validation |
| [`reports/HANSOME_SCORE_WEEK1_5_HARDENING.md`](HANSOME_SCORE_WEEK1_5_HARDENING.md) | Gate to Week 2 product work |
| [`reports/HANSOME_SUPPLY_AND_BURN_P0P1_VALIDATION.md`](HANSOME_SUPPLY_AND_BURN_P0P1_VALIDATION.md) | Supply & Burn P0+P1 validation (PASS) |
