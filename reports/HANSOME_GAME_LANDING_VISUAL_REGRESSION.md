# HANSOME Game Landing — Visual Regression Investigation

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Primary target | `https://game.hansomealpacas.xyz/` |
| Secondary | `https://www.hansomealpacas.xyz/` (marketing hero only — no standoff stage) |
| Tip at mission start | `dpl_386gq56oXj2wyB5n9hMjrfdwBGJA` (`hansomealpacas-czyysyje0-…`; tip had already moved past prior rollback `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`) |
| Tip at close | `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR` (`hansomealpacas-6ospyfvnh-…`) |
| Deployed this mission | **NO** |
| Final verdict | **PASS_NOT_DEPLOYED** |

### Context

Prior report [`HANSOME_GAME_LANDING_BACKGROUND_HOTFIX_PRODUCTION.md`](./HANSOME_GAME_LANDING_BACKGROUND_HOTFIX_PRODUCTION.md) issued **PASS** based on HTTP **200** + HTML refs only. That is insufficient: assets can return 200 while CSS/stacking/hydration leaves them visually missing. This mission validates **rendered visibility**.

Composition note (code + live screenshot truth):

| Region | Faction | Selectors |
|--------|---------|-----------|
| Left / west | **Cougar** | `.standoff__hero--cougar`, `.standoff__world--west` |
| Right / east | **Alpaca** | `.standoff__hero--alpaca`, `.standoff__world--east` |

(User wording “left alpaca / right cougar” does not match the shipped standoff layout.)

---

## 1. Root cause (visual)

**No active visual regression on current Production tip.**

Playwright confirmed after hydration:

- Left **cougar** hero, right **alpaca** hero, and dual-world **landscape** plates are in the DOM
- Non-zero bounding boxes inside the viewport
- `display` / `visibility` / `opacity` healthy
- Not fully covered by stacking (menu sits above center; heroes remain in `elementsFromPoint` stack on side samples)
- Decoded image natural sizes match source PNGs
- **Painted-pixel sampling** (canvas `drawImage` of each `<img>`) shows opaque, non-near-black content — rules out “200 but blank/transparent decode”
- Desktop screenshot matches freshly captured healthy baseline at **0.00%** pixel diff

Ruled out again for current tip:

| Hypothesis | Result |
|------------|--------|
| Zero bbox / `display:none` / `opacity:0` | **FAIL not observed** |
| Transform/position off-viewport | **FAIL not observed** (desktop + mobile 390×844) |
| Opaque coverer hiding heroes | **FAIL not observed** on side samples |
| Broken image decode (natural 0×0) | **FAIL not observed** |
| Transparent / near-black paint despite HTTP 200 | **FAIL not observed** (pixel sample) |
| `.vercelignore` bare `assets` stripping `public/assets` | Still anchored as `/assets` only |
| www missing standoff stage | **Expected** — marketing uses `/pixel/pasture-hero-bg.png`, not `StandoffStage` |

Historical class of real outage remains the packaging bug in [`HANSOME_GAME_LAYOUT_PRODUCTION_FIX.md`](./HANSOME_GAME_LAYOUT_PRODUCTION_FIX.md) (bare `assets` → 404 art → dark empty stage). That is **not** reproducing now.

---

## 2. Playwright findings

**Script:** `scripts/game-landing-visual-smoke.mjs`  
**Helper:** `scripts/_png-diff.mjs`  
**Baselines:** `tests/visual/baselines/game-landing-desktop.png`, `tests/visual/baselines/www-landing-desktop.png`  
**Artifacts (gitignored):** `tests/visual/artifacts/`  
**npm:** `npm run test:visual:game-landing` / `npm run test:visual:game-landing:update`

### Game landing (`game.hansomealpacas.xyz/`) — desktop 1440×900

