# HANSOME Genesis — Special-21 Allocation Map

_Specification only. **No artwork generated, no final NFT images, public 470 generation untouched.**_

The **Special 21** = **Founder #001** (the single King) **+ the 20 Legendary NFTs (#11–30)**, split across four gameplay classes. Each token's background is locked to its class (see `compatibility.json > specialBackgroundClassLock`).

## Composition

| Gameplay Class | Count | Background (locked) | Token IDs |
|---|---|---|---|
| King | 1 | `king` | #001 (Founder) |
| Guardian | 5 | `guardian` | #11–#15 |
| Farmer | 5 | `farmer` | #16–#20 |
| Lucky | 5 | `lucky` | #21–#25 |
| Runner | 5 | `runner` | #26–#30 |
| **Total** | **21** | | |

## Global design rules (apply to all 21)

- **Existing identity only.** Each Special uses one **existing Genesis base archetype** — same face style, wool shape, silhouette, proportions, and pixel rendering as the public collection.
- **No new anatomy, no new archetypes.** Nothing is redesigned.
- **Alpaca stays the focus.** The class-locked Special Background is the primary differentiator; auras glow *around* the silhouette.
- **Palette:** only subtle in-universe warmth/coolness shifts that echo the class aura. No neon, no hues outside the HANSOME palette.
- **Expression:** pick an existing archetype expression that fits the class mood — no new facial rigs.
- **Accessories:** minimal. At most **one subtle optional** class accent. Rarity comes from **class + background + supply + metadata**, not accessories.
- **Founder #001** is the **only** token allowed to use the iconic mascot appearance.

---

## King (1)

| SP | Token | Role | Base |
|---|---|---|---|
| SP-01 | #001 | **The Founder King — HANSOME, First of the Herd** | mascot (Founder-exclusive) |

- **Lore:** The first alpaca of the meadow and the origin of the whole herd. Where HANSOME walks, the village follows. He wears the crown of the pasture kingdom not as a ruler over others, but as the one who remembers every alpaca's name.
- **Visual direction:** Founder-exclusive mascot base (iconic side-swept wool, signature calm smile) on the **King** background — royal purple, gold sunburst aura, crown emblem. Warm gold light on the wool. Optional single accent: the Founder Crown. Regal, serene, unmistakably the mascot.

---

## Guardian (5) — `guardian` background

| SP | Token | Role | Base | Lore (short) |
|---|---|---|---|---|
| SP-02 | #11 | Warden of the Old Stones | elder | Eldest guardian; watches the standing stones — calm as bedrock. |
| SP-03 | #12 | Shield of the Meadow | bramble | Slow to rise, impossible to move; the little ones shelter behind his wool. |
| SP-04 | #13 | Sentinel of the North Gate | scruffy | Sharp-eyed watcher who takes the coldest post for a clear horizon. |
| SP-05 | #14 | Keeper of the Herd | topknot | Counts every alpaca home before the gates close at dusk. |
| SP-06 | #15 | Watcher of Dawn | sleek | Stands the dawn watch on the ridge so the herd can rest longer. |

- **Visual direction:** steel-blue temple backdrop, stone pillars framing the alpaca, shield emblem, cool cyan aura. Steady, watchful expressions; subtle cool-grey rim light. No accessories.

## Farmer (5) — `farmer` background

| SP | Token | Role | Base | Lore (short) |
|---|---|---|---|---|
| SP-07 | #16 | Keeper of the Golden Fields | puff | Happiest knee-deep in ripe wheat at golden hour. |
| SP-08 | #17 | The Harvest Warden | bramble | Keeps the rhythm of the seasons and never rushes one. |
| SP-09 | #18 | Master of the Orchard | curly | Tends the crooked apple trees; hums while he works. |
| SP-10 | #19 | The Old Sower | elder | Has planted more seasons than anyone can count. |
| SP-11 | #20 | Shepherd of the Vale | scruffy | Gathers strays at sundown with patience and a soft call. |

- **Visual direction:** golden-hour field, distant barn, wheat. Warm amber light on the wool; content, homely expressions. Optional single accent: a subtle wheat sprig.

## Lucky (5) — `lucky` background

| SP | Token | Role | Base | Lore (short) |
|---|---|---|---|---|
| SP-12 | #21 | The Clover Child | cria | Born under a four-leaf clover; has never stopped smiling. |
| SP-13 | #22 | Fortune's Favorite | curly | Coins find the ground wherever this one wanders. |
| SP-14 | #23 | The Charm Bearer | puff | Carries the herd's good luck quietly, for everyone. |
| SP-15 | #24 | Wanderer of Wishes | sleek | Collects wishes to hand back to alpacas who've run out. |
| SP-16 | #25 | The Lucky Star | topknot | Always draws the long straw and lands on all four hooves. |

- **Visual direction:** green meadow, gold shimmer, floating clovers. Bright, joyful expressions; faint gold sparkle catch-light. Optional single accent: a tiny clover.

## Runner (5) — `runner` background

| SP | Token | Role | Base | Lore (short) |
|---|---|---|---|---|
| SP-17 | #26 | The Dawn Runner | sleek | Runs the ridge each morning to wake the sun. |
| SP-18 | #27 | Windfoot | cria | Fastest little one; slips through any gap. |
| SP-19 | #28 | The Trailblazer | scruffy | Finds the paths no one else will. |
| SP-20 | #29 | Messenger of the Meadow | curly | Carries news between far barns faster than the wind. |
| SP-21 | #30 | The Swift | topknot | So quick the herd only sees where it just was. |

- **Visual direction:** dawn sky, side speed-streaks, low-sun halo. Alert, forward-facing expressions; cool-to-warm palette with motion streaks behind (never covering the alpaca).

---

## Archetype spread (variety check)

Founder uses the mascot base. Across the 20 Legendaries: scruffy ×3, topknot ×3, sleek ×3, curly ×3, elder ×2, bramble ×2, puff ×2, cria ×2 — all 8 existing archetypes represented, none over-used.

## Status & next steps

- **Machine-readable spec:** `public/pixel/traits/special-21-allocation.json`
- **Enforcement:** class↔background lock validated by `scripts-nft/genesis/validate-special.mjs` (`validateSpecialToken()` will check each Special when its `gameplayClass` + `specialBackground` are set).
- **Not done (awaiting approval):** hand-designing the 21 artworks, writing their final metadata, and any minting — none started.
