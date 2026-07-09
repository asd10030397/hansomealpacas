# KAIRU Brand Guidelines

> *We look expensive. We feel nothing. We still post.*

---

## Brand Essence

KAIRU is a premium meme brand — the visual restraint of Apple, the emotional vacancy of a 3am scroll, and the quiet chaos of internet culture. Everything is intentional. Nothing is trying too hard.

### Brand Personality

| Trait | What it means | What it is NOT |
|---|---|---|
| **Minimal** | Clean layouts, generous whitespace, one idea per frame | Cluttered, loud, over-designed |
| **Dead inside** | Flat affect, understated copy, no fake enthusiasm | Hype, exclamation marks, "we're so excited" |
| **Funny** | Dry, observational, slightly unhinged | Slapstick, try-hard memes, corporate humor |
| **Mysterious** | Incomplete sentences, implied lore, withheld context | Crypto buzzwords, explainer overload |

### The Golden Rule

**Never look like Web3 corporate design.**

Avoid: purple-blue gradients, hexagonal grids, rocket ships, diamond hands, "WAGMI" energy, glassmorphism cards, neon glow borders, futuristic HUD overlays, tokenomics charts as hero imagery, or anything that screams "we raised $40M."

Instead: monochrome dominance, deadpan typography, meme-adjacent imagery treated with editorial seriousness, and copy that sounds like it was written by someone who has seen too much.

---

## Logo Usage

### Primary Logo

The KAIRU wordmark is the hero. It should always feel like it belongs on a $2,000 hoodie, not a Discord server banner.

**Specifications:**
- Wordmark: `KAIRU` in all caps, tracked wide (+80 to +120)
- Preferred weight: Medium to Semibold
- Preferred typeface: SF Pro Display, Inter, or Helvetica Neue
- Color: `#0A0A0A` on light backgrounds / `#FAFAFA` on dark backgrounds

### Logo Clear Space

Maintain clear space equal to the height of the letter **K** on all four sides. Nothing enters this zone — not icons, not taglines, not meme stickers.

### Minimum Size

| Context | Minimum width |
|---|---|
| Digital | 80px |
| Print | 20mm |

Below these sizes, use the monogram **K** only.

### Logo Don'ts

- Do not add gradients, glows, or drop shadows to the logo
- Do not stretch, skew, rotate, or outline the wordmark
- Do not place the logo on busy or low-contrast backgrounds
- Do not pair the logo with crypto iconography (coins, chains, rockets)
- Do not animate the logo with bounce, pulse, or "hype" effects
- Do not use the logo as a watermark at low opacity over meme content — memes stand alone; the logo appears in the frame, not on top of it

### Monogram

The **K** monogram is used for:
- Favicons and app icons
- Social avatars
- Watermarks on owned content (full opacity only, never ghosted)

Monogram treatment: single **K**, centered, same tracking discipline as the full wordmark.

### Co-branding

When KAIRU appears alongside partners, KAIRU is always visually dominant or equal — never secondary, never smaller, never relegated to a corner badge.

---

## Color Palette

Monochrome first. Color is a rare event — like feeling something.

### Core Colors

| Name | Hex | RGB | Usage |
|---|---|---|---|
| **Void** | `#0A0A0A` | 10, 10, 10 | Primary text, logo, dark mode background |
| **Bone** | `#FAFAFA` | 250, 250, 250 | Light mode background, reversed text |
| **Ash** | `#6B6B6B` | 107, 107, 107 | Secondary text, captions, metadata |
| **Smoke** | `#E8E8E8` | 232, 232, 232 | Borders, dividers, subtle UI chrome |
| **Ghost** | `#F5F5F5` | 245, 245, 245 | Card backgrounds, input fields (light mode) |

### Accent Colors (Use Sparingly)

Accents appear in less than 10% of any composition. They signal emphasis, not brand identity.

| Name | Hex | Usage |
|---|---|---|
| **Bleed** | `#FF2D2D` | Critical alerts, destructive actions, the one thing that broke the silence |
| **Mold** | `#8B9A6B` | Success states, confirmations — muted, not celebratory |
| **Static** | `#4A5568` | Links, interactive elements on dark backgrounds |

