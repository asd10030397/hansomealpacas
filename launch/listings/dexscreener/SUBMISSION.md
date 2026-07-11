# DEX Screener — Token Info 更新申請

## 重要說明

DEX Screener **不需要**「上架申請表」即可顯示交易對：

> 只要 Token 在支援的 DEX 上有流動性池且至少有一筆 swap，就會**自動索引**。

本文件用於更新 **Logo、描述、社群連結**（Enhanced Token Info）。

- 官方說明：https://docs.dexscreener.com/token-listing
- 搜尋入口：https://dexscreener.com

## 第一步：確認已自動索引

1. 開啟 https://dexscreener.com
2. 搜尋 `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` 或 `UGLY`
3. 選擇 **Robinhood** 鏈上的 **ETH/UGLY** 交易對

若尚未出現：

- 確認 v4 池 `0x7b0294...` 有流動性
- 在 https://kairu.lol/swap 執行至少一筆 swap
- 等待 2–30 分鐘後重新搜尋

## 第二步：Update Token Info

在 Token / Pair 頁面點 **「Update Token Info」**（或 Marketplace 表單）。

> ⚠️ 部分鏈需付費（常見約 $300 SOL 等值，**以表單頁當下顯示為準**）。Robinhood Chain 支援情況請以 DEX Screener UI 為準。

## 表單欄位 — 直接填寫

| 表單欄位 | 填寫內容 |
|----------|----------|
| **Chain** | Robinhood / Robinhood Chain |
| **Token Address** | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| **Project Description** | 貼上 [`description.txt`](./description.txt)（≤500 字元） |
| **Website** | https://kairu.lol |
| **Documentation** | https://kairu.lol/token-list |
| **Twitter / X** | https://x.com/DeerloveRu |
| **Telegram** | *(留空)* |
| **Discord** | *(留空)* |
| **Token Icon** | 上傳 [`../assets/logo-256.png`](../assets/logo-256.png)（≥256×256 正方形 PNG） |
| **Token Header / Banner** | 上傳 [`../assets/banner-3x1.png`](../assets/banner-3x1.png)（3:1，≥600px 寬，選填） |
| **Locked Supply** | *(選填 — LP 在 Uniswap v4 Position NFT #39790，可說明由 Treasury 管理)* |
| **Contact** | *(選填 — Telegram / Discord 聯絡方式加速審核)* |

### Description（`description.txt`）

```
UGLY DEER ($UGLY) is a community-driven meme token on Robinhood Chain (4663). Trade ETH/UGLY on kairu.lol via Uniswap v4. Zero tax. 1B supply. Official site lists contract, swap, and token list.
```

## 機器可讀欄位

見 [`form-fields.json`](./form-fields.json)

## Pool 參考

| 欄位 | 值 |
|------|-----|
| DEX | Uniswap v4 |
| Pair | ETH / UGLY |
| Pool ID | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |
| Fee | 0.05% |

## 審核與時程

- 人工審核，通常 **24–72 小時**
- 連結失效、描述過短、Logo 非正方形常見拒絕原因
- 拒絕後可修正再提交（可能需再付費）

## 免費替代路徑

若平台從第三方列表抓取 metadata，可先完成：

- Trust Wallet assets PR
- 官網 Token List：https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json
- CoinGecko listing（通過後 DEX Screener 常自動同步）

---

© 2026 UGLY DEER
