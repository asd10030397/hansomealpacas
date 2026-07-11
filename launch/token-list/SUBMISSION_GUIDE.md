# UGLY Token Logo ? Submission Guide

Token metadata and logo assets for **UGLY DEER ($UGLY)** on Robinhood Chain (4663).

| Field | Value |
| ----- | ----- |
| Name | Ugly Deer |
| Symbol | UGLY |
| Decimals | 18 |
| Contract | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| Chain ID | 4663 |
| Explorer | https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |

---

## 1. Where each platform gets token logos

| Platform | Primary logo source | How UGLY gets a logo |
| -------- | ------------------- | -------------------- |
| **Uniswap Web App** | [Uniswap Default Token List](https://github.com/Uniswap/default-token-list) (`logoURI` per token); also [Uniswap/assets](https://github.com/Uniswap/assets) CDN | PR to default-token-list **or** user imports hosted token list (see below) |
| **MetaMask** | Token lists, CoinGecko, [contract-metadata](https://github.com/MetaMask/contract-metadata) (frozen); [EIP-747](https://docs.metamask.io/wallet/how-to/display/tokens/) for dApp prompt | Trust Wallet assets PR + hosted token list; optional `wallet_watchAsset` on site |
| **Rabby** | [DeBank](https://debank.com) backend (`logo_url` in OpenAPI) ? Rabby is built by DeBank | DeBank token listing request **or** Trust Wallet assets (partial propagation) |
| **Trust Wallet** | [trustwallet/assets](https://github.com/trustwallet/assets) GitHub repo | PR with `info.json` + `logo.png` |
| **Blockscout** | On-chain metadata + [Token Name Service (TKN)](https://tkn.xyz) + CoinGecko/CMC | Submit to TKN with logo URL |

**Immediate workaround (no PR wait):** Import token list in Uniswap ? Settings ? Manage lists ? paste:

```
https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json
```

---

## 2. Hosted Uniswap Token List (ready)

| File | URL (after deploy) |
| ---- | ------------------ |
| Token list JSON | https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json |
| Logo 256×256 (primary) | https://kairu.lol/logo/logo-256.png |
| Logo 512×512 (upscale) | https://kairu.lol/logo/logo-512.png |
| Logo SVG | https://kairu.lol/logo/logo.svg |

Local source: [`public/token-list/ugly-deer-robinhood.tokenlist.json`](../../public/token-list/ugly-deer-robinhood.tokenlist.json)

Conforms to [Token Lists spec](https://tokenlists.org/) v1.0.0.

---

## 3. Blockscout / Token Name Service (TKN)

Blockscout queries **TKN** for name, logo, description, and social links.

### Steps

1. Go to https://tkn.xyz and connect wallet.
2. Click **Edit Data** ? add row for UGLY.
3. Fill fields:

| TKN field | Value |
| --------- | ----- |
| Ticker | UGLY |
| Description | UGLY DEER ? meme coin on Robinhood Chain |
| URL | https://kairu.lol |
| Contract Address | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| Token Decimals | 18 |
| Twitter | https://x.com/DeerloveRu |
| Logo | `https://kairu.lol/logo/logo-256.png` (paste in logo field / upload) |

4. Submit on-chain edit; TKN stakers review after timelock.
5. After acceptance, Blockscout token page shows logo in info dropdown.

**Note:** ERC-20 contracts do not store logos on-chain. Blockscout does **not** accept direct logo uploads per token ? TKN is the supported path.

---

## 4. GitHub PR ? Trust Wallet / Uniswap Assets

Folder in repo: [`submissions/trustwallet-assets/`](./submissions/trustwallet-assets/)

### Target repo

- https://github.com/trustwallet/assets (Trust Wallet, MetaMask, many aggregators)
- Optional mirror: https://github.com/Uniswap/assets (Uniswap CDN ? same layout)

### Files to add

```
blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/
??? info.json
??? logo.png          ? 256�256 PNG (copy from public/logo/logo-256.png)
```

Copy logo before PR:

```bash
cp public/logo/logo-256.png \
  launch/token-list/submissions/trustwallet-assets/blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/logo.png
```

### PR title

```
Add UGLY (Ugly Deer) on Robinhood Chain
```

### PR body (template)

```markdown
## Summary
Add logo and metadata for UGLY DEER ($UGLY) on Robinhood Chain (chain ID 4663).

## Token info
- **Name:** Ugly Deer
- **Symbol:** UGLY
- **Decimals:** 18
- **Contract:** 0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c
- **Chain:** Robinhood Chain (4663)
- **Website:** https://kairu.lol
- **Explorer:** https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c

## Checks
- [x] `info.json` follows asset guidelines
- [x] `logo.png` is 256�256 PNG
- [x] Contract is deployed and verified on Blockscout
- [x] Website is live

## Fee
Happy to pay the required processing fee per Trust Wallet guidelines.
```

---

## 5. GitHub PR ? Uniswap Default Token List

File: [`submissions/uniswap-default-token-list/token-entry.json`](./submissions/uniswap-default-token-list/token-entry.json)

### Target repo

https://github.com/Uniswap/default-token-list

### Steps

1. Fork repo, branch `add-ugly-robinhood`.
2. Append entry to **`src/tokens/robinhood.json`** (end of array).
3. Run `npm test && npm run build`.
4. Open PR.

### PR title

```
add: UGLY (2026-07-11)
```

### PR body

```markdown
## Token
| Field | Value |
|-------|-------|
| Chain | Robinhood Chain (4663) |
| Address | 0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |
| Name | Ugly Deer |
| Symbol | UGLY |
| Decimals | 18 |
| logoURI | https://kairu.lol/logo/logo-256.png |

## Links
- Website: https://kairu.lol
- Explorer: https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c
```

Uniswap Labs typically processes via internal Linear tickets; community PRs may take longer.

---

## 6. Rabby / DeBank

Rabby reads `logo_url` from DeBank?s token database.

1. Ensure token is visible on https://debank.com (search contract on Robinhood Chain).
2. If missing or no logo: contact DeBank via https://debank.com/about (official listing) or Rabby support with:
   - Chain: Robinhood Chain (4663)
   - Contract, name, symbol, decimals
   - Logo URL: `https://kairu.lol/logo/logo-256.png`
   - Website: `https://kairu.lol`

Trust Wallet assets merge often propagates to other wallets over time.

---

## 7. Logo file requirements

| Use case | File | Size | Format |
| -------- | ---- | ---- | ------ |
| **Canonical PNG** | `logo-256.png` | **256�256** | PNG ? token list `logoURI`, wallet_watchAsset |
| Trust Wallet / GitHub assets PR | `logo.png` (256 copy) | **256�256** | PNG, square |
| Platform upload (512 required) | `logo-512.png` | **512�512** | PNG ? upscaled from logo-256 only |
| Website UI | `coin.svg` | scalable | SVG |

Generate assets:

```bash
npm run generate:assets
```

Outputs: `public/logo/logo-256.png` (canonical), `public/logo/logo-512.png` (upscaled from 256).

**Guidelines:**
- Square aspect ratio
- Readable at 32�32 (wallet list)
- No animated GIF for primary logo
- Prefer opaque or simple background (Trust Wallet rejects cluttered images)

---

## 8. MetaMask ? EIP-747 (optional, site integration)

For visitors who add UGLY manually, call `wallet_watchAsset` with image URL:

```javascript
await provider.request({
  method: 'wallet_watchAsset',
  params: {
    type: 'ERC20',
    options: {
      address: '0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c',
      symbol: 'UGLY',
      decimals: 18,
      image: 'https://kairu.lol/logo/logo-256.png',
    },
  },
});
```

---

## 9. Pre-flight checklist

```bash
curl -I https://kairu.lol/logo/logo-256.png
curl -I https://kairu.lol/logo/logo-256.png
curl -I https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json
```

- [ ] All URLs return HTTP 200
- [ ] `Content-Type` is `image/png` or `application/json`
- [ ] Token list validates at https://tokenlists.org/
- [ ] Trust Wallet PR includes 256�256 `logo.png`
- [ ] TKN submission completed for Blockscout
- [ ] Site redeployed so `/token-list/` is live

---

� 2026 UGLY DEER
