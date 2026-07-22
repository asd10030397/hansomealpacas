# Mainnet Phase 1 — setBaseURI Baseline Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-23 (Asia/Taipei) |
| **Mode** | Gateway negative test → owner `setBaseURI` broadcast → post-broadcast verification |
| **Chain** | Robinhood Mainnet **4663** |
| **RPC** | `https://rpc.mainnet.chain.robinhood.com` |
| **Genesis NFT** | `0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0` |
| **Owner** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Vault** | `secrets/mainnet-reveal-metadata.env` (BASE_URI / rotation CID — not committed) |
| **Reference** | [`MAINNET_FRONTEND_DEPLOY_AND_SETBASEURI_READY.md`](./MAINNET_FRONTEND_DEPLOY_AND_SETBASEURI_READY.md), [`MAINNET_BLIND_BOX_PRE_BROADCAST_VERIFICATION.md`](./MAINNET_BLIND_BOX_PRE_BROADCAST_VERIFICATION.md) |

---

## Executive summary

Phase 1 completed successfully. Pre-broadcast gateway negative tests **PASS** for rotation CID tokens **11, 12, 100** on Pinata and ipfs.io (all timeout/unavailable — no HTTP 200 metadata JSON). Owner broadcast **`setBaseURI`** to rotation root `ipfs://bafybei…pmnu7qhi/` (vault). Post-broadcast on-chain gates **PASS**. Production frontend bundles contain **neither** old nor rotation CID fingerprints. Post-broadcast gateway negative re-run **PASS**.

### Verdict

**SUCCESS**

### Owner actions taken

| Action | Status |
|--------|--------|
| `setBaseURI(rotation CID)` | ✅ **Broadcast** |
| `setWhitelistMerkleRoot` / merkle | ❌ **Not performed** |
| `requestReveal` / `processReveal` | ❌ **Not performed** |
| Mint / withdraw / freeze / price / start-time changes | ❌ **Not performed** |
| Solidity changes | ❌ **None** |
| Settlement worker / `DRY_RUN=0` | ❌ **Not enabled** |

---

## Step 1 — Gateway negative test (pre-broadcast)

**Rotation CID (redacted):** `bafybei…pmnu7qhi`  
**Probe script:** `scripts-nft/genesis/phase1-gateway-negative.mjs`  
**Tokens:** 11, 12, 100  
**Gateways:** Pinata (`https://gateway.pinata.cloud/ipfs/`), ipfs.io (`https://ipfs.io/ipfs/`)  
**Timeout:** 20s per probe  
**Abort rule:** HTTP 200 + valid reveal metadata JSON → ABORT (no broadcast)

| Probe | HTTP | Valid metadata JSON | Result |
|-------|------|---------------------|--------|
| pinata-11 | ERR (timeout) | No | ✅ PASS |
| ipfs.io-11 | ERR (timeout) | No | ✅ PASS |
| pinata-12 | ERR (timeout) | No | ✅ PASS |
| ipfs.io-12 | ERR (timeout) | No | ✅ PASS |
| pinata-100 | ERR (timeout) | No | ✅ PASS |
| ipfs.io-100 | ERR (timeout) | No | ✅ PASS |

**Pre-broadcast gateway negative:** ✅ **PASS** (0 failures)

### Old leaked CID (informational — not abort trigger)

Old CID `bafybeihs7d6…2idd224e` remains publicly accessible on Pinata/ipfs.io (HTTP 200) per prior audits. This is **expected residual** and does **not** block broadcast per Phase 1 rules.

---

## Step 2 — setBaseURI broadcast

### Preflight (simulation + estimateGas)

| Field | Value |
|-------|-------|
| **Script** | `contracts/scripts/preflight-set-genesis-base-uri.ts` |
| **Signer** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **BASE_URI (vault)** | `ipfs://bafybei…pmnu7qhi/` (67 chars, trailing `/`) |
| **`eth_call` simulation** | ✅ Success |
| **`eth_estimateGas`** | **50,253** |
| **`maxFeePerGas`** | **178,968,000** wei |
| **`maxPriorityFeePerGas`** | **0** wei |
| **Owner balance** | **29,973,468,671,125,152** wei |
| **Pending nonce (pre-tx)** | **67** |
| **Preflight block** | **16710779** |

### Transaction

| Field | Value |
|-------|-------|
| **Function** | `setBaseURI(string uri)` |
| **Script** | `contracts/scripts/set-genesis-base-uri.ts` |
| **Tx hash** | `0x53806bbc520ff3dbc8a1fd99d5ff21c9cbccb1c44e04efc1f499f8f17fcab406` |
| **Block** | **16711047** |
| **Block timestamp** | **1784751915** |
| **Status** | **1** (success) |
| **Gas used** | **49,863** |
| **From** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **To** | `0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0` |
| **New base URI** | `ipfs://bafybei…pmnu7qhi/` (matches vault) |
| **Confirmations** | ≥1 (confirmed in same Hardhat `tx.wait()`) |

