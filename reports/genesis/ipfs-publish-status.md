# IPFS Publish Status — Robinhood Testnet

| Field | Value |
|-------|--------|
| Updated | 2026-07-19 |
| Production package validation | **PASS** |
| Image / Metadata pin | **Done** (see `ipfs-cids.json`) |
| Gateway verify | Pinata-first + retries (`npm run nft:verify-reveal`) |
| setBaseURI / placeholder | **PASS** — see `robinhood-testnet-validation.md` |
| Mint + URI verify | **PASS** (15 minted; pre-reveal placeholder) |
| Game settle+claim | In progress (RevealClosed wait) |

---

## Blocker

`PINATA_JWT` is **not** present in `.env.local` or `contracts/.env`.

Owner key for testnet txs **is** available (`DEPLOYER_PRIVATE_KEY` / treasury fallback).

### Configure (do not commit)

Add to `contracts/.env` or `.env.local`:

```
PINATA_JWT=<your Pinata JWT>
```

Then run:

```bash
npm run nft:publish-reveal
```

That command executes the approved order:

1. Validate 550 artwork  
2. Pin `image/` (incl. `placeholder.png`) → **Image CID**  
3–5. Fisher–Yates reveal shuffle for `#011–#550` (reserved `#001–#010` fixed) + bake Image CID  
6. Validate reveal metadata  
7–8. Pin `reveal-metadata/` → **Metadata CID** + pin real placeholder URI  
9. Gateway verify stratified samples  
10. Print setBaseURI / placeholder commands  

---

## Offline work already completed

| Artifact | Path |
|----------|------|
| Shuffle FY engine | `scripts-nft/genesis/lib/reveal-fy.mjs` |
| Bake script | `scripts-nft/genesis/bake-550-reveal-metadata.mjs` |
| Validate reveal | `scripts-nft/genesis/validate-550-reveal-metadata.mjs` |
| Pin helper | `scripts-nft/genesis/pin-directory-ipfs.mjs` |
| Full publish | `scripts-nft/genesis/publish-550-reveal-ipfs.mjs` |
| Gateway verify | `scripts-nft/genesis/verify-550-reveal-ipfs.mjs` |
| Dry-run manifest | `reports/genesis/reveal-shuffle-manifest.json` *(seed for dry-run only — republish regenerates unless `REVEAL_SEED` set)* |
| Dry-run validation | `reports/genesis/reveal-metadata-validation.md` → **PASS** |

Sale deck matches on-chain `buildSaleIdentities()`:

- 50 Cougar (`501–550`)  
- 479 Public Common  
- 11 Legendary (3 Guardian / 3 Farmer / 3 Lucky / 2 Runner)  
- Reserved 1–10 never enter the sale deck  

---

## After pin succeeds — on-chain (Testnet only)

```bash
cd contracts

# Final metadata base URI (immediate; before requestReveal)
METADATA_CID=<cid> npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet

# Real placeholder (timelocked ~60s on testnet)
PLACEHOLDER_URI=ipfs://<placeholderCid>/placeholder.json \
  npx hardhat run scripts/set-genesis-placeholder-uri.ts --network robinhoodTestnet
```

### Reveal / shuffle on-chain caveat

`requestReveal` requires **sale sell-out (540)**. Current smoke deploy has only a few mints (~12).  
Therefore:

- **Now:** pin CIDs + `setBaseURI` + real placeholder + off-chain gateway verify of shuffled JSON  
- **Full on-chain shuffle verify** (tokenURI → shuffled traits): needs sell-out, then `requestReveal` + mock `fulfill(revealSeed)` + `processReveal`

Recorded `revealSeed` in the manifest must match mock fulfill.

### Mainnet gates (not now)

- Confirm `contract.json` `fee_recipient` is final treasury (testnet uses deployer treasury)  
- Do **not** deploy Mainnet  
- Do **not** reuse testnet merkle / seeds on Mainnet  

---

## Deliverables checklist

| Deliverable | Status |
|-------------|--------|
| Final Image CID | Pending Pinata |
| Final Metadata CID | Pending Pinata |
| Shuffle manifest / seed | Dry-run ready; final on publish |
| IPFS verification report | Pending pin |
| Testnet setBaseURI tx | Pending CID + owner run |
| Test mint verification report | Pending (placeholder now; full reveal after sell-out) |
