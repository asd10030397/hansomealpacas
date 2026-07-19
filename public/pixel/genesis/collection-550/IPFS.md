# Collection-550 IPFS + reveal bake (Robinhood Testnet)

## Canonical flow

```bash
# Requires PINATA_JWT in contracts/.env or .env.local (never commit)
npm run nft:publish-reveal
```

Order:

1. Validate production artwork/metadata  
2. Pin `image/` (550 PNGs + `cougar.png` + `placeholder.png`) → **Image CID**  
3. Build sale deck matching on-chain packed identities  
4. Fisher–Yates shuffle for sale `#011–#550` (seed recorded)  
5. Keep reserved `#001–#010` fixed  
6. Bake `reveal-metadata/<tokenId>.json` with Image CID + mapping  
7. Validate reveal package  
8. Pin `reveal-metadata/` → **Metadata CID**  
9. Pin real `placeholder.json` URI  
10. Gateway-verify samples (Pinata-first; no re-pin)  

CIDs: `reports/genesis/ipfs-cids.json`  
Shuffle: `reports/genesis/reveal-shuffle-manifest.json`

### Re-verify only (no upload)

```bash
npm run nft:verify-reveal
```

Uses `https://gateway.pinata.cloud/ipfs` by default, retries 502/504 / “no providers” with exponential backoff, and reports **package integrity** separately from **gateway availability**. Does not regenerate CIDs.

## On-chain (Testnet)

```bash
cd contracts
METADATA_CID=<cid> npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet
PLACEHOLDER_URI=ipfs://<placeholderCid>/placeholder.json \
  npx hardhat run scripts/set-genesis-placeholder-uri.ts --network robinhoodTestnet
```

`tokenURI` stays on the placeholder until `collectionRevealed`.  
`requestReveal` requires 540 sale mints. Mock fulfill must use the manifest `revealSeed`.

## Env

| Variable | Purpose |
|----------|---------|
| `PINATA_JWT` | Pinata JWT (required for pin) |
| `REVEAL_SEED` | Optional; reuse a prior seed |
| `FEE_RECIPIENT` | Written into baked `contract.json` (confirm before Mainnet) |
| `SKIP_PIN_IMAGES=1` | Reuse Image CID from `ipfs-cids.json` |
| `SKIP_PIN_METADATA=1` | Reuse Metadata CID |
| `IPFS_GATEWAY` | Override preferred verify gateway (default Pinata) |
| `SKIP_PUBLIC_GATEWAY=1` | Skip informational ipfs.io smoke in verify |

## Important

- Provenance catalog `metadata/` is **not** the final sale `baseURI` package.  
- Final package is **`reveal-metadata/`** after shuffle bake.  
- Do not expose `PINATA_JWT` in logs, commits, or frontend.  
