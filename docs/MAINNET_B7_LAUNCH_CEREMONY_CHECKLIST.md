# HANSOME — B7 Mainnet Launch Ceremony Checklist

| Field | Value |
|------|------|
| File | `docs/MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md` |
| Purpose | Complete execution checklist for Mainnet ceremony + Vercel Production cutover (B7) |
| Mode | **Ops ceremony** — this file alone does **not** authorize deploy or transactions |
| Chain | Robinhood Mainnet **4663** (never **46630**) |
| Related | [`MAINNET_B7_GO_SIGNOFF_PACKAGE.md`](./MAINNET_B7_GO_SIGNOFF_PACKAGE.md) · [`MAINNET_GO_LIVE_CHECKLIST.md`](./MAINNET_GO_LIVE_CHECKLIST.md) · [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) · [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md) |

**Prerequisite board (2026-07-21):** B1–B6 **VERIFIED**. B7 remains **IN PROGRESS** until this checklist is completed end-to-end.

---

## 0. Hard gates (must all be true before any live write)

| # | Gate | OK |
|---|------|-----|
| 0.1 | B1–B6 marked VERIFIED on tracker | [x] |
| 0.2 | No placeholder role addresses (`0x000…0001`, zero, burn dummies) | [ ] |
| 0.3 | `USE_REVEAL_MOCK=0` (Mainnet) | [x] |
| 0.4 | Effective roles confirmed (below) | [x] |
| 0.5 | Dry-runs report **zero blockers** (game-launch preflight) | [x] (2026-07-21) |
| 0.6 | Human GO sign-off recorded (Phase 8) | [ ] |
| 0.7 | Live flags set **only** for the live step being executed | [ ] |

**Live write flags (all three required together):**

```text
ALLOW_MAINNET_DEPLOY=1
CONFIRM_MAINNET_DEPLOY=YES
LIVE_MAINNET_SEND=1
```

Prefer `DRY_RUN=1` for every script first. Dry-run never sends transactions.

---

## 1. Effective ceremony configuration (pre-filled — re-check at T-0)

| Role / env | Effective value | Notes |
|------------|-----------------|-------|
| `GAME_DAY_ZERO` | `1784894400` | 2026-07-24 12:00 UTC |
| `USE_REVEAL_MOCK` | `0` | Mock forbidden on Mainnet |
| `VRF_OPERATOR` | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Temp ceremony EOA; `VRF_OPERATOR_OWNER_ACK=1` |
| `RANDOMNESS_PROVIDER` | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Temp ceremony EOA; `B4_OWNER_ACK=1` |
| `MAINNET_OWNER` | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Initial EOA; `ALLOW_CEREMONY_EOA=1` + `OWNER_ACK=1` |
| `RESERVE_MINT_TO` | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Reserved `#001`–`#010` |
| Canonical `$HANSOME` | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | Set as `GAME_TOKEN_ADDRESS` — never tHANSOME |
| GameTreasury funder | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | **30,000,000** HANSOME |
| Treasury fund env | `SKIP_TREASURY_FUND=1` (or `GAME_TREASURY_FUND_ETH=30000000`) | Legacy name = **HANSOME amount**, not ETH |
| Timing | GDS `72000/14400/86400` | Testnet `120/120/240` omitted / ignored on Mainnet |
| Deployer key | Prefer `DEPLOYER_PRIVATE_KEY`; empty → `TREASURY_PRIVATE_KEY` | **Intentional** ceremony fallback (`signer.ts`) |
| Deployer ETH | ≥ **0.05** on 4663 | Re-check before live Genesis |
| Network | `--network mainnet` or `robinhood` → chainId **4663** | Abort on 46630 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | — |
| Explorer | `https://robinhoodchain.blockscout.com` | Verify + public links |

**B4 acknowledgment record**

| Field | Value |
|------|------|
| `B4_OWNER_ACK` | `1` |
| `B4_APPROVED_BY` | Project Owner |
| `B4_APPROVAL_DATE` | 2026-07-21 |
| `PROVIDER_STATUS` | temporary |
| `REPLACEMENT_PLAN` | Replace with a decentralized or production-grade randomness provider when available |

