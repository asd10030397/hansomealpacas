# Game deploy report — robinhoodTestnet

- HansomeGame: `0x84f719EC9A2E4151D8011bAC87be49f5A0F2fa5E`
- RewardDistributor: `0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2`
- GameTreasury: `0x6A0f4502CeA9Fd42EfB0526FAaA0FD7CD80C0e56`
- Token: `0xd27BD5dbbAB1A76968c53B4FC7D178172D2E193E`
- Genesis: `0x43c1d6aF194A796EC612F2bAC04085a409A1347C`
- dayZero: `1784454910`
- Timing: commit `120s` / reveal `120s` / day `240s` (fast testnet)
- Deploy tx: `0x68423997091b8d99dcf30b44ed9e5ff6a10657eaf30f582283bb0ca698eaaa51`
- Deployer: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- Explorer: https://explorer.testnet.chain.robinhood.com/address/0x84f719EC9A2E4151D8011bAC87be49f5A0F2fa5E

Next:
```bash
npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet
npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
```
