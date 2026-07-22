# HANSOME — Mainnet Go-Live Approval

| Field | Value |
|------|------|
| File | `docs/MAINNET_GO_LIVE_APPROVAL.md` |
| Purpose | Final **human approval** checklist before Robinhood Chain Mainnet launch |
| Chain | **Robinhood Chain Mainnet only** |
| Status | **Approval worksheet — not a deploy runbook** |
| Secrets | **Never** paste private keys, vault keys, mnemonics, or relayer keys here |

**Related**

- [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) — addresses & funding fill-in
- [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) — ceremony order
- [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) — Production env cutover
- [`MAINNET_GENESIS_MINT_OPS.md`](./MAINNET_GENESIS_MINT_OPS.md) — reserved mint & sale

**Hard rules**

- No deployment and no transactions from this document.
- Live writes require separate ceremony approval + `ALLOW_MAINNET_DEPLOY=1` + `CONFIRM_MAINNET_DEPLOY=I_UNDERSTAND`.
- This sheet records **human sign-off only**. Technical dry-runs belong in ops config / final checklist.

---

## 1. Network confirmation

| Item | Required value | Approved |
|------|----------------|----------|
| Network | Robinhood Chain **Mainnet** | [ ] |
| Chain ID | **`4663`** (never `46630`) | [ ] |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | [ ] |
| Explorer | `https://robinhoodchain.blockscout.com` | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| Network confirmed | | |

---

## 2. Genesis approval

| Item | Approved value | Confirmed |
|------|----------------|-----------|
| Supply | **550** | [ ] |
| Reserved | **10** (`#001`–`#010`) | [ ] |
| Whitelist | **100** | [ ] |
| Public | **440** | [ ] |
| Mint start | **July 23, 2026 12:00 UTC** (`1784808000`) | [ ] |
| Mint price | **0.015 ETH** | [ ] |

### Reserve allocation

| Token IDs | Purpose | Confirmed |
|-----------|---------|-----------|
| `#001` | Founder | [ ] |
| `#002`–`#004` | Internal QA | [ ] |
| `#005`–`#010` | Community / Partnership | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| Genesis parameters approved | | |
| Founder (`RESERVE_MINT_TO`) acknowledged | | |

---

## 3. Game approval

| Item | Approved value / statement | Confirmed |
|------|----------------------------|-----------|
| `GAME_DAY_ZERO` | **July 24, 2026 12:00 UTC** (`1784894400`) — immutable after Game deploy | [ ] |
| Reward system | `EmissionController` parameters verified against GDS / `GameTypes` (\(G_0\), \(R_0\), bands, `G_SAFE`) | [ ] |
| Treasury | Launch funding **30,000,000** `$HANSOME` from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` → GameTreasury (one-time); initial \(R_d = 80{,}000\)/day; protocol \(G_0\) unchanged; progressive top-ups from same or other approved treasury wallets ([`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md)) | [ ] |
| Settlement | `finalizeDay` + `creditBatch` path approved for Day-0 ops | [ ] |
| Timing | GDS Mainnet: commit **72000** / reveal **14400** / day **86400** (`GAME_FAST_TIMING=0`) | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| Game parameters approved | | |
| Treasury funding amount approved | | |

---

## 4. Security approval

| Check | Confirmed |
|-------|-----------|
| No Testnet contract addresses in ceremony env or Production cutover plan | [ ] |
| No chainId **`46630`** in Mainnet ceremony or Production game env | [ ] |
| No placeholder addresses (`0x000…0001`, `0x111…`, `0xdead…`, dummy dayZero) | [ ] |
| No exposed secrets in git, chat, docs, or `NEXT_PUBLIC_*` | [ ] |
| Ownership transfer plan ready (`transfer-mainnet-ownership.ts` targets agreed) | [ ] |
| **`MAINNET_OWNER`** verified (multisig / timelock; signers + threshold offline) | [ ] |
| Canonical `$HANSOME` only: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| Security approval | | |

---

## 5. Frontend approval

### Vercel Production (cutover plan)

| Check | Confirmed |
|-------|-----------|
| Mainnet RPC (`https://rpc.mainnet.chain.robinhood.com` or approved equivalent) | [ ] |
| Mainnet contract addresses from `robinhood-genesis.json` + `robinhood-game.json` only | [ ] |
| No Testnet RPC / explorer fallback when `NEXT_PUBLIC_GAME_CHAIN_ID=4663` | [ ] |
| No old Testnet env left active (addresses, `46630`, fast timing `120/120/240`) | [ ] |
| Server secrets: new Mainnet names only if gasless enabled; **never** copy Testnet keys | [ ] |

Cutover detail: [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md).

### Product surfaces to verify after cutover

| Surface | Confirmed ready to smoke |
|---------|--------------------------|
| My NFTs | [ ] |
| Mint | [ ] |
| Battle Result (`pendingRewardOf`) | [ ] |
| Claim | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| Frontend / Vercel approval | | |

---

## 6. First 24 hours monitoring

Post-launch ops checklist (execute only after live ceremony — **not** from this sheet).

| Window | Focus | Owner | Done |
|--------|-------|-------|------|
| **Hour 0** | Deployment verification — explorer + `robinhood-*.json` + verify scripts | Ops | [ ] |
| **Hour 1** | Genesis NFT loading — reserved ownership, metadata / side readable in UI | Ops / QA | [ ] |
| **Hour 2** | Commit / Reveal testing — QA Alpaca `#002`–`#004` on Mainnet | QA | [ ] |
| **Day 1** | Settlement — `fulfillDaySeed` → `finalizeDay` → `creditBatch` | Ops | [ ] |
| **Day 1** | Claim — wallet receives `$HANSOME`; Battle Result non-misleading | QA | [ ] |
| **Day 1** | Treasury monitoring — spendable \(G\), band, no unexpected drains | Ops | [ ] |

| Sign-off | Name | Date |
|----------|------|------|
| 24h monitoring plan acknowledged | | |

---

## 7. Final status

### Verdict

| Status | Mark one |
|--------|----------|
| **READY** | [ ] |
| **NOT READY** | [ ] |

**READY** only if §§1–5 are fully checked and all named sign-offs below are complete.  
Technical dry-runs must show **zero blockers** (see ops config §5.4) before flipping to READY.

### Remaining blockers

List only open human / ops items. Leave blank rows unused.

| # | Blocker | Owner | Needed by |
|---|---------|-------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

### Final human approvals

| Role | Name | READY / NOT READY | Date | Signature / initials |
|------|------|-------------------|------|----------------------|
| Founder | | | | |
| Ops lead | | | | |
| Product | | | | |
| Security / custody | | | | |

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-07-20 | Initial go-live approval worksheet (mint 2026-07-23 12:00 UTC @ 0.015 ETH; `GAME_DAY_ZERO` 2026-07-24 12:00 UTC) |
| 2026-07-21 | Treasury launch funding approved **30,000,000** HANSOME (initial Rd=80k/day); protocol G0 unchanged |
| 2026-07-21 | Funding source wallet: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (ops only; one-time launch transfer) |
| 2026-07-21 | Docs consistency: `GAME_TREASURY_FUND_HANSOME` preferred; scripts still `GAME_TREASURY_FUND_ETH` (HANSOME misnomer); see MAINNET_DOC_CONSISTENCY_AUDIT.md |
