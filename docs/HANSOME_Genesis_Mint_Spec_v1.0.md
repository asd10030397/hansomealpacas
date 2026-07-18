# HANSOME Genesis — NFT Mint Specification v1.0

| Field | Value |
|---|---|
| Document type | Mint / integration specification (NOT a contract, **NO Solidity**) |
| Status | **APPROVED** — architecture locked; Reserved `#001`–`#010` class map locked |
| Collection | **HANSOME Genesis NFT** (single collection) |
| Standard | ERC-721 + ERC-721Metadata + ERC-2981 (royalties) |
| Total supply | **550 (fixed)** = 500 Alpaca + 50 Cougar |
| Royalty | **500 bps (5%)** |
| Source of truth (gameplay) | HANSOME GDS v1.1 |
| Companion docs | `HANSOME_Alpaca_Mint_Spec_v1.0.md`, `HANSOME_Cougar_Mint_Spec_v1.0.md`, `HANSOME_Contract_Architecture_v1.0.md` |

**Locked design (approved):**

- **One ERC-721 collection. One mint entry.** There are **no** separate Alpaca/Cougar mint portals and **no** separate NFT contracts for mint.
- When a user mints, they randomly receive **either an Alpaca or a Cougar**. They do **not** know the result before mint/reveal.
- **Token ID does not indicate** side, rarity, or gameplay class.
- **Reserved #001–#010** are **Reserved Special Alpacas** (not Commons) with locked class map (see §2.2).
- Alpaca and Cougar **gameplay rules are unchanged** (GDS v1.1). Both sides participate in the **same** game ecosystem.
- Royalty: **5%** (`seller_fee_basis_points: 500`) for the collection.
- **Mint architecture does not modify gameplay formulas.**

---

## 0. Gameplay Consistency Confirmation (GDS v1.1 — unchanged)

Verified against `docs/HANSOME_GDS_v1.1_en.md` / `_zh-TW.md`. **No GDS formulas were modified for this mint update.**

### 0.1 Alpaca side (player characters)

| Item | GDS | Status |
|---|---|---|
| Role | Player character | ✅ Unchanged |
| Supply | \(N_A = 500\) | ✅ |
| Classes | King, Guardian, Farmer, Lucky, Runner, Common | ✅ |
| King | Permanent hunting immunity | ✅ §4.1 / §12.2 |
| Guardian | Hunting penalty rate × 0.5 (−50%) | ✅ |
| Farmer | Location reward weight × 1.20 (normalized) | ✅ |
| Lucky | 20% chance to avoid hunting damage (\(p_L=0.20\)) | ✅ |
| Runner | 30% chance to escape hunting (\(p_R=0.30\)) | ✅ |
| Common | No ability | ✅ |

### 0.2 Cougar side (hunters)

| Item | GDS | Status |
|---|---|---|
| Role | Hunter character | ✅ Unchanged |
| Supply | \(N_C = 50\) | ✅ |
| Identical | All 50 the same | ✅ |
| Rarity | None | ✅ |
| Special abilities | None | ✅ |
| Weight | Uniform \(w^C = 1\) | ✅ §4.2 / §11 / §12.3 |

### 0.3 Shared game ecosystem

| Item | Status |
|---|---|
| Alpacas and Cougars play in the **same** game | ✅ |
| Game reads both sides from the **single** Genesis NFT collection | ✅ (mint architecture) |
| Side detection = on-chain `side(tokenId)` | ✅ |
| Mint architecture does **not** change gameplay formulas | ✅ |

### 0.4 Economic / settlement systems (unchanged)

| System | GDS reference | Status |
|---|---|---|
| Reward pools | 80% Alpaca / 10% Cougar Base / 10% Hunting (§3.4) | ✅ Unchanged |
| Hunting mechanics | Hunt success + hunt score §11.2–§11.3 | ✅ |
| Penalties | §12; penalties → Treasury, never to Cougars | ✅ |
| Treasury flow | §13; sinks §14 | ✅ |
| Emission rules | §15 (\(R_0\), steps, \(G_{\mathrm{safe}}\)) | ✅ |

---

## 1. Supply & Composition

- **Total supply: 550, fixed.** No mint path may exceed 550; no re-mint.
- Hidden composition (revealed per-token at reveal):

| Side | Count |
|---|---|
| Alpaca | 500 |
| Cougar | 50 |
| **Total** | **550** |

### 1.1 Alpaca gameplay-class distribution (GDS §4.1 — unchanged)

| Class | Count | Ability |
|---|---|---|
| King | 1 | Permanent immunity to hunting penalty |
| Guardian | 5 | Hunting penalty rate × 0.5 (−50%) |
| Farmer | 5 | Effective location reward weight × 1.20 (normalized) |
| Lucky | 5 | 20% chance to fully avoid the day's hunting penalty |
| Runner | 5 | 30% chance to escape hunting (penalty = 0) |
| Common | 479 | No ability |
| **Total** | **500** | |

