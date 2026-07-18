# HANSOME Genesis NFT — Security Review v1.0

| Field | Value |
|---|---|
| Target | `contracts/contracts/genesis/HansomeGenesisNFT.sol` (+ types, interface, reveal mock) |
| Scope | Read-only audit — **no code modified** |
| Date | 2026-07-17 |
| Baseline | Architecture Review v1.0 + Structure Plan v1.0 |

> **Superseded for remediation status by [`HANSOME_GenesisNFT_Security_Review_v1.1.md`](HANSOME_GenesisNFT_Security_Review_v1.1.md)** (hardening implemented). This v1.0 file remains as the original finding record.

**Overall verdict (v1.0):** Solid supply/phase skeleton and OZ usage. **Not mainnet-ready** until trusted randomness and commitment/metadata centralization are hardened. **Acceptable for private/testnet** with a trusted deployer and operational discipline.

---

## 1. Supply security

| Check | Result | Notes |
|---|---|---|
| Hard cap 550 | ✅ | `LAST_TOKEN_ID = 550`; sale path reverts `ExceedsSupply` |
| No mint beyond 550 | ✅ | Sale IDs only via `nextSaleTokenId` 11→550; reserved fixed 1–10 |
| Reserved cannot exceed 10 | ✅ | Single `reserveMint`; `reservedMinted` latch; hardcoded IDs 1–10 |
| WL/Public cannot consume reserved IDs | ✅ | Sale starts at `FIRST_SALE_ID = 11` |
| No hidden mint path | ✅ | Only `reserveMint` / `whitelistMint` / `publicMint` |

**Phase caps:** WL ≤ 100, Public ≤ 440 ⇒ sale ≤ 540. Unsold WL slots are **not** rolled into Public (product behavior, not an overmint bug).

---

## 2. Mint phase security

| Check | Result | Notes |
|---|---|---|
| WL opens Public − 1 hour | ✅ | `whitelistStart = publicStart - 1 hours`; open iff `start ≤ now < publicStart` |
| WL max 1 / wallet | ✅ | `whitelistMintCount` |
| Public max 5 / wallet | ✅ | Per-tx and cumulative checks |
| Combined max 6 | ✅ | Enforced on `publicMint` |
| Reentrancy on mint | ✅ | `nonReentrant` + CEI-style counter updates before `_safeMint` |
| Payment | ✅ | Exact `msg.value` required (`IncorrectPayment`) |

### Findings

| ID | Severity | Finding |
|---|---|---|
| M-01 | **Medium** | Owner may call `setPublicStart` / `setMintPrice` / `setWhitelistMerkleRoot` **during** the sale — can shorten/extend phases, change price, or replace the WL set. |
| M-02 | **Low** | Block timestamp nudge (±~15s) cannot meaningfully bypass the 1h WL window; residual miner influence is negligible here. |
| M-03 | **Info** | Wallet caps are per-address; sybil (many wallets) is out of scope for on-chain limits. |

---

## 3. Reveal security

| Check | Result | Notes |
|---|---|---|
| Provenance commitment exists | ⚠️ | `saleIdentityCommitment` + hash check on `requestReveal` |
| Composition validated | ✅ | 50 Cougar + 479 Common + G3/F3/L3/R2 |
| Shuffle | ✅ | Lazy Fisher–Yates; deterministic given seed |
| Batch reveal | ✅ | `processReveal` gas-safe |
| Cannot repeat after complete | ✅ | `collectionRevealed` / `revealEntropyReady` latches |
| Sale tokenId ⇏ side before reveal | ✅ | `_side` stays `None` until assigned |
| Users cannot predict before entropy | ⚠️ | True **until** `revealRandomWord` is published |

### Findings

