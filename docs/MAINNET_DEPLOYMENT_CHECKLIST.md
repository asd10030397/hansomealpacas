# Mainnet deployment checklist (Robinhood Chain)

| Field | Value |
|------|------|
| Chain | **Robinhood Chain Mainnet only** |
| chainId | **`4663`** — abort if ≠ 4663; **`46630` forbidden** |
| RPC | **`https://rpc.mainnet.chain.robinhood.com`** (`RH_RPC_URL`) |
| Hardhat network | **`--network mainnet`** (preferred) or `--network robinhood` |
| Status | **Game suite not deployed** — dry-run only until ceremony |
| JSON stem | Always `deployments/robinhood-*.json` (even when `--network mainnet`) |

**Hard rule:** Do not deploy until `dry-run-mainnet-deploy-plan.ts` reports zero blockers.

**Final end-to-end launch order (Genesis → Game → fund → own → Vercel → smoke):** [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md).

**GameFi economic model (players + treasury math):** [`HANSOME_GAME_ECONOMIC_MODEL_EN.md`](./HANSOME_GAME_ECONOMIC_MODEL_EN.md) · [`HANSOME_GAME_ECONOMIC_MODEL_ZH.md`](./HANSOME_GAME_ECONOMIC_MODEL_ZH.md).

**After contracts:** Frontend cutover is a separate ceremony — see [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md).

**Genesis mint ops** (Merkle, `reserveMint`, price/start/root): [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md).

---

## Architecture note (scripts vs contracts)

There are **no separate** Hardhat scripts for:

| Requested script | Actual |
|------------------|--------|
| Genesis NFT | `deploy-genesis.ts` (+ `VRFRevealAdapter`) |
| Randomness (game day seed) | **Inside** `deploy-game.ts` → `GameRandomness` |
| HansomeGame | `deploy-game.ts` |
| RewardDistributor | **Inside** `deploy-game.ts` |

Genesis NFT reveal randomness (`VRFRevealAdapter`) ≠ gameplay `GameRandomness`.

---

## A. Exact deployment order

1. Preflight — `dry-run-mainnet-deploy-plan.ts` (0 blockers)
2. **Deploy Genesis** — `deploy-genesis.ts` (`BOOTSTRAP_SALE=0`, `RESERVE_MINT_TO=<founderWallet>`)
3. **Verify Genesis** — explorer / optional contract verify; confirm `robinhood-genesis.json`
4. **Initial config** — identity commitment set + locked (automatic on Mainnet deploy path)
5. **`reserveMint(founderWallet)`** — automatic first mint after deploy → `#001`–`#010`  
   - `#001` Founder · `#002`–`#004` internal testing · `#005`–`#010` giveaways/partners
6. **Verify reserved ownership** — `verify-mainnet-reserved.ts` (read-only)
7. **Final Game launch preflight** — `dry-run-mainnet-game-launch.ts` (0 blockers)  
   Requires: `GAME_DAY_ZERO`, `RANDOMNESS_PROVIDER`, canonical `GAME_TOKEN_ADDRESS`, fund plan
8. **Game suite** — `deploy-game.ts` (`DRY_RUN` then live):  
   GameTreasury → Emission → Distributor → GameRandomness → HansomeGame → Sinks → link →  
   `setRandomnessProvider` → fund  
9. **Verify Game suite** — `verify-mainnet-game.ts` (read-only vs `robinhood-game.json`)
10. Ownership transfer — `transfer-mainnet-ownership.ts` · relayer decision
11. Vercel cutover only after `robinhood-*.json` exist

Genesis mint detail: [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md).

---

## Commands to run later (do not run live yet)

```powershell
cd contracts

# 0) Plan (no txs)
$env:DRY_RUN="1"
npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network mainnet

# 1) Genesis dry-run (plans auto reserveMint)
$env:DRY_RUN="1"
$env:VRF_OPERATOR="<mainnet-vrf-operator>"
$env:BOOTSTRAP_SALE="0"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/deploy-genesis.ts --network mainnet

# 2) Genesis live — deploy + lock commitment + reserveMint(founderWallet)
Remove-Item Env:DRY_RUN -ErrorAction SilentlyContinue
$env:ALLOW_MAINNET_DEPLOY="1"
$env:CONFIRM_MAINNET_DEPLOY="I_UNDERSTAND"
$env:VRF_OPERATOR="<mainnet-vrf-operator>"
$env:BOOTSTRAP_SALE="0"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/deploy-genesis.ts --network mainnet

# 3) Verify #001–#010 ownership (READ-ONLY)
$env:GENESIS_NFT_ADDRESS="<from JSON>"
$env:RESERVE_MINT_TO="<founderWallet>"
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet

# 4) Final Game launch preflight (READ-ONLY — 0 blockers required)
$env:DRY_RUN="1"
$env:GAME_FAST_TIMING="0"
$env:GAME_TOKEN_ADDRESS="0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875"
$env:GENESIS_NFT_ADDRESS="<from JSON>"
$env:GAME_DAY_ZERO="<unix seconds — explicit, no default>"
$env:RANDOMNESS_PROVIDER="<day-seed fulfiller; may equal deployer>"
$env:SKIP_TREASURY_FUND="1"
# optional: $env:MAINNET_OWNER="<multisig>"
npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet

# 5) Game suite dry-run (only after launch preflight OK)
npx hardhat run scripts/deploy-game.ts --network mainnet

# 6) After live deploy — verify suite (READ-ONLY)
npx hardhat run scripts/verify-mainnet-game.ts --network mainnet
```

