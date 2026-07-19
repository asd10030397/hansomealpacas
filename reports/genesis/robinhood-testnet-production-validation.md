# Robinhood Testnet — Final Production Validation

| Field | Value |
|-------|--------|
| Generated | 2026-07-19 |
| Network | Robinhood Testnet (`46630`) |
| Mainnet | **Not deployed / not recommended yet** |

## Contract addresses

| Contract | Address |
|----------|---------|
| Genesis NFT | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| HansomeGame | `0x0C7ADF857687b3034C1f88cA2b357A4461D1BbbD` |
| RewardDistributor | `0xa67f13E39647b680FDa816c011a313f979F89212` |
| GameTreasury | `0x4a362DA19995038e0683534F5b80Ed867bd457Ef` |
| tHANSOME | `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E` |

## Phase 1 — Live game loop (Settle → Claim)

**Status: PASS** — day `0`, token `#1`.

| Step | Status | Tx |
|------|--------|-----|
| Commit | PASS | `0x2920183bf7fdee0d58f70c38a13d1c3689d388d4b2a0379131111f88ff3ebdf0` |
| Reveal | PASS | `0x20ca34e7eac7609b9f5d7c79425d99162ab2a4852844c13e3d9062536de6d871` |
| Seed | PASS | `0xab4d0fd1ff01cb559a17a4a1706bbb0d78b8b09f21409dafb4a4cdc3e7353c73` |
| Settlement | PASS | `0xba3ea763281abbbcd3d9203e928b62e871f32f83e6b9f0613b367f87ff27d192` |
| Claim | PASS | `0x1143df1ce1dc4bd018757255af12d7b8e7ec0fe755792abec7c05505e105c081` |

| Check | Result |
|-------|--------|
| Reward amount | **320,000** tHANSOME |
| claimable after | `0` |
| Duplicate claim rejected | PASS |
| Player token received | PASS |

Resume / monitor:

```bash
cd contracts
GAME_TOKEN_ID=1 GAME_FLOW_WAIT=16000 npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
```

After completion, balances and txs are written to:

- `contracts/deployments/robinhoodTestnet-game-flow.json`
- `contracts/deployments/robinhoodTestnet-game-flow-report.md`
- `reports/genesis/game-flow-settle-claim.md`

## Phase 2 — Live inventory (My NFTs)

**Status: IMPLEMENTED (code)**

- Removed `MOCK_NFTS` as the My NFTs data source.
- `useOwnedGenesisNfts` scans `ownerOf(1..totalMinted)`, reads `side` / `gameplayClass` / `isRevealed` / `tokenURI`, claimable via distributor, artwork via production Metadata CID when URI is still placeholder.
- Empty / disconnected / wrong-network states handled.

**Caveat:** Collection reveal is not complete on-chain, so public sale tokens may show `Unknown` role until `collectionRevealed`. Reserved `#1–#10` expose identity. Artwork falls back to Metadata CID `bafybeihs7d6nzeq2s6woads3bsbpwa5g4fgspz7fmtxr4wd6xh2idd224e`.

## Phase 3 — Dashboard live clock

**Status: PASS (verified hydrated UI)**

Hydrated `/game/dashboard` against Robinhood Testnet RPC:

- Live chain · **Day 0** · **state 3 (RevealOpen)**
- Phase badge: **Reveal**
- Countdown matches `secsToRevealEnd` (~2h50m at check time)
- Demo phase buttons hidden
- Claim amounts labeled **tHANSOME** (0 until settle credits)

Screenshot: `reports/genesis/qa-dashboard-desktop-hydrated.png`

## Phase 4 — Wallet flow

**Status: PARTIAL**

| Step | Backend / script | Frontend |
|------|------------------|----------|
| Mint | PASS (prior) | Live mint hooks |
| My NFTs | — | Live inventory hook |
| Commit | PASS (script) | Live when wallet connected |
| Reveal | PASS (script) | Live when wallet + local salt |
| Settlement | WAITING | Live `settleDay` |
| Claim | WAITING | Live `claimMany` |

Full browser wallet E2E still requires a human MetaMask session on testnet after Settle/Claim unlock.

## Phase 5 — Error handling

| Case | Handling |
|------|----------|
| Wallet disconnected | Connect CTA on My NFTs / WalletGate |
| Wrong network | Switch network CTA |
| Zero NFTs | Empty-state copy |
| Already committed | Commit button disabled / sealed status |
| Already revealed | Reveal queue filters |
| Already claimed | claimable → 0; duplicate claim reverts (script assert) |
| Tx rejected | UI `rejected` state in claim/commit/reveal |
| RPC timeout | Script retries; UI shows failure message |
| Loading | Inventory / day clock loading flags |

## Phase 6 — Responsive QA

See `reports/genesis/frontend-qa.json` and screenshots `qa-*-{mobile,tablet,desktop}.png`.

| Viewport | Dashboard overflow | My NFTs overflow |
|----------|--------------------|------------------|
| Mobile | fixed via `overflow-x: clip` (re-verify) | re-verify |
| Tablet | PASS | PASS |
| Desktop | PASS | PASS |

## Phase 7 — Performance (local)

From `frontend-qa.json` (domcontentloaded):

| Page | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| Dashboard | ~1.0s | ~1.2s | ~1.4s |
| My NFTs | ~2.2s | ~1.5s | ~1.5s |

NFT metadata fetch is gated per owned token (Pinata). No aggressive optimization beyond existing multicalls.

## Gate — Robinhood Mainnet ready?

| Check | Result |
|-------|--------|
| Settlement PASS | ✅ |
| Claim PASS | ✅ (320,000 tHANSOME; claimable→0; duplicate rejected) |
| Treasury PASS | ✅ (claim paid; player delta matched) |
| Inventory PASS | ✅ code wired (manual wallet confirm remaining) |
| Dashboard PASS | ✅ code wired (verify day/phase after hydrate) |
| Wallet PASS | ⏳ needs post-settle browser pass |
| Responsive PASS | ⚠️ mobile overflow patched — re-check |
| Performance PASS | ✅ acceptable for testnet |

**Mainnet recommendation: NO — not yet.**

Complete Settle → Claim with treasury/player balance proofs, then a connected-wallet UI pass, before recommending Mainnet.
