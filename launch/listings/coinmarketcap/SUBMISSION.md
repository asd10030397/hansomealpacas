# CoinMarketCap — 新幣 / 資訊更新申請

## 提交入口

| 項目 | 連結 |
|------|------|
| **Request 表單** | https://coinmarketcap.com/request/ |
| **Listing 指南** | https://support.coinmarketcap.com/hc/en-us/articles/360017031651 |

## 申請類型

首次提交選 **「Add New Cryptocurrency」**（或表單中等效選項）。

已上架後更新 Logo / 連結選 **「Update Existing Cryptocurrency」**。

## 表單欄位 — 直接填寫

| 表單欄位 | 填寫內容 |
|----------|----------|
| **Cryptocurrency Name** | Ugly Deer |
| **Symbol / Ticker** | UGLY |
| **Platform / Blockchain** | Robinhood Chain |
| **Contract Address** | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| **Decimals** | 18 |
| **Total Supply** | 1,000,000,000 |
| **Circulating Supply** | 1,000,000,000 |
| **Max Supply** | 1,000,000,000 |
| **Website (Official)** | https://kairu.lol |
| **Technical Documentation** | https://kairu.lol/token-list |
| **Source Code** | https://github.com/asd10030397/KAIRU |
| **Explorer** | https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |
| **Twitter** | https://x.com/DeerloveRu |
| **Telegram** | *(留空)* |
| **Discord** | *(留空)* |
| **Logo** | 上傳 [`../assets/logo-512.png`](../assets/logo-512.png)（透明或纯色背景，≥200×200） |
| **Project Description** | 貼上 [`description.txt`](./description.txt) |
| **Launch Date** | 2026-07-11 |
| **Category** | Meme / Token |

### Description（`description.txt`）

見同目錄 `description.txt`。

## 交易所 / 市場

| 欄位 | 值 |
|------|-----|
| **DEX Name** | Uniswap v4 |
| **Market Pair** | ETH/UGLY |
| **Chain ID** | 4663 |
| **Swap Page** | https://kairu.lol/swap |
| **Pool ID** | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |

## CMC 審核要點

- 合約必須在**官網明顯位置**公布（kairu.lol/#contract）
- 需有**可驗證交易量**；建議先完成 CoinGecko 或 DEX 圖表索引
- 提供**官方 X** 證明所有權（置頂貼文含合約 + 網站）
- 勿提交錯誤 chain 的合約地址

## 建議 X 置頂貼文範本

```
UGLY DEER ($UGLY) is LIVE on Robinhood Chain 🦌

🌐 https://kairu.lol
💱 Swap: https://kairu.lol/swap
📜 CA: 0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c
🔍 https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c

Born ugly. Built different. Not financial advice.
```

## 表單備註（Additional Comments）

```
ERC-20 on Robinhood Chain (chainId 4663). Live Uniswap v4 ETH/UGLY pool. Official swap at kairu.lol/swap. Token list: kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json. 0% tax, 1B fixed supply. Community meme token — no utility promises.
```

## 提交後

- 記錄 CMC request confirmation
- 通過後更新 `launch/metadata/token.json` → `extensions.coinmarketcap_id`
- 在 [`CHECKLIST.md`](../CHECKLIST.md) 標記完成

---

© 2026 UGLY DEER
