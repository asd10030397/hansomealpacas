# UGLY DEER → HANSOME ALPACAS Rebrand Notes

This repo was forked from **UGLY DEER** (symbol `UGLY`, delisted / liquidity
pulled). It is being converted into an independent project: **HANSOME
ALPACAS** (symbol `HANSOME`). This document tracks what changed and what is
still pending.

No contract has been deployed, no pool has been created, and no on-chain
config was touched during this pass — see "What was intentionally NOT
touched" below.

---

## What was rebranded (this pass)

### Brand config (single source of truth)

- `content/project.ts` — `PROJECT` (name/symbol/tagline/SEO/social/contract
  fallback) and `ASSETS` (image paths) now reflect HANSOME ALPACAS.
  `contractAddress`, `twitter`, `telegram` intentionally default to empty —
  the UI already has "pre-launch / coming soon" states wired to this.
- `.env.example` — placeholder values updated; social/contract left blank.

### Token / chain / market libs

- `lib/chain.ts` — `TOKEN_ADDRESS` (was `UGLY_TOKEN_ADDRESS`), `TOKEN_DECIMALS`
  (was `UGLY_DECIMALS`), `getTokenLogo256Url()` (was `getUglyLogo256Url()`).
  `POOL_ID` is a placeholder zero value — **do not reuse the old UGLY DEER
  pool ID**, it belongs to a different token.
- `lib/market/constants.ts` — `TOTAL_SUPPLY`, `TOKEN_ADDRESS`,
  `GECKO_TERMINAL_POOL_ID` (now empty placeholder),
  `GECKO_TERMINAL_TOKEN_POOLS_API`.
- `lib/market/pool.ts`, `lib/market/geckoterminal.ts` — generic
  `tokenPerEth` / `tokenInPool` naming, error messages reference HANSOME.
- `lib/swap/encoding.ts` — `buildEthToTokenInput` / `buildTokenToEthInput`
  (was `...Ugly...`), direction type is `"ethToToken" | "tokenToEth"`.
- `lib/wallet/watchAsset.ts` — `TOKEN_WATCH_ASSET`, `requestWatchTokenAsset()`
  (was `...Ugly...`), logo URL derived from `getTokenLogo256Url()`.
