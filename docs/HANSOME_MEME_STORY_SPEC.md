# HANSOME Meme Story / Project Background — Spec

| Field | Value |
|-------|-------|
| **Status** | PLANNING — Context layer only; not Week 1 scan |
| **Version** | `0.1.0` |
| **Date** | 2026-07-27 |
| **UI label** | “What’s the Meme?” / Project Background |
| **Related** | [`HANSOME_TAXONOMY_AND_EXPLORE.md`](HANSOME_TAXONOMY_AND_EXPLORE.md), [`HANSOME_SCORE_V1_SPEC.md`](HANSOME_SCORE_V1_SPEC.md) |

---

## 0. Purpose

Answer in **2–4 sentences**: “What is this meme and why does it exist?”

| Is | Is not |
|----|--------|
| Short factual context about the token’s meme / narrative | Buy advice |
| Origin and cultural recognizability when known | Promotion / shill copy |
| Labeled integrity tier (Verified / Community / Unknown) | Input to HANSOME Score |

**Content should cover (when available):**

- What the token is about
- Why it was created (if known)
- Origin
- Cultural recognizability (animal / internet meme / event / community / character / trend / narrative)

---

## 1. Independence (freeze)

**Meme Story is a separate Context / Story layer.**

It does **NOT** affect:

| Layer | Affected by Meme Story? |
|-------|-------------------------|
| HANSOME Score | **No** |
| Activity | **No** |
| Trending | **No** |
| Confidence (on-chain risk / data completeness) | **No** |

Score ≠ Activity ≠ Trending ≠ Category ≠ **Meme Story (Context)**.

---

## 2. Data integrity tiers (must label in UI)

Every displayed story **must** show one of these tiers:

| Tier | Meaning | UI treatment |
|------|---------|--------------|
| **Verified Project Description** | Project-submitted; verified against official site / socials | Label prominently as Verified |
| **Community / Public Background** | Publicly documented origin (not inventing) | Label as Community / Public |
| **Unknown** | No acceptable source | Show exact copy below — do not invent |

**Unknown copy (exact):**

> No verified background story is currently available.

---

## 3. Integrity rules (MVP)

1. **Do not invent lore.** No LLM-hallucinated stories from name/logo resemblance in MVP.
2. **No AI summaries in MVP.** AI summaries = later only if grounded in verified or public sources.
3. Prefer short, factual blurbs over marketing language.
4. Missing story → **Unknown** tier + fixed copy; never fabricate.

---

## 4. MVP sources

| Source | Role |
|--------|------|
| Project-submitted short description | Primary candidate for Verified |
| Official website | Cross-check / extract public background |
| Official X / socials | Cross-check / public origin notes |
| **Manual review** | Required before Verified public display |

Unverified or conflicting claims stay off the Verified tier (Community/Public only if clearly documented; else Unknown).

---

## 5. Storage (with category metadata)

Store alongside taxonomy metadata (Week 2–3), e.g.:

- `token_address`, `chain_id`
- `meme_story_text` (2–4 sentences, or null)
- `meme_story_tier` (`verified` | `community_public` | `unknown`)
- `meme_story_sources[]` (URLs / refs)
- `verified_by`, `verified_at` (when tier = verified)
- `source` (`project` | `hansome_manual` | `public_doc`)

Scanning engine **ignores** Meme Story for Score / Activity / Confidence / Trending.

---

## 6. Surfaces (when available)

| Surface | When |
|---------|------|
| `/scan/[address]` | Show Context / Story block when metadata exists |
| Future `/explore` token pages | Same — when Explore ships |
| Week 1 `/scan` | **No delay** — Story not required for Week 1 ship |

---

## 7. Roadmap placement

| Window | Deliverable |
|--------|-------------|
| **Week 1** | Scan engine unchanged. **No Story UI required.** Do not delay `/scan`. |
| **Week 2–3** | Store Meme Story with category / tag metadata; manual verify workflow |
| **Week 3–4+** | Show on `/scan/[address]` and Explore token pages when available |
| **Seed** | Manual-seed **HANSOME** as first **Verified Project Description** when building the metadata store |

---

## 8. Sample verified copy (HANSOME — optional seed)

**Tier:** Verified Project Description (after manual check vs official site / socials)  
**Token:** Hansome Alpacas (`HANSOME`) · `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · Robinhood Chain

Sample blurb (project-aligned; treat as candidate seed, not auto-published):

> HANSOME ALPACAS ($HANSOME) is a community-driven meme coin on Robinhood Chain — an animal-meme character (the “too handsome” alpaca) with a fixed supply and no utility promises. It exists as culture-first internet meme / community identity on the chain, not as a company pitch. Official home: hansomealpacas.xyz.

Ops must re-verify against current official site/socials before marking **Verified** in the store.

---

## 9. Explicit non-goals (now)

- Feeding Score, Activity, Trending, or Confidence
- LLM / AI-generated lore from ticker or logo
- Buy/sell CTAs inside the Story block
- Delaying Week 1 scan for Story completeness
- Production deploy of Story UI in Week 1
