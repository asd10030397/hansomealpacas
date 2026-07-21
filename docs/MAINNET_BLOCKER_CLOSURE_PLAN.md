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
| 1 | ETH gas funding | Open — ~0.004 ETH | Ops / Deployer | [ ] |
| 2 | GameTreasury HANSOME funding | Open — ~13.4M vs 300M | Treasury | [ ] |
| 3 | `VRF_OPERATOR` confirmation | Open — placeholder `0x000…0001` | Ops | [ ] |
| 4 | `RANDOMNESS_PROVIDER` confirmation | Open — set but not role-confirmed | Ops | [ ] |
| 5 | `MAINNET_OWNER` multisig setup | Open — unset | Founder / Ops | [ ] |
| 6 | `GAME_DAY_ZERO` update | Open — env mismatch | Product / Ops | [ ] |
| 7 | Vercel Production Mainnet cutover preparation | Open — dashboard not verified | Ops / Vercel admin | [ ] |

---

## 1. ETH gas funding

| Field | Detail |
|-------|--------|
| **Current status** | Deployer EOA (`0xcE15…069A` at audit) held **~0.00398 ETH** on Robinhood Mainnet (`4663`). Below ceremony recommendation. |
| **Required action** | Fund the **deployer** wallet on Mainnet with enough native ETH for Genesis + Game suite + recoveries + day-0 ops. Target **≥ 0.05 ETH** (more if suite + multiple recoveries expected). Prefer a dedicated `DEPLOYER_PRIVATE_KEY` (audit warned of Treasury-key fallback). |
| **Verification method** | Read-only: explorer balance for deployer **or** re-run `dry-run-mainnet-deploy-plan.ts` / `dry-run-mainnet-game-launch.ts` and confirm `deployer_gas` is pass (not warn). |
| **Completion criteria** | Deployer ETH **≥ 0.05** on chainId **4663**; dry-run gas check no longer a blocker/warn for underfunding; recorded in ops config. |
| **Final owner** | Ops / Deployer |

---

## 2. GameTreasury HANSOME funding

| Field | Detail |
|-------|--------|
| **Current status** | Funding wallet (same deployer at audit) held **~13,374,569** `$HANSOME`. Recommended GameTreasury initial fund is **300,000,000** (三億 / \(G_0\)). Shortfall ~**286,625,431**. Audit had `SKIP_TREASURY_FUND=1`. |
| **Required action** | Assemble **300,000,000** canonical Mainnet `$HANSOME` (`0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`) on the funder wallet **before** live `deploy-game` fund step (or document explicit lower amount + accept lower emission band in writing). Set `GAME_TREASURY_FUND_ETH=300000000` for ceremony plan; clear mistaken “三千萬” confusion — target is **三億**. Do **not** fund RewardDistributor. |
| **Verification method** | Read-only `balanceOf(funder)` on Mainnet; game-launch dry-run with `GAME_TREASURY_FUND_ETH=300000000` must **not** report `treasury_funding` blocker. |
| **Completion criteria** | Funder balance ≥ approved fund amount; dry-run `treasury_funding` = pass; amount written in [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) §3–§4 and signed in go-live approval. |
| **Final owner** | Treasury (with Ops ceremony coordination) |

---

## 3. VRF_OPERATOR confirmation

| Field | Detail |
|-------|--------|
| **Current status** | `VRF_OPERATOR` was **placeholder** `0x0000…0001`. Unusable for live Genesis (`VRFRevealAdapter` collection-reveal entropy — **≠** game day seed). |
| **Required action** | Choose the real Mainnet operator address; confirm key custody + online runbook; set `VRF_OPERATOR` in ceremony env (never leave burn/placeholder). Record redacted prefix in ops config. |
| **Verification method** | Env audit / `dry-run-mainnet-deploy-plan.ts` + `DRY_RUN=1 deploy-genesis.ts` show real operator (not `0x000…0001`); human sign-off in go-live approval §2 / security §4. |
| **Completion criteria** | Non-placeholder checksummed address set; operator acknowledges duty; Genesis dry-run `vrf_operator` = pass. |
| **Final owner** | Ops |

---

## 4. RANDOMNESS_PROVIDER confirmation

| Field | Detail |
|-------|--------|
| **Current status** | Env had an address set (`0xcE15…069A` at audit) — **not** missing, but **not** formally confirmed as the day-seed fulfiller role (may currently equal deployer). |
| **Required action** | Confirm who will run `GameRandomness.fulfillDaySeed` every day before settle; set `RANDOMNESS_PROVIDER` to that address; document custody + runbook; if temporary = deployer, record explicit plan to rotate before/after ownership transfer. |
| **Verification method** | `dry-run-mainnet-game-launch.ts` `randomness_provider` = pass; ops config + go-live approval signed for provider role. |
| **Completion criteria** | Named operator + address confirmed; ceremony env matches; day-0 fulfill runbook exists (offline). |
| **Final owner** | Ops |

---

## 5. MAINNET_OWNER multisig setup

| Field | Detail |
|-------|--------|
| **Current status** | `MAINNET_OWNER` was **unset**. No final Ownable recipient planned in env. |
| **Required action** | Stand up Mainnet multisig / timelock; record signers + threshold offline; set `MAINNET_OWNER` in ceremony env; confirm `transfer-mainnet-ownership.ts` target list (Genesis + game suite Ownables). |
| **Verification method** | Env shows `MAINNET_OWNER` set; game-launch dry-run `ownership_plan` = pass (not warn); founder/ops sign go-live security section. |
| **Completion criteria** | Multisig address verified on Mainnet; threshold documented; env filled; transfer plan acknowledged. |
| **Final owner** | Founder / Ops |

---

## 6. GAME_DAY_ZERO update

| Field | Detail |
|-------|--------|
| **Current status** | Approved Day 0: **2026-07-24 12:00 UTC** = unix **`1784894400`** ([`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md)). Machine env at audit had **`1800000000`** (mismatch / placeholder). |
| **Required action** | Set `GAME_DAY_ZERO=1784894400` in ceremony env; remove any other dayZero default; product confirms immutable intent before Game deploy. |
| **Verification method** | Re-read env (value only, no secrets); `dry-run-mainnet-game-launch.ts` `day_zero` detail shows `1784894400` and ISO `2026-07-24T12:00:00.000Z`. |
| **Completion criteria** | Env exactly matches approved unix; dry-run day_zero = pass; product sign-off on go-live approval §3. |
| **Final owner** | Product / Ops |

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
| R1 | Blockers **1–6** Closed (gas, treasury HANSOME, VRF, randomness role, owner multisig, dayZero) | [ ] |
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
