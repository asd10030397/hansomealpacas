# Mainnet Genesis mint operations

| Field | Value |
|------|------|
| Chain | **Robinhood Chain Mainnet only** |
| chainId | **`4663`** (abort if mismatch) |
| RPC | **`https://rpc.mainnet.chain.robinhood.com`** |
| Forbidden | Robinhood Testnet **`46630`** / any `*testnet*` RPC |
| Hardhat | `--network mainnet` (or `robinhood` alias) |
| Solidity | **Do not modify** — use existing `reserveMint` / timelocked sale ops |
| Reserved | Exactly **10** via `reserveMint(founderWallet)` (`#001`–`#010`) |
| Status | Ops tooling ready — no Mainnet Genesis until deploy ceremony |

Scripts abort via `assertExplicitMainnetNetwork` + `assertRobinhoodMainnetRpc` if chainId ≠ 4663, chainId is 46630, or RPC host is not `rpc.mainnet.chain.robinhood.com`.

Related: [`MAINNET_DEPLOYMENT_CHECKLIST.md`](./MAINNET_DEPLOYMENT_CHECKLIST.md), [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md).

---

## Reserved allocation purpose (ops custody — not on-chain labels)

All ten tokens mint in **one** `reserveMint(founderWallet)` call. Split later by transfer.

| Token IDs | Purpose |
|-----------|---------|
| `#001` | Founder NFT |
| `#002`–`#004` | Internal Mainnet gameplay testing |
| `#005`–`#010` | Community giveaways, partnerships, collaborations |

Hard rules: keep `reserveMint(10)` · no `ownerMint` · no supply increase · no distribution change.

---

## 1. Mainnet Genesis deployment ceremony checklist

| Step | Action | Command / note |
|------|--------|----------------|
| 1 | **Deploy Genesis** | `deploy-genesis.ts` with `BOOTSTRAP_SALE=0`, `RESERVE_MINT_TO=<founderWallet>`, `VRF_OPERATOR=…` |
| 2 | **Verify contract** | Explorer + optional Hardhat verify; confirm `robinhood-genesis.json` |
| 3 | **Set initial configuration** | Deploy path sets + **locks** sale identity commitment automatically on Mainnet |
| 4 | **Execute `reserveMint`** | **Automatic** in Mainnet `deploy-genesis` after commitment lock (first mint). Standalone: `reserve-mint-mainnet.ts` if recovering |
| 5 | **Verify `#001`–`#010` ownership** | `verify-mainnet-reserved.ts` (read-only) |
| 6 | **Continue Game deployment** | `deploy-game.ts` with `GENESIS_NFT_ADDRESS` from step 1 |

Then (sale open, later): Merkle generate → `schedule-mainnet-mint-sale.ts` → ownership transfer → Vercel cutover.

**Never:** reuse Testnet Merkle · add `ownerMint` · open WL/public before `reserveMint` · skip ownership verify before Game deploy.

---

## Recovery (deploy succeeded, reserveMint failed)

**Do not redeploy Genesis.** The NFT address is already on-chain; redeploying creates a second collection.

### What the scripts guarantee

| Case | Behavior |
|------|----------|
| NFT deploy OK, then crash before/during `reserveMint` | Early `robinhood-genesis.json` already written (`reserveMintStatus: "pending"` or `"failed"`) with `address` + `reservedTo` |
| `reserveMint` reverts mid-ceremony | Contract sets `reservedMinted` only after success; OZ `_safeMint` is atomic per call — second call reverts `ReservedAlreadyMinted` |
| Retry `reserveMint` when already done | `reserve-mint-mainnet.ts` dry-run reports `ALREADY_DONE`; live refuses |
| Commitment locked but reserved not minted | Recovery script locks only if needed, then `reserveMint` |
| Commitment not set | Recovery script sets + locks commitment, then `reserveMint` |

### Recovery commands

```powershell
cd contracts

# 1) Inspect JSON / on-chain state (read-only)
$env:GENESIS_NFT_ADDRESS="<from robinhood-genesis.json or explorer>"
# RESERVE_MINT_TO optional if JSON has reservedTo
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet

# 2) Dry-run recovery (detects reservedMinted=true without error)
$env:DRY_RUN="1"
$env:GENESIS_NFT_ADDRESS="<genesis>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet
# Look for status ALREADY_DONE vs NEEDS_RESERVE_MINT

# 3) Live recovery ONLY if reservedMinted=false
Remove-Item Env:DRY_RUN -ErrorAction SilentlyContinue
$env:ALLOW_MAINNET_DEPLOY="1"
$env:CONFIRM_MAINNET_DEPLOY="I_UNDERSTAND"
$env:GENESIS_NFT_ADDRESS="<genesis>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet

# 4) Re-verify #001–#010
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet
```

