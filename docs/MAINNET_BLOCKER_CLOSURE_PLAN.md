# HANSOME — Mainnet Blocker Closure Plan

| Field | Value |
|------|------|
| File | `docs/MAINNET_BLOCKER_CLOSURE_PLAN.md` |
| Purpose | Close every pre-launch blocker from the environment audit before live ceremony |
| Source | [`MAINNET_PRE_LAUNCH_ENV_AUDIT.md`](./MAINNET_PRE_LAUNCH_ENV_AUDIT.md) (audited **2026-07-20T15:23:19Z**) |
| Mode | **Ops checklist only** — no deployment, no transactions, no secrets in this file |
| Baseline verdict | **NOT READY** until all items below are Closed |

**Related**

- [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) — address / funding fill-in
- [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) — human sign-off
- [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) — Production env cutover
- [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) — live ceremony order

**Hard rules**

- Do not paste private keys, vault keys, or full hot-wallet secrets here.
- Prefer redacted address prefixes when recording completion notes.
- Clearing a blocker here does **not** authorize live deploy — that still needs go-live approval + dry-run zero blockers + live flags.

---

## Closure board

| # | Blocker | Status (from audit) | Owner | Closed |
|---|---------|---------------------|-------|--------|
| 1 | ETH gas funding | **Closed / VERIFIED** — ≥ 0.05 ETH (2026-07-21) | Ops / Deployer | [x] |
| 2 | GameTreasury HANSOME funding | **Closed / VERIFIED** (pre-launch) — procedure + funder ≥ 30M | Treasury | [x] |
| 3 | `VRF_OPERATOR` confirmation | **Closed / VERIFIED** — temp ceremony EOA in `.env` + ACK + guard PASS | Ops / Owner | [x] |
| 4 | `RANDOMNESS_PROVIDER` confirmation | **Closed / VERIFIED** — env + runbook + owner ack (`B4_OWNER_ACK=1`) | Ops / Owner | [x] |
| 5 | `MAINNET_OWNER` setup | **Closed / VERIFIED** — initial EOA hot wallet + ceremony ACK flags | Founder / Owner | [x] |
| 6 | `GAME_DAY_ZERO` update | **Closed / VERIFIED** — **`1784894400`** | Product / Ops | [x] |
| 7 | Vercel Production Mainnet cutover preparation | **In progress** — plan ready; blocked on live deploy JSON | Ops / Vercel admin | [ ] |

---

## 1. ETH gas funding

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED.** Read-only re-check **2026-07-21**: deployer EOA `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (resolved via `TREASURY_PRIVATE_KEY` fallback — no dedicated `DEPLOYER_PRIVATE_KEY` in env) holds **0.054108923342201094 ETH** on Robinhood Mainnet (`4663`). **Meets** minimum **≥ 0.05 ETH**. |
| **Required action** | *(Met)* Keep deployer funded through ceremony; prefer a dedicated `DEPLOYER_PRIVATE_KEY` when practical (audit warned of Treasury-key fallback). |
| **Verification method** | Read-only: explorer balance for deployer **or** re-run `dry-run-mainnet-deploy-plan.ts` / `dry-run-mainnet-game-launch.ts` and confirm `deployer_gas` is pass (not warn). |
| **Completion criteria** | Deployer ETH **≥ 0.05** on chainId **4663**; dry-run gas check no longer a blocker/warn for underfunding; recorded in ops config. |
| **Final owner** | Ops / Deployer |
| **Last verification** | 2026-07-21 read-only RPC balance — **PASS** (0.054108923342201094 ≥ 0.05). B1 **VERIFIED**. |

---

## 2. GameTreasury HANSOME funding

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED (pre-launch).** Ops procedure documented and consistent: **30,000,000** HANSOME from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` → GameTreasury at ceremony (one-time); future top-ups from same or other approved treasury wallets; not hardcoded in Solidity. Read-only **2026-07-21:** funder balance ≈ **30,904,320 HANSOME** ≥ 30M. Ceremony ERC-20 transfer (or deploy fund step) remains a **launch execution** step, not a missing procedure. |
| **Required action** | *(Pre-launch met.)* At ceremony: transfer **30,000,000** to GameTreasury (`SKIP_TREASURY_FUND=1` + funder transfer preferred if deployer ≠ funder). Do **not** fund RewardDistributor. |
| **Verification method** | Docs consistency + read-only `balanceOf(funder)` ≥ 30M (done). Post-ceremony: GameTreasury reflects 30M. |
| **Completion criteria** | Pre-launch: procedure + funder balance (met). Launch: 30M in GameTreasury. |
| **Final owner** | Treasury (with Ops ceremony coordination) |
| **Last verification** | 2026-07-21 — funder ≥ 30M + docs OK → **VERIFIED** (pre-launch). |

---

## 3. VRF_OPERATOR confirmation

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED.** Temporary ceremony EOA `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` + `VRF_OPERATOR_OWNER_ACK=1` in `contracts/.env`. Guard validation PASS. Classification: temporary ceremony EOA, **not** permanent production VRF. Does **not** authorize deploy. Replacement plan retained in Owner Input Form / Roles runbook. |
| **Required action** | *(Met for launch.)* Before live: re-check balance / key control. Later: migrate to production VRF/beacon per replacement plan. |
| **Verification method** | Env set + ACK + `requireMainnetVrfOperator` PASS. |
| **Completion criteria** | Met for B3 board. |
| **Final owner** | Ops / Owner |
| **Last verification** | 2026-07-21 — insert + guard validation → **VERIFIED**. |

