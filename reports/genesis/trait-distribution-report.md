# HANSOME Genesis — Trait Distribution Report

_Simulation batch: **100** random previews · seed **20260717** · deterministic. Validation only — not the final collection._

## Ready trait inventory (used by the generator)

| Category | Layer | Required | Ready items | `none` weight |
|---|---|---|---|---|
| Base | 1 | yes | 8 | — |
| Background | 0 | yes | 5 | — |
| Clothing | 3 | no | 2 | 110 |
| Neck Accessories | 4 | no | 5 | 120 |
| Mouth | 6 | yes | 5 | — |
| Ear Accessories | 7 | no | 5 | 170 |
| Glasses | 8 | no | 5 | 110 |
| Hat | 9 | no | 5 | 140 |
| Effects | 10 | no | 5 | 210 |

> Note: **fur** currently has only `classic` (no-op overlay) ready and **face** has no ready art, so every simulated alpaca uses Classic wool and no face mark. These categories are registered but not yet drawn.

## Balance status (Phase 2 tuning applied)

The Phase 2 balancing adjustments are now live and reflected in this batch:

- **Hat `none` 70 → 140:** hats now on ~76% (was 86%); 24 bare-headed alpacas. Straw Hat 24%, Wool Beanie 21% — no longer over-hatted.
- **Clothing `none` 60 → 110:** Cozy Wool Scarf worn 32% (was 53%); clothing bare 64%. Bare-wool cozy identity is now the dominant look.
- **New rule `festival-ribbon → suppress necklace`:** eliminated chest crowding (4 ribbons, 0 with a neck accessory).
- **Rarity ladder** still reads correctly: Golden Glow (legendary) 1×, Golden Ear Tag (epic) 1×.
- Base archetypes remain **uniform** (8–17 spread = expected variance at n=100).

No further tuning recommended — distribution is coherent and on-identity.

## Base

| Trait | id | Count | Share |
|---|---|---|---|
| Sleek | sleek | 17 | 17% |
| Scruffy | scruffy | 16 | 16% |
| Topknot | topknot | 15 | 15% |
| Elder | elder | 13 | 13% |
| Cria | cria | 12 | 12% |
| Curly | curly | 10 | 10% |
| Puff | puff | 9 | 9% |
| Bramble | bramble | 8 | 8% |

## Background

| Trait | id | Count | Share |
|---|---|---|---|
| Morning Sky | morning-sky | 36 | 36% |
| Green Meadow | meadow-green | 34 | 34% |
| Sunset Pasture | sunset-pasture | 21 | 21% |
| Barn Wood | barn-wood | 5 | 5% |
| Starry Night | starry-night | 4 | 4% |

## Clothing

| Trait | id | Count | Share |
|---|---|---|---|
| (none) | __none__ | 64 | 64% |
| Cozy Wool Scarf | wool-scarf | 32 | 32% |
| Festival Ribbon Outfit | festival-ribbon | 4 | 4% |

## Neck Accessories

| Trait | id | Count | Share |
|---|---|---|---|
| (none) | __none__ | 63 | 63% |
| Wooden Necklace | wooden-beads | 13 | 13% |
| Bell Collar | bell-collar | 12 | 12% |
| Berry String | berry-string | 8 | 8% |
| HANSOME Pendant | hansome-pendant | 2 | 2% |
| Clover Pendant | clover-pendant | 2 | 2% |

## Mouth

| Trait | id | Count | Share |
|---|---|---|---|
| Fresh Grass | fresh-grass | 39 | 39% |
| Wheat Stalk | wheat | 33 | 33% |
| Wildflower | white-flower | 17 | 17% |
| Lavender Sprig | lavender | 8 | 8% |
| Four-leaf Clover | four-leaf-clover | 3 | 3% |

## Ear Accessories

| Trait | id | Count | Share |
|---|---|---|---|
| (none) | __none__ | 55 | 55% |
| Leaf Clip | leaf-clip | 21 | 21% |
| Small Flower | small-flower | 17 | 17% |
| Tiny Bell | tiny-bell | 3 | 3% |
| Feather | feather | 3 | 3% |
| Golden Ear Tag | golden-ear-tag | 1 | 1% |

## Glasses

| Trait | id | Count | Share |
|---|---|---|---|
| Round Glasses | round-glasses | 32 | 32% |
| (none) | __none__ | 30 | 30% |
| Reading Glasses | reading-glasses | 16 | 16% |
| Sunglasses | sunglasses | 13 | 13% |
| Heart Glasses | heart-glasses | 5 | 5% |
| Farm Goggles | farm-goggles | 4 | 4% |

## Hat

| Trait | id | Count | Share |
|---|---|---|---|
| Straw Sun Hat | straw-hat | 24 | 24% |
| (none) | __none__ | 24 | 24% |
| Wool Beanie | wool-beanie | 21 | 21% |
| Bobble Hat | bobble-hat | 14 | 14% |
| Cloth Cap | cloth-cap | 10 | 10% |
| Flower Crown | flower-crown | 7 | 7% |

## Effects

| Trait | id | Count | Share |
|---|---|---|---|
| (none) | __none__ | 72 | 72% |
| Small Sparkles | small-sparkles | 8 | 8% |
| Soft Snowflakes | snowflakes | 7 | 7% |
| Falling Leaves | falling-leaves | 6 | 6% |
| Small Fireflies | fireflies | 6 | 6% |
| Golden Glow | golden-glow | 1 | 1% |

