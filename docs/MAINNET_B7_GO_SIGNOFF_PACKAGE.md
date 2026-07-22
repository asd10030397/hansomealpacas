# HANSOME — B7 Final GO / NO-GO Sign-off Package

| Field | Value |
|------|------|
| File | `docs/MAINNET_B7_GO_SIGNOFF_PACKAGE.md` |
| Prepared | 2026-07-21 |
| Mode | **Human sign-off only** — does **not** authorize deploy until `GO_FOR_LIVE_TRANSACTIONS=1` |
| Related | [`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) · [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md) |

**Hard rules**

- No deployment / no transactions from this document alone.
- Do **not** set live flags until the sign-off form below has `GO_FOR_LIVE_TRANSACTIONS=1`.
- Prefer `DRY_RUN=1` for every script before any live step.
- Unset live flags between phases.

---

## 1. Scheduled launch time (reconfirmed)

| Item | Value |
|------|------|
| Wall clock | **2026-07-24 12:00 UTC** |
| `GAME_DAY_ZERO` | **`1784894400`** |
| Meaning | Day 0 / game clock start (immutable once Game is deployed) |
| Timing (GDS) | commit **72000** s · reveal **14400** s · day **86400** s |

---

## 2. Exact addresses (reconfirm at T-0)

| Role | Address |
|------|---------|
| **Deployer** (signer; Treasury-key fallback) | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **MAINNET_OWNER** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **VRF_OPERATOR** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **RANDOMNESS_PROVIDER** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **RESERVE_MINT_TO** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Treasury funding source** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Canonical `$HANSOME`** | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **GameTreasury** (destination) | *Unknown until live `deploy-game.ts` — take from `deployments/robinhood-game.json` → `treasury`* |

Network: `--network robinhood` or `mainnet` → chainId **4663**  
RPC: `https://rpc.mainnet.chain.robinhood.com`  
Explorer: `https://robinhoodchain.blockscout.com`

---

## 3. Exact treasury action

| Item | Value |
|------|------|
| Amount | **30,000,000** HANSOME (whole tokens) |
| From | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| To | Newly deployed **GameTreasury** (address from live JSON) |
| Nature | **One-time** initial launch funding |
| Env path | `SKIP_TREASURY_FUND=1` at deploy, then ERC-20 `transfer` after GameTreasury exists |
| Do **not** | Fund RewardDistributor with this 30M |

---

## 4. Required live flags (do **not** enable yet)

All three must be set **together** only for the live step being executed:

```text
ALLOW_MAINNET_DEPLOY=1
CONFIRM_MAINNET_DEPLOY=YES
LIVE_MAINNET_SEND=1
```

| Flag | Required value | Notes |
|------|----------------|-------|
| `ALLOW_MAINNET_DEPLOY` | `1` | Gate 1 |
| `CONFIRM_MAINNET_DEPLOY` | `YES` (legacy `I_UNDERSTAND` also accepted) | Gate 2 |
| `LIVE_MAINNET_SEND` | `1` | Final gate immediately before txs |
| `DRY_RUN` | `1` for preflight | Dry-run never sends txs; omit / unset for live |

**Between phases:** clear `LIVE_MAINNET_SEND` (and preferably all three) until the next live step.

---

## 5. Final ceremony command sequence (execution order)

Work directory: `contracts/`  
Shell: PowerShell-compatible env shown; adapt as needed.

### Phase 0 — Preflight (before GO)

| # | Label | Command / action |
|---|--------|------------------|
| 0.1 | **READ-ONLY** | Re-check `GAME_DAY_ZERO=1784894400`, canonical token, roles, deployer ETH ≥ 0.05, funder ≥ 30M HANSOME |
| 0.2 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network robinhood` |
| 0.3 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network robinhood` |
| 0.4 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/deploy-genesis.ts --network robinhood` |
| 0.5 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/deploy-game.ts --network robinhood` |
| 0.6 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood` |
| 0.7 | **MANUAL VERIFICATION** | Confirm every dry-run: **zero blockers**. Stop if any FAIL. |

### Phase 1 — Live Genesis (only after `GO_FOR_LIVE_TRANSACTIONS=1`)

| # | Label | Command / action |
|---|--------|------------------|
| 1.1 | **MANUAL VERIFICATION** | Confirm `BOOTSTRAP_SALE=0`, `USE_REVEAL_MOCK=0`, `VRF_OPERATOR`, `RESERVE_MINT_TO` |
| 1.2 | **LIVE TRANSACTION** | Set live flags → `npx hardhat run scripts/deploy-genesis.ts --network robinhood` |
| 1.3 | **MANUAL VERIFICATION** | Confirm `deployments/robinhood-genesis.json`; explorer addresses on chainId **4663** |
| 1.4 | **READ-ONLY** | `npx hardhat run scripts/verify-mainnet-reserved.ts --network robinhood` |
| 1.5 | **MANUAL VERIFICATION** | Unset live flags before Phase 2 |

### Phase 2 — Live Game suite

| # | Label | Command / action |
|---|--------|------------------|
| 2.1 | **MANUAL VERIFICATION** | Set `GENESIS_NFT_ADDRESS` from `robinhood-genesis.json` |
| 2.2 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network robinhood` (with live Genesis) |
| 2.3 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/deploy-game.ts --network robinhood` |
| 2.4 | **LIVE TRANSACTION** | Set live flags → `npx hardhat run scripts/deploy-game.ts --network robinhood` (`SKIP_TREASURY_FUND=1`) |
| 2.5 | **MANUAL VERIFICATION** | Confirm `deployments/robinhood-game.json` (`treasury`, `randomness`, `address`, `dayZero`) |
| 2.6 | **READ-ONLY** | `npx hardhat run scripts/verify-mainnet-game.ts --network robinhood` |
| 2.7 | **MANUAL VERIFICATION** | Unset live flags |

### Phase 3 — Treasury funding (30M)

| # | Label | Command / action |
|---|--------|------------------|
| 3.1 | **MANUAL VERIFICATION** | Read GameTreasury address from `robinhood-game.json` |
| 3.2 | **LIVE TRANSACTION** | Transfer **30,000,000** HANSOME from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` → GameTreasury (ERC-20 `transfer`; one-time) |
| 3.3 | **READ-ONLY** / **MANUAL VERIFICATION** | Confirm GameTreasury `balanceOf` ≥ 30,000,000 HANSOME on explorer / script |

### Phase 4 — Ownership transfer

| # | Label | Command / action |
|---|--------|------------------|
| 4.1 | **READ-ONLY** | `$env:DRY_RUN='1'; npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood` |
| 4.2 | **LIVE TRANSACTION** | Set live flags → `npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood` |
| 4.3 | **READ-ONLY** | Re-run `verify-mainnet-game.ts` with `MAINNET_OWNER` set |
| 4.4 | **MANUAL VERIFICATION** | Unset live flags |

### Phase 5 — Blockscout verification

| # | Label | Command / action |
|---|--------|------------------|
| 5.1 | **MANUAL VERIFICATION** | Verify Genesis + VRFRevealAdapter + game suite on Blockscout (constructor args from live JSON) |

### Phase 6 — Vercel Production cutover

| # | Label | Command / action |
|---|--------|------------------|
| 6.1 | **VERCEL / FRONTEND** | Apply Production env per [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md): `NEXT_PUBLIC_GAME_CHAIN_ID=4663`, Mainnet RPC/explorer, addresses from **live** `robinhood-*.json` only |
| 6.2 | **VERCEL / FRONTEND** | Deploy / promote Vercel Production |
| 6.3 | **MANUAL VERIFICATION** | Smoke: wallet on 4663, site not on Testnet suite |

### Phase 7 — Post-cutover smoke

| # | Label | Command / action |
|---|--------|------------------|
| 7.1 | **MANUAL VERIFICATION** | Connect wallet · optional QA mint/commit path |
| 7.2 | **LIVE TRANSACTION** (ops) | `fulfillDaySeed` via `RANDOMNESS_PROVIDER` when first day requires it |
| 7.3 | **MANUAL VERIFICATION** | Settle / claim path healthy; no public GO announce until smoke PASS |

---

## 6. GO sign-off form (human fill)

```text
HANSOME MAINNET — B7 FINAL GO SIGNOFF

GO_APPROVED_BY:
[OWNER TO FILL]

GO_APPROVAL_DATE:
[YYYY-MM-DD]

GO_APPROVAL_TIME_UTC:
[HH:MM]

GO_FOR_LIVE_TRANSACTIONS:
[0 or 1]

INCIDENT_CONTACT:
[OWNER TO FILL — name / channel; no private keys]

ROLLBACK_OPERATOR:
[OWNER TO FILL — who runs Vercel revert + ops freeze]

DECLARATIONS (YES / NO):
SCHEDULED_DAY_ZERO_CONFIRMED_2026-07-24_12:00_UTC:
[YES / NO]

GAME_DAY_ZERO_1784894400_CONFIRMED:
[YES / NO]

CANONICAL_HANSOME_TOKEN_CONFIRMED:
[YES / NO]

THIRTY_MILLION_TREASURY_FUNDING_PLAN_CONFIRMED:
[YES / NO]

DRY_RUNS_ZERO_BLOCKERS_RECONFIRMED_AT_T0:
[YES / NO]

LIVE_FLAGS_WILL_BE_SET_ONLY_AFTER_THIS_FORM:
[YES / NO]

FORM_IS_NOT_AUTOMATIC_DEPLOY:
[YES / NO]

OWNER_TYPED_APPROVAL:
[OWNER TO FILL — e.g. I APPROVE LIVE MAINNET CEREMONY]
```

**Rule:** Live ceremony remains **NO-GO** while `GO_FOR_LIVE_TRANSACTIONS=0` or the form is incomplete.

---

## 7. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Ceremony EOA is deployer + owner + VRF + randomness | High (ops) | Documented temporary; rotate owner / providers after launch |
| Deployer = Treasury key fallback | Medium | Intentional; prefer dedicated `DEPLOYER_PRIVATE_KEY` when practical |
| GameTreasury address unknown until after deploy | Medium | Fund only after JSON + address confirmation |
| Reserve mint failure after Genesis deploy | Medium | Recovery script — do **not** redeploy Genesis |
| Vercel cutover with wrong addresses | High | Cut over only from live JSON; keep Testnet rollback window |
| Funder / deployer underfunded at T-0 | High | Re-check balances immediately before Phase 1 |
| Human error with live flags left on | High | Unset flags between phases |

---

## 8. Package verdict (as of preparation)

| Item | Status |
|------|--------|
| Game-launch dry-run | Clean (0 blockers) at last rehearsal |
| Sign-off form | **Blank — awaiting project owner** |
| Live flags | **Not enabled** |
| **GO / NO-GO** | **NO-GO** until form completed with `GO_FOR_LIVE_TRANSACTIONS=1` |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | Initial B7 GO sign-off package; no deploy authorized |
