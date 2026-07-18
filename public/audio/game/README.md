# Game audio

| File | Role |
|------|------|
| `gameplay-theme.ogg` / `.mp3` | Battle-mode arrangement of the site HANSOME theme (`/audio/ambient.wav`) |
| `phase-impact.ogg` | Short sting on Reveal / Settlement phase entry |

**Do not replace** `public/audio/ambient.wav` — marketing site music stays as-is.

Regenerate from the current ambient source:

```bash
npm run generate:gameplay-theme
```

Processing notes (v1):

- Tempo ≈ **1.15×** (~15% faster)
- Stronger low percussion + taiko-style pulses + late-loop cinematic hits
- Tension pad/pulse derived from the same theme (builds across the loop)
- Loop seam crossfade for continuous play
- Loudness kept modest so UI / future SFX remain clear
