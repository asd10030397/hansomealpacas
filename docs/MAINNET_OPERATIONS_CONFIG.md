# HANSOME — Mainnet Operations Configuration

| Field | Value |
|------|------|
| File | `docs/MAINNET_OPERATIONS_CONFIG.md` |
| Purpose | Final **operator fill-in** sheet before any live Mainnet ceremony |
| Chain | **Robinhood Chain Mainnet only** |
| Status | **Config worksheet — not a deploy runbook** |
| Secrets | **Never** paste private keys, vault keys, mnemonics, or relayer keys here |

**Related**

- [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) — launch order & GO/NO-GO
- [`MAINNET_DEPLOYMENT_CHECKLIST.md`](./MAINNET_DEPLOYMENT_CHECKLIST.md) — deploy scripts & env
- [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md) — reserved mint & sale ops
- [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) — frontend Production cutover

**Hard rules**

- No deployment and no transactions from this document alone.
- Live writes still require `ALLOW_MAINNET_DEPLOY=1` + `CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND` and zero dry-run blockers.
- Never reuse Testnet addresses (`46630`), Testnet suite contracts, or tHANSOME.
- Canonical `$HANSOME` (Mainnet): `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`.

---

## 1. Network

| Item | Required value | Operator fill-in / confirm |
|------|----------------|----------------------------|
| Network name | Robinhood Chain **Mainnet** | [ ] Confirmed |
| Hardhat network | `--network mainnet` (alias `robinhood` OK) | [ ] Confirmed |
| **chainId** | **`4663`** | [ ] Confirmed — **never `46630`** |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | [ ] Confirmed |
| Explorer | `https://robinhoodchain.blockscout.com` | [ ] Confirmed |
| Deployment JSON stem | `contracts/deployments/robinhood-*.json` | [ ] Confirmed |

---

## 2. Required addresses

Fill **checksummed** `0x…` addresses only. Mark role owner. Leave blank until verified — do **not** invent placeholders for live.

| Env / role | Purpose | Address (fill) | Verified by | Date |
|------------|---------|----------------|-------------|------|
| **DEPLOYER** | Ceremony hot wallet: deploy Genesis + game suite; temporary Ownable; may fund Treasury | `_TBD_` | | |
| **RESERVE_MINT_TO** | Receives reserved `#001`–`#010` (founder / cold custody) | `_TBD_` | | |
| **VRF_OPERATOR** | Operates `VRFRevealAdapter` (Genesis **collection** reveal entropy — ≠ game day seed) | `_TBD_` | | |
| **RANDOMNESS_PROVIDER** | Calls `GameRandomness.fulfillDaySeed` each day before settle | `_TBD_` | | |
| **MAINNET_OWNER** | Final Ownable (multisig / timelock) after verify | `_TBD_` | | |

### Address rules

| Rule | Check |
|------|-------|
| Every row filled with a real Mainnet-capable address | [ ] |
| No `0x000…0001` / `0x111…1111` / `0xdead…` placeholders | [ ] |
| No canonical **Testnet** suite addresses | [ ] |
| `RESERVE_MINT_TO` ≠ throwaway; custody plan for `#001`–`#010` agreed | [ ] |
| `VRF_OPERATOR` key custody + online runbook ready | [ ] |
| `RANDOMNESS_PROVIDER` key custody + daily fulfill runbook ready | [ ] |
| `MAINNET_OWNER` multisig signers + threshold documented offline | [ ] |
| `DEPLOYER` has its **own** key material (prefer not long-term reuse of treasury key) | [ ] |

**Optional (not required for game smoke):** `MAINNET_RELAYER` — only if Mainnet gasless is deliberately enabled later; **new** key, never copy Testnet relayer.

---

## 3. Required decisions

Freeze these **before** live Genesis / Game deploy. Record the approved value and who signed off.

| Decision | Env / field | Approved value (fill) | Notes | Owner | Date |
|----------|-------------|----------------------|-------|-------|------|
| **GAME_DAY_ZERO** | `GAME_DAY_ZERO` | `_TBD_unix_` | Unix seconds; **immutable** after Game deploy. No “now” default on Mainnet. Also record ISO-8601 UTC. | Product / Ops | |
| **Genesis mint price** | `GENESIS_MINT_PRICE_ETH` (sale schedule) | `_TBD_` | ETH per NFT (sale ceremony; can be after game smoke). See mint ops doc. | Product / Founder | |
| **Genesis mint date** | Public / WL start (`GENESIS_PUBLIC_START` etc.) | `_TBD_` | Calendar date + unix; WL/public schedule — **not** required to open game smoke. | Product / Ops | |
| **Treasury initial funding** | `GAME_TREASURY_FUND_ETH` | `_TBD_` | Whole `$HANSOME` tokens to transfer into **GameTreasury**. Recommended **`300000000`** (\(G_0\) = **300,000,000** / 三億). Absolute minimum for commits: **15,000,000** (`G_SAFE`). Top emission band \(R_d = 400{,}000\) needs spendable \(G \ge 210{,}000{,}000\). | Treasury / Ops | |

