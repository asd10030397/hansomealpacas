# CoinGecko — 新幣 / 資訊更新申請

## 提交入口

| 項目 | 連結 |
|------|------|
| **新幣申請** | https://www.coingecko.com/en/coins/new |
| **資訊更新**（已上架後） | https://www.coingecko.com/en/coins/new → Info Update 或 Support 表單 |
| **Robinhood 生態分類** | https://www.coingecko.com/en/categories/robinhood-ecosystem |

## 資格提示

CoinGecko 通常要求：

- 合約在官網與社群**可公開驗證**
- 具備**真實鏈上流動性**與交易活動
- 官網有足夠專案說明（非單頁 placeholder）
- 非 honeypot / 高風險 scam 特徵

Robinhood Chain 已有其他 Token 上架先例；審核時間通常 **數天至數週**。

## 表單欄位 — 直接填寫

| 表單欄位 | 填寫內容 |
|----------|----------|
| **Coin Name** | Ugly Deer |
| **Ticker Symbol** | UGLY |
| **Blockchain / Platform** | Robinhood Chain |
| **Contract Address** | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| **Contract Decimal Places** | 18 |
| **Total Supply** | 1000000000 |
| **Circulating Supply** | 1000000000 *(或依實際流通調整)* |
| **Category** | Meme / Robinhood Ecosystem |
| **Website** | https://kairu.lol |
| **Official Twitter** | https://x.com/DeerloveRu |
| **Telegram** | *(留空)* |
| **Discord** | *(留空)* |
| **Explorer Link** | https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c |
| **Logo** | 上傳 [`../assets/logo-512.png`](../assets/logo-512.png) 或填 URL https://kairu.lol/logo/logo-512.png |
| **Description** | 貼上 [`description.txt`](./description.txt) |
| **Announcement / Proof** | 官網上線 + X 發文連結（含合約） |

### Description（`description.txt`）

完整英文說明見同目錄 `description.txt`。

## 交易市場（Markets）資訊

| 欄位 | 值 |
|------|-----|
| **Primary DEX** | Uniswap v4 (Robinhood Chain) |
| **Trading Pair** | ETH / UGLY |
| **Pool ID** | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |
| **Swap URL** | https://kairu.lol/swap |

## 提交前 Checklist

- [ ] https://kairu.lol 首頁可開，含 Contract 區塊
- [ ] https://kairu.lol/swap 可 swap
- [ ] X @DeerloveRu 發文含 `$UGLY` + 合約 + kairu.lol
- [ ] Blockscout token 頁可開
- [ ] Logo 512×512 PNG 清晰可讀

## 上架後

- CoinGecko slug 填入 `launch/metadata/token.json` → `extensions.coingecko_id`
- GeckoTerminal 會同步 CoinGecko 部分欄位
- DEX Screener 可能自動抓取 CoinGecko metadata

## 聯絡範本（Email / 表單備註）

```
Subject: Listing Request — UGLY DEER (UGLY) on Robinhood Chain

Hello CoinGecko team,

We request listing for UGLY DEER ($UGLY), an ERC-20 meme token on Robinhood Chain (4663).

Contract: 0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c
Website: https://kairu.lol
Explorer: https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c
Twitter: https://x.com/DeerloveRu
DEX: Uniswap v4 ETH/UGLY pool, swap at https://kairu.lol/swap

Supply: 1B, decimals 18, 0% tax. Contract is published on our official website.

Thank you,
UGLY DEER Team
```

---

© 2026 UGLY DEER
