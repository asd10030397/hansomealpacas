# HANSOME Score Week 2B — Category + Meme Story

| Field | Value |
|-------|-------|
| **Status** | Implemented (storage + API attach; **no Explore UI**, **no Story UI**) |
| **Date** | 2026-07-27 |
| **Gate** | Lock Distribution live verify **PASS** + Scan/Score baseline freeze |
| **Specs** | [`docs/HANSOME_TAXONOMY_AND_EXPLORE.md`](../docs/HANSOME_TAXONOMY_AND_EXPLORE.md), [`docs/HANSOME_MEME_STORY_SPEC.md`](../docs/HANSOME_MEME_STORY_SPEC.md) |

---

## Delivered

1. **Taxonomy config** — top-level categories + animal subtags (`lib/hansome-taxonomy/categories.ts`)
2. **Metadata store** — JSON seed + runtime overlay (`content/taxonomy/token-metadata.json`, `store.ts`)
3. **Meme Story helpers** — tiers, exact Unknown copy, display resolve (`meme-story.ts`)
4. **Manual verify workflow** — project submit → ops verify for category + story (`verify.ts`)
5. **HANSOME seed** — Verified Animal Memes / Meme / Alpaca + Verified Project Description blurb
6. **Scan API attach** — `ScanResponse.context` from `getTokenContextMetadata()` (affectsScore: false); **ScanClient UI not wired** (Week 3–4+)

## Explicitly not started

- `/explore` UI
- Just Launched / NEW ON ROBINHOOD homepage rail
- Production deploy
- Analytics / Most Searched
- LLM tagging or invented lore
- Score / Overall / Confidence weight changes

## Left for Week 3–4+

- Story / category chips on `/scan/[address]` UI
- Explore filters once scanner stable
- Persistent DB / ops form (JSON store is MVP)