### 1.2 Cougar (GDS §4.2 / §11 / §12.3 — unchanged)

All **50** Cougars are identical: **no rarity**, **no traits**, **no special abilities**, uniform weight \(w^C = 1\).

---

## 2. Distribution & Allocation

| Bucket | Count | Wallet cap | Notes |
|---|---|---|---|
| **Reserved Special Alpacas** | **10** | n/a (pre-mint to owner / treasury) | `#001`–`#010` — ownership allocation only |
| **Whitelist** | **100** | **1 / wallet** | Random Alpaca **or** Cougar |
| **Public** | **440** | **5 / wallet** | Random Alpaca **or** Cougar |
| **Total** | **550** | | `10 + 100 + 440 = 550` |

### 2.1 Why Public is 440 (not 390)

Under an Alpaca-only 500 model, distribution was often stated as Reserved 10 + Whitelist 100 + Public 390.  
Under the **approved single mixed mint of 550**, the sale must also include the **50 Cougars** in the same mint entry:

- Reserved Special Alpacas: **10** (never sold in WL/Public)
- Mintable pool: **540** = remaining **490 Alpacas** + **50 Cougars**
- Whitelist **100** + Public **440** = **540**

Wallet caps stay as approved: WL max 1, Public max 5, max 6 across phases.

### 2.2 Reserved Special Alpacas (`#001`–`#010`) — **LOCKED**

| Token | Status | Gameplay Class |
|---|---|---|
| `#001` | Reserved Special | **King** (iconic mascot appearance) |
| `#002` | Reserved Special | **Guardian** |
| `#003` | Reserved Special | **Guardian** |
| `#004` | Reserved Special | **Farmer** |
| `#005` | Reserved Special | **Farmer** |
| `#006` | Reserved Special | **Lucky** |
| `#007` | Reserved Special | **Lucky** |
| `#008` | Reserved Special | **Runner** |
| `#009` | Reserved Special | **Runner** |
| `#010` | Reserved Special | **Runner** |

Rules:

- All `#001`–`#010` are **Reserved Special Alpacas** — **not** Commons.
- They use class-locked Special backgrounds matching the assigned Gameplay Class.
- **Reserved means ownership allocation only** — who receives the token before the public sale.
- Reserved status grants **no** extra gameplay advantage. Abilities come **only** from Gameplay Class (GDS §4.1).
- **No Cougars are reserved.**
- Minting/owning `#001` does **not** transfer the mascot / brand / IP.

Machine-readable map: `public/pixel/traits/reserved-special-allocation.json`.

### 2.3 Public sale pool (540)

Drawn by Whitelist + Public as a **single mixed random pool**:

| Identity | Count in sale pool |
|---|---|
| Remaining Special Alpacas | **11** = Guardian ×3 + Farmer ×3 + Lucky ×3 + Runner ×2 |
| Common Alpacas | 479 |
| Cougars | 50 |
| **Total** | **540** |

Rare gameplay classes and Cougar side are **seeded into the random pool** and are **not predictable before reveal**.

---

## 3. Mint Rules

### 3.1 Distribution (locked)

| Bucket | Count |
|---|---|
| Reserved Special Alpacas `#001`–`#010` | **10** |
| Whitelist | **100** |
| Public | **440** |
| **Total Genesis NFTs** | **550** |

### 3.2 Phase schedule — Whitelist early mint

| Phase | Timing | Cap | Wallet max |
|---|---|---|---|
| Reserved | Pre-mint to owner / treasury before sale | 10 | n/a |
| **Whitelist** | Starts **1 hour before** Public opens | 100 | **1** |
| **Public** | Starts when Whitelist period ends | 440 | **5** |

Rules:

- **Whitelist phase starts 1 hour before the public phase.**
- **Public mint starts after the whitelist period ends** (i.e. after that 1-hour early window).
- Whitelist mint draws randomly from the **same Genesis sale pool** as Public (remaining Specials + Commons + Cougars).
- Whitelist does **not** guarantee Alpaca or Cougar.
- Whitelist does **not** guarantee rarity or gameplay class.
- Side / class remain hidden until the shared collection reveal (§5).

### 3.3 Wallet limits (locked)

| Phase | Max per wallet |
|---|---|
| Whitelist | **1** NFT |
| Public | **5** NFTs |
| **Both phases combined** | **6** NFTs |

- **Separate phase counters** — whitelist count and public count are tracked independently.
- **Reserved 10** are minted to the owner/treasury up front and are **not** counted against any wallet or phase mint cap.
- Gameplay eligibility remains **per NFT, not per wallet** (GDS §4.3).

---


## 4. Random Allocation & Fairness

Required guarantees:

- **Token ID must not indicate rarity, side, or gameplay class.**
- **Mint order must not determine rarity.**
- **Rare gameplay classes and Alpaca/Cougar side must not be predictable before reveal.**

Mechanism (provable fairness):

