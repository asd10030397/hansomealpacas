# GeckoTerminal — Token Info 更新申請

## 提交入口

| 項目 | 連結 |
|------|------|
| **表單（主要）** | https://www.geckoterminal.com/update-token-info |
| **說明文件** | https://support.coingecko.com/hc/en-us/articles/22612245806745 |
| **網路 slug** | `robinhood`（Robinhood Chain） |

> 若 Token **已上 CoinGecko**，需改在 CoinGecko 更新，GeckoTerminal 會同步。

## 前置步驟

1. 開啟 GeckoTerminal → 選 **Robinhood** 網路
2. 搜尋合約 `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` 或池子 **ETH/UGLY**
3. 進入 Token 頁 → **Token Info** → **Update Token Info**（或直接用上方表單連結）
4. 使用專案官方 Email，完成 **OTP 驗證**

## 表單欄位 — 直接填寫

| 表單欄位 | 填寫內容 |
|----------|----------|
| **Network / Chain** | Robinhood Chain |
| **Token Contract Address** | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| **Token Name** | Ugly Deer |
| **Token Symbol** | UGLY |
| **Logo URL** | https://kairu.lol/logo/logo-256.png |
| **Website** | https://kairu.lol |
| **Project Description** | 見下方 Description 區塊 |
| **Twitter / X** | https://x.com/DeerloveRu |
| **Telegram** | *(留空或稍後補)* |
| **Discord** | *(留空)* |
| **GitHub** | https://github.com/asd10030397/KAIRU |
| **Whitepaper** | *(無 — 留空)* |
| **Explorer** | https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |

### Description（貼上）

```
UGLY DEER ($UGLY) is a community meme token on Robinhood Chain (chain ID 4663). Users swap ETH/UGLY on the official site kairu.lol/swap via Uniswap v4. Total supply: 1B. Decimals: 18. Tax: 0%. Contract address is published on kairu.lol and Blockscout.
```

## 流動性 / Pool 參考（審核用）

| 欄位 | 值 |
|------|-----|
| DEX | Uniswap v4 |
| Pair | ETH / UGLY |
| Fee | 0.05% (500) |
| Pool ID | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |
| Swap | https://kairu.lol/swap |

## 驗證要求（GeckoTerminal 常見拒絕原因）

- [ ] 合約地址出現在 **https://kairu.lol** 的 Contract 區塊
- [ ] 合約地址出現在 **@DeerloveRu** 官方 X（bio、置頂或發文）
- [ ] Logo URL 可公開存取（512×512 PNG）
- [ ] 網站可正常開啟，非 placeholder
- [ ] 勿重複提交相同請求（24h 內）

## Fast Pass（選用）

GeckoTerminal 提供付費 Fast Pass 加速 Token Info 審核（價格以表單頁為準）。**非必須**；標準審核通常 24 小時內。

## 提交後

- 記錄提交 Email 與時間
- 在 [`CHECKLIST.md`](../CHECKLIST.md) 更新狀態
- 核准後確認 Token 頁顯示 Logo、Website、X 連結

---

© 2026 UGLY DEER
