# Listing Assets

| File | Size | Use |
|------|------|-----|
| `logo-256.png` | 256×256 | **Canonical PNG** — token list logoURI, wallet, DEX Screener upload |
| `logo-512.png` | 512×512 | Upscaled from logo-256 — CoinGecko/CMC upload when 512×512 required |
| `banner-3x1.png` | ~1500×500 | DEX Screener header (optional) |

## Hosted URLs

| Purpose | URL |
|---------|-----|
| **Primary (logoURI, wallet)** | https://kairu.lol/logo/logo-256.png |
| Upscale (512 upload only) | https://kairu.lol/logo/logo-512.png |
| Website UI | https://kairu.lol/logo/coin.svg |

## Regenerate

```bash
npm run generate:assets
```

Syncs `public/logo/logo-256.png`, upscales to `logo-512.png`, and copies both here.

---

© 2026 UGLY DEER
