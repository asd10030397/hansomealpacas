# Robinhood Testnet Validation Report

| Field | Value |
|-------|--------|
| Generated | 2026-07-19 |
| Network | Robinhood Testnet (`chainId` 46630) |
| Mainnet | **Not deployed** — blocked until this validation completes |
| Genesis NFT | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| HansomeGame | `0xAE3f907Dfb8dd56d802de1481b39C88f66c79f32` |
| RewardDistributor | `0xe5aF47B3Fbd084e82104287C89Fc59d0e0D0B433` |
| Deployer / holder | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |

---

## 1. IPFS package (prerequisite)

| Item | CID / URI | Status |
|------|-----------|--------|
| Image CID | `bafybeib577pwjkf5feztkjyf4m5exlodr7mx4zchf7rsmxb46zfeslzn3m` | Verified (Pinata) |
| Metadata CID | `bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e` | Verified (Pinata) |
| Placeholder URI | `ipfs://bafybeiaq6n2kpjqsr5tb22gmxek6w3u2ot2ys7fkxzkxtzhzbfcyhnc26u/placeholder.json` | Verified |
| Reveal seed | `0x7e764e44e6fc2f7e7a90072e6345ded047ed8e39c53f60bdcba46b78e4163d35` | Recorded in shuffle manifest |

See `reports/genesis/ipfs-verify-reveal.md` — **package integrity PASS**.

---

## 2. On-chain URI configuration

| Step | Tx | Result |
|------|-----|--------|
| `setBaseURI(ipfs://METADATA_CID/)` | `0x709d055b94af550bc660745911462ecc985a7c3b07b07c4c3e9e6eeebe6f8931` | **PASS** |
| `schedulePlaceholderURI` | `0xeb674494942bfbc23e1fbb4d58a23d4ff816b721381284b26f629650f8e032ac` | **PASS** |
| `executePlaceholderURI` | `0x1857a995c04c2f762c1f835946ae770b6b9a5873f5816a2045eed43a63986b70` | **PASS** |

**Pre-reveal behavior (by design):** `tokenURI(id)` returns the production placeholder until `collectionRevealed`.  
**Post-reveal behavior:** `tokenURI(id)` → `ipfs://bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e/{id}.json`.

`collectionRevealed` is currently **false** (sale not sold out — `requestReveal` needs 540 sale mints).

---

## 3. Mint

| Field | Value |
|-------|--------|
| Additional public mint | qty **3** |
| Mint tx | `0x44c0f951195f730e4f6d4221438a8dafde154d3e303193138ec89c938b12c6aa` |
| `totalMinted` | **15** (10 reserved + 5 sale) |
| Owner of #1–#15 | Deployer treasury |

Record: `contracts/deployments/robinhoodTestnet-genesis-mint.json`

---

## 4. tokenURI / metadata / artwork / reveal mapping

Script: `npx hardhat run scripts/validate-genesis-testnet-uris.ts --network robinhoodTestnet`

| Check | Result |
|-------|--------|
| On-chain `tokenURI` == production placeholder (minted samples) | **9/9 PASS** |
| Pinata reveal metadata + shuffle mapping | **9/9 PASS** |
| Pinata artwork bytes | **9/9 PASS** |
| Owned by deployer | **9/9** |

### Category coverage (on-chain minted + package)

| Category | Evidence |
|----------|----------|
| Reserved / Founder | `#1` King — placeholder URI + Pinata meta |
| Reserved / Legendary | `#2` Guardian, `#8` Runner |
| Public / Common | `#11`, `#12`, `#13`, `#15` |
| Legendary (shuffled onto sale id) | `#14` → package identity Lucky |
| Cougar (package; not yet minted on this wallet) | `#525` Pinata meta = Cougar / identity 513 |

Full JSON: `contracts/deployments/robinhoodTestnet-uri-validation.json`

---

## 5. My NFTs page & wallet display

| Surface | Status | Notes |
|---------|--------|-------|
| On-chain ownership | **PASS** | Deployer owns `#1`–`#15` |
| Wallet `tokenURI` | **PASS (pre-reveal)** | All minted tokens return production placeholder URI (correct until collection reveal) |
| `/game/my-nfts` UI | **NOT LIVE** | Page still renders `MOCK_NFTS` demo data — live inventory wiring is a follow-up (does not block URI/mint validation) |

---

## 6. Gameplay flow (Commit → Reveal → Settle → Claim)

Uses real minted NFT **`#1`** (Reserved King) on `HansomeGame`.

| Step | Status | Tx / note |
|------|--------|-----------|
| Commit (day 0) | **PASS** | `0x09f15b6a6a9b06b0e47fbbed6bd89d64cdb9924d1ac17a2b2ea6ad96c6393b75` |
| Reveal | **PASS** | `0x65cc4cf8de9737f126310150aebc882614f5e934662819558dd2ef6d723bb8b5` · `locationOf(1,0)=2` |
| Day seed | **PASS** | `0x8c9581d023d62757f8c2692367ec0928ed0cac403d6f503d2046169ec9f069cf` |
| Settlement | **IN PROGRESS** | Waiting for day-0 `RevealClosed` (~4h reveal window); resume script running |
| Claim | **PENDING** | After settle |

Resume:

```bash
cd contracts
GAME_TOKEN_ID=1 GAME_FLOW_WAIT=10000 npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
```

State file: `contracts/deployments/robinhoodTestnet-game-flow.json`

---

## 7. Known testnet caveats (not Mainnet blockers for URI package)

1. **Collection reveal** requires **540 sale mints** before on-chain `tokenURI` switches from placeholder to shuffled metadata. Off-chain package + `baseURI` are already configured for that moment.
2. Mock fulfill for NFT reveal must use recorded `revealSeed` from `reports/genesis/reveal-shuffle-manifest.json`.
3. Confirm `fee_recipient` / royalty receiver before Mainnet.
4. Do **not** reuse testnet merkle root / WL proofs on Mainnet.

---

## 8. Overall gate

| Gate | Status |
|------|--------|
| IPFS package | **PASS** |
| setBaseURI + placeholder | **PASS** |
| Mint + ownership | **PASS** |
| tokenURI / metadata / artwork / mapping | **PASS** (pre-reveal + Pinata) |
| My NFTs live UI | **Open** (mock page) |
| Full game day settle+claim | **In progress** (waiting RevealClosed) |
| Robinhood Mainnet | **Blocked** until settle+claim PASS and remaining open items accepted |

---

## Explorer

- Genesis: https://explorer.testnet.chain.robinhood.com/address/0x43c1d6aF194A796EC612F2bAC04085a409A1347C  
- Game: https://explorer.testnet.chain.robinhood.com/address/0xAE3f907Dfb8dd56d802de1481b39C88f66c79f32  
