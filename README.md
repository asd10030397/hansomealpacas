# HANSOME ALPACAS

The alpaca that won the genetic lottery. Too handsome to be useful.
Preparing for launch on Robinhood Chain.

Official Website: [hansomealpacas.xyz](https://hansomealpacas.xyz)
Official X: [@HansomeAlpacas](https://x.com/HansomeAlpacas)
Official Telegram: [telegram.me/hamsomealpacaspremium](https://telegram.me/hamsomealpacaspremium)
Contract: `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` (Robinhood Chain)

> This repo was forked from a previous meme coin project (UGLY DEER, now
> delisted/unmaintained). See `docs/REBRAND_NOTES.md` for what changed during
> the rebrand and what's still pending before launch.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- wagmi / viem (Wallet Connect, Uniswap v4 swap on Robinhood Chain)

## Development

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run generate:assets` | Rasterize logo to PNG/banners |
| `npm run release:check` | Pre-launch validation |

## Environment

Copy `.env.example` to `.env.local` to override; the values below are also
hardcoded as fallbacks in `content/project.ts` / `lib/chain.ts`, so the site
works correctly even without a `.env.local`:

- `NEXT_PUBLIC_WEBSITE` — `https://hansomealpacas.xyz`
- `NEXT_PUBLIC_X` — `https://x.com/HansomeAlpacas`
- `NEXT_PUBLIC_TELEGRAM` — `https://telegram.me/hamsomealpacaspremium`
- `NEXT_PUBLIC_CONTRACT` — `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875`
- `NEXT_PUBLIC_BUY`
- `NEXT_PUBLIC_CHART` — not set yet (no Uniswap v4 pool / chart exists)

## Brand config

All brand identity (name, symbol, tagline, SEO copy, social links, asset
paths) is centralized in `content/project.ts` (`PROJECT` / `ASSETS`). Token
and chain config lives in `lib/chain.ts` and `lib/market/constants.ts`. See
`BRAND_GUIDELINES.md` for voice/visual direction.

## License

Private. © 2026 HANSOME ALPACAS
