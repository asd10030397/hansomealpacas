# HANSOME — Mainnet Go-Live Checklist

| Field | Value |
|------|------|
| File | `docs/MAINNET_GO_LIVE_CHECKLIST.md` |
| Purpose | Single ceremony gate list before any Mainnet write |
| Related | [`MAINNET_ROLES_AND_RUNBOOK.md`](./MAINNET_ROLES_AND_RUNBOOK.md) · [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) |
| Mode | Ops only — **no** deploy / txs from this file alone |

**Live flags (required together for any write):**

```text
ALLOW_MAINNET_DEPLOY=1
CONFIRM_MAINNET_DEPLOY=YES          # or legacy I_UNDERSTAND
LIVE_MAINNET_SEND=1                 # final gate immediately before txs
# Prefer DRY_RUN=1 first — dry-run never sends txs
```

---

## A. Roles & env (fail-closed)

| # | Item | OK |
|---|------|-----|
| A1 | `VRF_OPERATOR` validated (non-empty, checksummed, not placeholder/zero) | [x] |
| A2 | If `VRF_OPERATOR` = ceremony EOA `0xcE15…069A`, `VRF_OPERATOR_OWNER_ACK=1` set after written owner approval | [x] |
| A3 | `MAINNET_OWNER` validated (not empty/placeholder; ceremony EOA has ALLOW+ACK) | [x] |
| A4 | Owner type / worksheet filled in runbook §B5 (initial EOA hot wallet) | [x] |
| A5 | `RANDOMNESS_PROVIDER` set; go-live acknowledgment signed (`B4_OWNER_ACK=1`) | [x] |
| A6 | `USE_REVEAL_MOCK=0` (or unset) on Mainnet ceremony env | [x] |
| A7 | `GAME_DAY_ZERO=1784894400` (2026-07-24 12:00 UTC) | [x] |
| A8 | No `0x000…0001` / zero / burn placeholders in ceremony env | [x] |

---

## B. Network

| # | Item | OK |
|---|------|-----|
| B1 | Hardhat `--network mainnet` or `robinhood` | [ ] |
| B2 | Provider chainId **4663** (never **46630**) | [ ] |
| B3 | RPC `https://rpc.mainnet.chain.robinhood.com` (or approved Mainnet host) | [ ] |
| B4 | Deployer ETH ≥ **0.05** on 4663 | [ ] |

---

## C. Dry-runs (zero blockers)

| # | Item | OK |
|---|------|-----|
| C1 | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network robinhood` | [ ] |
| C2 | `DRY_RUN=1 npx hardhat run scripts/dry-run-mainnet-game-launch.ts --network robinhood` | [ ] |
| C3 | `DRY_RUN=1 npx hardhat run scripts/deploy-genesis.ts --network robinhood` | [ ] |
| C4 | `DRY_RUN=1` game deploy plan clean | [ ] |

---

## D. Treasury

| # | Item | OK |
|---|------|-----|
| D1 | Funding decision recorded: **30,000,000** HANSOME from `0xcE15…069A` | [ ] |
| D2 | Funder `balanceOf` ≥ 30M verified (read-only) | [ ] |
| D3 | Ceremony path chosen: deploy-fund **or** `SKIP_TREASURY_FUND=1` + ERC-20 transfer | [ ] |
| D4 | Do **not** fund RewardDistributor | [ ] |

---

## E. Contracts & ownership

| # | Item | OK |
|---|------|-----|
| E1 | Contract verification plan (Blockscout) recorded | [ ] |
| E2 | Ownership transfer plan → `MAINNET_OWNER` via `transfer-mainnet-ownership.ts` | [ ] |
| E3 | Post-transfer `verify-mainnet-game.ts` with `MAINNET_OWNER` set | [ ] |

---

## F. NFT sale / metadata

| # | Item | OK |
|---|------|-----|
| F1 | Metadata CID / image CID frozen (or explicit defer) | [ ] |
| F2 | Mint price / max supply / WL / public mint confirmed (or deferred after game smoke) | [ ] |
| F3 | Placeholder URI policy understood (pre-reveal) | [ ] |

---

## G. Frontend / Vercel

| # | Item | OK |
|---|------|-----|
| G1 | Frontend contract addresses from live `robinhood-*.json` only | [ ] |
| G2 | Vercel Production env plan per [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) | [ ] |
| G3 | `NEXT_PUBLIC_GAME_CHAIN_ID=4663`, Mainnet RPC/explorer, no Testnet suite | [ ] |
| G4 | Cutover **after** verify — not before | [ ] |

---

## H. Smoke & incident

| # | Item | OK |
|---|------|-----|
| H1 | Smoke test plan (connect / mint path / game commit path) | [ ] |
| H2 | Rollback / pause / incident response (see Roles & Runbook emergency §) | [ ] |

---

## I. Final GO / NO-GO sign-off

| Role | Name | Date | GO / NO-GO | Signature |
|------|------|------|------------|-----------|
| Product | | | | |
| Ops / Deployer | | | | |
| Treasury | | | | |
| Security / Founder | | | | |

**Hard rule:** Role blockers B1–B6 are VERIFIED. Ceremony remains **NO-GO for live writes** until [`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md) dry-runs pass and Phase 10 GO is signed.
