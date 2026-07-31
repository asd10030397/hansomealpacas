# HANSOME Taxonomy, Trending & Explore — Roadmap Spec

| Field | Value |
|-------|-------|
| **Status** | PLANNING — not Week 1 implementation |
| **Version** | `0.1.0` |
| **Date** | 2026-07-27 |
| **Related** | [`HANSOME_SCORE_V1_SPEC.md`](HANSOME_SCORE_V1_SPEC.md), [`HANSOME_MEME_STORY_SPEC.md`](HANSOME_MEME_STORY_SPEC.md) |

---

## 0. Hard separation

| Concept | Meaning | Must not |
|---------|---------|----------|
| **HANSOME Score** | Structural risk & transparency (0–100) | Be driven by category, trending, story, or payment |
| **Activity** | Low / Medium / High activity (UI may show branded **HANSOME Level**) | Be sold as “safety” |
| **Trending** | Relative momentum rank | Be pure absolute volume or pay-to-rank organic |
| **Category / Tags** | Taxonomy labels | Affect HANSOME Score |
| **Meme Story (Context)** | “What’s the Meme?” background blurb | Affect Score / Activity / Trending / Confidence |

**Score ≠ Activity ≠ Trending ≠ Category ≠ Meme Story (Context) ≠ Just Launched / NEW ON ROBINHOOD ≠ Most Searched.**

Week 1 ships **`/scan` only**. Do **not** build `/explore` in Week 1. Meme Story must **not** delay Week 1 scan. Do **not** implement the homepage Just Launched rail until the Score gate and discovery plan approve it (see [`reports/HANSOME_JUST_LAUNCHED_DISCOVERY_PLAN.md`](../reports/HANSOME_JUST_LAUNCHED_DISCOVERY_PLAN.md)).

---

## 1. Taxonomy (config / DB driven)

### 1.1 Design goals

- Add / rename tags **without code changes** (config table or JSON/DB).
- Multi-tag OK per token.
- Category **MUST NOT** affect HANSOME Score.
- **No LLM** in MVP for assignment.

### 1.2 Top-level categories

| Category |
|----------|
| Animal Memes |
| Meme |
| AI / AI Agent |
| RWA |
| DeFi |
| Gaming |
| NFT |
| Utility / Infrastructure |
| Social |
| Other / Unclassified |

### 1.3 Animal subtags (when Animal Memes applies)

| Subtag |
|--------|
| Dog |
| Cat |
| Frog |
| Alpaca |
| Penguin |
| Other Animal |

### 1.4 MVP assignment process

1. **Project-submitted** category request (form / ops intake — future).
2. **HANSOME manual verify** before public Explore label.
3. Unverified → `Other / Unclassified` or hidden from category filters.
4. **No LLM / AI auto-tagging** in MVP.

### 1.5 Storage (Week 2–3)

- Prefer config/DB rows: `token_address`, `chain_id`, `tags[]`, `subtags[]`, `verified_by`, `verified_at`, `source` (`project` | `hansome_manual`).
- Code loads taxonomy definitions from config; scanning engine ignores tags for Score.
- **Also store Meme Story fields** in the same metadata window — see §1.6 and [`HANSOME_MEME_STORY_SPEC.md`](HANSOME_MEME_STORY_SPEC.md).

### 1.6 Meme Story / Project Background (“What’s the Meme?”)

Full spec: [`HANSOME_MEME_STORY_SPEC.md`](HANSOME_MEME_STORY_SPEC.md).

| Item | Rule |
|------|------|
| Purpose | 2–4 sentence answer to what the meme is and why it exists — **not** buy advice or promotion |
| Layer | **Context / Story only** — never feeds Score, Activity, Trending, or Confidence |
| Integrity tiers (UI must label) | **Verified Project Description** · **Community / Public Background** · **Unknown** |
| Unknown copy | “No verified background story is currently available.” |
| MVP sources | Project-submitted short description, official website, official X/socials, **manual review** |
| Forbidden in MVP | Invented lore; LLM stories from name/logo resemblance; AI summaries without verified/public grounding |
| Surfaces | `/scan/[address]` and future Explore token pages **when available** |
| Seed | Manual-seed HANSOME as first Verified example when building the metadata store |

---

## 2. Trending v1 (future)

Transparent **relative momentum**, not vanity volume:

Suggested inputs (labeled sources):

- Volume growth (e.g. 24h vs prior 24h)
- Unique trader growth
- Tx growth
- New holder growth
- Buy-side activity share
- Token age (dampen brand-new spam spikes; do not ban new tokens)

**Rules:**

- Not pure absolute volume ranking.
- No HANSOME payment to boost **organic** Trending.
- Future paid placement = labeled **“Promoted”** only — never mixed into organic Trending or Score.

---

## 3. Explore roadmap

| Window | Deliverable |
|--------|-------------|
| **Week 1** | `/scan` only (Score / Activity / Confidence). **No `/explore`.** No Meme Story delay. |
| **Week 2–3** | Category / tag **+ Meme Story** metadata storage + manual verify workflow; seed HANSOME Verified story |
| **Week 3–4** | `/explore` UI **if** scanner is stable; Story on `/scan/[address]` / Explore pages when available |
| Later | Trending v1 + optional labeled Promoted slots |
| Later (after Score gate) | **Most Searched / Hot CA** (Scan interest) — plan only: [`reports/HANSOME_ANALYTICS_AND_DISCOVERY_PLAN.md`](../reports/HANSOME_ANALYTICS_AND_DISCOVERY_PLAN.md). Separate from Market Trending; never mixed with PROMOTED or Score. |
| Later (after Score gate) | **NEW ON ROBINHOOD / Just Launched** homepage rail (indexed new pools — not “all tokens”) — plan only: [`reports/HANSOME_JUST_LAUNCHED_DISCOVERY_PLAN.md`](../reports/HANSOME_JUST_LAUNCHED_DISCOVERY_PLAN.md). Title stays **NEW ON ROBINHOOD** until Category/Taxonomy filters are operational; only then may a MEME filter surface **NEW MEMES — LAST 15 MIN**. Separate from Most Searched · TOO HANSOME · Category · Overall; never feeds Structural Score. |

### Explore UI (when built)

- Filter by category / animal subtag.
- Show Score, Activity / **HANSOME Level**, Confidence as separate columns/chips.
- Future filter/display examples for market activity (presentation of Activity only), e.g. `🔥 TOO HANSOME RIGHT NOW` — branded chip; not a safety signal. See [`HANSOME_LEVEL_PRESENTATION.md`](HANSOME_LEVEL_PRESENTATION.md).
- Optional **What’s the Meme?** / Context block (tier-labeled) — never as a safety signal.
- Optional Trending section with methodology footnote.
- Never imply Category, Trending, Story, or HANSOME Level = safety.
- **Do not build Explore UI** until the approved Explore phase.

---

## 4. Explicit non-goals (now)

- Building `/explore` in Week 1
- LLM tagging or LLM-invented Meme Story lore
- Pay-to-boost organic Trending
- Letting taxonomy or Meme Story change Score
- Production deploy of Explore / Story UI in Week 1

---

## 5. Handoff note for Week 1 report

Week 1 report must state:

- Taxonomy + Explore + Meme Story are **Week 2–4 plan** only.
- Week 1 success = live `/scan` for HANSOME with real on-chain numbers.
- Meme Story does not delay or modify the Week 1 scan engine.
