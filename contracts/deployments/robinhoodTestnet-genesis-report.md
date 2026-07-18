# Genesis deploy report — robinhoodTestnet

**Status:** Deployed + bootstrapped + smoke-tested (WL + public).  
**Mainnet:** not deployed.  
**Assets:** temporary placeholder URI only — not final IPFS.

## Contract

| Field | Value |
|-------|--------|
| Address | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| Chain ID | `46630` (Robinhood Chain Testnet) |
| Deploy tx | `0x920c33055b4d57bed35fe6cae4dda0ddedde8880956c102f29c78b2dceeee7cb` |
| Deploy block | `91295262` |
| Deployer | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| Randomness | `RevealRandomnessMock` @ `0x76CeFc07dC066114cF65BF8B6bA123B7e493FeCF` |
| Placeholder URI | `ipfs://hansome-genesis/placeholder.json` |
| Mint price | `0.001` ETH |
| publicStart | `1784395020` |
| whitelistStart | `1784391420` |
| Merkle root | `0xd99a380240a4ef52e77ed44fb3d450e7e1af60d2d093eb8de06e82b998035ccf` |

Explorer: https://explorer.testnet.chain.robinhood.com/address/0x43c1d6aF194A796EC612F2bAC04085a409A1347C

## Sale bootstrap

- Sale identity commitment set + locked
- Reserved `#001`–`#010` minted to deployer
- Testnet-only merkle (deployer/treasury wallet)
- Short WL window (~10 min) then public
- **WARNING:** Merkle root/proofs are **TESTNET ONLY** — do not reuse on mainnet

## Smoke tests (on-chain)

| Check | Result |
|-------|--------|
| Connect / signer | Pass (`0xcE15…069A`) |
| `name()` | `HANSOME Genesis NFT` |
| `totalMinted()` after reserve | `10` |
| `tokenURI(1)` / metadata URI | `ipfs://hansome-genesis/placeholder.json` |
| `whitelistMint` | Pass — tx `0x368536e94768fe9918ea78565e4a8a296cde1af0478851f508e2b39b941c79d2` (block `91295608`) → minted `#011` |
| `publicMint(1)` | Pass — tx `0x361146c9704f5beb865dbaabe6084b796f5ed34eea1ff0a989798cac2b2b57b9` (block `91296471`) → minted `#012` |
| `totalMinted()` after tests | `12` |

## Frontend sync

- `.env.local`: `NEXT_PUBLIC_GENESIS_NFT_ADDRESS=0x43c1d6aF194A796EC612F2bAC04085a409A1347C`
- Testnet WL proofs: `lib/game/testnet/whitelistProofs.TESTNET-ONLY.json`
- `/game/mint` wired for connect, supply reads, WL/public mint, pending/success/error states

## Notes

- Initial automated bootstrap hit a 1s timelock race on `executeMintPrice`; recovered via `finish-genesis-bootstrap.ts`. Deploy script wait buffer increased for future runs.
- UI wallet connect requires an injected wallet on chain `46630` (restart `npm run dev` to pick up `.env.local`).
