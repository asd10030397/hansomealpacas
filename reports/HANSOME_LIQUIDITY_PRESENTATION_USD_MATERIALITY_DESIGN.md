# HANSOME — Presentation USD Materiality Threshold (Design Only)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | **DESIGN ONLY — do not implement** |
| **Goal** | Evaluate optional USD floor to exclude economically tiny pools from **Presentation cards** while keeping detection / internal inventory unchanged |
| **Code / deploy** | **NONE** |

Related:

- Inventory materiality: `lib/hansome-score/lp/pool-materiality.ts`
- Multi-pool presentation: `lib/hansome-score/lp/presentation.ts`
- UX polish (shipped separately): `reports/HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX.md`
- Proof cases: FOX dust (`HANSOME_FOX_DUST_*`), GME dual-card (`HANSOME_GME_0xc2362aff_LIQUIDITY_INVESTIGATION.md`)

---

## 1. Current materiality (inventory-based)

### Classifier (`classifyPoolInventoryMateriality`)

| Signal | Rule (today) |
|--------|----------------|
| Raw scanned-token / quote balance | Material if **≥ `MIN_MATERIAL_POOL_TOKEN_BALANCE` (1000 wei/units)** |
| Optional reliable per-pool USD | Material if **≥ `MIN_MATERIAL_POOL_USD` (1)** when present |
| Failed / missing reads | `inventory_unknown` — **not** auto-material |
| Factory existence alone | Not material |

Presentation stubs are emitted only for `material` pools (`isPresentationMaterial`). Dust stays in discovery / technical counts.

### Gap

Inventory floors catch **1 wei** dust (FOX/USDG) but **not** “economically ~$0 with raw ≥ 1000” stubs — e.g. GME V2 pair with ~5e-11 ETH / negligible USD while still `material` by raw balance. Those stubs force **≥2 presentation cards** → PR1 nulls per-card USD (now surfaced as “Included in Total Liquidity”, but single-pool attribution remains blocked).

`MIN_MATERIAL_POOL_USD = 1` already exists but is rarely usable at adapter time because **reliable per-pool USD is usually unavailable** during discovery (adapters do not invent USD from raw L).

---

## 2. Proposed optional USD threshold (Presentation-only)

### Intent

Add a **Presentation-layer filter** (not a detection change):

> If a pool is inventory-material but its **reliable USD value** (when known) is below a Presentation floor `P`, omit it from **presentation cards** / treat as presentation-dust. Keep it in internal discovery inventory, technical details, and adapter `poolsFound` bookkeeping.

### Suggested shape (future PR — not now)

| Piece | Proposal |
|-------|----------|
| Constant | e.g. `MIN_PRESENTATION_POOL_USD` — candidate band **$1 – $50** (see §5); default suggestion **$10** gated behind feature flag or config |
| When USD known and `< floor` | Exclude from `buildPresentationPools` / stub emission for cards only |
| When USD **unknown** | **Do not exclude** solely on missing USD — avoid hiding real pools that lack pricing |
| Detection / `pools[]` / dust counts | Unchanged — still discovered |
| Scoring / lock math | Unchanged — never retune from presentation filter |
| Per-pool USD invention | Still forbidden — only use existing reliable USD fields |

### Placement options (pick in implementation PR)

| Option | Pros | Cons |
|--------|------|------|
| **A. Presentation only** (`buildPresentationPools` / materialPositions filter) | Clearest “UI only”; detection untouched | Cards may disagree with adapter `material` counts unless UI maps carefully |
| **B. Adapter stub gate with separate `presentationMaterial` flag** | Explicit API field for cards vs discovered | Touches adapters; higher regression surface |
| **C. Raise inventory floor only** | Simple | Hurts high-decimal / low-unit tokens; does not encode USD economics |

**Preferred:** **A** (or A + thin flag on hits) — Presentation exclusion, discovery unchanged.

---

## 3. Keep detection / internal inventory unchanged

Hard constraints for any future implementation:

1. Factory discovery still records the pool (discovered / dust / inventory_unknown taxonomy preserved).
2. Technical Details may still list discovered pool counts.
3. No change to lock adapters, aggregate lock state, or score liquidity depth inputs.
4. No even-split of labeled TVL onto remaining cards beyond today’s single-pool attribution rule.
5. If exclusion drops presentation count to **1**, single-pool path may attribute labeled aggregate — that is an intended UX win **only when** the excluded pool is truly negligible; see risks.

---

## 4. Impact analysis

