# HANSOME — Solidity Structure Plan v1.0

| Field | Value |
|---|---|
| Status | ACTIVE — implementation baseline |
| Authority | `HANSOME_Contract_Architecture_Review_v1.0.md` |
| Does not change | GDS gameplay formulas, NFT distribution (10 / 100 / 440 / 550) |

---

## 1. Scope of this implementation phase

| In scope (now) | Out of scope (later) |
|---|---|
| `HansomeGenesisNFT` ERC-721 | Full Game day machine / settlement |
| On-chain `side` + Alpaca `gameplayClass` | Emission controller / sinks / claims |
| Reserved / WL / Public mint | Mint price economics (param only) |
| Provenance + reveal shuffle | Chain-specific VRF vendor binding |
| Metadata placeholder / freeze / ERC-2981 | Frontend / deployment addresses |
| Game-facing **read interface** | Solidity that alters GDS math |

**Game contract:** only `IHansomeGenesis` is provided so a future `HansomeGame` can read ownership, side, and class. Settlement logic is **not** implemented in this phase (avoids accidental rule drift).

---

## 2. Solidity file list

```text
contracts/contracts/
  HansomeAlpacas.sol                    # existing ERC-20 (unchanged)
  genesis/
    HansomeTypes.sol                    # Side / GameplayClass enums + constants
    IHansomeGenesis.sol                 # Game-facing read API
    HansomeGenesisNFT.sol               # ERC-721 mint + reveal + metadata
    randomness/
      IRevealRandomness.sol             # Pluggable reveal entropy provider
      RevealRandomnessMock.sol          # Test / interim provider
```

Tests / scripts:

```text
contracts/test/HansomeGenesisNFT.test.ts
contracts/scripts/deploy-genesis.ts     # optional deploy helper
```

---

## 3. Responsibilities

| File | Responsibility |
|---|---|
| `HansomeTypes.sol` | Shared enums (`Side`, `GameplayClass`) and supply/phase constants. No logic. |
| `IHansomeGenesis.sol` | Minimal interface for Game: `side`, `gameplayClass`, `ownerOf`, `isRevealed`. |
| `HansomeGenesisNFT.sol` | Single collection: reserve mint `#001`–`#010`, WL (−1h, max 1), Public (max 5), cap 550, provenance commitment, reveal shuffle assigning sale identities, placeholder→final URI, URI freeze, ERC-2981 500 bps. |
| `IRevealRandomness.sol` | Abstraction so reveal entropy can come from VRF / beacon / ops key without hard-coding Chainlink (Robinhood Chain may lack a fixed VRF address). |
| `RevealRandomnessMock.sol` | **TEST ONLY** entropy provider — never mainnet. |
| `VRFRevealAdapter.sol` | Production randomness adapter; only `vrfOperator` fulfills into the NFT. |

---

## 4. Dependencies

| Dependency | Use |
|---|---|
| **OpenZeppelin Contracts v5** (already in `contracts/package.json`) | `ERC721`, `ERC2981`, `Ownable`, `ReentrancyGuard`, `MerkleProof`, `Strings` |
| **Hardhat + toolbox** (existing) | Compile, test, deploy scripts |
| **VRF / randomness** | **Not** hard-wired to Chainlink. NFT accepts entropy via `IRevealRandomness` / trusted `randomnessProvider`. Production: bind Chainlink VRF (if available) or equivalent beacon by setting the provider. |
| **Access control** | `Ownable` for admin (phases, merkle root, provenance, URI, freeze, randomness provider). Narrow surface; freeze is one-way. |

**Not used in this phase:** Uniswap SDKs (existing token scripts only).

---

## 5. On-chain data model (sale fairness)

| TokenIds | Side / class |
|---|---|
| `1`–`10` | Reserved Special Alpacas — class set at `reserveMint` (locked map) |
| `11`–`550` | Sale pool — minted opaque; `side` + `gameplayClass` written only at reveal |

Sale identity commitment: `keccak256(packedIdentities)` where `packedIdentities` is 540 bytes (one byte per sale token identity). Reveal verifies the commitment, then Fisher–Yates–shuffles assignment onto `11…550` using the reveal random word.

---

## 6. Implementation order

1. Types + interface  
2. `HansomeGenesisNFT`  
3. Reveal randomness mock  
4. Hardhat tests (caps, WL timing, reveal opacity, reserved classes)  
5. (Later) `HansomeGame` reading `IHansomeGenesis` — separate PR  

---

## 7. Implementation status

| Item | Status |
|---|---|
| Structure plan | ✅ |
| `HansomeTypes` / `IHansomeGenesis` | ✅ |
| `HansomeGenesisNFT` (mint + reveal + URI freeze + 500 bps) | ✅ |
| `RevealRandomnessMock` | ✅ |
| Hardhat tests | ✅ `npx hardhat test test/HansomeGenesisNFT.test.ts` |
| Deploy helper | ✅ `scripts/deploy-genesis.ts` |
| `HansomeGame` settlement | ⏳ Deferred (interface ready) |

**Reveal note:** Only `randomnessProvider` fulfills entropy. Views hide sale side/class/seed until full collection reveal; metadata auto-freezes. Commitment must be locked before mint. Admin params use 24h timelock.

**Compiler:** Solidity `0.8.28`, `evmVersion: cancun` (OpenZeppelin 5.x `mcopy`).

**Security:** See `HANSOME_GenesisNFT_Security_Review_v1.1.md`.

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial structure plan; Genesis NFT phase only |
| 2026-07-17 | Genesis NFT implemented + tests green; batched reveal |
