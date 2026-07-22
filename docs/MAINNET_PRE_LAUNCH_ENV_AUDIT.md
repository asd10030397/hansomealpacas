# HANSOME — Mainnet Pre-Launch Environment Audit

| Field | Value |
|------|------|
| File | `docs/MAINNET_PRE_LAUNCH_ENV_AUDIT.md` |
| Purpose | Final **read-only** environment audit before Robinhood Chain Mainnet launch |
| Audited at | **2026-07-20T15:23:19.523Z** (UTC) |
| Mode | **READ_ONLY** — no deployment, no transactions, no secret values recorded |
| Verdict | **NOT READY** |

**Related:** [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) · [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md)

**Hard rules for this audit**

- No private keys, vault keys, or full addresses beyond redacted prefixes.
- Live RPC reads only (`eth_chainId`, `balanceOf`, `getBalance`).
- Vercel Production dashboard was **not** queried from this machine.

---

## 1. Deployment machine

| Check | Result | Status |
|-------|--------|--------|
| Node.js | `v24.18.0` | Pass (runtime available) |
| npm | `11.16.0` | Pass |
| Hardhat CLI | `2.28.6` | Pass |
| `contracts/.env` | present | Pass (file exists; values audited below without disclosure) |
| Hardhat `mainnet` / `robinhood` | `chainId: 4663`, RPC via `resolveRobinhoodMainnetRpcUrl` | Pass |
| Hardhat Testnet isolation | `robinhoodTestnet` = `46630` (separate network) | Pass |
| Canonical Mainnet RPC | `https://rpc.mainnet.chain.robinhood.com` | Pass |
| `RH_RPC_URL` override | unset → uses canonical default | Pass |
| Live RPC `eth_chainId` | **4663** | **Pass** |
| Explorer (config) | `https://robinhoodchain.blockscout.com` | Pass |

---

## 2. Wallet readiness

| Check | Result | Status |
|-------|--------|--------|
| Deployer key configured | Present via **`TREASURY_PRIVATE_KEY` fallback** (no dedicated `DEPLOYER_PRIVATE_KEY`) | **Warn / hygiene gap** |
| Deployer address (redacted) | `0xcE15…069A` | Present |
| Deployer ETH | **~0.00398 ETH** (recommend ≥ **0.05 ETH**) | **Blocker** |
| HANSOME funding wallet | Same deployer EOA; balance **~13,374,569** `$HANSOME` | Present |
| Recommended Treasury fund (at audit) | Was **300,000,000**; **superseded 2026-07-21** by approved launch **30,000,000** (initial \(R_d=80k\)/day; protocol \(G_0\) unchanged) | **Blocker vs 30M** if funder &lt; 30M — see [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md) |
| `RESERVE_MINT_TO` | Set (`0xcE15…069A`) — confirm intentional founder custody | Pass (set) / human confirm |
| `VRF_OPERATOR` | **Placeholder** `0x0000…0001` | **Blocker** |
| `RANDOMNESS_PROVIDER` | Set (`0xcE15…069A`) | Pass (set) / human confirm role |
| `MAINNET_OWNER` | **Missing** | **Blocker** |

---

## 3. Contract deployment inputs

### Genesis (approved targets — from go-live approval)

| Parameter | Approved value | Env / machine | Status |
|-----------|----------------|---------------|--------|
| Supply | 550 | On-chain constant | Pass (design) |
| Reserved | 10 | On-chain constant | Pass (design) |
| Whitelist | 100 | On-chain constant | Pass (design) |
| Public | 440 | On-chain constant | Pass (design) |
| Mint start | 2026-07-23 12:00 UTC (`1784808000`) | Sale schedule (later) | Human — not in live deploy env yet |
| Mint price | 0.015 ETH | Sale schedule (later) | Human — not in live deploy env yet |
| `GENESIS_NFT_ADDRESS` | Live address after deploy | Placeholder `0x1111…1111` | Warn (dry-run only) |
| Live `robinhood-genesis.json` | Required post-deploy | **Absent** | Warn (not deployed) |

### Game

| Parameter | Approved / required | Env on machine | Status |
|-----------|---------------------|----------------|--------|
| Token | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | Canonical OK | **Pass** |
| `GAME_DAY_ZERO` | **1784894400** (2026-07-24 12:00 UTC) | **`1800000000`** (mismatch) | **Blocker** |
| `GAME_FAST_TIMING` | `0` / unset | `0` | Pass |
| `USE_REVEAL_MOCK` | must not be `1` | unset / not `1` | Pass |
| `RANDOMNESS_PROVIDER` | real operator address | set (see §2) | Pass (set) |
| Treasury fund plan | Docs `GAME_TREASURY_FUND_HANSOME=30000000`; scripts still `GAME_TREASURY_FUND_ETH=30000000` (HANSOME misnomer) or skip path | `SKIP_TREASURY_FUND=1`, fund amount unset | Warn — funding still required before commits |
| Live `robinhood-game.json` | Required post-deploy | **Absent** | Warn (not deployed) |
| Dry-run artifacts | Optional | genesis / game / game-launch dry-run JSON present | Pass |

