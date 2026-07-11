# UGLY DEER — 平台上架申請包

`launch/listings/` 內含 **GeckoTerminal、DEX Screener、CoinGecko、CoinMarketCap、Trust Wallet** 五個平台的完整申請資料，可直接複製貼上或上傳提交。

## 快速開始

1. 閱讀 [`TOKEN_CORE.md`](./TOKEN_CORE.md) — 所有平台共用欄位
2. 執行 Pre-flight（下方）
3. 依 [`CHECKLIST.md`](./CHECKLIST.md) 順序提交各平台

## 資料夾結構

```
launch/listings/
├── README.md                 ← 本文件
├── CHECKLIST.md              ← 提交順序與狀態追蹤
├── TOKEN_CORE.json           ← 機器可讀核心 metadata
├── TOKEN_CORE.md             ← 人工 copy-paste 對照表
├── assets/
│   ├── logo-256.png          ← 256×256（Trust Wallet / DEX Screener）
│   ├── logo-512.png          ← 512×512（CoinGecko / CMC / URL 引用）
│   └── banner-3x1.png        ← 橫幅（DEX Screener 選填）
├── geckoterminal/
│   └── SUBMISSION.md
├── dexscreener/
│   ├── SUBMISSION.md
│   └── description.txt
├── coingecko/
│   ├── SUBMISSION.md
│   └── description.txt
├── coinmarketcap/
│   ├── SUBMISSION.md
│   └── description.txt
└── trust-wallet/
    ├── SUBMISSION.md
    ├── PR_BODY.md
    └── assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/
        ├── info.json
        └── logo.png
```

## Pre-flight（提交前必做）

```bash
curl -I https://kairu.lol/logo/logo-256.png
curl -I https://kairu.lol/logo/logo-512.png
curl -I https://kairu.lol/logo/logo-256.png
curl -I https://kairu.lol/token-list/ugly-deer-robinhood.tokenlist.json
curl -I https://kairu.lol/swap
```

確認：

- [ ] 官網 https://kairu.lol 可開啟
- [ ] 合約地址顯示於 https://kairu.lol/#contract
- [ ] `/swap` 可正常開啟
- [ ] Blockscout Token 頁可開啟
- [ ] X 帳號 @DeerloveRu 可開啟，且 bio/置頂含官網或合約
- [ ] Logo URL 回傳 `200` 且 `Content-Type: image/png`

## 平台入口

| 平台 | 提交方式 | 文件 |
|------|----------|------|
| **GeckoTerminal** | 線上表單（Token Info Update） | [geckoterminal/SUBMISSION.md](./geckoterminal/SUBMISSION.md) |
| **DEX Screener** | 自動索引 + 付費/表單更新 Token Info | [dexscreener/SUBMISSION.md](./dexscreener/SUBMISSION.md) |
| **CoinGecko** | 線上 Listing / Info Update 表單 | [coingecko/SUBMISSION.md](./coingecko/SUBMISSION.md) |
| **CoinMarketCap** | 線上 Request 表單 | [coinmarketcap/SUBMISSION.md](./coinmarketcap/SUBMISSION.md) |
| **Trust Wallet** | GitHub PR → trustwallet/assets | [trust-wallet/SUBMISSION.md](./trust-wallet/SUBMISSION.md) |

## 建議提交順序

1. **Trust Wallet** — 免費 PR，錢包 Logo 最快
2. **GeckoTerminal** — DEX 圖表 Logo / 描述（Robinhood 鏈已支援）
3. **DEX Screener** — 確認池子已索引後更新 Enhanced Token Info
4. **CoinGecko** — 需一定交易量與可驗證資訊
5. **CoinMarketCap** — 通常需 CoinGecko 或更高曝光後較易通過

## 重要提醒

- 合約地址必須出現在**官網**與**官方 X**，各平台會交叉驗證
- Robinhood Chain 為新鏈，部分平台審核可能較慢；表單中請明確填 **Chain ID 4663**
- 勿使用非官方「代提交」服務；GeckoTerminal / CoinGecko 官方更新為免費（Fast Pass 為選付）
- 本 repo **不修改智能合約**；僅提交前端與 metadata

---

© 2026 UGLY DEER
