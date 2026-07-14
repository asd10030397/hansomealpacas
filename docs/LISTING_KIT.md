# HANSOME ALPACAS — Listing Kit

Single reference sheet for submitting HANSOME ALPACAS to market data / DEX
aggregator platforms (GeckoTerminal, DEX Screener, DexTools, CoinGecko,
CoinMarketCap). Copy the fields below directly into each platform's
submission form.

Do not edit contract values here — this file only documents what is already
live on-chain (see `content/project.ts` and `lib/chain.ts` for the
machine-readable source of truth).

---

## 1. Core Token Info

| Field | Value |
| ----- | ----- |
| **Token Name** | Hansome Alpacas |
| **Symbol / Ticker** | HANSOME |
| **Chain** | Robinhood Chain |
| **Chain ID** | 4663 |
| **Contract Address** | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Decimals** | 18 |
| **Total Supply** | 1,000,000,000 HANSOME |
| **Tax / Fee on transfer** | 0% |
| **Mint function** | None (fixed supply, minted once at deploy) |
| **Blacklist / whitelist** | None |
| **Owner privileges** | None (no `Ownable`, no admin functions) |
| **Contract standard** | ERC-20 (OpenZeppelin `ERC20`) |
| **License** | MIT |
| **Solidity version** | 0.8.24 |
| **Source** | `contracts/contracts/HansomeAlpacas.sol` |

## 2. Liquidity / Pool

| Field | Value |
| ----- | ----- |
| **DEX** | Uniswap v4 |
| **Pool** | ETH / HANSOME |
| **Pool ID** | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |
| **Fee tier** | 0.05% (500) |
| **Tick spacing** | 10 |
| **Hooks** | None (zero address) |
| **Position NFT** | #47299 |
| **Position owner** | Treasury wallet — `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Liquidity deposited** | 50,000,000 HANSOME + 0.075 ETH |

## 3. Links

| Field | Value |
| ----- | ----- |
| **Official Website** | https://hansomealpacas.xyz |
| **Swap page** | https://hansomealpacas.xyz/swap |
| **Transparency / official wallets** | https://hansomealpacas.xyz/transparency |
| **Token list (EIP-3770 style)** | https://hansomealpacas.xyz/token-list/hansome-alpacas-robinhood.tokenlist.json |
| **X (Twitter)** | https://x.com/HansomeAlpacas |
| **Telegram** | https://t.me/HandsomeAlpacasCommunity |
| **Discord** | Not set up |
| **GitHub** | Not public |
| **Whitepaper** | None (meme coin, no utility promises) |

## 4. Block Explorer (contract)

| Field | Value |
| ----- | ----- |
| **Explorer** | Blockscout (Robinhood Chain) |
| **Contract page** | https://robinhoodchain.blockscout.com/address/0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875 |
| **Verification status** | ⚠️ Pending re-check — `verify:robinhood` previously failed due to a transient Blockscout API error (HTML/500 response), not a code issue. Re-run `npm run verify:robinhood` from `contracts/` and confirm the "Contract" tab shows verified source before submitting to CoinGecko/CoinMarketCap (both require a verified, readable contract). |

## 5. Logo / Brand Assets

| Asset | Path | Notes |
| ----- | ---- | ----- |
| Primary vector logo | `public/logo/coin.svg` | Use where SVG is accepted |
| Canonical PNG (256×256) | `public/logo/logo-256.png` | **Use this for listing submissions** — also the `logoURI` in the token list JSON |
| Upscaled PNG (512×512) | `public/logo/logo-512.png` | Use only if a platform requires 512×512 |
| Light/dark variants | `public/logo/logo-light.svg`, `public/logo/logo-dark.svg` | For platforms with theme-aware embeds |
| Monochrome | `public/logo/logo-monochrome.svg` | For single-color placements |
| Mascot cutout (transparent) | `public/logo/mascot-cutout.png` | For banners / social cards, not the token icon |
| Hosted logo URL (once deployed) | https://hansomealpacas.xyz/logo/logo-256.png | Paste this URL directly into forms that only accept a link instead of a file upload |

## 6. Description Copy

**Short (≤100 chars, for symbol/name-adjacent fields):**

> The alpaca that won the genetic lottery. Too handsome to be useful.

**Medium (~200–250 chars, for CoinGecko/CMC "Project Description"):**

> HANSOME ALPACAS ($HANSOME) is a community-driven meme coin on Robinhood
> Chain. No utility promises, no roadmap theatrics — just the best-looking
> alpaca in the ecosystem. Fixed supply, 0% tax, no mint, no blacklist, no
> owner controls.

**Category / tags:** Meme, Community, Robinhood Chain

---

## 7. Quick-copy block (plain text)

```
Name: Hansome Alpacas
Symbol: HANSOME
Chain: Robinhood Chain (Chain ID 4663)
Contract: 0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875
Decimals: 18
Total Supply: 1,000,000,000
Tax: 0%
DEX: Uniswap v4
Pool ID: 0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d
Fee tier: 0.05%
Website: https://hansomealpacas.xyz
Swap: https://hansomealpacas.xyz/swap
Explorer: https://robinhoodchain.blockscout.com/address/0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875
X: https://x.com/HansomeAlpacas
Telegram: https://t.me/HandsomeAlpacasCommunity
Logo: https://hansomealpacas.xyz/logo/logo-256.png
```

---

## 8. Platform-specific notes

### GeckoTerminal
- Indexes pools automatically once on-chain activity is detected; no manual
  submission form exists for new chains/pools in most cases.
- Expected pool URL once indexed: `https://www.geckoterminal.com/robinhood/pools/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d`
  (network slug `robinhood` matches `GECKO_TERMINAL_POOL_API` in
  `lib/market/constants.ts` — confirm the slug once the page resolves).
