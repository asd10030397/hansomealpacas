# Metadata Assets

Image and file requirements for `token.json` and wallet/explorer display.

All paths refer to files in `public/` on the live site unless noted.

## Primary token image

| Asset | Path | Size | Format | Used for |
| ----- | ---- | ---- | ------ | -------- |
| Logo (primary) | `/logo/logo-512.png` | 512×512 | PNG | `token.json` → `image` |
| Logo (vector) | `/logo/logo.svg` | scalable | SVG | `properties.files`, site |
| Favicon | `/icons/favicon.png` | 32×32 | PNG | Site tab (not token.json) |
| Avatar | `/images/avatar.png` | — | PNG | Apple touch icon, social |

**Production URL (primary):** https://kairu.lol/logo/logo-512.png

Requirements before metadata upload:

- Square aspect ratio
- Readable at 64×64 (wallet list size)
- No animated GIF for primary `image` field
- Cache headers already set in `next.config.ts` for `/logo/*`

## Social / Open Graph (reference)

| Asset | Path | Size | Notes |
| ----- | ---- | ---- | ----- |
| OG image | `/images/og.png` | 1200×630 | Link previews, not token.json |
| X banner | `/images/twitter-banner.png` | — | Profile banner draft |
| Telegram banner | `/images/telegram-banner.png` | — | If Telegram launches |

## Identity illustrations (not token icon)

Used on Deer Vote results only — do **not** use as SPL token image.

| File | Identity |
| ---- | -------- |
| `/identities/kolittle.svg` | Little Deer |
| `/identities/stag.svg` | Stag |
| `/identities/emperor.svg` | Deer Emperor |

## Optional future assets

| Asset | Status | Notes |
| ----- | ------ | ----- |
| Transparent PNG 512 | Optional | If explorers prefer no background |
| Dark/light variants | Not required | Single brand mark preferred |
| On-chain metadata animation | Not planned | Static image only |

## Hosting notes

- Prefer **immutable** hosting for final metadata URI (IPFS CID or Arweave)
- Using `kairu.lol` directly is acceptable for drafts; confirm long-term URL stability before mainnet
- After any logo change, bump metadata version and re-upload JSON

## Pre-launch verification

```bash
# Example checks (run manually before upload)
curl -I https://kairu.lol/logo/logo-512.png
curl -I https://kairu.lol/logo/logo.svg
```

- [ ] HTTP 200
- [ ] Correct `Content-Type`
- [ ] File matches approved brand export

---

© 2026 KAIRU