### Dark Mode (Default)

KAIRU lives in the dark. Dark mode is the primary experience.

```
Background:     #0A0A0A
Surface:        #141414
Surface raised: #1C1C1C
Border:         #2A2A2A
Text primary:   #FAFAFA
Text secondary: #6B6B6B
```

### Color Don'ts

- No purple-to-blue gradients (ever)
- No neon accent colors
- No rainbow or multi-color gradients
- No gold/platinum "premium crypto" palettes
- No color used purely for decoration — every color must mean something

---

## Typography

Typography does the heavy lifting. Images are secondary. The type IS the brand.

### Primary Typeface

**SF Pro Display** (Apple ecosystem) or **Inter** (cross-platform)

- Headlines: Display, Semibold (600)
- Body: Text, Regular (400)
- Labels/UI: Text, Medium (500)

### Secondary Typeface

**IBM Plex Mono** — for metadata, timestamps, code snippets, and anything that should feel like a system log or terminal output.

Use monospace sparingly. It adds mystery; overuse kills it.

### Type Scale

| Level | Size | Weight | Tracking | Line Height | Usage |
|---|---|---|---|---|---|
| **Hero** | 72–96px | 600 | +2% | 1.0 | Landing hero, campaign headlines |
| **H1** | 48px | 600 | +1% | 1.1 | Page titles |
| **H2** | 32px | 600 | 0 | 1.2 | Section headers |
| **H3** | 24px | 500 | 0 | 1.3 | Subsections |
| **Body** | 16px | 400 | 0 | 1.6 | Paragraphs, descriptions |
| **Small** | 14px | 400 | 0 | 1.5 | Captions, footnotes |
| **Micro** | 12px | 500 | +2% | 1.4 | Labels, badges, metadata (mono) |

### Typography Rules

1. **All caps for headlines** — KAIRU headlines are uppercase with generous tracking
2. **Sentence case for body** — lowercase energy, deadpan delivery
3. **Never use more than two typefaces** in a single composition
4. **No decorative or script fonts** — ever
5. **No outlined or shadowed text** — flat and clean
6. **Ellipsis is a punctuation choice** — use `...` to imply something unsaid

### Example Hierarchy

```
STILL HERE.                    ← Hero, 72px, Void/Bone
we never left.                 ← Body, 16px, Ash
posted 3 days ago · 847 views  ← Micro, 12px, IBM Plex Mono, Ash
```

---

## Button Styles

Buttons are quiet. They don't scream "CLICK ME." They sit there, confident, waiting.

### Primary Button

The default action. Used once per view, maximum.

```
Background:     #0A0A0A (light mode) / #FAFAFA (dark mode)
Text:           #FAFAFA (light mode) / #0A0A0A (dark mode)
Font:           14px, Medium (500), +2% tracking, uppercase
Padding:        14px 28px
Border radius:  8px
Border:         none
```

**Hover:** opacity 85%
**Active:** opacity 70%
**Disabled:** opacity 40%, cursor not-allowed

### Secondary Button

For alternative actions. Visually subordinate.

```
Background:     transparent
Text:           #0A0A0A / #FAFAFA
Border:         1px solid #E8E8E8 / #2A2A2A
Padding:        14px 28px
Border radius:  8px
```

**Hover:** background `#F5F5F5` / `#141414`

### Ghost Button

For tertiary actions, inline links, dismissals.

```
Background:     transparent
Text:           #6B6B6B
Border:         none
Padding:        8px 16px
Text decoration: none

Hover: text color → #0A0A0A / #FAFAFA
```

### Destructive Button

Rare. Used for irreversible actions only.

```
Background:     #FF2D2D
Text:           #FAFAFA
Border radius:  8px
```

### Button Copy Guidelines

| Do | Don't |
|---|---|
| "Continue" | "Let's go!" |
| "Done" | "Awesome!" |
| "Delete" | "Remove forever 💀" |
| "See more" | "Unlock the magic ✨" |
| "..." | "Submit" |

Buttons use sentence case or single words. Never exclamation marks.

---

## Border Radius

