# tHANSOME — Robinhood Testnet Deployment Report

| Field | Value |
|-------|--------|
| Generated | 2026-07-19 |
| Network | **Robinhood Testnet only** (chainId 46630) |
| Mainnet | **Not deployed** |
| Real $HANSOME | **Unchanged** (`HansomeAlpacas`) |

> Test-only ERC-20 for gameplay Claim validation. Name: **Test HANSOME** · Symbol: **tHANSOME** · Decimals: **18**.

---

## Token

| Item | Value |
|------|--------|
| Contract | `TestHANSOME` |
| Address | `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E` |
| Deploy tx | `0x2c28d9a473e8a6effcba52036cacce7784f2b1ce1cef7e3b11909e47777f6dbd` |
| Initial supply | **1,000,000,000** tHANSOME → deployer |
| Deployer | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |

Record: `contracts/deployments/robinhoodTestnet-thansome.json`

---

## Allocation

| Recipient | Amount | Notes |
|-----------|--------|-------|
| GameTreasury (claim payer) | **900,000,000** tHANSOME | Fund tx `0x1604e5bfa6d8f27237ca892742f5d57eb929e4a3ceee20aa38be75d4af2a2b11` |
| Deployer retained | **100,000,000** tHANSOME | Manual testing |
| RewardDistributor ERC-20 balance | **0** | By design — `claimMany` pulls via `GameTreasury.payClaim` |

---

## Game suite rewired to tHANSOME

`GameTreasury.token` is immutable, so the testnet game suite was **redeployed** with `GAME_TOKEN_ADDRESS=tHANSOME`.

| Contract | Address |
|----------|---------|
| HansomeGame | `0x0C7ADF857687b3034C1f88cA2b357A4461D1BbbD` |
| RewardDistributor | `0xa67f13E39647b680FDa816c011a313f979F89212` |
| GameTreasury | `0x4a362DA19995038e0683534F5b80Ed867bd457Ef` |
| Game token (tHANSOME) | `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E` |
| Genesis NFT (unchanged) | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |

---

## Frontend / env

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_THANSOME_ADDRESS` | `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E` |
| `NEXT_PUBLIC_HANSOME_GAME_ADDRESS` | `0x0C7ADF857687b3034C1f88cA2b357A4461D1BbbD` |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` | `0xa67f13E39647b680FDa816c011a313f979F89212` |
| `contracts/.env` `THANSOME_ADDRESS` / `GAME_TOKEN_ADDRESS` | set to tHANSOME |

---

## Verification (immediate)

| Check | Result |
|-------|--------|
| name / symbol / decimals | Test HANSOME / tHANSOME / 18 |
| Deployer balance | 100,000,000 tHANSOME |
| GameTreasury balance | 900,000,000 tHANSOME |
| ERC-20 transfer | PASS (self-transfer smoke) |
| Unit tests (`npm run test:thansome`) | **6/6 PASS** (mint auth, unauthorized reject, fund treasury, claimMany, duplicate claim) |

---

## Settlement → Claim (live)

Live Commit → Reveal → Settle → Claim on NFT `#1` against the new tHANSOME-backed game:

| Step | Status / Tx |
|------|-------------|
| Commit | **PASS** `0x2920183bf7fdee0d58f70c38a13d1c3689d388d4b2a0379131111f88ff3ebdf0` |
| Reveal → Settle → Claim | In progress (waiting RevealOpen / RevealClosed) — report updates in `contracts/deployments/robinhoodTestnet-game-flow-report.md` |

Resume if needed:

```bash
cd contracts
GAME_TOKEN_ID=1 GAME_FLOW_WAIT=20000 npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-thansome.ts` | Deploy tHANSOME (refuses Mainnet) |
| `scripts/fund-test-reward-distributor.ts` | Fund GameTreasury for claims |
| `scripts/verify-thansome.ts` | Metadata + balance checks |
| `test/TestHANSOME.test.ts` | Automated tests |

---

## Important

- Do **not** deploy tHANSOME to Robinhood Mainnet.
- Do **not** modify real `$HANSOME` (`HansomeAlpacas`).
- Claims are paid from **GameTreasury**, not from a RewardDistributor token balance.
