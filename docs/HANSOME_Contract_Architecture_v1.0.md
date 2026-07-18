# HANSOME — Contract Architecture v1.0

| Field | Value |
|---|---|
| Document type | Architecture / integration (NOT Solidity) |
| Status | **APPROVED** |
| Scope | NFT mint topology, game interaction, metadata freeze |
| Does not define | Gameplay formulas (GDS), art, Solidity code |
| Companion docs | `HANSOME_Genesis_Mint_Spec_v1.0.md`, `HANSOME_Alpaca_Mint_Spec_v1.0.md`, `HANSOME_Cougar_Mint_Spec_v1.0.md`, GDS v1.1 |

**Locked topology:**

1. **One NFT contract:** `HANSOME Genesis NFT` (ERC-721), supply **550**.
2. **One mint entry** — random Alpaca or Cougar.
3. **Game contract** reads that single NFT contract; Alpacas and Cougars play in the **same** ecosystem.
4. **Side detection is by on-chain per-token side flag**, not by separate contract addresses, and **not by token ID ranges that encode rarity**.

---

## 1. Contract set (logical)

| Contract | Role |
|---|---|
| **Genesis NFT** | Fixed-supply ERC-721 (550). Mint, reveal, metadata URI, royalty, immutable `side` per token. Optional on-chain gameplay-class registry for Alpacas. |
| **Game** | Day state machine: Commit → Reveal → Settlement → Claim. Reads Genesis NFT for ownership, side, and Alpaca class. |
| **HANSOME Token / Treasury** | Existing economic layer per GDS (rewards from treasury; no reward minting). Not redesigned here. |
| **VRF adapter** | Randomness for reveal shuffle (mint fairness) and for Lucky / Runner settlement rolls (GDS §16). |

**There is no separate Cougar ERC-721.**

---

## 2. Genesis NFT contract requirements

### 2.1 Standards & caps

- ERC-721 + ERC-721Metadata
- ERC-2981 royalties: **500 bps (5%)**, collection-level; `fee_recipient` = treasury
- Hard cap **550**; reject mint above cap; no re-mint of an existing id
- Enumerable optional

### 2.2 Mint phases

| Phase | Timing | Cap | Per-wallet max | Counter |
|---|---|---|---|---|
| Reserved Special Alpacas | Pre-mint (owner/treasury) | 10 | n/a | Pre-mint |
| Whitelist | Starts **1 hour before** Public | 100 | **1** | Separate |
| Public | Starts when Whitelist period ends | 440 | **5** | Separate |

- Max minted by one wallet across sale phases: **6**
- Sale mints pull from the **same** mixed Alpaca/Cougar Genesis pool; side hidden until reveal
- Whitelist does **not** guarantee Alpaca, Cougar, rarity, or gameplay class
- Public opens only after the 1-hour whitelist early window ends

### 2.3 On-chain identity (minimum)

| Storage | Requirement |
|---|---|
| `side[tokenId]` | `None` → `Alpaca` \| `Cougar` at reveal; then **immutable** |
| `gameplayClass[tokenId]` (Alpaca) | Required for game settlement; set at reveal (or via sealed registry revealed with the same seed). Commons + Special classes per GDS counts. |
| `tokenURI` / `baseURI` | Placeholder pre-reveal; final CID post-reveal; then **freeze** setter |

Token ID alone must **not** be used as the rarity oracle. Marketplaces may show traits from metadata; game authority is on-chain side + class.

### 2.4 Reveal & freeze

1. Publish provenance hash pre-sale.
2. Sale completes under placeholder URI.
3. Reveal seed (VRF recommended) shuffles identity → tokenId.
4. Write `side` (and Alpaca `gameplayClass`) immutably.
5. Point `baseURI` to final IPFS metadata.
6. Renounce / freeze metadata mutation paths.

### 2.5 What is NOT on-chain

- Visual trait layers (hat, glasses, etc.) — metadata only
- Public Alpaca trait rarity scores — metadata only
- Cougar rarity — does not exist

---

## 3. Cougar / Alpaca — corrected interaction model

### 3.1 Retracted model

~~Separate Alpaca contract + separate Cougar contract; `isAlpaca = (nft == ALPACA_ADDR)` / `isCougar = (nft == COUGAR_ADDR)`.~~

### 3.2 Locked model

```
Game
  └─ reads ownership + side + class from GenesisNFT
        side(tokenId) ∈ { Alpaca, Cougar }
        if Alpaca → gameplayClass(tokenId)
        if Cougar → weight = 1, no special abilities
```

| Check | Method |
|---|---|
| Is this an Alpaca? | `GenesisNFT.side(tokenId) == Alpaca` |
| Is this a Cougar? | `GenesisNFT.side(tokenId) == Cougar` |
| Does the caller control it? | `ownerOf(tokenId) == msg.sender` (or approved operator) |
| Same ecosystem? | **Yes** — one game, one NFT collection, two sides |

---

## 4. Game contract requirements

Aligned with GDS v1.1; **no gameplay formula changes** in this document or in mint architecture.

