# Pull Request Templates

Copy-paste ready content for external GitHub PRs.

---

## A. trustwallet/assets

**Repo:** https://github.com/trustwallet/assets  
**Branch:** `add-ugly-robinhoodchain`  
**Files:** copy from [`submissions/trustwallet-assets/blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/`](./submissions/trustwallet-assets/blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/)

**Title:**
```
Add UGLY (Ugly Deer) on Robinhood Chain
```

**Body:**
```markdown
## Summary
Add logo and metadata for UGLY DEER ($UGLY) on Robinhood Chain (chain ID 4663).

## Token info
| Field | Value |
|-------|-------|
| Name | Ugly Deer |
| Symbol | UGLY |
| Decimals | 18 |
| Contract | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| Chain | Robinhood Chain (4663) |
| Website | https://kairu.lol |
| Explorer | https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |

## Asset files
- `blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/info.json`
- `blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/logo.png` (256?256)

## Checks
- [x] Logo is 256?256 PNG
- [x] Contract deployed on Robinhood Chain mainnet
- [x] Website live at kairu.lol
- [x] Explorer link verified
```

---

## B. Uniswap/default-token-list

**Repo:** https://github.com/Uniswap/default-token-list  
**File to edit:** `src/tokens/robinhood.json` (append entry from [`token-entry.json`](./submissions/uniswap-default-token-list/token-entry.json))

**Title:**
```
add: UGLY (2026-07-11)
```

**Body:**
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

**After edit:**
```bash
npm test
npm run build
```

---

## C. Uniswap/assets (optional mirror)

Same folder structure as Trust Wallet PR. Uniswap interface may serve logos from:

```
https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/logo.png
```

Use the same PR title/body as trustwallet/assets.

---

© 2026 UGLY DEER