Rounded, but not soft. Apple-adjacent, not bubbly.

| Element | Radius |
|---|---|
| Buttons | 8px |
| Input fields | 8px |
| Cards | 12px |
| Modals / dialogs | 16px |
| Images / media | 8px |
| Avatars | 50% (circle) |
| Pills / tags | 999px (full) |
| Meme frames | 0px (sharp — memes are raw) |

**Rule:** UI chrome is rounded. Meme content is sharp. The contrast is intentional — the frame is premium, the content is unfiltered.

---

## Shadows

Shadows are almost invisible. Depth is suggested, never announced.

### Elevation Scale

| Level | Shadow | Usage |
|---|---|---|
| **0 — Flat** | none | Default state for most elements |
| **1 — Resting** | `0 1px 2px rgba(0,0,0,0.04)` | Cards on light backgrounds |
| **2 — Raised** | `0 4px 12px rgba(0,0,0,0.06)` | Dropdowns, popovers |
| **3 — Floating** | `0 8px 24px rgba(0,0,0,0.08)` | Modals, dialogs |

### Dark Mode Shadows

On dark backgrounds, use border instead of shadow:

```
Border: 1px solid #2A2A2A
```

Shadows on dark backgrounds are nearly invisible and should be avoided. Use surface color shifts (`#141414` → `#1C1C1C`) to imply elevation.

### Shadow Don'ts

- No colored shadows
- No heavy drop shadows (nothing above level 3)
- No glow effects
- No inner shadows
- No shadow + border + gradient stacking

---

## Layout Spacing

Whitespace is the brand. When in doubt, add more space.

### Base Unit

**4px grid.** All spacing values are multiples of 4.

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight inline gaps |
| `space-2` | 8px | Icon-to-text gaps |
| `space-3` | 12px | Compact padding |
| `space-4` | 16px | Standard padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Component separation |
| `space-12` | 48px | Section padding |
| `space-16` | 64px | Major section breaks |
| `space-24` | 96px | Hero padding |
| `space-32` | 128px | Page-level vertical rhythm |

### Layout Principles

1. **One focal point per viewport** — one headline, one image, one CTA
2. **Center-aligned for hero sections** — left-aligned for content
3. **Max content width: 680px** for text-heavy pages (readability)
4. **Max content width: 1200px** for grid layouts
5. **Mobile-first** — design for 375px, scale up
6. **Generous vertical padding** — sections breathe; nothing feels cramped

### Grid

```
Desktop:  12 columns, 24px gutter, 48px margin
Tablet:   8 columns, 16px gutter, 32px margin
Mobile:   4 columns, 16px gutter, 16px margin
```

---

## Icon Style

Icons are functional, not decorative. They exist to communicate, then disappear.

### Style Specifications

| Property | Value |
|---|---|
| Style | Outlined (stroke), not filled |
| Stroke width | 1.5px |
| Size | 20px (UI), 24px (navigation), 16px (inline) |
| Color | `#6B6B6B` default, `#0A0A0A` / `#FAFAFA` on hover |
| Corner style | Rounded stroke caps and joins |
| Source | Lucide, Phosphor (regular weight), or SF Symbols |

### Icon Rules

1. **One icon style per interface** — never mix outlined and filled
2. **Icons always paired with text labels** in navigation (no icon-only nav)
3. **No emoji as icons** in UI — emoji belong in content, not chrome
4. **No crypto-specific icons** — no coins, chains, wallets, rockets
5. **Icon color matches text hierarchy** — Ash for secondary, Void/Bone for primary

### Meme-adjacent Icons (Content Only)

In meme content and social posts, icons can break rules — but they must be:
- Screenshot-quality (not clipart)
- Contextually deadpan (a loading spinner captioned "still waiting" > a party popper)

---

## Meme Style

This is the soul of KAIRU. Memes are treated as editorial content, not throwaway jokes.

### Visual Treatment

| Property | Guideline |
|---|---|
| **Format** | 1:1 (feed), 4:5 (portrait), 16:9 (video/thumbnail) |
| **Resolution** | Minimum 1080px on shortest side |
| **Border** | None — memes are full-bleed, no frames or watermarks |
| **Text on image** | Impact-style is banned. Use clean sans-serif (same as brand type) |
| **Filters** | No Instagram filters. Slight desaturation (-10 to -20%) is acceptable |
| **Quality bar** | Must look good on a retina display — no pixelated screenshots |

