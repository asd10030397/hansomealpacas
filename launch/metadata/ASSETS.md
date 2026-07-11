# Metadata Assets

Image and file requirements for `token.json` and wallet/explorer display.

All paths refer to files in `public/` on the live site unless noted.

## Primary token image

| Asset | Path | Size | Format | Used for |
| ----- | ---- | ---- | ------ | -------- |
| **Logo (canonical PNG)** | `/logo/logo-256.png` | 256×256 | PNG | Token list `logoURI`, wallet_watchAsset, hosted URLs |
| Logo (upscale) | `/logo/logo-512.png` | 512×512 | PNG | Upscaled from logo-256; PWA manifest, platform upload when 512 required |
| Logo (vector / UI) | `/logo/coin.svg` | scalable | SVG | Website UI, `properties.files` |
| Favicon | `/icons/favicon.png` | 32×32 | PNG | Site tab (not token.json) |
| Avatar | `/images/avatar.png` | — | PNG | Apple touch icon, social |

**Production URLs:**
- https://kairu.lol/logo/logo-256.png (primary)
- https://kairu.lol/logo/logo-512.png (upscale-only)
- https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json

See [launch/token-list/SUBMISSION_GUIDE.md](../token-list/SUBMISSION_GUIDE.md) for wallet/explorer submission steps.

Requirements before metadata upload:

- Square aspect ratio
- Readable at 64×64 (wallet list size)
- No animated GIF for primary `image` field
- Cache headers already set in `next.config.ts` for `/logo/*`

Regenerate PNGs:

```bash
npm run generate:assets
```

`logo-512.png` is always upscaled from `logo-256.png` (never rasterized separately from SVG).

## Social / Open Graph (reference)

| Asset | Path | Size | Notes |
| ----- | ---- | ---- | ----- |
| OG image | `/images/og.png` | 1200×630 | Link previews, not token.json |
| X banner | `/images/twitter-banner.png` | — | Profile banner draft |
| Telegram banner | `/images/telegram-banner.png` | — | If Telegram launches |

## Pre-launch verification

```bash
curl -I https://kairu.lol/logo/logo-256.png
curl -I https://kairu.lol/logo/logo-512.png
curl -I https://kairu.lol/logo/coin.svg
```

- [ ] HTTP 200
- [ ] Correct `Content-Type`
- [ ] logo-512 matches logo-256 (upscale only)

---

© 2026 UGLY DEER
