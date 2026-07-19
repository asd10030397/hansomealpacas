# Source audio masters (not served)

| Path | Role |
|------|------|
| `Alpaca Warpath.wav` | Game BGM master → `public/audio/game/gameplay-theme.*` |
| `UI.wav` | UI click master → `public/audio/game/ui-click.*` |
| `Guardian/` | Guardian ability SFX folder |
| `Runner/` | Runner ability SFX folder |
| `Lucky/` | Lucky ability SFX folder |
| `Farmer/` | Farmer ability SFX folder |
| `king/` | King ability SFX folder (royal immunity) |
| `AlpacaHunted/` | Alpaca hunted result SFX |
| `AlpacaSafe/` | Alpaca safe / survived / escaped result SFX |
| `CougarHuntSuccess/` | Cougar hunt success result SFX |
| `CougarHuntFailed/` | Cougar hunt miss result SFX |

## Ability SFX

Put any `.wav` / `.mp3` / `.ogg` in the ability folder (first file alphabetically is used). Then:

```bash
npm run generate:ability-sfx
```

Served output: `public/audio/game/abilities/<id>/effect.{ogg,mp3}`  
Catalog: `lib/game/abilityEffects/catalog.ts` (banner text + folder map only).

## Settlement result SFX

Same folder convention for `AlpacaHunted`, `AlpacaSafe`, `CougarHuntSuccess`, `CougarHuntFailed`:

```bash
npm run generate:settlement-result-sfx
```

Served: `public/audio/game/settlement-results/<id>/effect.{ogg,mp3}`  
Catalog: `lib/game/settlementResults/catalog.ts`
