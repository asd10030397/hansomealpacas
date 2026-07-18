# HANSOME — Smart Contract Architecture Review v1.0

| Field | Value |
|---|---|
| Document type | Architecture review report (**NO Solidity**) |
| Status | REVIEW COMPLETE — ready for Solidity when authorized |
| Sources reviewed | `HANSOME_Contract_Architecture_v1.0.md`, `HANSOME_Genesis_Mint_Spec_v1.0.md`, `HANSOME_Alpaca_Mint_Spec_v1.0.md`, `HANSOME_Cougar_Mint_Spec_v1.0.md`, GDS v1.1, reserved/special allocation JSON |
| Scope | Final pre-Solidity consistency check after single mixed-mint architecture |

**Verdict:** Architecture is **internally consistent and implementation-ready**. No gameplay-formula changes required. Proceed to Solidity only after this review is accepted.

---

## Executive summary

| Topic | Result |
|---|---|
| NFT topology | ✅ One ERC-721 **HANSOME Genesis NFT**, supply **550** |
| Mint entry | ✅ Single entry; WL/Public randomly receive Alpaca **or** Cougar |
| Separate Cougar contract | ❌ Retracted — not part of final architecture |
| On-chain `side` | ✅ Required; not derived from tokenId range or metadata alone |
| Reveal fairness | ✅ Provenance hash + global reveal shuffle (VRF recommended) |
| Wallet / phase rules | ✅ WL −1h, max 1; Public max 5; max 6 total; Reserved admin-only |
| Game interaction | ✅ Same ecosystem; GDS formulas unchanged |
| Security posture | ✅ Requirements clear; implement with standard controls (see §7) |

---

## 1. NFT contract — confirmed

| Requirement | Locked value | Doc alignment |
|---|---|---|
| Collection name | **HANSOME Genesis NFT** | Genesis Mint Spec, Contract Architecture |
| Standard | **ERC-721** (+ Metadata; ERC-2981 royalties 500 bps) | ✅ |
| Total supply | **550** fixed (500 Alpaca + 50 Cougar) | ✅ |
| Mint entry | **One** | ✅ |
| Separate Alpaca/Cougar contracts | **No** | ✅ |

### Distribution

| Bucket | Count | Notes |
|---|---|---|
| Reserved Special Alpacas `#001`–`#010` | 10 | Admin/reserve mint only; fixed Alpaca + class map |
| Whitelist | 100 | Same sale pool; max 1 / wallet |
| Public | 440 | Same sale pool; max 5 / wallet |
| **Total** | **550** | `10 + 100 + 440 = 550` |

**Clarification (important for implementers):**  
“Randomly receives Alpaca or Cougar” applies to **Whitelist + Public** mints (540 tokens from the mixed sale pool).  
**Reserved `#001`–`#010`** are always **Alpaca Specials** with the locked class map — not random side draws.

---

## 2. Token data — confirmed

### 2.1 Required on-chain fields

| Field | Requirement |
|---|---|
| `tokenId` | ERC-721 id in `1…550` (or equivalent contiguous scheme covering 550) |
| `side(tokenId)` | Enum / uint8: `None` → `Alpaca` \| `Cougar` |
| `gameplayClass(tokenId)` (Alpaca) | Required for game settlement; unset/ignored for Cougar |

### 2.2 Side rules

| Rule | Status |
|---|---|
| Stored / readable on-chain | ✅ Required |
| Must **not** depend on tokenId range encoding side | ✅ Required |
| Must **not** depend only on metadata | ✅ Required — metadata is display; game reads on-chain |
| Immutable after reveal (sale tokens) | ✅ Required |

### 2.3 Token ID neutrality

| Guarantee | Applies to |
|---|---|
| Token ID does **not** indicate rarity, class, or side **before reveal** for sale tokens | Whitelist + Public (540) |
| Mint order does not determine rarity | Sale pool |
| After reveal, tokenId is only a serial; identity comes from on-chain side/class + metadata | All tokens |

**Reserved exception (documented, not a fairness bug):**  
`#001`–`#010` have a **public, locked** class map (King, Guardian×2, Farmer×2, Lucky×2, Runner×3). Once that map is published, those tokenIds are known Specials by allocation — that is **ownership allocation**, not a sniping vector in the public sale (they are not sold in WL/Public).