| ID | Severity | Finding |
|---|---|---|
| R-01 | **High** | **Trusted / owner-chosen randomness.** `fulfillReveal` (owner) and `fulfillRevealRandomWord` (provider **or owner**) let the admin pick `randomWord`. With `RevealRandomnessMock`, the mock owner also chooses the word. An admin holding sale tokenIds can **grind** a seed for a favorable mapping. Production needs non-manipulable VRF/beacon; owner must not retain fulfill rights. |
| R-02 | **High** | **Commitment not locked before sale.** `setSaleIdentityCommitment` may be changed until `collectionRevealed`. Spec intent is pre-sale publish; the contract does **not** freeze the commitment when minting starts. Admin could delay or rotate the commitment after observing the buyer set. |
| R-03 | **High** | **Full mapping leakage once entropy is armed.** `revealRandomWord` is public. Anyone can recompute the entire Fisher–Yates offline **before** `processReveal` finishes. Batches then only materialize already-knowable assignments. |
| R-04 | **Medium** | **Partial on-chain reveal during batches.** After the first `processReveal`, early tokenIds already have `side`/`class` while later ones do not — uneven marketplace information during the batch window. |
| R-05 | **Medium** | **Early `requestReveal` allowed before sell-out.** After reveal, `isPublicOpen` becomes false; unminted sale IDs never mint, but `processReveal` still assigns identities onto those IDs — rare classes can be “burned” onto unminted tokens. |
| R-06 | **Low** | Admin cannot re-arm entropy after `revealEntropyReady` (no reroll of seed). Good. |
| R-07 | **Info** | Admin **does** choose the identity **multiset** (via commitment). Fairness is “fixed deck, shuffled by entropy,” not “admin-blind deck construction.” Acceptable if commitment is published and frozen pre-sale. |

**Reserved `#001`–`#010`:** Classes are public by design (allocation map). Not a sale-pool sniping bug.

---

## 4. Metadata security

| Check | Result | Notes |
|---|---|---|
| Placeholder pre-reveal | ✅ | `tokenURI` → `_placeholderURI` until revealed + base set |
| Final URI pattern | ✅ | `baseURI + tokenId + ".json"` |
| Freeze blocks URI setters | ✅ | `setBaseURI` / `setPlaceholderURI` revert when frozen |

### Findings

| ID | Severity | Finding |
|---|---|---|
| U-01 | **Medium** | After reveal, owner can still `setBaseURI` until `freezeMetadata()`. Rug/replace window exists; freeze is **manual** and not forced. |
| U-02 | **Medium** | Nothing requires freeze to ever be called — long-term metadata mutability if ops skip freeze. |
| U-03 | **Info** | Royalty receiver/bps set in constructor; no public royalty setter in this contract (good). |

On-chain `side` / `gameplayClass` are **not** rewritten by URI changes — game safety holds even if metadata is swapped pre-freeze. Marketplace art/attributes remain at risk until freeze.

---

## 5. Access control

| Power | Actor |
|---|---|
| `reserveMint`, phase config, price, merkle, commitment, URIs, freeze, randomness provider, withdraw, `requestReveal`, `fulfillReveal` | `onlyOwner` |
| `fulfillRevealRandomWord` | `randomnessProvider` **or** `owner` |
| `processReveal` | Anyone (permissionless) |

### Findings

| ID | Severity | Finding |
|---|---|---|
| A-01 | **High** (ops) | **Single EOA Ownable** concentrates mint economics, fairness inputs, metadata, and funds. |
| A-02 | **Medium** | `setRandomnessProvider` can point at a malicious contract that later supplies a chosen word (if owner still controls fulfill path). |
| A-03 | **Low** | No `Ownable2Step` — ownership transfer to a wrong address is hard to recover. |
| A-04 | **Info** | Unused error `QueryForNonexistentToken` (dead code). |

### Recommend multisig / timelock for

- `setPublicStart`, `setMintPrice`, `setWhitelistMerkleRoot`
- `setSaleIdentityCommitment` (ideally one-way lock before WL)
- `setBaseURI` / `freezeMetadata`
- `setRandomnessProvider`
- `withdraw`
- `requestReveal` / entropy fulfill path (or remove owner fulfill entirely)

---

## 6. Game integration safety

| Check | Result |
|---|---|
| `IHansomeGenesis` is read-only | ✅ `side`, `gameplayClass`, `isRevealed` — no state-changing API |
| Game cannot modify NFT via this interface | ✅ |
| Ownership via IERC721 | ✅ Documented separately |

### Findings

| ID | Severity | Finding |
|---|---|---|
| G-01 | **Info** | Checklist asked for `isRevealed(tokenId)`; implementation is **collection-wide** `isRevealed()`. During batched reveal, some tokens are assigned while `isRevealed()` is still false — game should treat `side == None` as “not ready,” not only the global flag. |
| G-02 | **Info** | If Game is approved as operator, it could transfer NFTs via ERC721 — keep Game approvals minimal. |

