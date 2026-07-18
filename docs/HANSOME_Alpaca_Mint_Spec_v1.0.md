# HANSOME Alpacas — Mint Specification v1.0

| Field | Value |
|---|---|
| Document type | Alpaca-side mint / metadata specification (NOT a contract, **NO Solidity**) |
| Status | **APPROVED** — Reserved `#001`–`#010` class map locked |
| Parent mint document | **`HANSOME_Genesis_Mint_Spec_v1.0.md`** (authoritative for supply, phases, reveal, freeze) |
| Collection | **HANSOME Genesis NFT** (single ERC-721 — Alpacas are a **side** inside it, not a separate mint) |
| Alpaca supply | **500** (of 550 total Genesis tokens) |
| Royalty | **500 bps (5%)** — collection-level (same as Genesis) |
| Source of truth (gameplay) | HANSOME GDS v1.1 §4.1 / §10–§12 |

**This document does not define a separate Alpaca mint entrance or contract.**  
All mint flow, wallet caps, random allocation, reveal, IPFS, and freeze rules live in the Genesis Mint Spec. This file specifies **Alpaca identity, reserved Specials, metadata, and gameplay class mapping** inside that single collection.

---

## 1. Position in the Genesis mint

| Topic | Rule |
|---|---|
| Collection | One ERC-721: **HANSOME Genesis NFT** |
| User experience | One mint entry; buyer randomly receives Alpaca **or** Cougar |
| Alpaca count | 500 |
| How side is known | Immutable on-chain `side` written at reveal — **not** by a second contract address |
| Mint phases / caps | See Genesis Mint Spec §3 (Reserved 10 / WL 100 / Public 440) |
| Whitelist early access | Whitelist opens **1 hour before** Public; WL max 1; Public max 5; max **6** across phases |
| WL guarantees | **None** — same random pool; no guaranteed Alpaca/Cougar/class |

### 1.1 Gameplay consistency (Alpaca)

GDS v1.1 §4.1 / §10 / §12 — **unchanged** by mint architecture:

| Class | Ability |
|---|---|
| King | Permanent hunting immunity |
| Guardian | Hunting damage / penalty × 0.5 |
| Farmer | Location reward weight × 1.20 (normalized) |
| Lucky | 20% chance to avoid hunting damage |
| Runner | 30% chance to escape hunting |
| Common | No ability |

Mint docs never alter reward pools, hunting, penalties, treasury, or emission.

---

## 2. Alpaca supply & class distribution

Fixed (GDS §4.1):

| Gameplay Class | Count | Ability |
|---|---|---|
| King | 1 | Permanent immunity to hunting penalty |
| Guardian | 5 | Hunting damage / penalty rate × 0.5 (−50%) |
| Farmer | 5 | Location reward weight × 1.20 (normalized) |
| Lucky | 5 | 20% chance to avoid hunting damage (full same-day immunity roll) |
| Runner | 5 | 30% chance to escape hunting (penalty = 0) |
| Common | 479 | No ability |
| **Total** | **500** | |

Gameplay power comes **only** from Gameplay Class. Ownership bucket (Reserved / Whitelist / Public) never adds abilities.

---

## 3. Reserved Special Alpacas (`#001`–`#010`) — **LOCKED**

| Token | Gameplay Class |
|---|---|
| `#001` | **King** (iconic mascot appearance) |
| `#002` | **Guardian** |
| `#003` | **Guardian** |
| `#004` | **Farmer** |
| `#005` | **Farmer** |
| `#006` | **Lucky** |
| `#007` | **Lucky** |
| `#008` | **Runner** |
| `#009` | **Runner** |
| `#010` | **Runner** |

Source files: `public/pixel/traits/reserved-special-allocation.json`, `public/pixel/traits/special-21-allocation.json`.

### 3.1 What “Reserved” means

- **Ownership allocation only** — these ten tokens are pre-minted to the owner / treasury and are not sold in Whitelist or Public.
- They are **Reserved Special Alpacas**, **not** Commons.
- They use class-locked Special backgrounds matching Gameplay Class.
- **No** extra gameplay advantage from being reserved. Abilities come **only** from Gameplay Class.

