# HANSOME Cougars — Identity & Metadata Specification v1.0

| Field | Value |
|---|---|
| Document type | Cougar-side identity / metadata specification (NOT a contract, **NO Solidity**) |
| Status | **APPROVED** — Cougars inside single Genesis mint (no separate contract) |
| Parent mint document | **`HANSOME_Genesis_Mint_Spec_v1.0.md`** |
| Collection | **HANSOME Genesis NFT** (single ERC-721) |
| Cougar supply | **50** (of 550 total Genesis tokens) |
| Royalty | **500 bps (5%)** — collection-level (same as Genesis) |
| Source of truth (gameplay) | HANSOME GDS v1.1 §4.2 / §11 / §12.3 |
| Companion asset | `public/pixel/cougar/cougar-official-base.png` (1024×1024) |

**Architecture correction (locked):**

- Cougars are **not** a separate ERC-721 and **not** a separate mint entrance.
- Cougars are minted only through the **single HANSOME Genesis NFT** mint.
- A buyer may randomly receive a Cougar instead of an Alpaca; they do not choose side before reveal.
- Gameplay rules for Cougars are **unchanged**. Alpacas and Cougars still participate together in the same game ecosystem.

---

## 1. Locked Cougar rules (NFT design)

| Rule | Value |
|---|---|
| Supply | 50 |
| Artwork | One official base for all 50 — identical |
| Rarity system | **None** |
| Special abilities | **None** |
| Classes | Single class: `Cougar` |
| Weight | Uniform \(w^C = 1\) |
| Token ID meaning | Serial / collection id only — **never** implies rarity or power |

---

## 2. Position in the Genesis mint

| Topic | Rule |
|---|---|
| How Cougars enter circulation | Drawn from the **same** Whitelist + Public random pool as Alpacas |
| Reserved Cougars | **None** — Reserved `#001`–`#010` are Special Alpacas only |
| Count in sale pool | All **50** Cougars sit in the mintable 540-token pool |
| Whitelist early window | WL opens **1 hour before** Public; WL does **not** guarantee Cougar |
| Reveal | Same global reveal as Alpacas; side unknown until reveal |
| Gameplay | Unchanged — identical, \(w^C=1\), no abilities; same game ecosystem |

See Genesis Mint Spec for phases, wallet caps, provenance, IPFS, and freeze.

---

## 3. Previous architecture — retracted

Earlier drafts recommended a **separate** `HANSOME Cougars` ERC-721 with side detection by contract address, instant reveal, and a 40/5/5 Cougar-only allocation map.

**That model is retracted** for mint topology:

| Old | New (locked) |
|---|---|
| Separate Cougar ERC-721 | Single Genesis ERC-721 |
| Separate mint entrance | One mint entry |
| Side = contract address | Side = immutable on-chain flag per `tokenId` |
| Instant Cougar metadata | Placeholder until **shared** Genesis reveal |
| Cougar-only 40/5/5 sale buckets | Cougars mixed into Genesis WL + Public pool |
| Royalty 0% (older draft) | Collection royalty **500 bps (5%)** |

Cougar **gameplay math** (uniform weight, no abilities, Base Pool + Hunting Pool) remains as in GDS v1.1.

---

## 4. Metadata structure (post-reveal Cougar tokens)

All 50 Cougar identities share the same art and attributes. After reveal, each assigned Genesis `tokenId` that resolves to a Cougar carries:

```json
{
  "name": "HANSOME Genesis #<tokenId> — Cougar",
  "description": "One of the 50 HANSOME Cougars inside HANSOME Genesis. All 50 Cougars are identical: no rarity, no special abilities, one shared official design. Strength comes only from where you choose to hunt each day.",
  "image": "ipfs://<IMAGE_CID>/cougar.png",
  "edition": "<tokenId>",
  "attributes": [
    { "trait_type": "Side", "value": "Cougar" },
    { "trait_type": "Class", "value": "Cougar" },
    { "trait_type": "Edition Size", "value": 50 }
  ],
  "hansome": {
    "side": "Cougar",
    "class": "Cougar",
    "identical": true,
    "rarity": "none",
    "specialAbilities": "none",
    "weight": 1,
    "gds": "v1.1 §4.2/§11/§12.3 (uniform w^C=1)"
  }
}
```

Rules that keep Token ID rarity-neutral:

- Same `image`, same attributes, same `hansome` block for every Cougar.
- No `rarityRank` / `rarityScore` / tier words.
- Name uses the Genesis token ordinal only.

---

## 5. Reveal & freeze

- **No separate Cougar reveal.** Cougars use the Genesis collection reveal (placeholder → final `baseURI`).
- After final `baseURI`, freeze metadata (Genesis Mint Spec §6.4).
- On-chain `side = Cougar` is written at reveal and is immutable.

---

## 6. Gameplay integration

| Topic | Rule |
|---|---|
| Side detection | `onchainSide(tokenId) == Cougar` on the **Genesis** contract |
| Eligibility | Per NFT (GDS §4.3) |
| Locations | Huntable only — never Home |
| Base Pool | Equal split among valid Cougars |
| Hunt score | \(\sigma_j = A_d(\ell(j))\) |
| VRF for Cougars | Not required (no Lucky/Runner rolls on Cougars) |
| Ecosystem | Same game as Alpacas; game reads the single Genesis NFT contract |

---

## 7. Existing asset package note

Files under `public/pixel/cougar/mint/` remain valid as the **Cougar identity source** (shared art + template metadata). They must be **merged into the Genesis 550 package** with placeholder + reveal layout. The off-chain `allocation-map.json` (40/5/5) is **obsolete for sale topology** under the single mixed mint; do not use it for mint phases.

Generator (legacy helper): `scripts-nft/cougar/build-cougar-metadata.mjs` — may be replaced by a Genesis merge script later. **Still no Solidity.**

---

## 8. Explicitly out of scope

- Solidity
- Redesigning Cougar art
- Reintroducing Cougar rarity tiers or abilities
- Separate Cougar mint contract

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Original separate-contract mint spec |
| 2026-07-17 | Corrected to Cougar-inside-Genesis single mint; royalty 500 bps; separate contract retracted |