---

## 2. Phase A — Pre-ceremony dry-runs (no txs)

| # | Action | Pass criteria | OK |
|---|--------|---------------|-----|
| A1 | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network robinhood` | Exit 0; zero blockers; roles PASS | [ ] |
| A2 | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network robinhood` | Exit 0; zero blockers | [x] (2026-07-21 — token fixed; GDS timing) |
| A3 | `DRY_RUN=1 npx hardhat run scripts/deploy-genesis.ts --network robinhood` | Plan OK; outputs dry-run JSON | [ ] |
| A4 | `DRY_RUN=1` game deploy (`deploy-game.ts` or game dry-run path) | Plan OK; canonical token; dayZero correct | [ ] |
| A5 | `DRY_RUN=1 npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood` | Lists Ownable targets → `MAINNET_OWNER` | [ ] |
| A6 | Re-check deployer ETH ≥ 0.05; funder HANSOME ≥ 30M (read-only) | Balances still meet floors | [ ] |

**Stop if any dry-run blocker remains. Do not set live flags.**

---

## 3. Phase B — Live Genesis

| # | Action | Output | OK |
|---|--------|--------|-----|
| B1 | Confirm `BOOTSTRAP_SALE=0`, `VRF_OPERATOR`, `RESERVE_MINT_TO`, `USE_REVEAL_MOCK=0` | Env locked | [ ] |
| B2 | Set live flags; run **LIVE** `deploy-genesis.ts` | `deployments/robinhood-genesis.json` | [ ] |
| B3 | Confirm VRFRevealAdapter + Genesis on explorer (4663) | Addresses + txs | [ ] |
| B4 | Confirm reserved mint `#001`–`#010` complete | `reserveMintStatus` / verify script | [ ] |
| B5 | `verify-mainnet-reserved.ts` (read-only) if available | ok=true | [ ] |
| B6 | Unset `LIVE_MAINNET_SEND` (and live flags) until next phase | Fail-closed between phases | [ ] |

**If `reserveMint` fails after NFT deploy:** recover per [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md) — do **not** redeploy Genesis.

---

## 4. Phase C — Live Game suite + treasury

| # | Action | Output | OK |
|---|--------|--------|-----|
| C1 | Set `GENESIS_NFT_ADDRESS` from `robinhood-genesis.json` | Env | [ ] |
| C2 | Confirm `GAME_TOKEN_ADDRESS` = canonical HANSOME; `GAME_DAY_ZERO=1784894400`; `RANDOMNESS_PROVIDER` | Env | [ ] |
| C3 | Choose funding path: deploy-fund **or** `SKIP_TREASURY_FUND=1` + transfer 30M from `0xcE15…069A` | Record choice | [ ] |
| C4 | Dry-run game once more with live Genesis address | Zero blockers | [ ] |
| C5 | Set live flags; **LIVE** `deploy-game.ts` | `deployments/robinhood-game.json` | [ ] |
| C6 | Confirm `setRandomnessProvider` → ceremony EOA; treasury funded 30M (or fund now) | On-chain + JSON | [ ] |
| C7 | `verify-mainnet-game.ts` (read-only) | ok=true | [ ] |
| C8 | Unset live flags until ownership phase | Fail-closed | [ ] |

Do **not** fund RewardDistributor with the 30M launch allocation.

---

## 5. Phase D — Ownership transfer

| # | Action | Pass | OK |
|---|--------|------|-----|
| D1 | `DRY_RUN=1 transfer-mainnet-ownership.ts` with current `MAINNET_OWNER` | Plan matches EOA owner | [ ] |
| D2 | **LIVE** `transfer-mainnet-ownership.ts` | Deployer no longer owner of suite | [ ] |
| D3 | Re-run `verify-mainnet-game.ts` with `MAINNET_OWNER` set | Owners match | [ ] |
| D4 | Unset live flags | — | [ ] |