### JSON fields to check

| Field | Meaning |
|-------|---------|
| `address` | Deployed Genesis NFT |
| `reservedTo` | Founder wallet (planned/actual recipient) |
| `reservedMinted` | `true` after successful `reserveMint` |
| `reserveMintStatus` | `pending` \| `complete` \| `failed` |
| `reservedMintTxHash` | Set when complete |
| `saleIdentityCommitmentLocked` | Must be true before WL/public mint |

---

## 2. Frontend whitelist proof loading plan

| Chain | Source | Loader |
|-------|--------|--------|
| `46630` | `lib/game/testnet/whitelistProofs.TESTNET-ONLY.json` | `resolveWhitelistProofs(46630)` |
| `4663` | `lib/game/mainnet/whitelistProofs.MAINNET.json` | `resolveWhitelistProofs(4663)` |
| other | — | `null` |

`MintPanel` uses `resolveWhitelistProofs(GENESIS_CHAIN_ID)`. Placeholder Mainnet JSON has empty proofs until the real Merkle generator runs.

---

## 3. Dry-run + verification commands (no live txs required for dry-run)

```powershell
cd contracts

# --- Genesis deploy dry-run (includes reserveMint in plan) ---
$env:DRY_RUN="1"
$env:BOOTSTRAP_SALE="0"
$env:VRF_OPERATOR="<ops>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/deploy-genesis.ts --network mainnet
# → deployments/robinhood-genesis.dry-run.json (postDeployOrder + allocation purpose)

# --- Standalone reserveMint dry-run (recovery / re-run plan) ---
$env:DRY_RUN="1"
$env:GENESIS_NFT_ADDRESS="<after deploy>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/reserve-mint-mainnet.ts --network mainnet

# --- Verify #001–#010 (READ-ONLY; run after live reserveMint) ---
$env:GENESIS_NFT_ADDRESS="<mainnet-genesis>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet
# → deployments/robinhood-reserved-verify.json ; exit 2 if FAIL

# --- Merkle (offline) ---
npx hardhat run scripts/generate-mainnet-whitelist-merkle.ts --network hardhat

# --- Sale schedule dry-run (after reserved verified) ---
$env:DRY_RUN="1"
$env:GENESIS_NFT_ADDRESS="<mainnet-genesis>"
$env:GENESIS_MINT_PRICE_ETH="<approved>"
$env:GENESIS_PUBLIC_START="<unix>"
npx hardhat run scripts/schedule-mainnet-mint-sale.ts --network mainnet
```

npm aliases:

```bash
npm run genesis:reserve:mainnet
npm run genesis:verify-reserved:mainnet
npm run genesis:merkle:mainnet
npm run genesis:schedule-sale:mainnet
```

---

## 4. Live ceremony order (later — not now)

```powershell
# 1–4) Deploy Genesis (auto reserveMint) — ONLY after dry-run OK
Remove-Item Env:DRY_RUN -ErrorAction SilentlyContinue
$env:ALLOW_MAINNET_DEPLOY="1"
$env:CONFIRM_MAINNET_DEPLOY="I_UNDERSTAND"
$env:BOOTSTRAP_SALE="0"
$env:VRF_OPERATOR="<ops>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/deploy-genesis.ts --network mainnet

# 5) Verify
$env:GENESIS_NFT_ADDRESS="<from JSON>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet

# 6) Game suite
$env:DRY_RUN="1"
$env:GAME_FAST_TIMING="0"
$env:GAME_TOKEN_ADDRESS="0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875"
$env:GENESIS_NFT_ADDRESS="<from JSON>"
$env:SKIP_TREASURY_FUND="1"
npx hardhat run scripts/deploy-game.ts --network mainnet
```

---

## 5. Files

| File | Role |
|------|------|
| `contracts/scripts/deploy-genesis.ts` | Mainnet: early JSON + commitment lock + **auto `reserveMint`**; recoverable on failure |
| `contracts/scripts/reserve-mint-mainnet.ts` | Standalone / recovery reserve + dry-run detects already-minted |
| `contracts/scripts/verify-mainnet-reserved.ts` | Read-only `#001`–`#010` ownership check (uses JSON `reservedTo`) |
| `contracts/scripts/schedule-mainnet-mint-sale.ts` | Price / root / publicStart |
| `contracts/scripts/generate-mainnet-whitelist-merkle.ts` | Merkle generator |
| `lib/game/whitelistProofs.ts` | Frontend proof resolver |
| `docs/MAINNET_GENESIS_MINT_OPS.md` | This checklist |
