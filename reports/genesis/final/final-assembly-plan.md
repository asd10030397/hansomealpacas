# HANSOME Genesis 500 — Final Collection Assembly Plan

**Status:** PLAN ONLY — no final generation performed. Awaiting assembly approval.
**Guardrail:** The Public 470 pipeline (art + metadata for IDs 31–500) remains **untouched** until approval. The assembly step is designed to be additive/idempotent — it never re-rolls or overwrites public tokens.
**Verification backing this plan:** `reports/genesis/final/pre-assembly-verification.md` — **20/20 checks PASS ✅** (read-only, ran against the real files).

---

## 0. What "assembly" means here

Every art + metadata piece already exists in one of three states. Assembly is the final **merge + relabel + validate** pass that turns the three pools into one coherent, mint-ready 500 set. It does **not** create new random alpacas.

| Pool | Token IDs | Art status today | Metadata status today |
|---|---|---|---|
| Public | 31–500 (470) | ✅ final, rendered | ✅ final (10 attrs + rarity) |
| Special 21 (Founder + Legendary) | 1, 11–30 (21) | ✅ ready in `genesis/special/` (approved) | ⏳ staging only (`_special-metadata.json`) — not yet merged into collection slots |
| Reserved (non-founder) | 2–10 (9) | ⏳ `pending-hand-design` placeholder tile | ✅ placeholder metadata (Reserved) |

**Net:** on assembly, 491/500 tokens get final artwork (470 public + 21 special). The only outstanding artwork is the **9 reserved commons (#2–10)**, which stay as labelled placeholders until hand-designed (metadata slots already exist).

---

## 1. Founder Reserve 10 allocation ✅

IDs **1–10** are held out of the random pool up front. Founder #001 is **one of** the ten (not an extra).

| ID | Role | Class | Art source on assembly |
|---|---|---|---|
| 1 | **Founder** (uses iconic mascot appearance) | King | `genesis/special/001.png` |
| 2, 3 | Team | Common | pending hand-design |
| 4, 5 | Community events | Common | pending hand-design |
| 6, 7 | Partnerships | Common | pending hand-design |
| 8, 9, 10 | Future ecosystem rewards | Common | pending hand-design |

- IP note preserved: minting/owning Founder #001 does **not** transfer the mascot/brand/IP.

## 2. Public mint pool ✅

- Range **31–500**, exactly **470** tokens; all have art + metadata + `type=Public`; none fall in 1–30.
- Deterministic (seed `20260717`), **470/470 unique** trait combinations.
- **Untouched by assembly.**

## 3. Gameplay Class distribution ✅ (matches GDS §4.1 exactly)

| Class | Count | Token IDs |
|---|---|---|
| King | 1 | #1 |
| Guardian | 5 | #11–15 |
| Farmer | 5 | #16–20 |
| Lucky | 5 | #21–25 |
| Runner | 5 | #26–30 |
| Common | 479 | 470 public (31–500) + 9 reserved (#2–10) |
| **Total** | **500** | |

`1 + 5 + 5 + 5 + 5 + 479 = 500`. The 20 Legendary (#11–30) are exactly the 20 non-King special classes; Founder #001 is the single King.

## 4. Metadata structure ✅

Unified per-token JSON at `public/pixel/genesis/metadata/{id}.json`.

**Public (31–500) — already final:**
```
name, description, image: "genesis/{id}.png", edition,
attributes[]: Background, Archetype, Wool, Clothing, Neck Accessory, Mouth, Ear Accessory, Glasses, Hat, Effect,
hansome: { type:"Public", archetype, comboHash, rarityRank, rarityScore, rarityOutOf:470 }
```

**Special (1, 11–30) — to be UPGRADED on assembly** from the staging spec (`special-21-allocation.json` + `special/_special-metadata.json`). Proposed final shape:
```
name: "HANSOME Genesis #{id} — {roleName}",
description: lore,
image: "genesis/{id}.png",   // repointed to the placed special art
edition: id,
attributes[]: Type (Reserved|Legendary), Gameplay Class, Background, Archetype, [Class Accent],
hansome: { type, gameplayClass, specialBackground, baseArchetype, role, excludedFromRarity:true, usesMascotAppearance:(id===1) }
```

**Reserved #2–10 — unchanged** (Reserved placeholder metadata; artwork pending).

## 5. Random assignment rules ✅

- Weighted draw (`mulberry32`, seed `20260717`) over ready trait items; per-category `none` weights for optional layers.
- Compatibility suppression applied at draw time (see §6).
- Uniqueness enforced via `sha256` of sorted trait-id list (≤500 attempts/token).
- Reserved (1–10) + Legendary (11–30) removed from the candidate id set **before** drawing — specials are **manual/deterministic**, never random.

## 6. Trait compatibility ✅

Enforced in generation and re-verified against the 470 picks — **0 violations**:

| Rule | Violations |
|---|---|
| Wool Beanie (covers-ears) suppresses Ear Accessories | 0 |
| Cozy Wool Scarf (covers-neck) suppresses Neck Accessories | 0 |
| Festival Ribbon (covers-chest) suppresses Neck Accessories | 0 |
| Special backgrounds class-locked (21/21) | 0 lock errors |
| No public token uses a special background | 0 of 470 |

---

## 7. Assembly procedure (to run ONLY after approval)

A new `scripts-nft/genesis/assemble-final.mjs` will, in order:

1. **Pre-flight:** run `verify-assembly.mjs`; abort if any check fails.
2. **Place special art (additive):** copy `genesis/special/{001,011..030}.png` → `genesis/{1,11..30}.png`, replacing only those placeholder tiles. Public tiles (31–500) are never written.
3. **Upgrade special metadata:** rewrite `metadata/{1,11..30}.json` using the §4 special shape sourced from `special-21-allocation.json`. Founder #001 keeps `type:"Reserved"`; #11–30 keep `type:"Legendary"`.
4. **Leave public + reserved #2–10 as-is** (no rewrite).
5. **Validate final set:** 500 art + 500 metadata present; class distribution = GDS; class-lock holds; public uniqueness/compat unchanged; every special image path resolves.
6. **Regenerate reports/preview:** refresh `validation-report.md`, `trait-distribution-report.md`, `rarity-report.md`, `metadata-summary.md`, and rebuild `_COLLECTION-PREVIEW.png` now showing real special art.
7. **Output:** a single `final-assembly-report.md` with before/after counts.

**Still excluded (per your standing rules):** no minting, no blockchain assets, no on-chain metadata pinning.

## 8. Known outstanding item (surfaced, not blocking the plan)

- **Reserved #2–10 artwork** (9 Common one-of-ones) is still `pending-hand-design`. The final 500 can be assembled and previewed now with these as labelled placeholders; they can be dropped in later without touching any other token. Decide at approval whether to: (a) ship placeholders for now, or (b) hand-design them before final assembly.

---

**Ready for your approval.** On "go", I run the assembly procedure above; until then nothing in `public/pixel/genesis/` changes.