- `lib/links.ts`, `lib/launch.ts` — official X/Telegram fallback URLs cleared
  (were hardcoded to UGLY DEER's `@DeerloveRu` / Telegram invite).
- `lib/mascot.ts` — `ALPACA_LAYERS` / `ALPACA_COLORS` (was
  `UGLY_DEER_LAYERS` / `UGLY_DEER_COLORS`); still unused placeholder IDs, not
  wired to real artwork yet.
- `lib/analytics.ts` — removed dead `DEER_VOTE_*` / `DEER_IDENTITY_SELECTED`
  event constants (unused "deer identity vote" feature, no UI references it).
- `lib/ambient-sound.ts`, `content/i18n/index.ts` — localStorage keys renamed
  `uglydeer:*` → `hansomealpacas:*` (resets returning visitors' saved
  ambient/locale prefs — expected).

### Components / hooks

- `components/CoinDeerFace.tsx` → deleted, then its short-lived replacement
  `components/CoinAlpacaFace.tsx` (hand-coded placeholder SVG) was **also
  deleted** once the real mascot artwork landed (see Assets below).
- `components/GoldCoin.tsx` — no more hardcoded "UGLY DEER" text; reads
  `PROJECT.name` / `PROJECT.symbol`, and its face art is now the real mascot
  cutout instead of a placeholder SVG.
- `components/Mascot.tsx`, `components/swap/TokenIcon.tsx`,
  `components/swap/SwapCard.tsx` — generic symbol handling via
  `PROJECT.symbol` instead of hardcoded `"UGLY"`.
- `hooks/useUglyDeerEasterEgg.ts` → renamed `hooks/useMascotEasterEgg.ts`.

### Copy / i18n

- `content/i18n/en.ts`, `content/i18n/zh.ts` — full copy rewrite: hero
  tagline, about section, FAQ, tokenomics labels, footer, etc. New taglines:
  **"The alpaca that won the genetic lottery."** / **"Too handsome to be
  useful."** / 天生贏家臉，一輩子沒屁用。
- `content/i18n/types.ts` — renamed fields `approveUgly` → `approveToken`,
  `uglyPrice` → `tokenPrice`, `stayUgly` → `stayHansome`.
- `content/transparency.ts` — `OFFICIAL_WALLETS` is now an **empty array**
  (no wallets exist yet for this project — do not reuse UGLY DEER's
  deployment/liquidity/treasury/founder addresses). `app/transparency/page.tsx`
  shows a "no contract deployed yet" empty state. Same data shape is kept so
  filling in real wallets later requires no structural changes.

### SEO / metadata / routes

- `app/layout.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`,
  `app/swap/layout.tsx`, `app/token-list/page.tsx`,
  `app/transparency/page.tsx`, `lib/og-image.tsx` — titles, OG/Twitter copy,
  metadataBase fallback, token-list filename.
- `app/swap/watch-test/page.tsx`, `app/api/market/route.ts`,
  `hooks/useMarketStats.ts` — `[UGLY]` console log tags → `[HANSOME]`.

### Assets

- **Official mascot locked in.** `public/logo/mascot-source.jpg` is the
  brand-owner-supplied pixel-art alpaca portrait (checked into the repo as
  the canonical source — do not regenerate/redraw it). `public/logo/coin.svg`
  now embeds that exact artwork (cropped + centered, unfiltered) inside a
  simple gold coin rim, built by `scripts/build-mascot-coin.mjs`. The old
  hand-coded placeholder alpaca (`components/CoinAlpacaFace.tsx`) was
  deleted; `components/GoldCoin.tsx`'s interactive 3D hero coin now renders
  `public/logo/mascot-cutout.png` (same artwork, background chroma-keyed to
  transparent) inside its front face for full visual consistency with the
  favicon/logo/OG assets.
- `npm run generate:assets` was re-run to regenerate every derived PNG
  (`logo-256.png`, `logo-512.png`, favicons, apple-touch-icon, OG/Twitter
  social preview images, avatar) from the new `coin.svg`. If the mascot art
  is ever replaced again: swap `public/logo/mascot-source.jpg`, re-run
  `node scripts/build-mascot-coin.mjs`, then `npm run generate:assets`.
- `public/token-list/ugly-deer-robinhood.tokenlist.json` → renamed to
  `hansome-alpacas-robinhood.tokenlist.json`, `tokens: []` until a contract
  exists (a fabricated token entry would be actively misleading).
- `public/identities/*.svg` (emperor/kolittle/stag) — **deleted**. These were
  dead code from a removed "Deer Vote" feature, not referenced by any current
  UI.
- `scripts/generate-assets.mjs`, `scripts/social-preview.mjs`,
  `scripts/release-check.mjs` — brand strings updated to HANSOME ALPACAS.

### Config

- `package.json` name → `hansome-alpacas`.
- `README.md`, `BRAND_GUIDELINES.md` — rewritten for HANSOME ALPACAS.

### Visual redesign — "Pixel Alpaca Paradise" (this pass)

The site's visual identity moved from UGLY DEER's black/gold "premium NFT"
look to a warm, 8-bit pixel-art alpaca-ranch theme. **No functionality,
component structure, or business logic changed** — only design tokens,
CSS, image assets, and a handful of copy strings (button labels).

- `styles/globals.css` — full theme rewrite:
  - `--color-background`/`--color-foreground`/`--color-border` flipped from
    near-black/off-white to sky-blue/dark-brown (light theme).
  - `--color-gold*` tokens repointed from metallic gold to a honey/wood
    palette; added `--color-gold-pale` (genuinely pale butter, for
    highlights/glows) since `--color-gold-light` now has to double as
    *readable dark amber text* on a light background (see contrast notes
    below). Added `--color-sky`, `--color-grass`, `--color-grass-dark`,
    `--color-wood`, `--color-wood-dark`, `--color-surface`.
  - `.gold-border` / `.tokenomics-card` / `.live-status-card` — dropped
    `backdrop-filter: blur()` + soft glow shadows, replaced with solid
    cream fills, chunky 3px wood/grass borders, and hard offset
    "step" shadows (retro game panel look).
  - New `.pixel-btn` utility (chunky border + hard drop shadow + press
    animation) layered onto existing buttons; new `.grass-divider` (tileable
    pixel grass strip, used above the footer).
- `app/layout.tsx` — swapped the `Anton` display font for `Press_Start_2P`
  (kept the `--font-anton` CSS variable name on purpose so every existing
  `var(--font-anton)` reference across ~20 files picks up the new pixel
  typeface without editing each file). Body copy still uses Noto Sans TC
  for CJK readability. `viewport.colorScheme` → `"light"`.
- `content/project.ts` — `themeColor` → `#BFE8F6` (sky blue).
- **Contrast fix (important if you touch colors again):** almost every
  `text-gold` / `text-gold/NN` and `text-gold-light` usage in the codebase
  was written assuming a *dark* backdrop (bright gold text on near-black).
  Flipping to a light backdrop made all of those unreadable, so:
  `--color-gold-light` was repointed to a **dark, readable amber**
  (`#96591a`) instead of pale gold, and every bare `text-gold`/`text-gold/NN`
  eyebrow-label usage across `sections/*` and `components/transparency/*`
  was mechanically swapped to `text-gold-light`. Genuinely pale
  highlight/gradient stops (badge sheen, coin face, ticker gradient) use the
  new `--color-gold-pale` token instead.
- `components/GoldCoin.tsx` — inline gradients recolored from metallic gold
  hexes to the cream/honey/wood palette; still the same interactive 3D flip
  coin, just reskinned.
- `components/ActionButton.tsx`, `CopyButton.tsx`, `SocialIcon.tsx`,
  `transparency/WalletCard.tsx`, `transparency/CopyAddressButton.tsx`,
  `swap/SwapCard.tsx`, `swap/TokenIcon.tsx`, `swap/TxStatusBanner.tsx`,
  `LanguageToggle.tsx`, `market/Sparkline.tsx` — restyled to the wood/pixel
  bevel system; `TxStatusBanner`'s success/failed colors darkened
  (`emerald-200`/`red-200` → `emerald-800`/`red-800`) for light-bg contrast.
- `sections/*` (Hero, LiveStatus, Tokenomics, Buy, Contract, MarketStats,
  Faq, Footer) and `app/{swap,transparency,token-list}/page.tsx`,
  `app/swap/watch-test/page.tsx` — removed now-redundant
  `bg-white/[0.0x]` / `bg-black/NN` overlay classes (the new card classes
  supply their own solid fill), swapped buttons to the pixel-bevel pattern.
- `sections/HeroSection.tsx` — new full pasture background scene + two
  decorative alpaca sprites (see Assets below); hero title font size/tracking
  tuned down for `Press_Start_2P`'s wider glyphs; chain/status/tagline text
  got a light drop-shadow for legibility over the busy background image.
- `sections/TokenomicsSection.tsx` — badge text color fixed (`text-background`
  is no longer near-black, so badges switched to `text-wood-dark` on a
  solid `bg-gold` pill); ticker-card value font size reduced so `HANSOME`
  doesn't clip out of its card at the new pixel font's wider letterforms.
- `content/i18n/{types,en,zh}.ts` — added `buy.ctaSublabel`; buy CTA copy
  changed to **"GET HANSOME"** / 領取 HANSOME with sublabel **"Feed the
  alpacas"** / 餵飽羊駝們 (per brief: playful, non-utility CTA copy).

### New pixel art assets (this pass)

- `public/pixel/pasture-hero-bg.png` — wide pixel-art scene (sky, sun,
  clouds, hills, wooden fence, flowers, 3 background alpacas
  grazing/sleeping/standing) used as the Hero section backdrop, generated to
  match the official mascot's palette/style. Source PNG kept at
  `pasture-hero-bg-source.png`.
- `public/pixel/alpaca-sunglasses.png`, `public/pixel/alpaca-goofy.png` —
  standalone decorative alpaca sprites (background-removed via
  `scripts/build-pixel-assets.mjs`, same chroma-key technique as
  `build-mascot-coin.mjs`), scattered in the Hero's bottom corners. Sources
  kept as `*-source.png` in the same folder.
- `scripts/build-pixel-assets.mjs` — re-run this after replacing any
  `*-source.png` in `public/pixel/` to regenerate the trimmed/keyed outputs.
- These are new decorative/background characters, **not** replacements for
  the official mascot — the mascot (`coin.svg` / `mascot-cutout.png`) is
  untouched and remains the brand's single canonical character.

---

## What was intentionally NOT touched

Per launch instructions: **no contract deployment, no pool creation, no
blockchain changes.**

- **`contracts/`** — Solidity contract (`UglyDeer.sol`), deployment/pool
  scripts, and `contracts/package.json` (`ugly-deer-token`) still reference
  UGLY DEER. Left untouched — renaming/redeploying the contract is a
  deliberate decision for a later phase, not a text rebrand.
- **`docs/LAUNCH_PLAN.md`, `docs/SOCIAL_PLAN.md`, `docs/ROADMAP.md`,
  `docs/TOKEN_INFO.md`, `docs/UGLY_POOL_HISTORY.md`,
  `docs/UGLY_SWAP_VERIFICATION.md`, `docs/RELEASE_REPORT.md`** — legacy UGLY
  DEER launch/ops history (pool creation logs, swap verification, a
  generated release report). These describe things that actually happened to
  the old token/pool and would be misleading if hand-edited to say
  "HANSOME." Treat as **archived UGLY DEER history**; write new versions
  once HANSOME actually has a contract/pool.
- **`launch/`** (34 files: listing submission guides for CoinGecko, CMC,
  DexScreener, GeckoTerminal, Trust Wallet, token-list PRs, etc.) — all
  reference UGLY DEER's real contract address, pool ID, and kairu.lol URLs.
  Same reasoning as above: these are submission records tied to a specific
  deployment, not brand copy. Rebuild these once HANSOME has a live
  contract + pool (the guides/templates themselves are still structurally
  reusable).
- **`public/images/twitter-banner.png`, `public/images/telegram-banner.png`**
  — manually-designed social profile banners (not part of the
  `generate:assets` pipeline). Still show the old deer mascot. Need manual
  redesign; not rendered anywhere on the website itself.

---

## Next steps (suggested order)

1. ~~Get final HANSOME ALPACAS mascot artwork and drop it into
   `public/logo/coin.svg`~~ — **done.** Official mascot art is live in
   `coin.svg`, `logo-256.png`, `logo-512.png`, favicons, apple-touch-icon,
   OG/Twitter images, and the interactive hero coin.
2. Redesign `public/images/twitter-banner.png` / `telegram-banner.png` using
   the same official mascot (still shows the old deer art — not part of the
   `generate:assets` pipeline, needs manual design work).
3. Set `NEXT_PUBLIC_X` / `NEXT_PUBLIC_TELEGRAM` once official socials exist
   (`lib/links.ts` / `lib/launch.ts` currently have empty fallbacks with
   `TODO` comments).
4. When ready to deploy: contract → pool → set `NEXT_PUBLIC_CONTRACT`,
   `POOL_ID` in `lib/chain.ts`, `GECKO_TERMINAL_POOL_ID` in
   `lib/market/constants.ts`, fill in `content/transparency.ts`
   `OFFICIAL_WALLETS`, populate the HANSOME token-list JSON `tokens` array.
5. Decide on `contracts/UglyDeer.sol` — rename/rewrite as a new
   `HansomeAlpacas.sol` (or equivalent) before any deployment.
6. Rewrite `docs/` launch/ops docs and `launch/` listing submission files
   once step 4 is done — CoinGecko/CoinMarketCap/GeckoTerminal/DexScreener
   submissions all require a live contract + pool anyway.
7. Run `npm run lint` and `npm run build` before shipping (already
   verified clean after wiring in the real mascot).
8. `lib/og-image.tsx` (dynamic favicon/apple-icon via `next/og`) was
   recolored to the pasture palette. `scripts/social-preview.mjs` (the
   static OG/Twitter share-card generator — black/gold "premium coin"
   look) was **intentionally left as-is**: it's a bigger, more elaborate
   rewrite (glow/vignette/highlight gradients all tuned for a dark
   backdrop) and isn't rendered on the site itself, only in link previews.
   Worth revisiting once the pixel redesign settles, but not required for
   the site's own visual consistency.
