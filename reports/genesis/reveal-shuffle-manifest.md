# Reveal shuffle manifest

Generated: 2026-07-18T21:11:32.279Z

- Image CID: `bafybeib577pwjkf5feztkjyf4m5exlodr7mx4zchf7rsmxb46zfeslzn3m`
- Reveal seed: `0x7e764e44e6fc2f7e7a90072e6345ded047ed8e39c53f60bdcba46b78e4163d35`
- Sale identity commitment: `0x37a7b2080cbd2b26841c70b764379d11531a837fb92e0fbceab99aa41780f2bb`
- Output: `public/pixel/genesis/collection-550/reveal-metadata/`

## Samples

- #1: packageIdentity=1 · Alpaca/King · HANSOME Genesis #1 — The Founder King
- #2: packageIdentity=2 · Alpaca/Guardian · HANSOME Genesis #2 — Reserved Special (Guardian)
- #10: packageIdentity=10 · Alpaca/Runner · HANSOME Genesis #10 — Reserved Special (Runner)
- #11: packageIdentity=111 · Alpaca/Common · HANSOME Genesis #11
- #12: packageIdentity=44 · Alpaca/Common · HANSOME Genesis #12
- #100: packageIdentity=416 · Alpaca/Common · HANSOME Genesis #100
- #250: packageIdentity=465 · Alpaca/Common · HANSOME Genesis #250
- #500: packageIdentity=351 · Alpaca/Common · HANSOME Genesis #500
- #501: packageIdentity=132 · Alpaca/Common · HANSOME Genesis #501
- #550: packageIdentity=150 · Alpaca/Common · HANSOME Genesis #550

## Ops

1. Pin `reveal-metadata/` → METADATA_CID
2. `setBaseURI(ipfs://METADATA_CID/)` before requestReveal
3. Mock `fulfill(requestId, revealSeed)` with the seed above
4. `processReveal` until collectionRevealed
