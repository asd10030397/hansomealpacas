# HANSOME Level — Presentation Layer

| Field | Value |
|-------|-------|
| **Status** | Presentation only |
| **Version** | `1.0.0` |
| **Date** | 2026-07-27 |
| **Related** | [`HANSOME_SCORE_V1_SPEC.md`](HANSOME_SCORE_V1_SPEC.md), [`HANSOME_OVERALL_SCORE_SPEC.md`](HANSOME_OVERALL_SCORE_SPEC.md), [`HANSOME_TAXONOMY_AND_EXPLORE.md`](HANSOME_TAXONOMY_AND_EXPLORE.md) |

---

## Purpose

**HANSOME Level** is HANSOME’s meme-themed **display** of current market **Activity**.

It does **not** measure token safety, quality, or investment potential.

---

## Hard constraints

HANSOME Level must **not** affect:

- Structural Score
- Overall Score
- Data Confidence
- Risk deductions

Raw Activity values in the engine and API remain unchanged. Scoring weights and the Overall formula are unchanged.

---

## Mapping (raw Activity → branded display)

| Raw Activity | id | Display (English, never translate) |
|--------------|----|------------------------------------|
| Very Low / Inactive | `not_hansome` | 💀 NOT HANSOME |
| Low | `kinda_hansome` | 😐 KINDA HANSOME |
| Medium | `hansome` | 🦙 HANSOME |
| High | `very_hansome` | 😎 VERY HANSOME |
| Very High | `too_hansome` | 🔥 TOO HANSOME |

Engine today emits **Low / Medium / High**. Presentation supports all five for future raw levels.

Implementation: `lib/hansome-score/hansome-level.ts`.

---

## API shape

```json
{
  "activity": { "level": "Low", "source": "geckoterminal", "...": "..." },
  "hansomeLevel": {
    "id": "kinda_hansome",
    "label": "KINDA HANSOME",
    "emoji": "😐",
    "rawLevel": "Low"
  }
}
```

---

## UI / i18n

- Scan card title: **HANSOME LEVEL**
- Branded labels stay **English** in all locales
- Supporting copy (description, tooltip, “Raw Activity”, “Source”) uses en/zh i18n
- Info tooltip exact EN copy is locked in product i18n (`scan.hansomeLevelInfoBody`)

---

## Explore (future — do not build yet)

When Explore ships, filters/chips may show branded phrasing such as:

`🔥 TOO HANSOME RIGHT NOW`

Still presentation of Activity — never a safety signal. See [`HANSOME_TAXONOMY_AND_EXPLORE.md`](HANSOME_TAXONOMY_AND_EXPLORE.md).