### Meme Categories

**1. Deadpan Observational**
> Image: empty office chair
> Caption: "he's still in the meeting"

**2. Mysterious Lore**
> Image: grainy photo of something unidentifiable
> Caption: "day 847"

**3. Anti-Hype**
> Image: graph going down
> Caption: "performance update"

**4. Existential Product**
> Image: product shot with studio lighting
> Caption: "it exists. that's the update."

**5. Meta / Self-Aware**
> Image: screenshot of our own tweet
> Caption: (no caption — the screenshot IS the joke)

### Meme Copy Rules

- **Lowercase preferred** — uppercase only for emphasis on one word max
- **No hashtags in the meme itself** — hashtags go in the post caption, not the image
- **No emoji in meme text** — emoji in captions only, and sparingly
- **Punctuation is minimal** — periods optional. question marks rare. exclamation marks never.
- **Imply, don't explain** — if the audience gets it, it's good. if they don't, also good.

### Meme Don'ts

- No "when you..." setup format (overused)
- No Drake pointing / distracted boyfriend / stock templates (unless ironically degraded)
- No minion memes, no motivational quote overlays
- No watermarks, handles, or CTAs burned into the image
- No crypto price charts as meme backgrounds
- No "POV:" format

---

## Social Media Style

Each platform gets the same brand, adapted — not diluted.

### Profile Setup

