# HANSOME Genesis — Metadata Summary

- Collection: **HANSOME Genesis** (HANSOME-GEN)
- Total supply: **500** — 470 Public · 20 Legendary · 10 Reserved (incl. Founder #001)
- Seed: **20260717** (deterministic)
- Artwork: `public/pixel/genesis/{tokenId}.png` (1024×1024, pixel-perfect / nearest-neighbor)
- Metadata: `public/pixel/genesis/metadata/{tokenId}.json`

## Allocation & generation status

| Type | Token IDs | Count | Generation | Artwork |
|---|---|---|---|---|
| Reserved | 1–10 | 10 | manual (hand-designed) | placeholder — pending |
| Legendary | 11–30 | 20 | manual (hand-designed) | placeholder — pending |
| Public | 31–500 | 470 | procedural (approved trait system) | generated ✅ |

## Metadata schema (Public example)

```json
{
  "name": "HANSOME Genesis #98",
  "description": "A HANSOME Genesis alpaca — an original individual of the cozy countryside HANSOME universe. Handcrafted pixel art. Not the mascot.",
  "image": "genesis/98.png",
  "edition": 98,
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Starry Night"
    },
    {
      "trait_type": "Archetype",
      "value": "Cria"
    },
    {
      "trait_type": "Wool",
      "value": "Classic"
    },
    {
      "trait_type": "Clothing",
      "value": "None"
    },
    {
      "trait_type": "Neck Accessory",
      "value": "Bell Collar"
    },
    {
      "trait_type": "Mouth",
      "value": "Wildflower"
    },
    {
      "trait_type": "Ear Accessory",
      "value": "Small Flower"
    },
    {
      "trait_type": "Glasses",
      "value": "None"
    },
    {
      "trait_type": "Hat",
      "value": "Bobble Hat"
    },
    {
      "trait_type": "Effect",
      "value": "Golden Glow"
    }
  ],
  "hansome": {
    "type": "Public",
    "archetype": "Cria",
    "comboHash": "7bc7db89d7243366a783f0b77033a876ae9b074b38ce3d2224d53cdd80558b9a",
    "rarityRank": 1,
    "rarityScore": 150.538,
    "rarityOutOf": 470
  }
}
```

## Trait slots per token

Each Public token carries these `trait_type`s: Background, Archetype, Wool, Clothing, Neck Accessory, Mouth, Ear Accessory, Glasses, Hat, Effect (empty optional slots = "None"). Reserved/Legendary carry Type (+ Role) only.

> No minting performed. No blockchain assets created. Metadata `image` fields are relative repo paths, ready to be re-pointed to IPFS/hosting at mint time.
