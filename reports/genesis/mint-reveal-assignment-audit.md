# Genesis NFT mint / reveal assignment audit

| Field | Value |
|-------|--------|
| Status | Audit complete — **no code changes** |
| Date | 2026-07-19 |
| Scope | How metadata / side / class are assigned today; Testnet vs Mainnet |
| Out of scope | Implementing Mainnet reveal ops, contract ABI changes, gameplay changes |

---

## Root cause of “sequential reveal” confusion

What looks sequential on Robinhood Testnet is usually one of:

1. **TokenIds mint in order** (`11, 12, 13…`) — expected, and **not** the same as identity assignment.
2. **On-chain sale identity is still unrevealed** (`collectionRevealed = false` while sale is incomplete) — `side()` / `gameplayClass()` return `None` for sale tokens.
3. **Testnet UI bypasses opacity** via `NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL` (default on for chain `46630`) and loads IPFS `metadata/{tokenId}.json` from the **already shuffle-baked** CID — so the UI shows traits now, keyed by tokenId.
4. **Provenance folder** `public/pixel/genesis/collection-550/metadata/{id}.json` is **package-id sequential**; the **production Metadata CID** is **not** (e.g. token `#11` → package identity `111`).

**Mint order does not determine on-chain sale identity today.** Randomization for sale `#11–#550` is implemented and deferred until full collection reveal.

---

## Answers

### 1. Is metadata currently assigned sequentially by tokenId?

| Layer | Sequential by tokenId? |
|--------|-------------------------|
| Minted tokenId | Yes (counter only) |
| On-chain sale side/class at mint | **No** — not written at mint |
| Reserved `#1–#10` | Fixed by id (King/Guardian/…), not shuffled |
| Provenance `metadata/` package | Yes (package id = file id) |
| Live reveal Metadata CID | **No** — shuffled bake (`#11` → identity `111`) |
| `tokenURI` path after reveal | Path is `{baseURI}{tokenId}.json`; **file contents** are shuffle-mapped |

### 2. Is randomization already implemented?

**Yes.** Full pipeline exists:

- Pre-sale **`saleIdentityCommitment`** = `keccak256(packedIdentities)` (540 packed side/class bytes)
- After sell-out: **`requestReveal`** → randomness provider → **`fulfillRevealRandomWord`**
- **`processReveal`**: Fisher–Yates via `_fyTake(seed, salt)` maps pending deck indices onto sale tokenIds `11 + t`
- Off-chain mirror: `scripts-nft/genesis/lib/reveal-fy.mjs` + bake script; recorded seed in [`reveal-shuffle-manifest.md`](./reveal-shuffle-manifest.md)

Evidence from shuffle manifest (baked package):

| TokenId | packageIdentity |
|--------:|----------------:|
| 11 | 111 |
| 12 | 44 |
| 100 | 416 |
| 250 | 465 |
| 550 | 150 |

### 3. Where does sequential assignment occur?

Only **tokenId allocation**, not identity:

`HansomeGenesisNFT.sol` → `_mintSaleToken`: `nextSaleTokenId++` then `_safeMint`.

Sale identity assignment is in `processReveal` (FY index → `_side` / `_gameplayClass`), not at mint.

### 4. Is current Testnet behavior expected?

**Mostly yes, for QA:**

- Immediate NFT preview on Testnet is intentional frontend config (`lib/game/genesisNftReveal.ts`).
- On-chain `collectionRevealed` remains false until 540 sale mints + reveal ops.
- That preview uses the **shuffled** CID, not sequential package ids — so if traits look “in order,” check whether you are looking at provenance `metadata/` vs Pinata reveal CID, or at tokenId sequence itself.

Mainnet default keeps immediate preview **off**.

---

## How assignment works today

```text
Lock saleIdentityCommitment before WL
        ↓
Mint: sequential tokenId only (#11..#550)
        ↓
saleMinted == 540
        ↓
Off-chain: seed + FY bake reveal-metadata
        ↓
setBaseURI(ipfs CID)
        ↓
requestReveal(packedIdentities)
        ↓
fulfillRevealRandomWord(same seed)
        ↓
processReveal batches → assign side/class
        ↓
collectionRevealed → tokenURI uses baseURI
```

**Views before `collectionRevealed` (sale tokens):**

- `tokenURI` → placeholder
- `side` / `gameplayClass` → `None`
- `isRevealed` → `false`

**After reveal:** storage + `tokenURI = baseURI + tokenId + ".json"`.

**Testnet UI shortcut (not on-chain reveal):**

```text
mint → frontend loads GENESIS_METADATA_CID/{tokenId}.json → shows Side/Class
```

---

## Relevant contracts / files

| Piece | Path |
|--------|------|
| Core NFT | `contracts/contracts/genesis/HansomeGenesisNFT.sol` — `_mintSaleToken`, `requestReveal`, `fulfillRevealRandomWord`, `processReveal`, `_fyTake`, `tokenURI`, `side`, `gameplayClass`, `isRevealed`, `setBaseURI` |
| Types | `contracts/contracts/genesis/HansomeTypes.sol` |
| VRF adapter | `contracts/contracts/genesis/randomness/VRFRevealAdapter.sol` |
| Testnet mock | `contracts/contracts/genesis/randomness/RevealRandomnessMock.sol` |
| Packed deck builder | `contracts/scripts/lib/genesis-identities.ts` |
| Off-chain FY + bake | `scripts-nft/genesis/lib/reveal-fy.mjs`, `bake-550-reveal-metadata.mjs` |
| Shuffle evidence | `reports/genesis/reveal-shuffle-manifest.md` |
| Frontend preview | `lib/game/genesisNftReveal.ts`, `hooks/game/useOwnedGenesisNfts.ts` |

---

## Important Mainnet constraint (ops, not missing FY)

`setBaseURI` is blocked after `revealRequested` (`RevealAlreadyRequested`). Therefore metadata must be baked for a seed **before** `requestReveal`, and the randomness fulfill must use **that same seed**.

Fairness depends on how/when that seed is generated and that fulfill cannot be ground by the owner (provider-only fulfill). Live “request → unknown VRF → then bake” does **not** fit the current ABI without a contract change.

---

## Recommended approach before Mainnet (not implemented by this audit)

1. Keep **commitment locked** before whitelist; do not publish seed during mint.
2. After **540/540** sell-out: generate/obtain entropy → run FY bake → pin Metadata CID → `setBaseURI` → `requestReveal(packedIdentities)` → fulfill with **same seed** → `processReveal` until `collectionRevealed`.
3. Use **`VRFRevealAdapter`** (or equivalent non-owner provider), not `RevealRandomnessMock`.
4. Keep **`NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL` off** on Mainnet (already default).
5. Publish provenance clearly: package ids ≠ post-reveal token metadata; mint order ≠ traits.
6. Optional later hardening (separate decision): commit to seed hash before mint, or allow baseURI after entropy — only if current “seed-known-before-requestReveal” ops model is unacceptable.

---

## Bottom line

- **Randomization for sale NFTs already exists** (commitment + FY + seed).
- **Sequential piece is tokenId minting**, which is correct.
- Testnet “see traits right after mint” is **frontend preview of shuffled IPFS**, not proof that mint order assigns identity on-chain.
- For Mainnet: run the full on-chain reveal with seed-aligned metadata; do not enable immediate preview.
- **This audit made no contract, mint, or gameplay code changes.**
