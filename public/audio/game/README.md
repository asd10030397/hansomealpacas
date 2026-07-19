# Game audio (Season 1)

| File | Role |
|------|------|
| `gameplay-theme.ogg` / `.mp3` | Game BGM — battle track (**done**; Music toggle) |
| `ui-click.ogg` / `.mp3` | Button / link SFX from `music/UI.wav` (SFX toggle) |
| `abilities/<id>/effect.{ogg,mp3}` | Special ability SFX (Guardian / Runner / Lucky / Farmer) |
| `settlement-results/<id>/effect.{ogg,mp3}` | Result SFX (AlpacaHunted / AlpacaSafe / CougarHuntSuccess / CougarHuntFailed) |
| `phase-impact.ogg` | Reserved for future SFX wiring |

**Source masters (not served):** `music/Alpaca Warpath.wav`, `music/UI.wav`, ability + settlement-result folders under `music/`

**Homepage / marketing:** `public/audio/ambient.wav` — **unchanged**. Do not replace.

## BGM status (locked)

- Menu / site: existing HANSOME theme (`ambient.wav`)
- Gameplay: battle BGM already shipped — **no further gameplay BGM work** unless explicitly requested
- Phase theme-variation music is **out of Season 1 priorities**

## Season 1 SFX (priority #4)

Start with UI click (shipped). Then add via `playSfx()` + **SFX toggle**:

`countdown-tick` · `commit-confirmed` · `reveal` · `hunt-success` · `escape-success` · `shield` · `lucky` · `settlement` · `reward-claim` · `error` · `notification`

```bash
npm run generate:gameplay-theme
npm run generate:ui-sfx
npm run generate:ability-sfx
npm run generate:settlement-result-sfx
```

Replace files under the matching `music/<Folder>/`, re-run the generate script. No gameplay code changes needed.
