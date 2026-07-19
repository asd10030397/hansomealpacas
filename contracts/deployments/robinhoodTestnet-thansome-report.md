# tHANSOME deploy — robinhoodTestnet (TEST ONLY)

> Not real $HANSOME. Robinhood Testnet only. Do not deploy to Mainnet.

- Address: `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E`
- Name / Symbol: Test HANSOME / tHANSOME
- Decimals: 18
- Supply minted to deployer: `1000000000.0`
- Deploy tx: `0x2c28d9a473e8a6effcba52036cacce7784f2b1ce1cef7e3b11909e47777f6dbd`
- Deployer: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`

Next:
```bash
# Redeploy game suite bound to tHANSOME (treasury token is immutable)
GAME_TOKEN_ADDRESS=0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E SKIP_TREASURY_FUND=1 \
  npx hardhat run scripts/deploy-game.ts --network robinhoodTestnet
npx hardhat run scripts/fund-test-reward-distributor.ts --network robinhoodTestnet
npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet
```