### Decision confirmations

| # | Statement | Sign-off |
|---|-----------|----------|
| 1 | `GAME_DAY_ZERO` matches the intended Day 0 start (UTC) and is written as unix seconds | [ ] |
| 2 | Genesis mint **price** approved (or explicitly deferred until after game smoke) | [ ] |
| 3 | Genesis mint **date** / sale window approved (or explicitly deferred) | [ ] |
| 4 | Treasury funding amount approved; if below 300M, lower band / runway impact accepted in writing | [ ] |
| 5 | Funding `$HANSOME` only — never tHANSOME; never fund RewardDistributor | [ ] |

---

## 4. Funding checklist

### 4.1 Deployer ETH (Robinhood Mainnet)

| Item | Target | Actual (fill) | OK |
|------|--------|---------------|-----|
| Deployer address | Same as §2 DEPLOYER | | |
| Ceremony gas balance | Prefer **≥ 0.05 ETH** (more if suite + recoveries + day-0 ops) | `_TBD_` | [ ] |
| Re-checked via dry-run `deployer_gas` warning cleared or accepted | — | | [ ] |

### 4.2 Treasury `$HANSOME`

| Item | Target | Actual (fill) | OK |
|------|--------|---------------|-----|
| Token address | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | | [ ] |
| Funder wallet (usually DEPLOYER) | Holds tokens **before** `deploy-game` fund step (or explicit `SKIP_TREASURY_FUND=1` then fund before commits) | `_TBD_` | [ ] |
| Amount available to transfer | Match §3 Treasury decision (recommended **300,000,000**) | `_TBD_` | [ ] |
| Destination | **GameTreasury** contract only (after deploy) | | [ ] |
| RewardDistributor balance | **0** required for funding plan | | [ ] |

**Chinese number check:** recommended funding is **三億 (300,000,000)**, not 三千萬 (30,000,000).

---

## 5. Pre-launch confirmation checklist

Complete **all** boxes before any `ALLOW_MAINNET_DEPLOY=1` live transaction.

### 5.1 Every address verified

| Check | OK |
|-------|-----|
| DEPLOYER filled + explorer-checked on chainId **4663** | [ ] |
| RESERVE_MINT_TO filled + custody confirmed | [ ] |
| VRF_OPERATOR filled + operator ready | [ ] |
| RANDOMNESS_PROVIDER filled + runbook ready | [ ] |
| MAINNET_OWNER filled + multisig ready | [ ] |

### 5.2 No placeholder values

| Check | OK |
|-------|-----|
| No `0x000…0001`, `0x111…`, `0xdead…`, or dummy unix dayZero left in live env | [ ] |
| No “TBD” left in required rows of this sheet for the ceremony being executed | [ ] |
| Local `contracts/.env` overrides reviewed so Testnet bleed cannot win over ceremony env | [ ] |

### 5.3 No Testnet values

| Check | OK |
|-------|-----|
| chainId is **4663** (not **46630**) | [ ] |
| RPC / explorer are Mainnet URLs only | [ ] |
| `GAME_TOKEN_ADDRESS` is canonical Mainnet `$HANSOME` | [ ] |
| No Testnet Genesis / Game / Distributor / Randomness addresses in ceremony env | [ ] |
| `GAME_FAST_TIMING=0` (GDS 72000 / 14400 / 86400) | [ ] |
| No Testnet private keys copied onto Mainnet env names | [ ] |

### 5.4 Dry-run passes

Run from `contracts/` with ceremony env (still **no** live flags). Expect **zero blockers**.

| Script | Command (reference) | Exit 0 / 0 blockers | Date |
|--------|---------------------|---------------------|------|
| Deploy plan | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network mainnet` | [ ] | |
| Genesis plan | `DRY_RUN=1` + `BOOTSTRAP_SALE=0` + `VRF_OPERATOR` + `RESERVE_MINT_TO` → `deploy-genesis.ts --network mainnet` | [ ] | |
| Game launch | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet` | [ ] | |
| Game deploy plan | `DRY_RUN=1` + required game env → `deploy-game.ts --network mainnet` | [ ] | |

Artifacts (local only until ceremony): `deployments/robinhood-*-*.dry-run.json`.

| Final gate | OK |
|------------|-----|
| All dry-runs above green with **this** sheet’s addresses and decisions | [ ] |
| `ALLOW_MAINNET_DEPLOY` / `CONFIRM_MAINNET_DEPLOY` still **unset** until GO | [ ] |
| Ops lead signs: **ready for live ceremony** per final checklist | [ ] Name: ________ Date: ________ |

---

## 6. Post-config pointer (do not execute from this sheet)

When §1–§5 are complete, follow the live order in [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md):

1. Genesis + `reserveMint` → verify reserved  
2. Game suite → fund GameTreasury → verify  
3. Ownership → Vercel cutover → first-player smoke  

Public Genesis mint (price/date in §3) may remain **after** game smoke.

---

## 7. Change log

| Date | Change |
|------|--------|
| 2026-07-20 | Initial operator configuration worksheet |
