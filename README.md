# HANSOME ALPACAS

The alpaca that won the genetic lottery. Too handsome to be useful.
Preparing for launch on Robinhood Chain.

Official Website: [hansomealpacas.xyz](https://hansomealpacas.xyz)

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

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_WEBSITE` — `https://hansomealpacas.xyz`
- `NEXT_PUBLIC_X` — official X/Twitter URL (not set yet)
- `NEXT_PUBLIC_TELEGRAM` — official Telegram invite (not set yet)
- `NEXT_PUBLIC_CONTRACT` — token contract address (not deployed yet)
- `NEXT_PUBLIC_BUY`
- `NEXT_PUBLIC_CHART`

## Brand config

All brand identity (name, symbol, tagline, SEO copy, social links, asset
paths) is centralized in `content/project.ts` (`PROJECT` / `ASSETS`). Token
and chain config lives in `lib/chain.ts` and `lib/market/constants.ts`. See
`BRAND_GUIDELINES.md` for voice/visual direction.

## License

Private. © 2026 HANSOME ALPACAS
