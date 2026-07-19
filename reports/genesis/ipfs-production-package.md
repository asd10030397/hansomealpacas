# Season 1 Priority 4 — IPFS Production Package

| Field | Value |
|-------|--------|
| Generated | 2026-07-18 |
| Package | `public/pixel/genesis/collection-550/` |
| Status | **Local validation PASS** · **Pin blocked (no IPFS credentials)** |

---

## Deliverables

| Deliverable | Status |
|-------------|--------|
| Image CID | **Pending** — set `PINATA_JWT` (or local Kubo) then run publish |
| Metadata CID | **Pending** — after Image CID bake + metadata pin |
| Validation report | ✅ `reports/genesis/ipfs-production-validation.md` |
| Issues before Mainnet | See below |

CIDs will be written to `reports/genesis/ipfs-cids.json` when pin succeeds.

---

## 1. Artwork validation — PASS

| Check | Result |
|-------|--------|
| Images 1–550 | **550/550** |
| Dimensions | **1024×1024** (all) |
| Format | **PNG** (all) |
| Alpaca duplicate art | **0** (500 unique alpaca hashes) |
| Cougar art | **50 identical** (expected) + shared `cougar.png` |
| Unique hashes | **501** (500 alpaca + 1 cougar) |

---

## 2. Metadata validation — PASS

| Check | Result |
|-------|--------|
| Metadata 1–550 | **550/550** |
| Token IDs / edition | Match filename |
| Names | Include `#<id>` (Founder King on #1) |
| Side | Alpaca 500 / Cougar 50 |
| Type | Reserved 10 · Legendary 11 · Public 479 · Cougar 50 |
| Classes (1–500) | King 1 · Guardian 5 · Farmer 5 · Lucky 5 · Runner 5 · Common 479 |
| Reserved #001–#010 | Matches locked allocation |
| Founder | #001 · Archetype `Mascot (Founder)` · Class King |
| Image URIs | `ipfs://__IMAGE_CID__/<id>.png` (awaiting bake) |

---

## 3–5. IPFS upload — BLOCKED

No provider available in this environment:

- `PINATA_JWT` — **missing**
- Local Kubo `IPFS_API` — **not reachable**

### Run when credentials are ready

```bash
# One-shot:
node scripts-nft/genesis/publish-550-ipfs.mjs

# Or step-by-step (see public/pixel/genesis/collection-550/IPFS.md):
npm run nft:validate-550-production
npm run nft:pin-550 -- --images
IMAGE_CID=<cid> npm run nft:bake-image-cid
npm run nft:pin-550 -- --metadata
npm run nft:verify-ipfs
```

Put `PINATA_JWT=...` in `.env.local` or `contracts/.env` (never commit).

---

## 6. Sample verification — PENDING

Script ready: `npm run nft:verify-ipfs`  
Samples: `#1, #2, #11, #25, #100, #250, #500, #501, #525, #550`  
Report target: `reports/genesis/ipfs-verify-samples.md`

---

## 7. Testnet integration — READY (manual owner tx)

| Item | Value |
|------|--------|
| Genesis NFT (Robinhood Testnet) | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| Current URI | Placeholder `ipfs://hansome-genesis/placeholder.json` |
| Script | `contracts/scripts/set-genesis-base-uri.ts` |

After Metadata CID exists:

```bash
cd contracts
METADATA_CID=<cid> npx hardhat run scripts/set-genesis-base-uri.ts --network robinhoodTestnet
```

**Reveal note:** Contract `requestReveal` requires `_baseTokenURI` set. Pre-reveal tokens still return placeholder until reveal processing; final `baseURI` must be the Metadata CID folder (`ipfs://<METADATA_CID>/` → `tokenURI = baseURI + id + ".json"`).

**Do not freeze** until post-reveal URI is confirmed on wallets/explorers.

Minted test tokens today (`#011`, `#012`) will show final art/metadata only after baseURI + reveal path resolves their on-chain identities — off-chain package IDs are provenance layout, not the sale shuffle map.

---

## Tooling added (this Priority)

| Script | npm |
|--------|-----|
| `scripts-nft/genesis/validate-550-production.mjs` | `nft:validate-550-production` |
| `scripts-nft/genesis/bake-550-image-cid.mjs` | `nft:bake-image-cid` |
| `scripts-nft/genesis/pin-550-ipfs.mjs` | `nft:pin-550` |
| `scripts-nft/genesis/verify-550-ipfs.mjs` | `nft:verify-ipfs` |
| `scripts-nft/genesis/publish-550-ipfs.mjs` | (node directly) |
| `contracts/scripts/set-genesis-base-uri.ts` | hardhat run |
| `public/pixel/genesis/collection-550/IPFS.md` | docs |

---

## Issues / checklist before Mainnet

1. **Pin credentials** — add `PINATA_JWT` (or run Kubo) and complete publish to obtain Image + Metadata CIDs.
2. **Placeholder pin** — production pre-reveal should use a real pinned placeholder JSON/image (current deploy uses temporary fake URI).
3. **`contract.json` fee_recipient** — still `0x<treasury>`; set real treasury before marketplace listing.
4. **Reveal shuffle vs package IDs** — document clearly for ops: IPFS folder uses fixed 1–500/501–550 layout; on-chain `tokenURI(id)` points at the JSON for that token id after shuffle assignment is baked into those JSON files at reveal prep (confirm ops plan if metadata must be rebuilt post-shuffle — **current package is off-chain provenance layout**; if reveal assigns different identities per token id, a post-shuffle metadata rebuild may be required before final pin).
5. **Do not reuse testnet merkle / proofs on mainnet.**
6. **Images are gitignored** — ensure CI/ops machines have the full `collection-550/image/` folder before pin.
7. **Freeze metadata** only after wallet/OpenSea-style viewers confirm art + traits.

### Critical ops clarification (identity) — Mainnet gate

Per Genesis Mint Spec §6 / reveal shuffle:

- `tokenURI(id) = baseURI + id + ".json"` must show the **post-shuffle identity** for that `tokenId`.
- Current `collection-550` layout (`1–500` Alpaca / `501–550` Cougar) is the **provenance identity catalog**, not the sale shuffle map.
- **Reserved `#001–#010`** match on-chain reserved identities (safe to treat as fixed).
- **Sale `#011–#550`** require a **post-shuffle metadata bake** (map each tokenId → identity JSON + `image` → Image CID file) **before** the final Metadata CID is pinned and set as `baseURI`.

Recommended production sequence:

1. Pin **images** now (stable Image CID) — done once identities/art are locked.
2. At reveal: apply shuffle → write `metadata/<tokenId>.json` for all 550 → pin Metadata CID → `setBaseURI` → freeze after verification.

Pinning the current provenance metadata folder as contract `baseURI` is OK only for **off-chain package QA**, not as the final revealed sale mapping.

---

## Next action for you

1. Add `PINATA_JWT` to `.env.local` (or start Kubo).
2. Reply **“pin IPFS”** (or run `node scripts-nft/genesis/publish-550-ipfs.mjs`).
3. Then run testnet `set-genesis-base-uri` with the Metadata CID.
