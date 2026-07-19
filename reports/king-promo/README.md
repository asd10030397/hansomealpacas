# King Alpaca Promotional Video

Marketing trailer for X / social — **“Because you are HANSOME, you are the King.”**

## Exports

| File | Format | Use |
|------|--------|-----|
| `hansome-king-promo-16x9.mp4` | 1920×1080 | Main / X landscape |
| `hansome-king-promo-9x16.mp4` | 608×1080 | Mobile / Stories / Reels |

Length ≈ **25 seconds**. Audio: soft Warpath bed + King royal SFX (`music/king` → `public/audio/game/abilities/king`).

## Message (locked)

King is a **permanent legendary identity** — not a random skill:

- You cannot be hunted.
- Others are the prey; King is the ruler.

## Transparent character assets

Built by `npm run promo:king:cutouts` → `public/assets/promo/king/`:

| File | Source |
|------|--------|
| `king.png` | Genesis #1 minus `traits/backgrounds/king.png` |
| `prey-a.png` | Genesis #100 minus morning-sky |
| `prey-b.png` | Genesis #250 minus morning-sky |
| `cougar.png` | Cougar mint art, subject cutout |

## Rebuild

```bash
# terminal A
npm run dev

# terminal B
set PREVIEW_URL=http://127.0.0.1:3000
npm run promo:king
```

Preview in browser: `/dev/king-promo` · vertical: `/dev/king-promo?aspect=9:16`