Outputs (canonical stem `robinhood`):

- `deployments/robinhood-mainnet-deploy-plan.dry-run.json`
- `deployments/robinhood-genesis.dry-run.json` / `robinhood-genesis.json`
- `deployments/robinhood-reserved-verify.json`
- `deployments/robinhood-mainnet-game-launch.dry-run.json`
- `deployments/robinhood-game.dry-run.json` / `robinhood-game.json`
- `deployments/robinhood-game-verify.json`

---

## Guardrails (required)

| Guard | Status |
|-------|--------|
| Explicit `--network mainnet` (or `robinhood`) | Yes — unknown networks refused; Testnet-only scripts refuse Mainnet |
| chainId must be `4663` | Yes — `46630` refused on Mainnet path |
| No Testnet Genesis / token defaults on Mainnet | Yes — explicit `GENESIS_NFT_ADDRESS` + `GAME_TOKEN_ADDRESS` |
| Reject known Testnet suite addresses | Yes — `mainnet-game-guards.ts` aborts deploy |
| Canonical `$HANSOME` only | Yes — hard refuse non-canonical token |
| Explicit `GAME_DAY_ZERO` | Yes — Mainnet refuses "now" default |
| Explicit `RANDOMNESS_PROVIDER` | Yes — set + recorded in `robinhood-game.json` |
| DRY_RUN | Yes — writes `*.dry-run.json`, no txs |
| Final Game preflight | `dry-run-mainnet-game-launch.ts` |
| Post-deploy Game verify | `verify-mainnet-game.ts` |
| chainId print before tx | Yes |
| Target / constructor print | Yes — `logLiveMainnetPreflight` |
| Live confirmation | `ALLOW_MAINNET_DEPLOY=1` + `CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND` |
| Deployment JSON | `robinhood-genesis.json` / `robinhood-game.json` |

---

## Constructor / linking / auth

| Contract | Constructor (explicit) | Post-deploy |
|----------|------------------------|-------------|
| VRFRevealAdapter | owner, `VRF_OPERATOR` | `setConsumer(genesis)` |
| HansomeGenesisNFT | owner, royalty, randomnessProvider, URI, timelock | sale ops (`BOOTSTRAP_SALE=0` recommended) |
| GameTreasury | `$HANSOME`, owner | `setGame` / `setDistributor` / `setSinkRegistry` (**onlyOwner**) |
| EmissionController | — | used by game |
| RewardDistributor | genesis, treasury, owner | `setGame` (**onlyOwner**); claims via `treasury.payClaim` |
| GameRandomness | owner (provider=owner) | `setRandomnessProvider(RANDOMNESS_PROVIDER)` in `deploy-game` |
| HansomeGame | genesis, treasury, emission, distributor, randomness, dayZero, **86400/72000/14400**, owner | `testnetRelayerRevealBatch` = **onlyOwner** |
| SinkRegistry | token, treasury, owner | — |

**Reward funding:** transfer `$HANSOME` → **GameTreasury** (not RewardDistributor balance). Never use `fund-test-reward-distributor.ts` on Mainnet.

**Relayer:** no separate authorize role — gasless Mainnet ⇒ owner==relayer or Solidity change.

---

## Risks before Mainnet deployment

1. **`VRF_OPERATOR` unset** — Genesis blocked.
2. **Deployer ETH too low** — suite deploy will fail mid-way.
3. **Gasless = onlyOwner** — do not leave hot relayer as sole owner without multisig plan.
4. **No separate Randomness/Distributor scripts** — operators must use `deploy-game.ts` order.
5. **Silent fund amounts forbidden** — Mainnet needs an explicit fund amount or `SKIP_TREASURY_FUND=1`. Docs: `GAME_TREASURY_FUND_HANSOME=30000000`. Scripts still require legacy `GAME_TREASURY_FUND_ETH=30000000` (value = whole **HANSOME**, not ETH). Initial 30M from ops wallet `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (not in Solidity); prefer skip+manual transfer when deployer ≠ funder.
6. **Testnet `.env` timing bleed** — ignored on Mainnet unless `GAME_ALLOW_NON_GDS_TIMING=1`.
7. **Ownership left on deployer** — run ownership transfer ASAP after `verify-mainnet-game.ts`.
8. **Frontend cutover before JSON** — forbidden.
9. **Sale bootstrap / WL** — do not reuse Testnet merkle; prefer `BOOTSTRAP_SALE=0`.
10. **Role-key reuse** — never copy Testnet relayer/treasury keys to Mainnet.
11. **`GAME_DAY_ZERO` wrong** — immutable; Mainnet refuses computed "now" default — set deliberately.
12. **`RANDOMNESS_PROVIDER` wrong** — days cannot settle without correct fulfiller.

**Hard rule:** Do not live-deploy Game until `dry-run-mainnet-game-launch.ts` reports zero blockers.
