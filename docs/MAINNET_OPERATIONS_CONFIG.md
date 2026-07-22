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
| **DEPLOYER** | Ceremony hot wallet: deploy Genesis + game suite; temporary Ownable; may fund Treasury | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (Treasury-key fallback today) | | |
| **RESERVE_MINT_TO** | Receives reserved `#001`–`#010` (founder / cold custody) | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (launch default; move cold later if needed) | | |
| **VRF_OPERATOR** | Operates `VRFRevealAdapter` (Genesis **collection** reveal entropy — ≠ game day seed) | **Temp** `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` + `VRF_OPERATOR_OWNER_ACK=1` in `.env` (B3 VERIFIED) — **never** `0x000…0001` | Owner + Ops | 2026-07-21 |
| **RANDOMNESS_PROVIDER** | Calls `GameRandomness.fulfillDaySeed` each day before settle | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (temporary; `B4_OWNER_ACK=1`, Project Owner, 2026-07-21) | Owner + Ops | 2026-07-21 |
| **MAINNET_OWNER** | Initial Ownable after verify (EOA hot wallet launch; may rotate to multisig/timelock later) | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (+ `ALLOW_CEREMONY_EOA=1` + `OWNER_ACK=1`) | Owner + Ops | 2026-07-21 |

Full role / runbook: [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md).

### Address rules

| Rule | Check |
|------|-------|
| Every row filled with a real Mainnet-capable address | [ ] |
| No `0x000…0001` / `0x111…1111` / `0xdead…` placeholders | [ ] |
| No canonical **Testnet** suite addresses | [ ] |
| `RESERVE_MINT_TO` ≠ throwaway; custody plan for `#001`–`#010` agreed | [ ] |
| `VRF_OPERATOR` key custody + online runbook ready | [ ] |
| `RANDOMNESS_PROVIDER` key custody + daily fulfill runbook ready + B4 ack | [x] |
| `MAINNET_OWNER` filled (initial EOA; later multisig optional) | [x] |
| `DEPLOYER` has its **own** key material (prefer not long-term reuse of treasury key) | [ ] |

**Optional (not required for game smoke):** `MAINNET_RELAYER` — only if Mainnet gasless is deliberately enabled later; **new** key, never copy Testnet relayer.

---

## 3. Required decisions

Freeze these **before** live Genesis / Game deploy. Record the approved value and who signed off.

| Decision | Env / field | Approved value (fill) | Notes | Owner | Date |
|----------|-------------|----------------------|-------|-------|------|
| **GAME_DAY_ZERO** | `GAME_DAY_ZERO` | **`1784894400`** (2026-07-24 12:00 UTC) | Unix seconds; **immutable** after Game deploy. | Product / Ops | 2026-07-21 |
| **Genesis mint price** | `GENESIS_MINT_PRICE_ETH` (sale schedule) | `_TBD_` | ETH per NFT (sale ceremony; can be after game smoke). See mint ops doc. | Product / Founder | |
| **Genesis mint date** | Public / WL start (`GENESIS_PUBLIC_START` etc.) | `_TBD_` | Calendar date + unix; WL/public schedule — **not** required to open game smoke. | Product / Ops | |
| **Treasury initial funding** | `GAME_TREASURY_FUND_HANSOME` (docs) / legacy `GAME_TREASURY_FUND_ETH` (scripts) | **`30000000`** (approved) | Whole `$HANSOME` → **GameTreasury** (**not ETH**). Protocol \(G_0 = 300{,}000{,}000\) unchanged. See §3A / [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md). | Treasury / Ops | |
| **GameTreasury funder wallet** | Ops (not an env hardcode in Solidity) | **`0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`** | Holds ≥ 30M `$HANSOME` before ceremony; one-time launch transfer. Future top-ups: same or other approved treasury wallets. | Treasury / Ops | |

### Decision confirmations

