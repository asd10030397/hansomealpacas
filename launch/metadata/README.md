# Token Metadata

Planning folder for UGLY DEER token metadata **before** any on-chain deployment.

**Status:** Draft structure only. Nothing in this folder has been uploaded to Arweave, IPFS, or Solana.

## Files

| File | Purpose |
| ---- | ------- |
| [token.json](./token.json) | Draft JSON metadata (name, symbol, image URI, attributes) |
| [ASSETS.md](./ASSETS.md) | Required image assets and dimensions |

## Usage (future — not now)

When the token is ready for launch:

1. Finalize copy in `token.json` (description, links, creators if any)
2. Confirm all image URIs are live and immutable (see [ASSETS.md](./ASSETS.md))
3. Host JSON at a permanent URI (IPFS / Arweave / trusted CDN — decision TBD)
4. Point SPL token metadata (Metaplex or equivalent) at that URI during mint
5. Record `mint_address` and `metadata_uri` in `token.json` → `_planning` block

**Do not mint or spend SOL from this planning step.**

## Field reference

| Field | Current value | Notes |
| ----- | ------------- | ----- |
| `name` | UGLY DEER | Display name |
| `symbol` | UGLY DEER | Ticker |
| `description` | Short tagline | Match site tone |
| `image` | logo-512.png URL | Primary icon for wallets/explorers |
| `external_url` | kairu.lol | Official site |
| `attributes` | Chain, decimals, supply | Informational only |
| `extensions` | Social links | Update telegram when live |

## Validation checklist (pre-upload)

- [ ] JSON validates (no trailing commas)
- [ ] `image` URL returns 200 and matches expected hash
- [ ] `external_url` matches production site
- [ ] No investment or guaranteed return language in `description`
- [ ] `_planning.deployed` set to `true` only after mainnet mint

---

© 2026 UGLY DEER
