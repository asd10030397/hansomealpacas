# KAIRU Launch Day Operations

Official launch-day runbook for KAIRU on Solana.

Use this document on launch day. Check items in order. Do not skip redeploy.

Reference: `content/project.ts` · `.env.example` · `npm run release:check`

---

## PRE-LAUNCH

Complete before creating or publishing the token.

- [ ] Website deployed
- [ ] Domain connected
- [ ] SSL working
- [ ] X account ready
- [ ] Telegram ready
- [ ] Logo exported
- [ ] Contract wallet funded
- [ ] SOL balance checked
- [ ] Contract address prepared

### Notes

| Item | Location / Action |
| ---- | ----------------- |
| Website | Vercel dashboard → confirm production deployment |
| Domain | Vercel → Settings → Domains → DNS verified |
| SSL | Confirm `https://` loads without warnings |
| X account | Avatar: `public/images/avatar.png` · Banner: `public/images/twitter-banner.png` |
| Telegram | Banner: `public/images/telegram-banner.png` |
| Logo | `public/logo/logo.svg` · `public/logo/logo-512.png` |
| Wallet | Launch wallet funded with enough SOL for mint + fees |
| SOL balance | Record balance: `__________` SOL |
| Contract address | Leave blank until mint is confirmed |

### Pre-launch command

```bash
npm run release:check
```

Review output in `docs/RELEASE_REPORT.md` before proceeding.

---

## TOKEN

Fill in at mint. Do not publish until all fields are confirmed.

| Field | Value |
| ----- | ----- |
| **Name** | KAIRU |
| **Ticker** | KAIRU |
| **Chain** | Solana |
| **Decimals** | |
| **Supply** | |
| **Mint authority** | |
| **Freeze authority** | |
| **Metadata** | |
| **Logo** | `public/logo/logo-512.png` |
| **Description** | KAIRU is a deer that never reacts. |

### Token checklist

- [ ] Name verified on-chain
- [ ] Ticker verified on-chain
- [ ] Decimals set
- [ ] Supply minted
- [ ] Mint authority revoked (if applicable)
- [ ] Freeze authority revoked (if applicable)
- [ ] Metadata uploaded
- [ ] Logo attached to metadata
- [ ] Description matches website
- [ ] Contract address saved securely

### Contract address

```
NEXT_PUBLIC_CONTRACT=
```

Store backup copy in `launch/assets/`.

---

## AFTER LAUNCH

Execute in this order immediately after mint is confirmed.

- [ ] Update website
- [ ] Update env vars
- [ ] Redeploy
- [ ] Publish contract
- [ ] Update X bio
- [ ] Pin tweet
- [ ] Update Telegram
- [ ] Publish buy link
- [ ] Publish chart

### Environment variables

Set in Vercel → Settings → Environment Variables:

```env
NEXT_PUBLIC_WEBSITE=https://your-domain.com
NEXT_PUBLIC_X=https://x.com/kairu
NEXT_PUBLIC_TELEGRAM=https://t.me/kairu
NEXT_PUBLIC_CONTRACT=
NEXT_PUBLIC_BUY=
NEXT_PUBLIC_CHART=
```

No code changes required. Values are read from env at build time.

### Redeploy

1. Save env vars in Vercel
2. Trigger redeploy (Production)
3. Wait for build to complete
4. Confirm website shows contract (`xxxx...xxxx`)
5. Confirm Copy button works
6. Confirm Buy button is enabled
7. Confirm Chart link works

### Verify

```bash
npm run release:check
```

- [ ] Contract visible on site
- [ ] Copy button copies full address
- [ ] Buy link opens correctly
- [ ] Chart link opens correctly
- [ ] Share card works

### Social updates

| Platform | Action |
| -------- | ------ |
| X bio | Add website + tagline: 又到了嚕館的時間了。 |
| X pin | Pin Tweet #1 (see Marketing) |
| Telegram | Pin announcement (see Marketing) |
| Telegram bio | Add contract + links |

---

## MARKETING

Tone: short, dry, deadpan. Never over-explain.

### Tweet #1 — Launch

```
KAIRU

又到了嚕館的時間了。

[website]
```

- [ ] Posted
- [ ] Pinned

### Tweet #2 — Contract

```
contract

[contract address]
```

- [ ] Posted

### Tweet #3 — Still here

```
😑
```

- [ ] Posted

### Telegram announcement

```
KAIRU

又到了嚕館的時間了。

KAIRU is a deer that never reacts.

Website: [website]
Contract: [contract address]
Buy: [buy link]
Chart: [chart link]
```

- [ ] Posted
- [ ] Pinned

### Discord announcement

```
KAIRU is live on Solana.

又到了嚕館的時間了。

Website: [website]
Contract: [contract address]
Chart: [chart link]
```

- [ ] Posted
- [ ] Pinned (if applicable)

---

## TRACKING

Submit after launch. Not all platforms index immediately.

| Platform | URL | Status |
| -------- | --- | ------ |
| **DexScreener** | https://dexscreener.com | [ ] Submitted [ ] Listed |
| **GeckoTerminal** | https://www.geckoterminal.com | [ ] Submitted [ ] Listed |
| **CoinGecko** | https://www.coingecko.com/en/coins/new | [ ] Submitted [ ] Listed |
| **CoinMarketCap** | https://coinmarketcap.com/request/ | [ ] Submitted [ ] Listed |
| **GMGN** | https://gmgn.ai | [ ] Submitted [ ] Listed |
| **Birdeye** | https://birdeye.so | [ ] Submitted [ ] Listed |

### Submission info (copy-paste)

| Field | Value |
| ----- | ----- |
| Name | KAIRU |
| Symbol | KAIRU |
| Chain | Solana |
| Contract | |
| Website | |
| Logo | `public/logo/logo-512.png` |
| Description | KAIRU is a deer that never reacts. |

---

## CHECKLIST

Master launch-day checklist. All items must be complete before calling launch done.

### Infrastructure

- [ ] Website live on production domain
- [ ] SSL valid
- [ ] `npm run release:check` passes

### Token

- [ ] Token minted on Solana
- [ ] Contract address recorded
- [ ] Metadata live
- [ ] Authorities configured as planned

### Website

- [ ] Env vars updated in Vercel
- [ ] Redeploy complete
- [ ] Contract displayed on site
- [ ] Copy button works
- [ ] Buy link live
- [ ] Chart link live

### Social

- [ ] Tweet #1 posted and pinned
- [ ] Tweet #2 posted
- [ ] Tweet #3 posted
- [ ] Telegram announcement posted and pinned
- [ ] Discord announcement posted
- [ ] X bio updated
- [ ] Telegram pin updated

### Tracking

- [ ] DexScreener submitted
- [ ] GeckoTerminal submitted
- [ ] CoinGecko submitted
- [ ] CoinMarketCap submitted
- [ ] GMGN submitted
- [ ] Birdeye submitted

### Archive

- [ ] Screenshot website with contract → `launch/assets/`
- [ ] Screenshot pinned tweet → `launch/assets/`
- [ ] Screenshot chart → `launch/assets/`
- [ ] Update `launch/launch-checklist.md` status

---

## Launch complete

When every box above is checked:

```
又到了嚕館的時間了。
```

KAIRU does not react to launches either.

---

© 2026 KAIRU
