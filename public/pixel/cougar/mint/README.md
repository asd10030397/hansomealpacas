# HANSOME Cougars — identity package (inside Genesis)

**Mint topology:** Cougars are **not** a separate collection. They mint only through **HANSOME Genesis NFT** (550 = 500 Alpaca + 50 Cougar). See:

- `docs/HANSOME_Genesis_Mint_Spec_v1.0.md`
- `docs/HANSOME_Cougar_Mint_Spec_v1.0.md`
- `docs/HANSOME_Contract_Architecture_v1.0.md`

## Contents

- `image/cougar.png` — the ONE official base, shared by all 50 Cougar identities (1024×1024).
- `metadata/1.json…50.json` — **legacy template** (serial Cougar-only ids). Must be merged into the Genesis 550 package with placeholder + reveal; do not treat these ids as the final Genesis tokenIds.
- `metadata/contract.json` — collection royalty **500 bps (5%)**; name aligned to Genesis.
- `allocation-map.json` — **obsolete for sale topology** (was 40/5/5 under the retracted separate-contract model).

## IPFS (final path is Genesis merge)

Final pin/freeze follows the Genesis Mint Spec (placeholder URI → reveal → freeze). This folder remains the Cougar art + JSON template source until the 550 merge runs.

No Solidity in this package.