---

## 6. Phase E — Contract verification (Blockscout)

| # | Action | OK |
|---|--------|-----|
| E1 | Verify Genesis + VRFRevealAdapter | [ ] |
| E2 | Verify GameTreasury, Emission, Distributor, GameRandomness, HansomeGame, sinks | [ ] |
| E3 | Publish addresses in ops log / transparency as required | [ ] |

---

## 7. Phase F — Vercel Production cutover (B7 core)

Follow [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md). Do **not** cut over before `robinhood-genesis.json` + `robinhood-game.json` exist and verify passes.

| # | Action | OK |
|---|--------|-----|
| F1 | Set `NEXT_PUBLIC_GAME_CHAIN_ID=4663` | [ ] |
| F2 | Set `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` | [ ] |
| F3 | Mainnet RPC + explorer public vars | [ ] |
| F4 | Set game / genesis / distributor / randomness addresses from **live** JSON only | [ ] |
| F5 | Timing: GDS `72000` / `14400` / `86400` (remove Testnet `120/120/240`) | [ ] |
| F6 | Server: **new** `GAME_MAINNET_*` keys only if gasless deliberately enabled; never copy Testnet keys | [ ] |
| F7 | Deploy / promote Vercel Production | [ ] |
| F8 | Smoke load `game.hansomealpacas.xyz` — Mainnet chain, not Testnet suite | [ ] |

---

## 8. Phase G — Post-cutover smoke (first day path)

| # | Check | OK |
|---|-------|-----|
| G1 | Wallet on Robinhood Mainnet 4663 | [ ] |
| G2 | Reserved Alpaca QA NFT visible (if using `#002`–`#004`) | [ ] |
| G3 | Commit while CommitOpen | [ ] |
| G4 | Ops: `fulfillDaySeed` via `RANDOMNESS_PROVIDER` | [ ] |
| G5 | Finalize + creditBatch → settled | [ ] |
| G6 | Claim `$HANSOME` | [ ] |
| G7 | Treasury spendable still healthy vs `G_SAFE` | [ ] |

---

## 9. Phase H — Incident / rollback readiness

| # | Item | OK |
|---|------|-----|
| H1 | Emergency runbook reviewed ([`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md)) | [ ] |
| H2 | Vercel rollback plan (revert env / redeploy prior Production) known | [ ] |
| H3 | Provider / VRF operator gas top-up path known | [ ] |
| H4 | Ownership already on `MAINNET_OWNER` before public marketing push | [ ] |

---

## 10. GO / NO-GO sign-off

| Role | Name | Date | GO / NO-GO | Signature |
|------|------|------|------------|-----------|
| Product | | | | |
| Ops / Deployer | | | | |
| Treasury | | | | |
| Security / Founder | | | | |

**Board rule after ceremony success:** Mark **B7 VERIFIED** only when Phases A–F complete (live deploy JSON + Production cutover smoke). Until then B7 stays **IN PROGRESS** and live ceremony remains **NO-GO** without Phase 10 GO.

---

## 11. Exact command order (reference)

```text
# A — dry-runs
DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network robinhood
DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network robinhood
DRY_RUN=1 npx hardhat run scripts/deploy-genesis.ts --network robinhood
DRY_RUN=1 npx hardhat run scripts/deploy-game.ts --network robinhood
DRY_RUN=1 npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood

# B — live Genesis (only after GO)
# ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=YES LIVE_MAINNET_SEND=1
# npx hardhat run scripts/deploy-genesis.ts --network robinhood

# C — live Game
# same flags + GENESIS_NFT_ADDRESS set
# npx hardhat run scripts/deploy-game.ts --network robinhood
# npx hardhat run scripts/verify-mainnet-game.ts --network robinhood

# D — ownership
# DRY_RUN=1 then LIVE transfer-mainnet-ownership.ts

# F — Vercel cutover per MAINNET_VERCEL_CUTOVER.md
```

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | Initial B7 ceremony checklist; B1–B6 VERIFIED prerequisite; no deploy authorized |
