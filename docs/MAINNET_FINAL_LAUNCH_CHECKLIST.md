# HANSOME — Final Robinhood Chain Mainnet Launch Checklist

| Field | Value |
|------|------|
| Chain | **Robinhood Chain Mainnet only** |
| chainId | **`4663`** (never `46630`) |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |
| Hardhat | `--network mainnet` |
| JSON stem | `deployments/robinhood-*.json` |
| Status | **Ceremony document — do not deploy until all gates pass** |

**Related:** [`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md) · [`MAINNET_DEPLOYMENT_CHECKLIST.md`](./MAINNET_DEPLOYMENT_CHECKLIST.md) · [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md)

**Hard rules**

- No live txs until dry-runs report **zero blockers**.
- Live writes require `ALLOW_MAINNET_DEPLOY=1` + `CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND`.
- Never reuse Testnet keys, Merkle roots, suite addresses, or tHANSOME.
- Do **not** cut over Vercel until `robinhood-genesis.json` + `robinhood-game.json` exist and verify scripts pass.
- Genesis supply stays **550**; reserved `#001`–`#010` are **Alpaca** specials only (Cougar QA = post-reveal ops).

---

## 1. Exact launch order

### Phase 0 — Gates (read-only / dry-run)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 0.1 | Confirm network: chainId **4663**, Mainnet RPC | Script banners match; abort if Testnet |
| 0.2 | `dry-run-mainnet-deploy-plan.ts` | Exit 0, zero blockers |
| 0.3 | Fill ops TBDs (see §4) | All manual confirmations signed off |

### Phase 1 — Genesis + reserved mint

| Step | Action | Output |
|------|--------|--------|
| 1.1 | `DRY_RUN=1` `deploy-genesis.ts` (`BOOTSTRAP_SALE=0`, `VRF_OPERATOR`, `RESERVE_MINT_TO`) | `robinhood-genesis.dry-run.json` |
| 1.2 | **LIVE** `deploy-genesis.ts` (same env + allow/confirm) | Deploy Genesis + VRF adapter; lock commitment; **auto `reserveMint`** → `#001`–`#010` |
| 1.3 | Confirm explorer + `robinhood-genesis.json` (`reserveMintStatus: complete`) | Address + `reservedTo` + tx hash |
| 1.4 | `verify-mainnet-reserved.ts` (read-only) | `robinhood-reserved-verify.json` **ok=true** |
| 1.5 | (Ops) Split custody if needed: `#001` founder · `#002`–`#004` Alpaca QA · `#005`–`#010` giveaways | Transfers only — no Solidity |

**If `reserveMint` fails after NFT deploy:** recover with `reserve-mint-mainnet.ts` — see Genesis mint ops Recovery. Do **not** redeploy Genesis.

### Phase 2 — Game suite + treasury + randomness

| Step | Action | Output |
|------|--------|--------|
| 2.1 | `dry-run-mainnet-game-launch.ts` | Zero blockers; `robinhood-mainnet-game-launch.dry-run.json` |
| 2.2 | `DRY_RUN=1` `deploy-game.ts` | `robinhood-game.dry-run.json` |
| 2.3 | **LIVE** `deploy-game.ts` | Order: Treasury → Emission → Distributor → GameRandomness → HansomeGame → Sinks → link → `setRandomnessProvider` → fund |
| 2.4 | Confirm `robinhood-game.json` includes `randomnessProvider`, `treasury`, `distributor`, `dayZero`, `token` | Canonical `$HANSOME` only |
| 2.5 | `verify-mainnet-game.ts` (read-only) | `robinhood-game-verify.json` **ok=true** |

**Required env (Game live):**

```text
GAME_TOKEN_ADDRESS=0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875
GENESIS_NFT_ADDRESS=<from robinhood-genesis.json>
GAME_DAY_ZERO=<unix — explicit, immutable>
RANDOMNESS_PROVIDER=<day-seed fulfiller>
# Docs name: GAME_TREASURY_FUND_HANSOME=30000000 (whole HANSOME, not ETH)
# Scripts still read legacy: GAME_TREASURY_FUND_ETH=30000000  (same value — misnomer)
GAME_TREASURY_FUND_ETH=30000000    # until script rename; 30M HANSOME → Rd=80k/day
# Prefer SKIP_TREASURY_FUND=1 if deployer ≠ funder, then transfer 30M from 0xcE15…069A → GameTreasury before commits
GAME_FAST_TIMING=0
```

### Phase 3 — Ownership

| Step | Action | Pass criteria |
|------|--------|---------------|
| 3.1 | `DRY_RUN=1` `transfer-mainnet-ownership.ts` `MAINNET_OWNER=<multisig>` | Plan lists all Ownable targets |
| 3.2 | **LIVE** ownership transfer | Deployer no longer owner of Genesis + game suite |
| 3.3 | Re-run `verify-mainnet-game.ts` with `MAINNET_OWNER` set | Owners match multisig |

### Phase 4 — Vercel cutover

| Step | Action | Pass criteria |
|------|--------|---------------|
| 4.1 | Follow [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) | Production env = Mainnet addresses only |
| 4.2 | Set public: chain `4663`, Mainnet RPC/explorer, game/genesis/distributor/randomness from JSON | Startup asserts pass |
| 4.3 | Server: **new** `GAME_MAINNET_*` keys only if gasless deliberately enabled; else leave unset | Never copy Testnet keys |
| 4.4 | Remove / ignore Testnet timing (`120/120/240`); use GDS `72000/14400/86400` | — |
| 4.5 | Deploy Production; smoke load `game.hansomealpacas.xyz` | Site on Mainnet, not Testnet suite |

### Phase 5 — First player smoke test (post-cutover)

| Step | Check | Pass |
|------|-------|------|
| 5.1 | Wallet on Robinhood Mainnet `4663` | Correct network |
| 5.2 | Genesis reserved NFT visible (Alpaca `#002`–`#004` for QA) | Owned + side readable |
| 5.3 | Commit (Choose Location) while CommitOpen and **not** safe mode | Tx succeeds |
| 5.4 | Ops: `fulfillDaySeed` for that day via `RANDOMNESS_PROVIDER` | `hasDaySeed=true` |
| 5.5 | After Reveal close: `finalizeDay` + `creditBatch` until settled | `DaySettled` + credits |
| 5.6 | Battle Result shows reward via `pendingRewardOf` (not DaySettled-only) | Non-misleading UI |
| 5.7 | Claim page → `claim` / `claimMany` | `$HANSOME` arrives in wallet |
| 5.8 | Confirm Treasury `spendable` still ≥ `G_SAFE` (15M) | Band healthy |

**Cougar hunting smoke:** only after collection reveal + holding Cougar sale NFTs (not reserved). Until then use Testnet for Cougar combat QA.

### Phase 6 — Public mint (later, not blocking game smoke)

Sale schedule / Merkle / WL open — [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md). Prefer after ownership transfer + game smoke green.

---

## 2. Required wallet roles

| Role | Who | Duties |
|------|-----|--------|
| **Deployer** | Hot ceremony wallet | Deploy Genesis + game suite; initial Ownable; fund Treasury transfer; temporary `RANDOMNESS_PROVIDER` if same |
| **Founder / `RESERVE_MINT_TO`** | Cold or founder wallet | Receives `#001`–`#010`; custody split by transfer |
| **`VRF_OPERATOR`** | Genesis reveal entropy operator | Operates `VRFRevealAdapter` (NFT collection reveal — **≠** game day seed) |
| **`RANDOMNESS_PROVIDER`** | Game day-seed fulfiller | `GameRandomness.fulfillDaySeed` every day before settle |
| **`MAINNET_OWNER`** | Multisig / timelock | Final Ownable for Genesis + Treasury + Game + Distributor + Randomness + Sinks + Emission |
| **Treasury funder** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | **Initial Treasury Funding Source** — one-time **30M** HANSOME → GameTreasury at launch (ops only; not in Solidity). Future top-ups: same or other approved treasury wallets |
| **QA player** | Internal wallet | Holds `#002`–`#004` (Alpaca) for smoke; later 2 Cougars post-reveal |
| **Mainnet relayer** (optional) | Dedicated hot wallet | Only if gasless deliberately enabled; **new** key; reveal batch is onlyOwner today |
| **Vercel admin** | Ops | Production env cutover |

**Never:** Testnet relayer/vault/treasury keys on Mainnet env names.

---

## 3. Required funds (ETH + HANSOME)

### `$HANSOME` (token `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`)

| Purpose | Amount | Notes |
|---------|--------|-------|
| **GameTreasury (launch funding)** | **30,000,000** | From Treasury wallet `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` → GameTreasury (one-time); initial \(R_d = 80{,}000\)/day |
| Funding source (ops) | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Operational only — not hardcoded in Solidity |
| Protocol band reference \(G_0\) | 300,000,000 | **Unchanged** in Solidity — scale for bands, not the launch transfer size |
| Absolute minimum (commits allowed) | 15,000,000 | `G_SAFE`; below → safe mode / no Commit |
| Optional later top-ups | 60M / 120M / 210M thresholds | Same funder or other approved treasury wallets; auto unlock 160k / 280k / 400k — see [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md) |
| RewardDistributor | **0** | Pulls from Treasury; do not fund distributor |
| Mint / WL payments | Separate ETH | Genesis sale (later) — not game reward liquidity |

### ETH (Robinhood Mainnet)

| Purpose | Guidance |
|---------|----------|
| Deployer ceremony gas | Comfortably above dry-run warning (~**≥ 0.05 ETH** preferred; more if suite + recoveries) |
| Day-0 ops | Seed fulfill + finalize + creditBatch chunks |
| Players | Standard Commit / Reveal / Claim gas |
| Ownership transfer | Small additional gas for multi-`transferOwnership` |

Exact gwei/fees vary — re-check deployer balance in `dry-run-mainnet-game-launch.ts` before live.

---

## 4. Manual confirmations before launch

Sign off **before** any `ALLOW_MAINNET_DEPLOY=1` live tx:

| # | Confirmation | Owner |
|---|--------------|-------|
| 1 | Network is Mainnet **4663** / Mainnet RPC only | Ops |
| 2 | `VRF_OPERATOR` address correct and online | Ops |
| 3 | `RESERVE_MINT_TO` = intended founder custody wallet | Founder |
| 4 | Sale identity commitment content approved (no Testnet deck) | Ops |
| 5 | `GAME_DAY_ZERO` unix = intended Day 0 start (immutable) | Product/Ops |
| 6 | `RANDOMNESS_PROVIDER` key custody + runbook | Ops |
| 7 | `GAME_TOKEN_ADDRESS` = canonical Mainnet `$HANSOME` | Ops |
| 8 | Treasury fund **30M** available on `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` for GameTreasury transfer | Treasury |
| 9 | `MAINNET_OWNER` multisig ready (signers + threshold) | Founder |
| 10 | Gasless Mainnet: **enabled with new keys** OR **explicitly deferred** | Product |
| 11 | Vercel Production cutover plan + rollback window agreed | Ops |
| 12 | No Testnet addresses in env or JSON targets | Ops |
| 13 | Public mint / WL Merkle **not** required for game smoke — scheduled separately | Product |
| 14 | Cougar QA plan: Testnet now; Mainnet post-reveal acquire 2 Cougars | QA |

---

## 5. Rollback plan

Contracts on Mainnet are **not** undeployable. Rollback = **contain + frontend revert + ops freeze**.

| Failure point | Action |
|---------------|--------|
| Genesis dry-run / preflight blockers | **Stop** — fix env; no live deploy |
| Genesis deployed, `reserveMint` failed | **Do not redeploy** — `reserve-mint-mainnet.ts` recovery; verify reserved |
| Wrong Genesis / wrong commitment | Freeze sale; escalate — supply/commitment may be locked; legal/ops decision |
| Game suite mid-deploy failure | Inventory partial addresses; do **not** cut over Vercel; redeploy only with new ceremony if unrecoverable (new suite — never point UI at half-linked set) |
| Wrong token / Testnet address aborted by guards | Expected — fix env and retry dry-run |
| Treasury underfunded / safe mode | Top up `$HANSOME` to Treasury; do not open commits until \(G \ge 15M\) |
| Bad `RANDOMNESS_PROVIDER` | Owner (or still-deployer) `setRandomnessProvider` to correct address **before** ownership loss |
| Ownership already transferred, need fix | Multisig executes corrective txs |
| Vercel cutover bad | **Revert Production env** to Testnet suite (`46630` + Testnet addresses) per cutover doc; keep `GAME_TESTNET_*` until rollback window ends |
| Player smoke fails (claim/settle) | Pause commits (`setCommitPaused`); fix seed/credit/treasury; do not advertise public play |
| Exploit / drain suspicion | Multisig: pause commit + sinks; investigate; communicate |

**Frontend rollback is the only fast user-facing undo.** On-chain Genesis/Game addresses remain.

---

## 6. Final launch verdict

| Gate | Verdict |
|------|---------|
| Tooling / guards / verify scripts | **Ready** (ceremony scripts exist; Mainnet-only aborts in place) |
| Contracts (Genesis + Game suite) | **Not deployed** on Mainnet yet |
| Treasury funding | **Plan ready** — **30M** `$HANSOME` from `0xcE15…069A` → GameTreasury at launch (one-time; or skip + fund before commits) |
| Reward / claim path | **Sound** — Treasury holds tokens; Distributor credits; claim pulls; UI uses `pendingRewardOf` + `claimable` |
| Ownership / randomness | **Ops TBD** — `MAINNET_OWNER`, `RANDOMNESS_PROVIDER`, `VRF_OPERATOR` must be filled |
| Vercel | **Blocked** until JSON + verifies green |
| First player smoke | **Blocked** until Phases 1–4 complete |
| Public mint | **Independent** later ceremony |

### Go / No-Go

| Decision | When |
|----------|------|
| **NO-GO** (now) | Any Phase 0 blocker; missing wallets/funds; no `GAME_DAY_ZERO` / provider / owner plan |
| **GO Genesis** | Phase 0 clear + confirmations §4 (1–4, 12) |
| **GO Game** | Reserved verify OK + game launch preflight 0 blockers + §4 (5–9, 12) |
| **GO Cutover** | `verify-mainnet-game` OK + ownership transferred (or explicit delay with deployer still owner documented) |
| **GO Public** | Smoke §5 green + mint ops scheduled |

**Current overall verdict:** **NO-GO for live Mainnet launch** until Genesis + Game are deployed, funded, verified, owned, cut over, and smoke-tested. Ceremony documentation and safety tooling are in place to execute when ops confirmations and balances are ready.

---

## Quick command index (execute only after approval)

```powershell
cd contracts

# Phase 0
npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network mainnet

# Phase 1 (dry-run then live with ALLOW/CONFIRM)
# deploy-genesis.ts → verify-mainnet-reserved.ts

# Phase 2
npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network mainnet
# deploy-game.ts → verify-mainnet-game.ts

# Phase 3
# transfer-mainnet-ownership.ts

# Phase 4
# docs/MAINNET_VERCEL_CUTOVER.md

# Phase 5 — manual player + ops smoke (no single script replaces this)
```