1. Before the sale, publish a **provenance hash** committing to the full set of 550 identities (image + side + class/traits).
2. Identity → `tokenId` mapping is finalized by a **shuffle seeded at reveal** (recommended: on-chain VRF, GDS §16 style). No party can target a specific identity to a specific `tokenId` in advance.
3. Side + class are fixed only by the reveal shuffle; the published provenance hash lets anyone verify afterward that nothing was swapped.

---

## 5. Reveal System

| Topic | Rule |
|---|---|
| Timing | Single global reveal after the public sale closes (or at a pre-announced time/threshold). All tokens reveal together — no rolling reveals that leak the remaining pool. |
| Pre-reveal | `tokenURI` returns a **neutral placeholder** metadata + image (identical for every token) so nothing about side/class leaks during the sale. |
| Reveal process | (1) Apply reveal shuffle seed → fix each token's identity. (2) Switch collection `baseURI` from placeholder to final metadata CID. (3) Write each token's **immutable on-chain `side`** (`Alpaca` \| `Cougar`). |
| Fairness | Provenance hash pre-sale; reveal seed applied publicly; mapping verifiable against provenance. On-chain `side` is permanent; metadata is display-only and cannot override on-chain side. |

---

## 6. Metadata

### 6.1 Token URI

- `tokenURI(id) = baseURI + id + ".json"`.
- **Pre-reveal:** `baseURI` → placeholder CID (every token identical).
- **Post-reveal:** `baseURI` → final metadata CID; each `id.json` resolves its assigned identity.

### 6.2 Attribute schema (post-reveal)

- **All tokens:** `Side` (`Alpaca` \| `Cougar`) — mirrors the on-chain flag for marketplace display.
- **Alpaca tokens:** see `HANSOME_Alpaca_Mint_Spec_v1.0.md` (Type, Gameplay Class, visual traits; Public rarity block; Specials excluded from rarity model).
- **Cougar tokens:** see `HANSOME_Cougar_Mint_Spec_v1.0.md` (identical schema; no rarity fields).

### 6.3 IPFS flow

1. Pin the **image** folder → `IMAGE_CID`; regenerate metadata so every `image` = `ipfs://<IMAGE_CID>/<file>`.
2. Pin the **metadata** folder → `METADATA_CID`.
3. Set contract `baseURI = ipfs://<METADATA_CID>/` (placeholder first; final at reveal).

### 6.4 Metadata freeze plan

- After the **final** `baseURI` is set at reveal, **renounce / freeze the metadata setter** so art/attributes can never be swapped.
- Collection `contractURI` carries name/description/`seller_fee_basis_points: 500`/`fee_recipient`.

### 6.5 Royalty

| Field | Value |
|---|---|
| `seller_fee_basis_points` | **500** (5%) |
| `fee_recipient` | Project treasury (address TBD at deploy) |
| Standard | ERC-2981 collection-level royalty |

---

## 7. Gameplay Integration (GDS v1.1)

- Side is read from the **on-chain flag**, never from a second NFT contract address:
  `side = onchainSide(tokenId)` → `Alpaca` or `Cougar`.
- Both sides play in the **same** game ecosystem. The game contract reads this **single** collection.
- Alpaca class abilities and Cougar uniform weight are unchanged (see §1 and companion specs).
- Commit / Reveal / Settlement / Claim remain per GDS. Cougars may never reveal Home.

---

## 8. Contract Requirements (summary — no Solidity yet)

See `HANSOME_Contract_Architecture_v1.0.md`.

- Single **ERC-721 + Metadata + ERC-2981 (500 bps)**, hard cap **550**, no re-mint.
- Whitelist opens **1 hour before** Public; separate per-wallet counters (WL max 1, Public max 5, max 6 total).
- Reserve mint of **10** Special Alpacas to owner/treasury.
- Reveal: placeholder → final `baseURI`; write immutable per-token `side`; freeze metadata.
- No separate Cougar mint contract.
- Game contract reads `side(tokenId)` from this collection; **does not** change GDS formulas.

---

## 9. Open Items / Follow-ups (post-approval)

1. ~~Owner selection for `#002`–`#010`~~ — **done** (see §2.2).
2. **Metadata merge:** combine current Alpaca package (`public/pixel/genesis/mint/`) and Cougar package (`public/pixel/cougar/mint/`) into one 550-token placeholder + reveal layout. **No artwork regeneration / no style change.**
3. **Art placement for Reserved `#002`–`#010`:** reuse existing Special staging art by class (no redesign); bind staging assets to reserved tokenIds in a later assembly pass.
4. **TBD operational values:** chain, mint price, treasury address, sale dates, whitelist source, VRF provider.

**Explicitly NOT in this document:** Solidity, deployment scripts, chain addresses, mint pricing.

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial DRAFT for single mixed 550 mint; Reserved Specials `#001`–`#010`; royalty 500 bps |
| 2026-07-17 | Locked Reserved class map: King×1, Guardian×2, Farmer×2, Lucky×2, Runner×3 |
| 2026-07-17 | Gameplay consistency confirmation (§0); Whitelist early mint = Public − 1 hour |
