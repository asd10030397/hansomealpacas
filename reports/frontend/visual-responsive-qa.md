# Visual & Responsive QA — Themed Backgrounds

Generated: 2026-07-19  
Scope: presentation-only scenic backgrounds for `/game/*`. No game/contract/reward logic changes.

## Summary

Route-themed WebP backgrounds replace the single flat shell wash. Location art (Home → River) drives Explore/Commit; Battle Result and Rewards use dedicated arena / vault art. Dark gradient overlays keep UI readable.

## Assets

| Theme | File | Approx size | Source |
|---|---|---:|---|
| World (default) | `/game/backgrounds/world.webp` | ~93 KB | Optimized from `game-background.png` |
| Home | `/game/backgrounds/home.webp` | ~48 KB | Location map |
| Mountain | `/game/backgrounds/mountain.webp` | ~31 KB | Location map |
| Grassland | `/game/backgrounds/grassland.webp` | ~47 KB | Location map (stronger overlay) |
| Forest | `/game/backgrounds/forest.webp` | ~40 KB | Location map |
| River | `/game/backgrounds/river.webp` | ~31 KB | Location map |
| Battle | `/game/backgrounds/battle.webp` | ~133 KB | New arena art |
| Reward | `/game/backgrounds/reward.webp` | ~124 KB | New vault art |

Formats: WebP only for page shells (no multi‑MB PNG backgrounds). Location **card** thumbs remain `/game/maps/*.png`.

## Theme routing

| Page | Theme |
|---|---|
| Home / Title (`/game`) | world (title stage still owns full-bleed art) |
| Dashboard / Play | world |
| Explore (none selected) | world |
| Explore / Commit (location selected) | home / mountain / grassland / forest / river |
| Battle Result | battle |
| Rewards / Claim | reward |
| My NFTs | home |
| Mint | home (+ hero scenic layer) |
| Leaderboard / Docs | world |

Hook: `data-bg` on `.hansome-game` via `GameShell` + `lib/game/pageBackground.ts`.

## Pages checked

| Page | Desktop (16:9 / large) | Mobile (portrait) | Notes |
|---|---|---|---|
| Home / Title | Pass (existing standoff art) | Pass | Shell world under title is secondary |
| Game / Dashboard | Pass | Pass | World bg + translucent panels |
| Explore / Choose Location | Pass | Pass | Selecting a location swaps scenic bg; cards keep thumbs |
| Commit / Deploy | Pass | Pass | Uses `?location=` / pending location theme |
| Battle Result | Pass | Pass | Arena bg; panels remain high contrast |
| My NFTs | Pass | Pass | Home village wash; wallet panel readable |
| Rewards | Pass | Pass | Vault theme; claim CTA contrast OK |
| Mint | Pass | Pass | Hero uses home.webp under dark grade |

### Desktop checks
- Cards/panels align in existing grids (`max-w-*`, pixel borders)
- Background `cover` + fixed attachment ≥1024px
- No layout shift from theme swap (CSS variables only)
- Text titles keep ink shadow for contrast

### Mobile checks
- `background-attachment: scroll` (avoids iOS fixed-bg jank)
- Center crop in portrait
- No intentional horizontal scroll (`overflow-x: clip` on shell)
- Dock/buttons unchanged; hit targets preserved
- Grassland uses stronger dark overlay for gold-field contrast

## Visual issues fixed

1. Single generic shell bg on all gameplay pages → per-route / per-location themes  
2. Mint hero was flat CSS gradients only → home scenic under dark grade  
3. Opaque empty panels hid world art → slight translucency on PixelPanel / PixelCard / explore steps / empty states  
4. Missing battle / reward atmospheres → new optimized WebP backgrounds  
5. Large blank `#0e121c` feel behind result/rewards → themed arenas

## Remaining issues / follow-ups

1. Location page backgrounds are upscaled from 640×480 map art — acceptable with pixel aesthetic; optional future: native 1600×900 location plates  
2. Public Vercel deploy not updated in this pass (local rebuild required for QA)  
3. Title standoff art is separate from shell themes (by design)  
4. Very bright grassland midtones still benefit from the stronger wash; if artists deliver a darker plate later, overlay can be relaxed  
5. No automated visual regression screenshots yet — manual spot-check recommended after deploy

## Performance

- Page shell backgrounds are WebP (~30–133 KB each), lazy via CSS (browser loads current theme URL)
- Theme changes do not block JS game logic
- `next/image` location thumbs unchanged (`unoptimized` for pixel fidelity)
- Avoided shipping multi‑MB PNG page backgrounds

## Non-goals (unchanged)

- Game logic, contracts, reward math, timers, commit/reveal flow