| Area | Requirement |
|---|---|
| Day flow | Commit → Reveal → Settlement → Claim |
| Keying | Participation keyed by `(tokenId, day)` (side derived from GenesisNFT) |
| Side detection | `GenesisNFT.side(tokenId)` → Alpaca \| Cougar |
| Alpaca locations | All five locations including Home |
| Cougar locations | Huntable only — Home invalidates that Cougar for the day |
| Alpaca rewards | Alpaca Pool + class abilities (King / Guardian / Farmer / Lucky / Runner / Common) |
| Cougar rewards | Base Pool equal split + Hunting Pool by hunt score; penalties never pay Cougars |
| Pools / penalties / treasury / emission | Unchanged vs GDS §3.4 / §10–§15 |
| VRF | Lucky / Runner rolls; mint reveal shuffle may share or use a dedicated VRF path |
| Claims | Unclaimed balances travel with the NFT (GDS §17) |

---

## 5. Mint flow (end-to-end)

```text
[Pre-sale]
  Publish provenance hash of 550 identities
  Pre-mint Reserved Special Alpacas #001–#010 to owner/treasury
  Set placeholder baseURI

[Whitelist — opens at T−1 hour]
  Eligible wallets mint up to 1
  Draw from the same Genesis sale pool
  Receive opaque Genesis token (side / class unknown)
  No guarantee of Alpaca vs Cougar or rarity/class

[Public — opens at T = end of whitelist window]
  Any wallet mints up to 5
  Same pool; side / class still unknown
  Max per wallet across WL+Public = 6

[Reveal]
  VRF / public seed → shuffle mapping
  Write side (+ Alpaca class) on-chain
  Switch baseURI to final IPFS CID
  Freeze metadata

[Game live]
  Holders commit/reveal locations per day using Genesis tokenIds
  Game reads side(tokenId) from Genesis NFT; GDS formulas unchanged
```

---

## 6. Metadata & IPFS (architecture view)

| Stage | Content |
|---|---|
| Pre-reveal | One placeholder image + one placeholder JSON template for all tokenIds |
| Post-reveal | 550 distinct `tokenURI`s: Alpaca JSONs (traits/class) or Cougar JSONs (identical template) |
| Images | Alpaca PNGs + shared `cougar.png` for all Cougar identities |
| Royalty metadata | `seller_fee_basis_points: 500` on collection `contractURI` / ERC-2981 |

Merge of existing packages (`public/pixel/genesis/mint/` + `public/pixel/cougar/mint/`) is a **data assembly** step after docs approval — not a Solidity step, and not an artwork redesign.

---

## 7. Whitelist, public mint, wallet limits (confirmation)

| Rule | Value | Source |
|---|---|---|
| Total supply | 550 | Genesis Mint Spec |
| Reserved Special Alpacas | 10 (`#001`–`#010`) | Locked |
| Whitelist supply | 100 | Locked |
| Public supply | 440 | Locked (`10+100+440=550`) |
| Whitelist early window | **1 hour before** Public | Locked |
| Public start | After whitelist period ends | Locked |
| WL wallet limit | 1 | Locked |
| Public wallet limit | 5 | Locked |
| Max across phases | 6 | Locked |
| Separate phase counters | Yes | Locked |
| WL guarantees side/class | **No** | Locked |

---

## 8. Random allocation & reveal (confirmation)

| Rule | Status |
|---|---|
| Token ID ⇏ rarity / side / class | Required |
| Mint order ⇏ rarity | Required |
| Side unknown before reveal | Required |
| Rare classes unpredictable before reveal | Required |
| Provenance hash + reveal shuffle | Required |
| Metadata freeze after final URI | Required |

---

## 9. Reserved Specials (architecture note) — **LOCKED**

| Token | On-chain expectation |
|---|---|
| `#001` | `side=Alpaca`, `gameplayClass=King` |
| `#002` | `side=Alpaca`, `gameplayClass=Guardian` |
| `#003` | `side=Alpaca`, `gameplayClass=Guardian` |
| `#004` | `side=Alpaca`, `gameplayClass=Farmer` |
| `#005` | `side=Alpaca`, `gameplayClass=Farmer` |
| `#006` | `side=Alpaca`, `gameplayClass=Lucky` |
| `#007` | `side=Alpaca`, `gameplayClass=Lucky` |
| `#008` | `side=Alpaca`, `gameplayClass=Runner` |
| `#009` | `side=Alpaca`, `gameplayClass=Runner` |
| `#010` | `side=Alpaca`, `gameplayClass=Runner` |

Reserved is an **allocation / mint-rights** concept only — **not** Commons, **not** a second gameplay tier. Class abilities remain the only mechanical differentiator.

---

## 10. Explicitly deferred

- Solidity source
- Deploy addresses / chain config
- Mint price
- Exact VRF provider binding
- Merged 550 metadata package build
- Binding existing Special staging art files to reserved `#002`–`#010` (no redesign)

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial: single Genesis 550 NFT + Game; side-by-flag; royalty 500 bps |
| 2026-07-17 | Locked Reserved `#001`–`#010` gameplay class map |
| 2026-07-17 | Whitelist early mint (−1h); confirmed wallet limits; gameplay formulas unchanged |