| Token / case | Today | If Presentation USD floor applied |
|--------------|-------|-----------------------------------|
| **FOX dust (1 wei USDG)** | Already inventory-dust after materiality fix → 1 card | No further change needed for that stub |
| **FOX multi-stub (stale / null inventory)** | UX copy now honest; dust fix targets root | USD floor helps only if a tiny-USD stub still has raw ≥ 1000 |
| **GME V2 ~$0 + V3 material** | 2 cards → per-card attribution withheld; section shows ~$470k labeled | **Primary beneficiary** — V2 excluded from cards → 1 presentation pool → V3 card can show labeled USD (lock still Unknown) |
| **HANSOME** | Typically 1 material pool / MIXED positions — happy path | Should be **unaffected** if secondary pools are absent or above floor |
| **Tiny V2 stubs (generic RH memes)** | Force multi-pool Unavailable / Included-in-total | Collapse to single material card when stub USD known-negligible |
| **True multi-pool books** (two real pools, both ≥ floor) | Multi-pool honesty path | **Unchanged** — still withhold per-card split |

---

## 5. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Hiding a real pool** with temporarily bad / missing USD | High | Never demote on `USD == null`; only demote when reliable USD is present and below floor |
| **False single-pool attribution unlock** — exclude a non-negligible pool → wrongly paste full labeled TVL onto the survivor | High | Conservative floor; require USD confidence; optional require excluded pool USD **and** inventory both dust-tier; add regression fixtures (GME, FOX, dual real pools) |
| **Labeled TVL ≫ on-chain book** (GME Gecko ~$470k vs V3 ETH inventory) | Medium | Single-pool attribution already uses labeled aggregate today — USD floor does not create that gap; document that card USD is labeled token TVL, not pool reserves |
| **i18n / DX** — “1 pool detected” while technical details show 2 discovered | Low | Keep headline = presentation count (already); technical details keep discovered |
| **Floor tuning wars** ($1 vs $100) | Medium | Ship **gated** (`PRESENTATION_USD_MATERIALITY` flag) + fixture matrix before default-on |
| **Score drift** if someone mistakenly filters scoring inputs | High | Explicit “presentation-only” API; tests assert score/lock fixtures unchanged |

---

## 6. Recommendation

**Implement later, gated — not now.**

Rationale:

- Inventory materiality already handles microscopic balances; the remaining gap is **raw-material / USD-dust** pairs (GME V2 class).
- UX item 1–2 already removes the “broken Unavailable” reading; USD floor is an **accuracy / single-pool attribution** improvement, not an emergency.
- Wrong exclusion that unlocks false single-pool TVL attribution is worse than showing “Included in Total Liquidity.”
- Prefer a follow-up PR with feature flag, fixtures (GME V2, FOX, dual-real-pool negative case), and PASS criteria below — **no code in this task**.

Candidate default if/when shipped: **`MIN_PRESENTATION_POOL_USD = 10`**, flag default **off** in production until smoke PASS on GME + FOX + HANSOME + a dual-real-pool control.

---

## 7. PASS criteria (future PR — no code now)

A future implementation PR may merge only if **all** hold:

1. **Detection unchanged** — discovered pool counts / internal inventory still include USD-dust stubs; technical details can still show them.
2. **Presentation exclusion** — pools with reliable USD `< floor` do not appear as presentation cards; pools with `USD == null` are **not** excluded by this rule alone.
3. **GME-class** — V2 ~$0 stub omitted from cards; presentation count → 1; V3 card may show labeled aggregate; lock remains Unknown (no false LOCKED).
4. **FOX-class** — no regression vs inventory dust filter; single material card still attributes labeled TVL when only one material presentation pool remains.
5. **Dual real pools** — two pools each with reliable USD ≥ floor still take multi-pool path (no per-card split; “Included in Total” UX).
6. **HANSOME** — single-pool / MIXED presentation unchanged; score weights and burn/lock fixtures unchanged.
7. **i18n** — EN + ZH strings for any new presentation labels (if needed) wired; no orphan keys.
8. **Tests** — unit fixtures for exclude / keep-unknown-USD / dual-real; `tsc` + focused vitest PASS.
9. **Flag** — gated; default-off until Production smoke on GME, FOX, HANSOME, and one multi-real-pool token.
10. **Explicit non-goals** — no scoring retune; no lock adapter changes; no inventing per-pool USD from raw L.

---

## Confirmation

- **No implementation** of USD threshold in this task.
- Presentation UX for multi-pool withheld attribution is tracked separately in `reports/HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX.md`.
