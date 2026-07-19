# Genesis mint / reveal randomness — simulation report

| Field | Value |
|-------|--------|
| Date | 2026-07-19 |
| Script | `scripts-nft/genesis/simulate-mint-reveal-randomness.mjs` |
| JSON | `reports/genesis/mint-reveal-randomness-simulation.json` |
| Contract | `HansomeGenesisNFT.sol` (`_mintSaleToken`, `_fyTake`, `processReveal`) |

---

## Critical distinction (vs requested example)

Your example assumes **random tokenId at mint**:

```text
Mint #1 → Token #347
Mint #2 → Token #12
```

**Current Mainnet-ready ABI does not do that.** It does:

```text
Mint #1 → Token #11  (sequential id)
Mint #2 → Token #12
…
Reveal → Token #11 gets shuffled identity/metadata package (e.g. package 150)
         Token #12 gets another shuffled identity (e.g. package 83)
```

| What | Randomized? | When |
|------|--------------|------|
| TokenId | **No** — sequential `#11…#550` | Each mint |
| Side / class / metadata identity | **Yes** — Fisher–Yates | After sell-out + entropy + `processReveal` |
| Reserved `#1–#10` | Fixed (Founder/Specials) | `reserveMint` only |

So mint order **must not** determine traits — and it does not. Mint order **does** determine tokenId (by design).

Changing mint to pick a random remaining tokenId (your example) would be a **new contract model** (pre-minted supply / ID lottery). That is **not** implemented today and is not required for fair trait assignment under the current reveal design.

---

## Assignment algorithm

1. **Commitment (pre-WL)**  
   `saleIdentityCommitment = keccak256(packedIdentities)` — 540 bytes  
   Composition locked: 50 Cougars + 490 sale Alpacas (479 Common + specials).

2. **Mint (WL / Public)**  
   `_mintSaleToken`: `tokenId = nextSaleTokenId++` starting at `11`.  
   No side/class written for sale tokens.

3. **Reveal (post sell-out)**  
   - `requestReveal(packedIdentities)` — must match commitment  
   - Randomness provider fulfills `randomWord` (owner cannot fulfill)  
   - `processReveal`: for each sale slot `t = 0..539`:  
     - `identityIndex = _fyTake(seed, t)`  
     - `tokenId = 11 + t`  
     - assign `_side` / `_gameplayClass` from `identities[identityIndex]`

`_fyTake` is classic Fisher–Yates sparse swap:

```solidity
j = uint256(keccak256(abi.encodePacked(seed, salt))) % n; // n = remaining
// swap chosen with last remaining; shrink deck
```

---

## Verification answers

| Requirement | Result |
|-------------|--------|
| Algorithm | Fisher–Yates (`_fyTake`) over committed 540-identity deck |
| Duplicate prevention | Each index removed from remaining deck after draw; set coverage check in sim |
| Equal probability among remaining | At step with `n` left, each of `n` indices has probability `1/n` (mod bias negligible) |
| Founder / Reserved excluded | `#1–#10` minted only via `reserveMint`; never in sale FY deck |
| Public cannot predict next NFT | Seed hidden until `collectionRevealed`; commitment locked before mint; provider-only fulfill |
| Modulo bias | `keccak % n` for `n ≤ 540`; relative bias `< n/2^256` (~0) — practically unbiased |

---

## Simulation results (540 sale mints + 10 reserved)

### Integrity (fixed seed + 20 random seeds)

| Check | Result |
|-------|--------|
| Every sale identity index used exactly once | ✅ |
| Every sale tokenId `#11–#550` assigned exactly once | ✅ |
| No duplicates | ✅ |
| Sale composition 490 Alpaca / 50 Cougar | ✅ |
| Reserved `#1–#10` excluded from shuffle | ✅ |
| 20/20 random seeds pass | ✅ |

### Sequentiality

| Metric | Value | Meaning |
|--------|------:|---------|
| Consecutive tokenId pairs | 539 / 539 | TokenIds are sequential **by design** |
| Consecutive package-identity pairs (fixed seed) | 1 | Identities are **not** sequential |
| Mint-order == package-order matches | 0 | Full shuffle vs provenance order |

### Sample (fixed seed run — sale mint order → identity)

| Sale mint # | TokenId | Package identity | Side / class |
|------------:|--------:|-----------------:|--------------|
| 1 | 11 | 150 | Alpaca / Common |
| 2 | 12 | 83 | Alpaca / Common |
| 3 | 13 | 132 | Alpaca / Common |
| 4 | 14 | 547 | Alpaca / Lucky |
| 9 | 19 | 550 | Alpaca / Runner |
| 10 | 20 | 534 | Alpaca / Common |

TokenIds climb `11,12,13…`; package identities do **not**.

---

## Why Testnet can look “sequential”

1. You see sequential **tokenIds** in the wallet (correct).  
2. Testnet UI may show immediate IPFS preview (`NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL`) keyed by tokenId from a **pre-baked shuffled** CID — traits are already shuffled relative to provenance package order.  
3. Local provenance `metadata/{id}.json` is package-sequential and is **not** the live reveal mapping.

---

## Mainnet readiness (current design)

| Item | Status |
|------|--------|
| Random trait assignment for sale NFTs | Implemented (FY + commitment + VRF/provider) |
| Random tokenId at mint | **Not** in ABI — sequential ids |
| Fairness ops | Lock commitment → sell 540 → bake metadata for seed → `setBaseURI` → `requestReveal` → fulfill same seed → `processReveal` |
| Immediate NFT preview | Keep **off** on Mainnet |

---

## If you require Mint→random TokenId (example #347)

That needs a **contract redesign** (e.g. pre-mint 550 and transfer a random remaining id, or ERC721A with ID lottery). Say explicitly if you want that scoped — it is a breaking change vs current Testnet/Mainnet path and is separate from the already-implemented identity shuffle.
