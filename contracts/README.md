# UGLY DEER Token ($UGLY)

Production-ready fixed-supply ERC-20 for **Ugly Deer** on **Robinhood Chain**.

| Property | Value |
| -------- | ----- |
| Name | Ugly Deer |
| Symbol | UGLY |
| Decimals | 18 |
| Max supply | 1,000,000,000 |
| Standard | OpenZeppelin ERC-20 |

## Design

This token is intentionally minimal:

- Fixed supply minted once at deployment
- No mint function after deployment
- No blacklist or whitelist
- No transfer tax
- No owner/admin controls
- No honeypot or hidden logic

The entire supply is sent to `TOKEN_RECIPIENT` in the constructor.

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
cd contracts
npm install
cp .env.example .env
```

Edit `.env`:

```env
PRIVATE_KEY=0x...
TOKEN_RECIPIENT=0x...
RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com
RH_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
```

Never commit real private keys.

## Commands

```bash
npm run compile
npm test
npm run deploy:robinhood-testnet
npm run deploy:robinhood
npm run verify:robinhood-testnet
npm run verify:robinhood
```

Deployment details are saved to `deployments/<network>.json`.

## Robinhood Chain networks

| Network | Chain ID | RPC |
| ------- | -------- | --- |
| Robinhood Chain (mainnet) | 4663 | `https://rpc.mainnet.chain.robinhood.com` |
| Robinhood Chain Testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` |

Block explorers:

- Mainnet: https://robinhoodchain.blockscout.com
- Testnet: https://explorer.testnet.chain.robinhood.com

Testnet ETH faucet: https://faucet.testnet.chain.robinhood.com

## Deploy

1. Fund the deployer wallet with ETH on the target network.
2. Set `TOKEN_RECIPIENT` to the address that should receive all 1B UGLY.
3. Deploy to testnet first:

```bash
npm run deploy:robinhood-testnet
```

4. Verify:

```bash
npm run verify:robinhood-testnet
```

5. Repeat on mainnet when ready:

```bash
npm run deploy:robinhood
npm run verify:robinhood
```

## Verify manually

If needed, pass the deployed address explicitly:

```env
UGLY_DEER_ADDRESS=0x...
TOKEN_RECIPIENT=0x...
```

Then run the matching `verify:*` script.

## Security notes

- Review the single source file: `contracts/UglyDeer.sol`
- Use a hardware wallet or secure key management for mainnet deployment
- Confirm `TOKEN_RECIPIENT` before broadcasting
- There is no recovery mechanism — supply allocation is permanent at deploy time

## License

MIT
