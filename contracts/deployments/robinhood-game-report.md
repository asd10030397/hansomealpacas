# Game deploy report — robinhood (stem=robinhood)

- HansomeGame: `0xb8dad421881171f4485523d109C94dc650ecB7Eb`
- RewardDistributor: `0x0f9683287F91698B84Da4A3A90366a75EaF93520`
- GameRandomness: `0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791`
- randomnessProvider: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- GameTreasury: `0x96EB6d545ce877115e83273293eC22bC8d2336CF`
- SinkRegistry: `0x41E6c8314A6664a1c8d9093a5DEc5F50F399e423`
- Token: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`
- Genesis: `0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0`
- dayZero: `1784894400`
- Timing: commit `72000s` / reveal `14400s` / day `86400s` (production GDS)
- Deploy tx: `0x84b67fe7bb8d7b42fd9f3b9b99df6d1ccd74ce33d972b092e1d727a82410f0f8`
- Deployer: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- Explorer: https://robinhoodchain.blockscout.com/address/0xb8dad421881171f4485523d109C94dc650ecB7Eb

Next:
```bash
npx hardhat run scripts/verify-mainnet-game.ts --network mainnet
DRY_RUN=1 MAINNET_OWNER=0x… npx hardhat run scripts/transfer-mainnet-ownership.ts --network mainnet
# Then Vercel cutover — docs/MAINNET_VERCEL_CUTOVER.md
```