---

## 7. OpenZeppelin review

| Component | Usage | Assessment |
|---|---|---|
| ERC721 | `_safeMint`, `tokenURI`, `_requireOwned` | ✅ Sound |
| ERC2981 | Default royalty 500 bps; `supportsInterface` override | ✅ |
| Ownable | Admin surface | ✅ Correct; centralization is policy risk |
| ReentrancyGuard | Mint, fulfill, process, withdraw | ✅ |
| MerkleProof | OZ standard double-hash leaf | ✅ Compatible with `StandardMerkleTree` |

No unsafe `_update` / supply overrides found. Constructor royalty + name/symbol are standard.

---

## 8. Gas / optimization

| Area | Assessment |
|---|---|
| Mint | Fine — up to 5 `_safeMint` per public tx |
| `requestReveal` | One-time 540-byte storage copy — expensive but acceptable |
| `processReveal` | Necessary; ~50–100 per tx recommended |
| Lazy FY | Extra SSTORE vs in-memory shuffle; correct tradeoff for RH gas limits |
| Storage | Identity maps + FY table — expected for on-chain reveal |

No critical gas bugs. Consider documenting recommended `batchSize` for operators.

---

## Findings summary

| ID | Severity | Area | Summary |
|---|---|---|---|
| R-01 | **High** | Reveal | Owner/provider can choose `randomWord` (grindable) |
| R-02 | **High** | Reveal | Identity commitment mutable until reveal completes |
| R-03 | **High** | Reveal | Public seed ⇒ full mapping known before batches finish |
| A-01 | **High** (ops) | Access | Single-owner control of all critical levers |
| M-01 | **Medium** | Mint | Admin can alter phases/price/WL mid-sale |
| R-04 | **Medium** | Reveal | Partial on-chain assignment during batches |
| R-05 | **Medium** | Reveal | Early reveal strands unminted sale supply |
| U-01 | **Medium** | Metadata | Post-reveal URI change until freeze |
| U-02 | **Medium** | Metadata | Freeze not enforced |
| A-02 | **Medium** | Access | Randomness provider swappable |
| M-02 | **Low** | Mint | Timestamp granularity |
| A-03 | **Low** | Access | No two-step ownership |
| R-06 | **Low** | Reveal | No seed reroll after arm (positive) |
| G-01 | **Info** | Game | Global vs per-token revealed semantics |
| M-03 | **Info** | Mint | Sybil outside wallet caps |
| U-03 | **Info** | Metadata | Royalty fixed at deploy (positive) |

**Critical (immediate fund theft / unbounded mint):** none found.

---

## Recommended fixes (priority order)

1. **R-01:** Bind a real VRF/beacon; **remove owner from** `fulfillRevealRandomWord`; delete or tightly gate `fulfillReveal` for emergencies only (timelock + multisig). Do not deploy mainnet with `RevealRandomnessMock`.
2. **R-02:** Lock `saleIdentityCommitment` once set (or once `publicStart` / first mint); emit + require non-zero before WL opens.
3. **R-03 / R-04:** Treat “entropy ready” as the public reveal moment (pause trading UX); or assign in one permissioned burst after seed; or keep markets paused until `collectionRevealed`.
4. **U-01 / U-02:** Auto-freeze metadata in the final `processReveal` step (or timelocked freeze right after reveal).
5. **M-01 / A-01:** Multisig (+ timelock) ownership; optionally freeze mint config when WL opens.
6. **R-05:** Require sell-out (or explicit remaining burn) before `requestReveal`.
7. **G-01:** Document that Game must use `side(tokenId) != None` (and/or add per-token revealed helper later).

---

## Testnet deployment readiness

| Environment | Ready? | Conditions |
|---|---|---|
| **Local / CI** | ✅ | Current tests cover caps, WL timing, reveal path |
| **Public testnet** | ✅ **with caveats** | Trusted admin; mock VRF OK for integration; do not market as “provably fair” yet |
| **Mainnet** | ❌ | Must address R-01, R-02, U-01/U-02, and A-01 at minimum |

**Answer:** Ready for **testnet** experimentation. **Not** ready for mainnet fair-launch until randomness and commitment/metadata locks are hardened.

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial security review of HansomeGenesisNFT implementation |
