# Game audio

| File | Role |
|------|------|
| `gameplay-theme.ogg` / `.mp3` | Game BGM — **Alpaca Warpath** (Music toggle only) |
| `ui-click.ogg` / `.mp3` | Button / link SFX from `music/UI.wav` (SFX toggle) |
| `phase-impact.ogg` | Reveal / Settlement sting — `playSfx("phase-impact")` |

**Source masters (not served):** `music/Alpaca Warpath.wav`, `music/UI.wav`

**Channels:** Music = BGM only. SFX = UI clicks + future phase/game cues. All `playSfx()` calls respect `sfxEnabled`.

**Do not replace** `public/audio/ambient.wav` — marketing site music stays as-is.

```bash
npm run generate:gameplay-theme
npm run generate:ui-sfx
```