| Element | Guideline |
|---|---|
| **Avatar** | K monogram on Void (#0A0A0A) or Bone (#FAFAFA) — alternate by platform for contrast |
| **Banner** | Solid color or single deadpan statement in brand typography. No collage banners. |
| **Bio** | One line. No emojis. No link tree unless necessary. |
| **Link** | Single link only — website or current campaign |

### Bio Examples

```
we're still here
```

```
something is coming. probably.
```

```
official account. unofficial feelings.
```

### Platform-Specific Guidelines

#### X (Twitter)

- **Tone:** Shortest, driest, most mysterious
- **Post length:** Under 100 characters ideal. Never thread unless lore requires it.
- **Frequency:** Quality over quantity. Silence is on-brand.
- **Format:** Text-only posts perform well. Image posts use meme style guidelines.
- **Engagement:** Reply deadpan. Quote-tweet with context, not commentary.
- **Pinned tweet:** One line + link, or a single image that defines the brand

#### Instagram

- **Grid:** Curated, monochromatic when viewed as a whole. Alternate: product/lifestyle shot → meme → text post
- **Stories:** Minimal — black background, white text, or raw photo. No sticker spam.
- **Reels:** Deadpan humor, slow pacing, no trending audio unless ironic
- **Captions:** 1-2 sentences max. No "double tap if..." or "tag someone who..."

#### TikTok

- **Style:** Anti-TikTok TikTok — slow, quiet, no jump cuts, no pointing at text
- **Audio:** Ambient, silence, or ironic classical music. Never trending sounds unironically.
- **Length:** 7-15 seconds. Say less.

#### Discord

- **Server aesthetic:** Void background, minimal channels, no welcome bot spam
- **Announcements:** Same copy tone as social — deadpan, no @everyone unless critical

### Posting Cadence

| Platform | Frequency |
|---|---|
| X | 3–5x per week |
| Instagram | 2–3x per week |
| TikTok | 1–2x per week |
| Discord | As needed — silence is fine |

### Hashtag Strategy

Maximum 2 hashtags per post. Only use if genuinely relevant.

```
Approved:  #kairu
Avoid:     #crypto #web3 #NFT #toTheMoon #WAGMI #blockchain
```

---

## Website Tone

The website is a gallery, not a pitch deck. Visitors should feel like they wandered into something — not like they're being sold to.

### Page Structure Principles

1. **Hero:** One statement. No subheadline explaining what we do. No "learn more" scroll indicators.
2. **Navigation:** Minimal — 3 to 5 items max. No dropdown mega-menus.
3. **Content sections:** One idea per section. Large type. Lots of space.
4. **Footer:** Small, quiet — copyright, one link, maybe a social icon row.
5. **No pop-ups.** No cookie banners that take over the screen. No chat widgets.

### Page Copy Examples

**Hero:**
```
STILL HERE.
```

**About (if needed):**
```
we make things for people who feel nothing
and want to feel something about feeling nothing.
```

**404:**
```
this page left too
```

**Loading state:**
```
...
```

**Empty state:**
```
nothing yet
```

### UX Microcopy

| Context | Copy |
|---|---|
| Success | "done" |
| Error | "that didn't work" |
| Loading | "..." |
| Empty | "nothing here" |
| Confirmation | "are you sure" |
| Sign up | "join" (not "Sign up for free!") |
| Sign out | "leave" |

### Website Don'ts

- No hero videos with particle effects
- No "trusted by" logo bars
- No testimonial carousels
- No pricing tables with 3 tiers and a "most popular" badge
- No countdown timers
- No "join 10,000+ members" social proof
- No FAQ accordions with 20 questions
- No chatbot named something like "Kai" or "Ru"

---

## Copywriting Tone

Every word is a choice. Most choices should be silence.

### Voice Attributes

| Attribute | Description | Example |
|---|---|---|
| **Flat** | No emotional inflation | "it's live" not "we're THRILLED to announce" |
| **Brief** | Say it in fewer words | "new drop" not "we're excited to reveal our latest collection" |
| **Oblique** | Don't explain everything | "day 12" not "here's an update on our 12-day project" |
| **Dry** | Humor through understatement | "it still works" not "this amazing product continues to deliver!" |
| **Confident** | No hedging, no asking | "get it" not "check it out if you're interested!" |

### Writing Rules

1. **Lowercase by default** — capitalize only for headlines and proper nouns
2. **No exclamation marks** — the only exception is ironic usage in meme content
3. **No emoji in official copy** — one emoji max in social captions, never in product copy
4. **Short sentences** — if it has a comma, consider splitting it
5. **No questions to the audience** — KAIRU doesn't ask "what do you think?" KAIRU states.
6. **Ellipsis over explanation** — "soon..." beats "coming soon to a platform near you"
7. **Numbers are specific** — "day 847" not "a long time"
8. **Avoid superlatives** — nothing is "the best" or "revolutionary" or "game-changing"

### Vocabulary

**Use:**
- still, here, nothing, something, maybe, probably, exists, left, waiting, day [number], update, note, void

**Avoid:**
- excited, thrilled, amazing, incredible, revolutionary, disruptive, empower, leverage, ecosystem, community (as a noun), journey, hustle, grind, WAGMI, LFG, to the moon, diamond hands, ngmi

### Copy Templates

**Product launch:**
```
[new thing]
it exists now
```

**Update / changelog:**
```
update
— fixed the thing
— added the other thing
— nothing you asked for
```

**Event / drop announcement:**
```
[date]
something happens
```

**Apology (if ever needed):**
```
we broke it
it's fixed now
sorry
```

**Thank you (if ever needed):**
```
noted
```

---

## Quick Reference Card

```
BRAND:        KAIRU
VIBE:         Minimal · Dead inside · Funny · Mysterious
NOT:          Web3 corporate

COLORS:       Void #0A0A0A · Bone #FAFAFA · Ash #6B6B6B
ACCENT:       Bleed #FF2D2D (rare)

TYPE:         SF Pro Display / Inter + IBM Plex Mono
HEADLINES:    UPPERCASE, tracked wide
BODY:         lowercase, deadpan

BUTTONS:      8px radius · uppercase · no exclamation marks
SHADOWS:      barely there · borders on dark mode
SPACING:      4px grid · whitespace is the brand

MEMES:        editorial quality · lowercase · imply don't explain
SOCIAL:       short · dry · silence is on-brand
WEB:          gallery not pitch deck · no pop-ups
COPY:         flat · brief · oblique · no hype words
```

---

*Last updated: July 2026*
*Version 1.0*

*If you're reading this and feeling something, that's on you.*
