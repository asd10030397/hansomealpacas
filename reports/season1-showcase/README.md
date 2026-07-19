# Season 1 Presentation Showcase (X / Twitter)

| Field | Value |
|-------|--------|
| File | `hansome-season1-presentation-showcase.mp4` |
| Resolution | **1920×1080** |
| Frame rate | **60 fps** |
| Duration | ~**25.5 s** |
| BGM | Production gameplay theme — **Alpaca Warpath** (`public/audio/game/gameplay-theme.*`) |
| SFX | Production ability + settlement-result effects (boosted + BGM duck) |

## Production pass

1. **SFX over BGM** — SFX gain ×4.2 + compressor/limiter; BGM ducks to ~0.07 during SFX, then linear restore (~0.28 s).
2. **NFT first** — fade/scale in (~450 ms) → hold (~500 ms) → then VFX + SFX (`FX_DELAY_MS = 950`).
3. **No pop-in** — all NFT images preloaded before START; recorder waits for `data-assets-ready`.
4. **Focus** — NFT remains under a transparent FX layer; bursts/stages are scaled so the character stays readable.

## Sequence

1. Guardian — NFT `#13` + shield VFX/SFX  
2. Runner — NFT `#8` + winged shoes VFX/SFX  
3. Lucky — NFT `#6` + clover VFX/SFX  
4. Farmer — NFT `#4` + wheat VFX/SFX  
5. Alpaca Hunted — NFT `#100` + claw slash VFX/SFX  
6. Alpaca Safe — NFT `#250` + happy jump VFX/SFX  
7. Cougar Hunt Success — NFT `#501` + jaws snap VFX/SFX  
8. Cougar Hunt Failed — NFT `#525` + walk-away VFX/SFX  
9. End card — HANSOME logo + “Coming to Robinhood Chain”

## Rebuild

Requires `npm run dev` on `http://127.0.0.1:3000`.

```bash
npm run showcase:season1
```

Live preview (no record):

`http://127.0.0.1:3000/dev/season1-showcase`

## Notes

- Showcase page: `app/dev/season1-showcase/` (dev-only, not in production nav).
- Visuals reuse production `AbilityEffectOverlay` / `ResultEffectOverlay`.
- Audio mix: `scripts/build-season1-showcase-audio.mjs` (Warpath + duck; BGM not replaced).
- No gameplay logic changes.
