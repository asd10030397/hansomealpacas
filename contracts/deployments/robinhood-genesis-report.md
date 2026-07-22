# Genesis deploy report — robinhood (stem=robinhood)

- Contract: `0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0`
- Chain ID: 4663
- Deploy tx: `0x5dc031141f478f5211e380c19422ca1a1fde16516b913f17eede98ee23442b2b`
- Deploy block: 15588565
- Deployer: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- Placeholder URI: `ipfs://hansome-genesis/placeholder.json`
- Mint price: 0.0 ETH
- publicStart: 0
- whitelistStart: 0
- merkleRoot: `0x0000000000000000000000000000000000000000000000000000000000000000`
- testnetWhitelistOnly: false
- randomness: VRFRevealAdapter @ `0xeb4Ed2A22974A348a48583658daea3C080e05900`
- reservedTo: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`
- reservedMinted: `true`
- reserveMintStatus: `complete`
- Deployed at: 2026-07-21T13:11:15.030Z

## Reserved allocation (Mainnet)

- `#001` Founder NFT
- `#002`–`#004` Internal Mainnet gameplay testing
- `#005`–`#010` Community giveaways, partnerships, collaborations

Verify:
```bash
npx hardhat run scripts/verify-mainnet-reserved.ts --network mainnet
```

Then continue Game deploy with GENESIS_NFT_ADDRESS from this report.


