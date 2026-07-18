# HANSOME Web Asset Checklist

| Field | Value |
|---|---|
| Status | Active — title screen uses **production pixel plates** where available |
| Game host | `game.hansomealpacas.xyz` |
| Local preview | `/game` |

Do **not** treat TEMP files as final launch art. Prefer `/public/pixel/*` sources and `/public/assets/*` prepared plates.

---

## Title screen — currently wired

| Asset | Path | Status |
|---|---|---|
| Cougar territory landscape | `public/assets/backgrounds/cougar-territory-scene.png` | **TEMP scene plate** — sky/mountains/pines/rocky ground; replace with final hand-pixel wilderness |
| Cougar FG rocks / bushes | `public/assets/ui/cougar-fg-rocks.svg`, `cougar-fg-bush.svg` | **TEMP** — foreground integration props |
| Alpaca ranch scene | `public/assets/backgrounds/alpaca-ranch-scene.png` | Mirrored stage plate (from ranch-world); keep in sync with cougar scene framing |
| Alpaca FG ledge / flowers | `public/assets/ui/alpaca-fg-ledge.png`, `alpaca-fg-flowers.svg` | Foreground integration for ranch scene |
| Ranch world (source) | `public/assets/backgrounds/ranch-world.png` | Source plate for alpaca-ranch-scene |
| Standoff style reference | `public/assets/reference/standoff-style-ref.png` | Art direction lock for both heroes + shared mountain world |
| Cougar hero (standoff full-body) | `public/assets/characters/cougar-hero-standoff.png` | **TEMP** — completed rear/tail from cropped ref; replace with final hand-pixel |
| Alpaca hero (ranch) | `public/assets/characters/alpaca-hero-ranch.png` | **TEMP** — title right hero; dusty cream, amber slit eye, no soft foot haze |
| Alpaca ranch world (lush) | `public/assets/backgrounds/alpaca-ranch-lush.png` | **TEMP** — title east plate, verdant greens (no baked alpaca) |
| Alpaca ranch world (prior) | `public/assets/backgrounds/alpaca-ranch-world.png` | Superseded by lush plate for title east |
| Cougar mountain world (clean) | `public/assets/backgrounds/cougar-mountain-world.png` | **TEMP** — title west plate (no baked cougar) |
| Shared standoff world | `public/assets/backgrounds/standoff-world.png` | Retired for title — baked characters / seams |
| Retired heroes | `cougar-hero-mascot.png`, `cougar-hero-full.png`, `alpaca-hero-face-left.png` (title use) | Superseded by standoff pair |
| Cougar hero (official bust plate) | `public/pixel/cougar/cougar-official-base.png` | Production — medium shot; art-direction reference only |
| Retired left plates | `mountain-env.png`, `mountain-sky.png`, `mountain-world.png` | Do not use — wrong composition / baked silhouette / blocky upscale |
| Alpaca hero (face left) | `public/assets/characters/alpaca-hero-face-left.png` | **Production-style** from `alpaca-fullbody-style-ref.png` |
| Center rift | `public/assets/ui/rift-center.svg` | **TEMP SVG** — replace with hand-pixel lightning/torn strip |
| Logo crest | `public/assets/ui/logo-hansome-game.svg` | **TEMP crest** — CSS logo plate in use; needs final wordmark PNG |
| Menu icons | `public/assets/icons/menu-*.svg` | TEMP SVG |

---

## Missing / not final production assets

| Asset | Suggested path | Status |
|---|---|---|
| Homepage split background (single authored plate) | `public/assets/backgrounds/hero-split-desktop.png` | Missing — currently two plates + CSS blend |
| Mountain environment only (no baked hero) | `public/assets/backgrounds/mountain-env.png` | Missing — would avoid hero/plate overlap |
| Cougar hero transparent + idle sheet | `public/assets/characters/cougar-hero.png` (+ `cougar-idle.png`) | Partial — crop still has scene BG |
| Alpaca hero idle sheet | `public/assets/characters/alpaca-idle.png` | Missing — CSS idle only |
| Center rift final | `public/assets/ui/rift-center.png` | Missing |
| Main logo / wordmark pixel | `public/assets/ui/logo-hansome-game.png` | Missing — plate + crest SVG stand-in |
| Menu button icons (final) | `public/assets/icons/menu-*.png` | TEMP SVG |
| Location thumbnails (Home + Loc 1–4) | `public/assets/backgrounds/loc-*.png` | Placeholder SVG |
| NFT unrevealed card art | `public/assets/ui/nft-unrevealed.png` | Placeholder SVG |
| Ambient VFX sheets (mist, sparkle, grass) | `public/assets/fx/*` | CSS-only |
| BGM / SFX | `public/audio/game/*` | Gameplay battle theme + phase impact (site `ambient.wav` unchanged) |
| Marketplace art | — | Coming Soon |

---

## Retired TEMP (do not use on title screen)

| Asset | Path | Notes |
|---|---|---|
| AI-style hero temps | `public/assets/characters/*-hero-temp.png` | Replaced by production pixel sources |
| Old split temp | `public/assets/backgrounds/hero-split-world-temp.png` | Replaced by mountain + ranch plates |
| Old rift temp | `public/assets/ui/rift-temp.svg` | Replaced by `rift-center.svg` |

---

## Notes

- Location names remain placeholders: Home, Location 1–4.
- Weights locked: 1 / 2 / 3 / 5 / 8 (GDS).
- Title screen prioritizes immersion; remaining missing items are listed above.