---

## 4. Vercel readiness

**Scope:** Repository + cutover documentation only. Production dashboard values were **not** read.

### Required `NEXT_PUBLIC_*` (after Mainnet contracts exist)

| Variable | Expected |
|----------|----------|
| `NEXT_PUBLIC_GAME_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_GAME_RPC_URL` | Mainnet RPC |
| `NEXT_PUBLIC_GAME_EXPLORER` | Mainnet Blockscout |
| `NEXT_PUBLIC_HANSOME_GAME_ADDRESS` | from `robinhood-game.json` |
| `NEXT_PUBLIC_GENESIS_NFT_ADDRESS` (or `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS`) | from `robinhood-genesis.json` |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` | from game JSON |
| `NEXT_PUBLIC_RANDOMNESS_ADDRESS` | from game JSON |

### Server secrets (names only — never commit values)

| Variable | Notes |
|----------|-------|
| `GAME_MAINNET_RELAYER_PRIVATE_KEY` | Only if Mainnet gasless deliberately enabled; **new** key |
| `GAME_MAINNET_COMMIT_VAULT_KEY` | **New**; never copy Testnet vault key |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Confirm Production |
| `GAME_RPC_URL` | Optional server RPC |

### Must not remain on Production Mainnet

| Item | Status in audit |
|------|-----------------|
| `46630` / Testnet suite addresses | Must be cleared at cutover — **manual confirm** |
| Testnet RPC / explorer | Must be cleared — **manual confirm** |
| `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=1` | Disable until approved |
| `NEXT_PUBLIC_THANSOME_ADDRESS` | Remove |
| Fast timing `120/120/240` | Remove / use GDS |
| Testnet secrets copied to Mainnet names | Forbidden |

### Repo guards

| Check | Status |
|-------|--------|
| `lib/game/__tests__/mainnetLaunchGuards.test.ts` | Present |
| `docs/MAINNET_VERCEL_CUTOVER.md` | Present |
| Cutover blocked until live Mainnet JSON + verify | **Yes** — Genesis/Game not deployed yet |

| Vercel audit item | Status |
|-------------------|--------|
| Dashboard env verified on this machine | **Not possible** → listed as blocker until ops confirms |

**Secret leak check (this audit):** No secret values written to this document. No keys printed to the audit transcript.

---

## 5. Final blocker list

| # | Blocker | Owner |
|---|---------|-------|
| 1 | Deployer ETH ≈ **0.004** &lt; recommended **0.05** | Ops / Deployer |
| 2 | Funding funder HANSOME ≈ **13.4M** &lt; approved launch **30,000,000** | Treasury |
| 3 | `VRF_OPERATOR` is placeholder `0x000…0001` | Ops |
| 4 | `MAINNET_OWNER` unset | Founder / Ops |
| 5 | `GAME_DAY_ZERO` env (`1800000000`) ≠ approved **`1784894400`** (2026-07-24 12:00 UTC) | Product / Ops |
| 6 | Vercel Production cutover not verified from this machine (confirm after deploy per cutover doc) | Ops / Vercel admin |

### Warnings (non-blocking for tooling, blocking for live ceremony)

| Warning |
|---------|
| Deployer key is Treasury fallback — set dedicated `DEPLOYER_PRIVATE_KEY` |
| `GENESIS_NFT_ADDRESS` placeholder — expected until live Genesis |
| No `robinhood-genesis.json` / `robinhood-game.json` (contracts not on Mainnet yet) |
| `SKIP_TREASURY_FUND=1` — must still fund GameTreasury before player commits |

---

## 6. Verdict

| Field | Value |
|-------|-------|
| **READY / NOT READY** | **NOT READY** |
| Dry-run tooling / RPC / Hardhat Mainnet config | Usable |
| Ceremony funding + roles + dayZero alignment | Incomplete |
| Live Mainnet contracts + Vercel cutover | Not started / not verified |

**Do not deploy** until blockers **1–5** are cleared, dry-runs report **zero blockers** with the corrected env, and human go-live approval ([`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md)) is signed. Clear blocker **6** before Production cutover.

---

## 7. Change log

| Date | Change |
|------|--------|
| 2026-07-20 | Initial pre-launch environment audit (read-only) |
