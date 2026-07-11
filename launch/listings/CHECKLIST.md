# 平台上架 Checklist

複製此表到 issue / Notion 追蹤進度。完成一項打 `[x]`。

## Pre-flight

- [ ] `curl -I` 全部 URL 200（見 README）
- [ ] 官網 Contract 區塊顯示 CA
- [ ] X @DeerloveRu 置頂或 bio 含 kairu.lol + 合約
- [ ] 至少一筆 ETH↔UGLY swap 已發生（DEX 索引用）

## Trust Wallet

- [ ] Fork https://github.com/trustwallet/assets
- [ ] 複製 `launch/listings/trust-wallet/assets/` 至 fork
- [ ] 路徑：`blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/`
- [ ] PR 標題與 body 使用 `trust-wallet/PR_BODY.md`
- [ ] PR merged

## GeckoTerminal

- [ ] 在 GeckoTerminal 搜尋 UGLY 合約或 ETH/UGLY 池
- [ ] 開啟 https://www.geckoterminal.com/update-token-info
- [ ] 依 `geckoterminal/SUBMISSION.md` 填表
- [ ] Email OTP 驗證
- [ ] 收到核准 / 拒絕原因

## DEX Screener

- [ ] 搜尋 https://dexscreener.com 是否已有 UGLY 交易對
- [ ] 若無：確認 v4 池有 swap 交易後等待自動索引
- [ ] 點 Pair 頁「Update Token Info」
- [ ] 上傳 `assets/logo-256.png` + `description.txt`
- [ ] 填 website / X links
- [ ] 付費確認（若平台顯示費用）並等待 24–72h

## CoinGecko

- [ ] 開啟 https://www.coingecko.com/en/coins/new
- [ ] 依 `coingecko/SUBMISSION.md` 填表
- [ ] 合約已在官網 + X 公開
- [ ] 提交後記錄 ticket / 回信

## CoinMarketCap

- [ ] 開啟 https://coinmarketcap.com/request/
- [ ] 選擇 Add New Cryptocurrency（或 Info Update）
- [ ] 依 `coinmarketcap/SUBMISSION.md` 填表
- [ ] 提交後記錄 request ID

## Post-submission

- [ ] 各平台 Token 頁 Logo 顯示正確
- [ ] FDV / Market Cap 與 1B supply 一致
- [ ] Chart 連結更新至 `NEXT_PUBLIC_CHART`（若需要）

---

| 平台 | 提交日期 | Request ID / PR | 狀態 | 備註 |
|------|----------|-----------------|------|------|
| Trust Wallet | | | Pending | |
| GeckoTerminal | | | Pending | |
| DEX Screener | | | Pending | |
| CoinGecko | | | Pending | |
| CoinMarketCap | | | Pending | |