**Block explorer:** https://robinhoodchain.blockscout.com/tx/0x53806bbc520ff3dbc8a1fd99d5ff21c9cbccb1c44e04efc1f499f8f17fcab406

---

## Step 3 — Post-broadcast verification

**Read block:** **16711047+** (live reads after confirmation)  
**Script:** `contracts/scripts/verify-set-genesis-base-uri.ts`

### On-chain checks

| Check | Expected | Live | Result |
|-------|----------|------|--------|
| Receipt status | 1 | 1 | ✅ |
| `BaseURIUpdated` event | 1 emit, rotation URI | 1 emit → `ipfs://bafybei…pmnu7qhi/` | ✅ |
| `tokenURI(1)` | Placeholder | `ipfs://bafybeiaq6n2…/placeholder.json` | ✅ |
| `saleMinted()` | 0 | 0 | ✅ |
| `nextSaleTokenId()` | 11 | 11 | ✅ |
| `revealRequested()` | false | false | ✅ |
| `collectionRevealed()` | false | false | ✅ |
| `metadataFrozen()` | false | false | ✅ |
| `whitelistMerkleRoot()` | `0x0` | `0x0` | ✅ |
| `saleIdentityCommitment()` | `0x37a7…f2bb` | `0x37a7b2080cbd2b26841c70b764379d11531a837fb92e0fbceab99aa41780f2bb` | ✅ |
| `saleIdentityCommitmentLocked()` | true | true | ✅ |

### Frontend (production)

**Host:** `https://game.hansomealpacas.xyz`  
**Method:** HTML fetch + JS chunk scan (`/game/mint`, `/game/my-nfts`)

| Check | Result |
|-------|--------|
| Rotation CID fingerprint `pmnu7qhi` in bundles | ✅ **0 hits** (28 + 30 chunks) |
| Old leaked CID fingerprint `2idd224e` in bundles | ✅ **0 hits** |
| `NEXT_PUBLIC_GENESIS_METADATA_CID` | Unset (scrubbed deploy `81a983d`) |
| Client can fetch `{rotationCID}/{tokenId}.json` pre-reveal | ✅ Blocked (no CID in bundle; `metadataUrlForToken` → null) |

### Post-broadcast gateway negative (rotation CID)

Re-run of Step 1 probes after tx confirmation:

| Probe | HTTP | Valid metadata JSON | Result |
|-------|------|---------------------|--------|
| pinata-11 / ipfs.io-11 | ERR (timeout) | No | ✅ |
| pinata-12 / ipfs.io-12 | ERR (timeout) | No | ✅ |
| pinata-100 / ipfs.io-100 | ERR (timeout) | No | ✅ |

**Post-broadcast gateway negative:** ✅ **PASS**

---

## Key state snapshot (post-broadcast)

| Field | Value |
|-------|-------|
| **On-chain base URI** | `ipfs://bafybei…pmnu7qhi/` |
| **`tokenURI(1)`** | Placeholder (unchanged until `collectionRevealed`) |
| **`saleMinted`** | **0** |
| **`nextSaleTokenId`** | **11** |
| **`revealRequested`** | **false** |
| **`collectionRevealed`** | **false** |
| **`metadataFrozen`** | **false** |
| **`whitelistMerkleRoot`** | **`0x0`** (whitelist mint still blocked) |
| **Rotation metadata public** | **No** (gateway negative pass) |
| **setBaseURI tx** | `0x53806bbc520ff3dbc8a1fd99d5ff21c9cbccb1c44e04efc1f499f8f17fcab406` |

---

## Residual risks

| Risk | Severity | Notes |
|------|----------|-------|
| `BaseURIUpdated` exposes rotation CID on-chain | Low–Medium | Expected; security model = unpinned / gateway-negative metadata |
| Old CID global mirrors | Medium | Mitigated by new seed/CID mapping; old preview ≠ final on-chain reveal |
| Whitelist merkle unset | — | **Intentional** — separate owner ceremony before WL mint |
| Public mint window | — | Requires `publicStart` elapsed; no mint txs in this phase |

---

## Next owner ceremonies (NOT done in Phase 1)

1. **`setWhitelistMerkleRoot`** — before whitelist mint window
2. **Pin rotation metadata to private gateway** — after 540/540 sell-out (per remediation plan)
3. **`requestReveal` → VRF → `processReveal`** — post sell-out only

---

## Artifacts added this session

| File | Purpose |
|------|---------|
| `scripts-nft/genesis/phase1-gateway-negative.mjs` | Abort-gate gateway probes (11/12/100) |
| `contracts/scripts/preflight-set-genesis-base-uri.ts` | Simulation + gas estimate |
| `contracts/scripts/verify-set-genesis-base-uri.ts` | Post-broadcast on-chain verification |

---

*Completed 2026-07-23. Phase 1 verdict: **SUCCESS**. Only owner action: `setBaseURI`. No merkle. No reveal. No Solidity modified.*