---

## 4. RANDOMNESS_PROVIDER confirmation

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED.** `RANDOMNESS_PROVIDER=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (temporary). Owner ack: `B4_OWNER_ACK=1`, `B4_APPROVED_BY=Project Owner`, `B4_APPROVAL_DATE=2026-07-21`. Replacement: decentralized / production-grade randomness when available. Runbook in [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md). |
| **Required action** | *(Met.)* Later rotate provider per replacement plan. |
| **Verification method** | Env non-placeholder; runbook published; owner ack recorded. |
| **Completion criteria** | Met for B4 board. |
| **Final owner** | Ops / Owner |
| **Last verification** | 2026-07-21 — **VERIFIED**. |

---

## 5. MAINNET_OWNER setup

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED.** Owner chose **EOA hot wallet** (not multisig / not timelock) as initial launch owner: `MAINNET_OWNER=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` with `MAINNET_OWNER_ALLOW_CEREMONY_EOA=1` + `MAINNET_OWNER_OWNER_ACK=1`. Guard `requireMainnetOwner` PASS. May transfer to multisig/timelock later. Not hardcoded in Solidity. |
| **Required action** | *(Met for launch.)* Optional post-launch: rotate ownership to multisig/timelock. |
| **Verification method** | Env set + ACK flags + `requireMainnetOwner(ceremonyEOA)` PASS. |
| **Completion criteria** | Met for B5 board. |
| **Final owner** | Founder / Ops |
| **Last verification** | 2026-07-21 — scaffold done; address **pending**. |

---

## 6. GAME_DAY_ZERO update

| Field | Detail |
|-------|--------|
| **Current status** | **Closed / VERIFIED.** Effective process env + `contracts/.env` = **`1784894400`** = **2026-07-24T12:00:00.000Z**. Matches go-live approval. |
| **Required action** | *(Met.)* Keep value immutable through Game deploy. |
| **Verification method** | Re-read env; ISO matches `2026-07-24T12:00:00.000Z`. |
| **Completion criteria** | Env exactly matches approved unix (met). |
| **Final owner** | Product / Ops |
| **Last verification** | 2026-07-21 — **PASS**. |

---

## 7. Vercel Production Mainnet cutover preparation

| Field | Detail |
|-------|--------|
| **Current status** | Repo guards + cutover doc exist; Production dashboard **not** audited from the deploy machine. Cutover is **blocked** until live `robinhood-genesis.json` + `robinhood-game.json` exist. Preparation can still be planned now. |
| **Required action** | Prepare Production variable plan per [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md): `NEXT_PUBLIC_GAME_CHAIN_ID=4663`, Mainnet RPC/explorer, contract addresses from deploy JSON only, GDS timing (or remove fast QA timing), disable Testnet gasless, remove tHANSOME / Testnet suite addresses. Stage **new** server secret **names** only if gasless approved — never copy Testnet keys. Do **not** cut over until contracts verified. |
| **Verification method** | Vercel Production checklist signed by admin; after deploy, startup asserts pass (no Testnet suite / no Testnet RPC on `4663`); smoke My NFTs / Mint / Battle Result / Claim. |
| **Completion criteria** | Written cutover plan ready before ceremony; post-deploy: Production env matches Mainnet JSON; no `46630` / Testnet addresses / leaked secrets in `NEXT_PUBLIC_*`; go-live frontend §5 signed. |
| **Final owner** | Ops / Vercel admin |

---

## READY criteria for Mainnet launch

Mark **READY** only when **all** of the following are true:

| # | Criterion | Done |
|---|-----------|------|
| R1 | Blockers **1–6** Closed (gas, treasury HANSOME, VRF, randomness role, owner, dayZero) — **B1–B6 closed; B7 ceremony pending** | [x] |
| R2 | Blocker **7** preparation complete; cutover scheduled **after** live JSON + verify (not before) | [ ] |
| R3 | `DRY_RUN=1` `dry-run-mainnet-deploy-plan.ts` → **0 blockers** | [ ] |
| R4 | `DRY_RUN=1` Genesis plan (`deploy-genesis.ts`) → clean | [ ] |
| R5 | `DRY_RUN=1` `dry-run-mainnet-game-launch.ts` → **0 blockers** (with real fund amount or accepted skip + fund plan) | [ ] |
| R6 | [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) required rows filled (no placeholders / no Testnet) | [ ] |
| R7 | [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) §§1–5 checked and final human approvals signed **READY** | [ ] |
| R8 | Canonical token only: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`; chainId **4663**; no `46630` in ceremony env | [ ] |
| R9 | `ALLOW_MAINNET_DEPLOY` / `CONFIRM_MAINNET_DEPLOY` still **unset** until the moment of approved live ceremony | [ ] |

### Final status

| Field | Value |
|-------|-------|
| **READY / NOT READY** | **NOT READY** until R1–R9 are checked |
| Next gate after READY | Follow live order in [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | Initial blocker closure plan from pre-launch env audit |
| 2026-07-21 | Pre-launch status audit: B6/B7 in progress; see [`MAINNET_PRE_LAUNCH_STATUS_REPORT.md`](./MAINNET_PRE_LAUNCH_STATUS_REPORT.md) |