### 3.2 Relationship to Special-21

Special-21 class totals stay GDS-aligned: King 1 + Guardian 5 + Farmer 5 + Lucky 5 + Runner 5 = **21**.

| Bucket | Count | Breakdown |
|---|---|---|
| Ownership-reserved Specials | 10 | King×1, Guardian×2, Farmer×2, Lucky×2, Runner×3 |
| Specials in random mint pool | 11 | Guardian×3, Farmer×3, Lucky×3, Runner×2 |
| Common Alpacas in random mint pool | 479 | |
| **Alpaca total** | **500** | |

---

## 4. Random allocation (Alpaca fairness)

Inherited from Genesis Mint Spec §4:

- Token ID must **not** indicate rarity or gameplay class.
- Mint order must **not** determine rarity.
- Rare gameplay classes must **not** be predictable before reveal.
- Provenance hash + reveal shuffle (recommended VRF) binds identities after sale.

Public Alpacas keep the existing off-chain trait generation uniqueness rules for visual traits; gameplay class for Specials is assignment/metadata, not a random trait draw among Commons.

---

## 5. Reveal (Alpaca view)

See Genesis Mint Spec §5.

- Pre-reveal: identical placeholder for every Genesis token (Alpaca and Cougar alike).
- Post-reveal: Alpaca metadata shows `Side: Alpaca`, Gameplay Class, visual traits / Special fields as applicable.
- On-chain `side = Alpaca` is immutable; metadata cannot override it.

---

## 6. Metadata structure (Alpaca)

### 6.1 Common fields (all Alpacas)

```json
{
  "name": "HANSOME Genesis #<tokenId> …",
  "description": "…",
  "image": "ipfs://<IMAGE_CID>/<tokenId>.png",
  "edition": "<tokenId>",
  "attributes": [
    { "trait_type": "Side", "value": "Alpaca" },
    { "trait_type": "Type", "value": "Public | Reserved | Legendary" },
    { "trait_type": "Gameplay Class", "value": "King | Guardian | Farmer | Lucky | Runner | Common" }
  ],
  "hansome": {
    "side": "Alpaca",
    "type": "…",
    "gameplayClass": "…",
    "ability": "…"
  }
}
```

### 6.2 Public / Common visual traits

Background, Archetype, Wool, Clothing, Neck Accessory, Mouth, Ear Accessory, Glasses, Hat, Effect — plus optional `hansome` rarity block (`rarityRank`, `rarityScore`, `rarityOutOf`) for Public trait rarity only.

### 6.3 Special Alpacas

- Class-locked Special background matching Gameplay Class.
- Excluded from the Public trait-rarity model (`excludedFromRarity: true`).
- `#001` may carry `usesMascotAppearance: true`.
- Class accent (if any) remains subtle per approved Special rules.

### 6.4 IPFS & freeze

Follow Genesis Mint Spec §6.3–§6.4. Collection royalty **500 bps**.

---

## 7. Gameplay integration

The game contract reads the **single Genesis NFT contract**:

- `side(tokenId) == Alpaca`
- `gameplayClass(tokenId)` (on-chain or authoritative registry — architecture doc)
- Commit / Reveal / Settlement / Claim per GDS
- VRF for Lucky / Runner rolls (GDS §16)

Cougars are tokens in the **same** collection with `side == Cougar`. There is no second mint contract.

---

## 8. Explicitly out of scope

- Solidity
- Regenerating approved artwork or traits
- Separate Alpaca ERC-721 deployment
- Changing artwork style or gameplay rules

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial: Alpaca side of single Genesis 550 mint; Reserved Specials `#001`–`#010` |
| 2026-07-17 | Locked Reserved class map (King / Guardian×2 / Farmer×2 / Lucky×2 / Runner×3) |
| 2026-07-17 | Whitelist early mint (−1h); gameplay consistency note |
