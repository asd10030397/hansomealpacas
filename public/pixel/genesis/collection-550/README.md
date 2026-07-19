# Genesis collection-550 (off-chain)

- Tokens **1–500**: Alpacas
- Tokens **501–550**: Cougars (shared art)
- This package is for asset management, validation, IPFS, and provenance.
- On-chain mint/reveal topology is unchanged (reserved #001–#010; sale #011–#550 shuffled at reveal).

## IPFS production

See [IPFS.md](./IPFS.md) and `reports/genesis/ipfs-production-package.md`.

```bash
npm run nft:validate-550-production
npm run nft:publish-550   # requires PINATA_JWT or local Kubo
```
