# HANSOME ALPACAS Token ($HANSOME)

Production-ready fixed-supply ERC-20 for **Hansome Alpacas** on **Robinhood Chain**.

| Property | Value |
| -------- | ----- |
| Name | Hansome Alpacas |
| Symbol | HANSOME |
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

## Wallet architecture (reused from UGLY DEER — do not create new wallets)

HANSOME ALPACAS reuses the exact same 4-wallet setup as UGLY DEER. No new
wallets, mnemonics, or private keys are generated for this relaunch — only
the token contract and its Uniswap v4 pool are new.

| Role | Env var | Used by |
| ---- | ------- | ------- |
| Deployment Wallet | `DEPLOYER_PRIVATE_KEY` | `deploy.ts` — deploys `HansomeAlpacas.sol` and signs contract verification |
| Treasury Wallet | `TREASURY_PRIVATE_KEY` | `create-v4-pool.ts`, `remove-v4-liquidity.ts` — holds treasury funds and manages the Uniswap v4 liquidity position |
| Liquidity Wallet | *(no separate key in this repo)* | Liquidity position lives at the address tracked on the [transparency page](../content/transparency.ts); pool scripts operate through the Treasury signer above |
| Founder Wallet | `TOKEN_RECIPIENT` (address only, no private key needed here) | Receives its share of the minted supply at deploy time |

If deploy/pool scripts need changes later, extend the existing signer
helpers in `scripts/lib/signer.ts` — do not introduce new private-key env
vars or additional wallets.

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

### Genesis NFT (testnet)

```bash
# 1) Fund the deployer with testnet ETH:
#    https://faucet.testnet.chain.robinhood.com/
#    (set DEPLOYER_PRIVATE_KEY, or TREASURY_PRIVATE_KEY is used as fallback)

# 2) Deploy + bootstrap public sale (60s timelock on testnet):
npx hardhat run scripts/deploy-genesis.ts --network robinhoodTestnet

# 3) Sync address into the Next.js app:
npx hardhat run scripts/sync-genesis-env.ts --network robinhoodTestnet
```

Writes `deployments/robinhoodTestnet-genesis.json`. Sale identity bytes are
saved as `*-genesis-identities.bin` (gitignored — needed for later reveal).

### Gameplay suite (testnet)

```bash
# Requires Genesis deploy + deployer ETH. Uses reserved NFT #1–#10 identities.
# Funds GameTreasury via a dedicated HansomeAlpacas mint (deployer has 0 of the
# public testnet HANSOME); set GAME_TOKEN_ADDRESS to reuse another ERC-20.
npx hardhat run scripts/deploy-game.ts --network robinhoodTestnet

# Sync Next.js env (game + distributor addresses):
npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet

# Live Commit → Reveal → Settle → Claim (resumable).
# Before Commit: requires CommitOpen — aborts immediately if Commit already ended
# (does not wait for the Commit window to close). For next-round auto-start:
#   set GAME_FLOW_AUTO_NEXT=1
npx hardhat run scripts/validate-game-flow.ts --network robinhoodTestnet
```

Writes `deployments/robinhoodTestnet-game.json`.


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
2. Set `TOKEN_RECIPIENT` to the address that should receive all 1B HANSOME.
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
HANSOME_ALPACAS_ADDRESS=0x...
TOKEN_RECIPIENT=0x...
```

Then run the matching `verify:*` script.

## Security notes

- Review the single source file: `contracts/HansomeAlpacas.sol`
- Use a hardware wallet or secure key management for mainnet deployment
- Confirm `TOKEN_RECIPIENT` before broadcasting
- There is no recovery mechanism — supply allocation is permanent at deploy time

## License

MIT