---

## 3. Reveal system — confirmed

### 3.1 How randomness is generated

| Step | Mechanism |
|---|---|
| Pre-sale | Publish **provenance hash** of the full set of 550 identities (image + side + class/traits) |
| During sale | Tokens mint under **identical placeholder** `tokenURI` — no side/class leakage |
| At reveal | **Reveal seed** (recommended: on-chain **VRF** / beacon, GDS §16 style) drives a shuffle of identity → tokenId for the sale pool |
| After reveal | Anyone can verify final mapping against the provenance hash |

### 3.2 Alpaca / Cougar assignment

- Sale pool contains exactly **490 remaining Alpacas + 50 Cougars** (540 identities).
- Assignment to minted sale `tokenId`s is finalized by the **reveal shuffle**, not by mint order and not by choosing a mint function.
- Reserved `#001`–`#010` are fixed `side = Alpaca` (set at reserve mint or at reveal consistently; must match locked map).

### 3.3 Class assignment

| Token set | Class assignment |
|---|---|
| Reserved `#001`–`#010` | Locked map (see Contract Architecture §9) |
| Remaining 11 Special Alpacas | In sale pool; class part of sealed identity; bound at reveal |
| Common Alpacas (479) | Class = Common; visual traits in metadata |
| Cougars (50) | No gameplay class / no abilities; `side = Cougar` only |

On-chain `gameplayClass` for Alpacas must be written at reveal (or via sealed registry revealed with the same seed) so the **Game** contract does not trust metadata for settlement.

### 3.4 When metadata becomes visible

| Stage | Visibility |
|---|---|
| Pre-reveal | Placeholder only (identical for every token) |
| Post-reveal | Final IPFS `baseURI`; per-token JSON + images |
| Freeze | Metadata setter renounced / frozen after final URI |

### 3.5 Fairness / no early advantage

| Attack / leak | Mitigation |
|---|---|
| Sniping rare class by mint order | Reveal shuffle decouples mint order from identity |
| Reading traits during sale | Placeholder URI |
| Rolling reveal leaking remainder | **Single global reveal** after public sale closes |
| Team swapping identities post-sale | Provenance hash + post-reveal verification + metadata freeze |
| Metadata lying about side | Game uses on-chain `side`, not metadata |

**Confirmed: no early advantage for WL vs Public on side/class** — both draw from the same opaque pool; WL only gets time priority and a 1-mint cap, not a better identity distribution.

---

## 4. Mint functions — confirmed (logical API)

| Function / path | Requirements |
|---|---|
| `reserveMint` / admin mint | Only `#001`–`#010` Special Alpacas; admin/owner; before or outside sale caps |
| `whitelistMint` | Active from `publicStart − 1 hour` until `publicStart`; merkle/allowlist; **max 1 / wallet**; draws from sale pool |
| `publicMint` | Active from `publicStart`; **max 5 / wallet**; same sale pool |
| Phase counters | Separate WL vs Public counters; combined max **6** |
| Supply enforcement | Hard stop at 550; no re-mint |

Exact function names are implementation detail; the above behaviors are mandatory.

---

## 5. Metadata — confirmed

### 5.1 Alpaca (post-reveal)

Must include (at minimum):

- `Side: Alpaca`
- `Gameplay Class` (+ ability text in `hansome` / attributes)
- Visual traits (Public): Background, Archetype, Wool, Clothing, Neck Accessory, Mouth, Ear Accessory, Glasses, Hat, Effect
- Specials: class-locked Special background; excluded from Public trait-rarity model

### 5.2 Cougar (post-reveal)

- `Side: Cougar`
- Identical art for all 50
- **No rarity**
- **No abilities**
- Uniform weight note (`w^C = 1`) in extension block only

### 5.3 Freeze plan

1. Pin images → `IMAGE_CID`
2. Pin metadata → `METADATA_CID`
3. Set final `baseURI = ipfs://<METADATA_CID>/` at reveal
4. **Freeze / renounce** metadata mutation
5. Collection royalty **500 bps** via ERC-2981 / `contractURI`