- Logo update request (if GeckoTerminal doesn't auto-pick up the token logo):
  https://www.geckoterminal.com/dashboard → "Update Token Info".

### DEX Screener
- Pools also index automatically; no submission form for basic listing.
- Paid "Enhanced Token Info" (socials, description, logo boost) requires
  their self-serve ad form — https://marketplace.dexscreener.com.
- Expected pool URL pattern: `https://dexscreener.com/robinhood/<pair-address>`
  — **unconfirmed**: verify DEX Screener supports the Robinhood Chain slug at
  all before relying on this link (see Section 9, item 3).

### DexTools
- Similar auto-indexing model; manual "Update Info" form exists per-pair
  once the pair page exists: https://www.dextools.io.

### CoinGecko
- Submission form: https://www.coingecko.com/en/coins/new
- Requires: verified contract, live trading (min. volume/liquidity, exact
  threshold not published), working website, active social accounts, and a
  square logo (min 200×200, ideally 512×512, transparent PNG).
- Typically wants the token already listed/trading for some days before
  approval.

### CoinMarketCap
- Submission form: https://coinmarketcap.com/request/
- Requires: verified contract source, functioning links (website, socials,
  explorer, chart), logo (PNG, 200×200 minimum, transparent background
  recommended), and a project description.
- CMC also asks for a project "category" (Meme) and whether the contract has
  been audited (see gap list below).

---

## 9. Missing / outstanding items before submitting

These are gaps found while assembling this kit — **no code was changed**,
this is a checklist for follow-up:

1. **Contract verification unresolved.** Mainnet `verify:robinhood` failed
   earlier due to a Blockscout API error (external, not a code bug). Must be
   re-run and confirmed green before CoinGecko/CoinMarketCap submission —
   both platforms reject unverified contracts.
2. **On-chain token list is stale.** `public/token-list/hansome-alpacas-robinhood.tokenlist.json`
   still has an empty `tokens: []` array and a comment saying "No contract
   deployed yet," even though the contract and pool are both live. Several
   wallets/aggregators read from token lists for logos/metadata — this file
   should be updated with the real token entry (address, decimals, symbol,
   `logoURI`) as a follow-up task.
3. **DEX Screener / DexTools chain support unconfirmed.** Neither platform's
   documented chain list was verified to include "Robinhood Chain" by name —
   confirm the pool page actually resolves before advertising those links
   publicly.
4. **No audit report.** CoinMarketCap's form asks whether the contract was
   audited. HANSOME ALPACAS has none — expected for a meme coin, but decide
   in advance how to answer that field (e.g. "unaudited, source verified and
   OpenZeppelin-based").
5. **No Discord / GitHub.** Some listing forms have optional Discord/GitHub
   fields; currently blank. Not blocking, but flagged since several
   platforms surface a "community score" that rewards having them.
6. **No recorded deployment transaction hash in the repo.** The deployment
   tx was reported in chat at deploy time but isn't persisted anywhere in
   the codebase/docs. Recommend saving it (plus the verify tx, if any) in
   this file or a `contracts/deployments/` record for future reference —
   it's often requested by listing reviewers as proof of deployment.
7. **Liquidity lock / vesting proof not published.** CoinGecko/CMC reviewers
   frequently ask whether LP is locked/burned. The Uniswap v4 position
   (#47299) is currently held directly by the Treasury wallet (not locked in
   a third-party locker contract) — decide whether to document this as-is or
   set up a lock before submitting, since "team-held LP" can trigger extra
   scrutiny or a lower trust score on some platforms.
8. **Trading history / volume.** Both CoinGecko and CoinMarketCap generally
   expect some organic trading history before approving a new listing — not
   something to fix in this doc, just a timing consideration for when to
   submit.

---

© 2026 HANSOME ALPACAS
