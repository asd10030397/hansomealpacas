# HANSOME Genesis 500 — Metadata Package Validation

_Read-only. Package at `public/pixel/genesis/mint/`. Artwork unchanged (approved images copied). No Solidity, not pinned._

**Result: ALL CHECKS PASSED ✅**

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Token coverage 1-500 complete (no gaps) | PASS ✅ | 500/500 |
| 2 | edition === tokenId for all | PASS ✅ | 0 mismatches |
| 3 | image ref scheme ipfs://<CID>/<id>.png for all | PASS ✅ | 0 bad |
| 4 | image file present for all 500 | PASS ✅ | 500/500 present |
| 5 | Type: Public 470 | PASS ✅ | 470 |
| 6 | Type: Legendary 20 | PASS ✅ | 20 |
| 7 | Type: Reserved 10 | PASS ✅ | 10 |
| 8 | Gameplay class distribution == GDS §4.1 | PASS ✅ | King 1 Guardian 5 Farmer 5 Lucky 5 Runner 5 Common 479 |
| 9 | All tokens carry Type + Gameplay Class + ability | PASS ✅ | 0 missing |
| 10 | Public (470) schema complete + rarity block | PASS ✅ | 470/470 |
| 11 | Special 21 class-lock valid (bg matches class) | PASS ✅ | 0 lock errors |
| 12 | Special 21 carry class + background + role + excludedFromRarity | PASS ✅ | 21/21 |
| 13 | Founder #001 uses mascot appearance + King | PASS ✅ | HANSOME Genesis #1 — The Founder King |
| 14 | Reserved commons #2-10 = Common, artwork pending | PASS ✅ | 9/9 |
| 15 | contract.json present (royalties 0) | PASS ✅ | ok |
| 16 | attribute-schema.json present | PASS ✅ | ok |

## Distribution

| Type | Count |
|---|---|
| Public | 470 |
| Legendary | 20 |
| Reserved | 10 |

| Gameplay Class | Count |
|---|---|
| King | 1 |
| Guardian | 5 |
| Farmer | 5 |
| Lucky | 5 |
| Runner | 5 |
| Common | 479 |

## Outstanding (documented, not a blocker)

- Reserved commons **#2–10** artwork is `pending-hand-design` (labelled placeholder tiles in the package); metadata is final.
- Image refs use placeholder `ipfs://__IMAGE_CID__/<id>.png`; bake real CID with `IMAGE_CID=<cid> node scripts-nft/genesis/build-metadata-package.mjs` at pin time.
