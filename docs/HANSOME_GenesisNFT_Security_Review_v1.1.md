# HANSOME Genesis NFT — Security Review v1.1 (Post-Hardening)

| Field | Value |
|---|---|
| Target | `HansomeGenesisNFT.sol` + `VRFRevealAdapter.sol` + `IHansomeGenesis.sol` |
| Prior review | v1.0 (2026-07-17) |
| Status | Hardening implemented; tests green (15/15) |
| Scope | Re-audit after security fixes — supply/mint rules/GDS unchanged |

**Verdict:** Prior **High** findings on owner fulfill, mutable commitment, and API-level partial reveal are **addressed**. Residual risk is operational (VRF operator trust, storage-slot observers, Ownable key). **Testnet-ready.** Mainnet-ready after production VRF wiring + multisig ownership.

---

## Fixes implemented (mapped to v1.0)

| v1.0 ID | Severity | Fix |
|---|---|---|
| R-01 | High | Removed owner `fulfillReveal`. Only `randomnessProvider` may call `fulfillRevealRandomWord`. Added `VRFRevealAdapter` for production VRF. Mock labeled test-only. |
| R-02 | High | `saleIdentityCommitment` lock required before mint; `lockSaleIdentityCommitment()` or auto-lock on `executePublicStart`. Cannot change after lock. |
| R-03 / R-04 | High/Med | `revealRandomWord()` reverts until collection revealed. `side` / `gameplayClass` / `isRevealed(tokenId)` stay opaque for sale tokens until **full** collection reveal (mid-batch API leak closed). |
| R-05 | Medium | `requestReveal` requires `saleMinted() == 540` (`SaleIncomplete`). |
| U-01 / U-02 | Medium | Auto `metadataFrozen = true` on final `processReveal` batch; `setBaseURI` blocked after `revealRequested` / freeze. |
| M-01 / A-01 | Medium/High ops | 24h timelock on mint price, public start, merkle root, randomness provider, placeholder URI, withdraw. |
| G-01 | Info | `isRevealed(tokenId)` + `isCollectionRevealed()` on `IHansomeGenesis`. |

---

## Re-check by area

### 1. Supply — still ✅
Hard cap 550; reserved 1–10 once; sale 11–550; no hidden mint.

### 2. Mint phases — still ✅ + stronger
WL −1h, caps 1/5/6 unchanged. Commitment must be locked before mint. Phase config changes timelocked.

### 3. Reveal — improved ✅
| Property | Status |
|---|---|
| Admin cannot fulfill entropy on NFT | ✅ |
| Commitment frozen before WL | ✅ |
| Seed hidden until full reveal | ✅ |
| Sale side/class hidden until full reveal | ✅ |
| No reveal before sell-out | ✅ |
| Auto metadata freeze | ✅ |

**Residual (Info):** Determined actors can still read raw storage during `processReveal` via `eth_getStorageAt`. Mitigate operationally (short batch window / indexer pause). True cryptographic hiding of mid-batch SSTORE is not possible on public chains.

**Residual (ops):** `VRFRevealAdapter.vrfOperator` must be a real VRF/beacon — not an EOA that can grind seeds.

### 4. Metadata — improved ✅
Base URI required before reveal; frozen automatically at completion.

### 5. Access control — improved ✅
Timelock on sensitive setters. Recommend multisig as `owner` for mainnet. `cancelAdminOp` available.

### 6. Game API — ✅
```solidity
side(tokenId)
gameplayClass(tokenId)
isRevealed(tokenId)        // per-token
isCollectionRevealed()     // global
```
Read-only. Sale tokens: `isRevealed` false and `side == None` until collection complete.

### 7. OpenZeppelin — ✅
No unsafe overrides; `ReentrancyGuard` retained on mint/fulfill/process/withdraw.

### 8. Gas — ✅
Batched `processReveal` unchanged; full sell-out before reveal adds mint cost only at launch ops.

---

## Open findings (remaining)

| ID | Severity | Notes |
|---|---|---|
| RES-01 | **Medium (ops)** | Single `Ownable` should be a multisig (+ optional TimelockController) on mainnet. |
| RES-02 | **Medium (ops)** | Production must set `randomnessProvider = VRFRevealAdapter` with non-grindable `vrfOperator`. |
| RES-03 | **Info** | Storage-slot observers during batch processing (see above). |
| RES-04 | **Info** | Sybil across wallets still outside per-wallet caps. |
| RES-05 | **Low** | Consider `Ownable2Step` for safer ownership transfer. |

**Critical / High (code):** none open after hardening.

---

## Test results

```text
npx hardhat test test/HansomeGenesisNFT.test.ts test/HansomeAlpacas.test.ts
15 passing
```

Covers: commitment lock, timelock, WL timing, wallet caps, owner-fulfill rejection, seed/side hiding mid-batch, auto-freeze, sell-out gate, VRF adapter operator check.

---

## Deployment readiness

| Environment | Ready? |
|---|---|
| Local / CI | ✅ |
| Public testnet | ✅ (`USE_REVEAL_MOCK=1` acceptable for integration) |
| Mainnet | ⚠️ After: real VRF operator on `VRFRevealAdapter`, multisig owner, pre-published locked commitment |

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | v1.0 initial review |
| 2026-07-17 | v1.1 post-hardening re-audit |