---

## 6. Game contract interaction — confirmed

| Game reads | Source |
|---|---|
| NFT contract address | Genesis NFT (single) |
| `tokenId` | Caller’s participating NFT |
| `side` | On-chain `side(tokenId)` |
| `gameplayClass` | On-chain (Alpaca only) |
| Ownership / approval | `ownerOf` / operator |

| Ecosystem rule | Status |
|---|---|
| Alpaca and Cougar in the **same** game | ✅ |
| GDS formulas unchanged (pools, hunting, penalties, treasury, emission) | ✅ |
| Cougar never reveals Home | ✅ GDS |
| Lucky / Runner use VRF at settlement | ✅ GDS §16 (separate from mint reveal VRF, or shared adapter) |

---

## 7. Security review (pre-implementation checklist)

| Risk | Required control |
|---|---|
| **Reentrancy** | CEI pattern; reentrancy guard on mint / reveal / any ETH pull; prefer pull payments in Game |
| **Access control** | Ownable/roles: reserve mint, phase timing, reveal trigger, URI set, freeze — narrowly scoped; renounce after freeze |
| **Supply cap** | `totalSupply` / nextId hard-capped at 550; every mint path checks cap |
| **Mint abuse** | Separate WL/Public counters; max 1 / 5 / 6; WL proof (merkle); no mint outside phase windows; no WL mint after Public opens |
| **Randomness manipulation** | Do **not** use manipulable blockhash alone; commit provenance pre-sale; VRF (or equivalent) for reveal shuffle; single global reveal |
| **Metadata manipulation** | Placeholder during sale; one-time final URI; freeze setter; game ignores metadata for side/class |
| **Reserved path abuse** | Reserve mint restricted to admin; only ids 1–10; cannot expand reserved supply |
| **Reveal front-running / selective reveal** | No per-token early reveal of sale pool; atomic or batched reveal of full mapping |
| **Royalty / fee spoofing** | ERC-2981 fixed 500 bps; fee recipient set to treasury; not user-overridable per token |

### Open implementation choices (not blockers)

1. Exact VRF provider / chain.
2. Whether Reserved `#001`–`#010` write on-chain class at reserve-mint time vs only at global reveal (either works if sale-pool opacity is preserved).
3. Mint price, payment token, and refund mechanics.
4. Merged 550 IPFS package assembly (data step before deploy).

---

## 8. Consistency matrix (docs vs architecture)

| Claim | Genesis Mint Spec | Contract Architecture | GDS | Result |
|---|---|---|---|---|
| One ERC-721, 550 | ✅ | ✅ | \(N=550\) | ✅ |
| Reserved 10 / WL 100 / Public 440 | ✅ | ✅ | n/a (mint) | ✅ |
| WL −1 hour | ✅ | ✅ | n/a | ✅ |
| Caps 1 / 5 / 6 | ✅ | ✅ | n/a | ✅ |
| On-chain side | ✅ | ✅ | side semantics | ✅ |
| No separate Cougar contract | ✅ | ✅ | supply only | ✅ |
| Gameplay formulas | Unchanged §0 | Unchanged §4 | Authority | ✅ |
| Royalty 500 bps | ✅ | ✅ | n/a | ✅ |

---

## 9. Final confirmation

The final smart contract architecture is:

1. **One** ERC-721 **HANSOME Genesis NFT** (550).  
2. **One** mint entry for sale; random Alpaca or Cougar for WL/Public.  
3. **On-chain `side(tokenId)`** (+ Alpaca `gameplayClass`) as game authority.  
4. **Token ID ≠ rarity / side / class** for the sale pool; reveal shuffle + provenance for fairness.  
5. **Whitelist 1h early**, max 1; Public max 5; max 6 total; Reserved admin `#001`–`#010`.  
6. **IPFS metadata** with freeze after reveal.  
7. **Game** reads Genesis NFT only; **GDS v1.1 formulas unchanged**.

**Recommendation:** Architecture approved for Solidity implementation when explicitly requested. Do not start coding until this review is accepted.

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial pre-Solidity architecture review after mixed-mint lock |