| # | Statement | Sign-off |
|---|-----------|----------|
| 1 | `GAME_DAY_ZERO` matches the intended Day 0 start (UTC) and is written as unix seconds | [ ] |
| 2 | Genesis mint **price** approved (or explicitly deferred until after game smoke) | [ ] |
| 3 | Genesis mint **date** / sale window approved (or explicitly deferred) | [ ] |
| 4 | Treasury launch funding **30,000,000** from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` approved; initial Rd = 80,000/day; progressive top-up strategy accepted | [ ] |
| 5 | Funding `$HANSOME` only — never tHANSOME; never fund RewardDistributor | [ ] |


---

## 3A. Initial Treasury Strategy

See full write-up: [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md).

| Layer | Statement |
|-------|-----------|
| **Protocol design** | \(G_0\) = 300,000,000, bands, \(G_{\mathrm{safe}}\) = 15,000,000 — **unchanged** in Solidity |
| **Launch operations** | GameTreasury initially funded with **30,000,000** HANSOME → initial \(R_d = 80{,}000\)/day |
| **Expansion** | Further transfers unlock 160k / 280k / 400k at 60M / 120M / 210M — **no upgrade** |

### Initial Treasury Funding Source

| Item | Value |
|------|------|
| **Amount** | **30,000,000** HANSOME |
| **Source** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Destination** | GameTreasury (ceremony) |
| **Type** | One-time **operational** launch funding transaction |
| **Solidity** | Address **not** hardcoded |
| **Future top-ups** | Same wallet or other approved project treasury wallets (treasury policy) |

**Env:** document as `GAME_TREASURY_FUND_HANSOME=30000000`. Deploy scripts still read legacy **`GAME_TREASURY_FUND_ETH=30000000`** (misnomer: value is HANSOME, not ETH) until a future script rename.

---

## 3B. Treasury Operations (ops guidelines — not contract rules)

| Spendable G | Suggested action |
|-------------|------------------|
| **30M** | Launch |
| **20M** | Review treasury status |
| **17M** | Prepare additional funding |
| **15M** | SafeMode threshold (on-chain Commit pause if below) |


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
| Funder wallet (ops source) | **`0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`** — holds ≥ **30,000,000** before ceremony | | [ ] |
| Amount to transfer | **30,000,000** HANSOME (one-time initial funding) | | [ ] |
| Destination | **GameTreasury** contract only (after deploy) | | [ ] |
| Transfer procedure | Prefer: funder signs ERC-20 `transfer` to GameTreasury **or** `SKIP_TREASURY_FUND=1` on deploy then fund from this wallet before commits. Do **not** hardcode this address in Solidity. | | [ ] |
| RewardDistributor balance | **0** required for funding plan | | [ ] |

**Launch vs protocol:** ceremony funds **30,000,000** from `0xcE15…069A`. Protocol band reference \(G_0\) remains **300,000,000** in contracts — do not confuse the two.

---

## 5. Pre-launch confirmation checklist

Complete **all** boxes before any `ALLOW_MAINNET_DEPLOY=1` live transaction.

### 5.1 Every address verified

| Check | OK |
|-------|-----|
| DEPLOYER filled + explorer-checked on chainId **4663** | [ ] |
| RESERVE_MINT_TO filled + custody confirmed | [ ] |
| VRF_OPERATOR filled + operator ready | [ ] |
| RANDOMNESS_PROVIDER filled + runbook ready + B4 ack | [x] |
| MAINNET_OWNER filled (initial EOA + ACK flags) | [x] |

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
| 2026-07-21 | Launch Treasury funding set to **30,000,000**; strategy sections 3A/3B; see INITIAL_TREASURY_STRATEGY.md |
| 2026-07-21 | Funding source wallet recorded: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (ops only) |
| 2026-07-21 | Docs: `GAME_TREASURY_FUND_HANSOME` preferred; legacy script env `GAME_TREASURY_FUND_ETH`; §3A funding-source block |
