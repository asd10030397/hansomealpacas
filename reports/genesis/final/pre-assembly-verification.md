# HANSOME Genesis — Pre-Assembly Verification

_Read-only. Public 470 art/metadata untouched; nothing generated. Verifies the 6 areas required before final assembly._

**Result: ALL CHECKS PASSED ✅ — ready to assemble on approval**

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Reserved allocation = 10 (IDs 1-10) | PASS ✅ | 10 entries, ids 1-10 |
| 2 | Founder is #001 + uses mascot appearance | PASS ✅ | founder id=1 |
| 3 | Token #1 metadata = Reserved/Founder/mascot | PASS ✅ | HANSOME Genesis #1 — Founder |
| 4 | Reserved #2-10 have non-founder roles (team/community/partners/ecosystem) | PASS ✅ | team, team, community-events, community-events, partnerships, partnerships, future-ecosystem-rewards, future-ecosystem-rewards, future-ecosystem-rewards |
| 5 | Public pool range = 31-500 (470 ids) | PASS ✅ | 470 ids, 31-500 |
| 6 | All 470 public have art + metadata + type=Public | PASS ✅ | meta 470, art 470, type 470 |
| 7 | No public token in IDs 1-30 | PASS ✅ | min public id = 31 |
| 8 | Gameplay class distribution matches GDS §4.1 | PASS ✅ | King 1, Guardian 5, Farmer 5, Lucky 5, Runner 5, Common 479 (sum 500) |
| 9 | Special 21 = King1 + Guardian5 + Farmer5 + Lucky5 + Runner5 | PASS ✅ | {"King":1,"Guardian":5,"Farmer":5,"Lucky":5,"Runner":5} |
| 10 | Public metadata schema complete (10 attrs + rarity block) | PASS ✅ | 470/470 conform |
| 11 | Special-21 staging metadata carries class + background + archetype | PASS ✅ | 21/21 |
| 12 | Deterministic seed present | PASS ✅ | seed 20260717 |
| 13 | 470 unique public combos (uniqueness enforced) | PASS ✅ | 470 unique / 470 |
| 14 | Reserved(1-10) + Legendary(11-30) excluded from random pool | PASS ✅ | candidate id set starts at 31 |
| 15 | Compatibility: 0 Beanie↔Ears violations | PASS ✅ | 0 |
| 16 | Compatibility: 0 Scarf↔Neck violations | PASS ✅ | 0 |
| 17 | Compatibility: 0 Ribbon↔Neck violations | PASS ✅ | 0 |
| 18 | Special backgrounds class-locked (21/21) | PASS ✅ | 0 lock errors |
| 19 | No public token uses a special background | PASS ✅ | 0 of 470 |
| 20 | Special-21 artwork present in staging (ready to place) | PASS ✅ | 21/21 png in genesis/special/ |

## Outstanding dependency (not a blocker for the plan)

- Reserved **#2-10** (2, 3, 4, 5, 6, 7, 8, 9, 10) are Common-class one-of-ones whose artwork is still `pending-hand-design`. Metadata slots exist; only the images are outstanding.
- Founder **#001** and Legendary **#11-30** artwork is READY in `public/pixel/genesis/special/` and will be placed into the collection during assembly.