| Check | Alpaca (right) | Cougar (left) | Landscape west | Landscape east |
|-------|----------------|---------------|----------------|----------------|
| Decoded | 1024×1024 | 1024×1024 | 1536×1024 | 1536×1024 |
| Painted opaque / nonDark | 43% / 100% | 31% / 100% | 100% / 100% | 100% / 100% |
| BBox | 292×341 @(970,453) | 588×588 @(66,349) | 720×840 @(0,122) | 720×840 @(720,122) |
| CSS | opacity=1, visible | same | same | same |
| Coverage samples | 0% covered | 0% covered | 0% covered | 0% covered |
| Screenshot vs baseline | **0.00%** diff (threshold 8%) | | | |

Mobile spot-check (390×844): all three art classes still non-zero bbox, opacity 1, decoded; screenshot shows cougar left + alpaca right + dual landscape behind menu.

### www (`www.hansomealpacas.xyz/`)

| Check | Result |
|-------|--------|
| Standoff stage | **Absent** (by design) |
| Pasture hero `img[src*="pasture-hero-bg"]` | decoded 1536×1024; bbox non-zero; opacity 1; covered 0% |
| Screenshot vs baseline | **0.00%** (threshold 20%) |

Decorative bottom-corner marketing sprites on www are separate from game standoff art and are not the primary gate.

---

## 3. Fix

**None required** for Production visibility.

Added reusable visual smoke so future tips cannot pass on HTTP 200 alone.

---

## 4. Files changed

| File | Change |
|------|--------|
| `scripts/game-landing-visual-smoke.mjs` | **New** — Playwright visual smoke (bbox, CSS, coverage, paint sample, screenshot diff) |
| `scripts/_png-diff.mjs` | **New** — sharp-based PNG decode/diff |
| `tests/visual/baselines/game-landing-desktop.png` | **New** — healthy game baseline (from live tip during this mission) |
| `tests/visual/baselines/www-landing-desktop.png` | **New** — healthy www baseline |
| `package.json` | `test:visual:game-landing` (+ `:update`) scripts |
| `.gitignore` | ignore `tests/visual/artifacts/` |
| `reports/HANSOME_GAME_LANDING_VISUAL_REGRESSION.md` | this report |

No gameplay, CSS layout, or packaging edits.

---

## 5. Visual smoke results (www + game)

| Host | Hydration | Heroes / landscape | Pixel paint | Screenshot diff | Verdict |
|------|-----------|--------------------|-------------|-----------------|---------|
| `game.hansomealpacas.xyz` | OK | Left cougar + right alpaca + both world plates **visible** | PASS | 0.00% | **PASS** |
| `www.hansomealpacas.xyz` | OK | Pasture hero landscape **visible**; no standoff stage | N/A (hero img bbox) | 0.00% | **PASS** |

Commands:

```bash
npm run test:visual:game-landing
# refresh baselines after intentional art changes:
npm run test:visual:game-landing:update
```

---

## 6. Deploy / alias / rollback / verdict

| Item | Value |
|------|-------|
| Deploy this mission | **Not deployed** (no fix required) |
| Live tip (close) | `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR` |
| Alias URL | `https://hansomealpacas-6ospyfvnh-the-67.vercel.app` |
| Aliases | `game.hansomealpacas.xyz`, `www.hansomealpacas.xyz`, `hansomealpacas.xyz` |
| Rollback target for *next* deploy | Record tip **immediately before** `vercel --prod` (production tip is moving frequently via analytics/env redeploys; do not assume `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` remains tip) |
| Rollback invoked | **No** |

### Final verdict

**PASS_NOT_DEPLOYED** — visual rendering of game landing artwork is healthy on Production; prior HTTP-only PASS was incomplete as a method but the live tip is not visually broken. Reusable Playwright visual smoke is in place.

### Visibility after investigation (no code fix)

| Element | Visible after investigation? |
|---------|------------------------------|
| Left cougar hero | **YES** |
| Right alpaca hero | **YES** |
| Landscape backgrounds | **YES** (west + east plates) |
| www pasture hero | **YES** (not standoff stage) |
