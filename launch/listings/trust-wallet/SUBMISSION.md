# Trust Wallet — GitHub PR 申請

## 目標 Repo

https://github.com/trustwallet/assets

Trust Wallet、MetaMask（部分）、Rabby/DeBank（間接）等會引用此 repo 的 token logo。

## PR 檔案（已備好）

本目錄已包含可直接複製的 PR 檔案：

```
launch/listings/trust-wallet/assets/
└── 0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/
    ├── info.json
    └── logo.png          ← 256×256 PNG
```

## 提交步驟

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USER/assets.git
cd assets
git checkout -b add-ugly-robinhood-chain
```

### 2. 複製檔案

將本 repo 的檔案複製到 fork：

```
blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/
├── info.json
└── logo.png
```

PowerShell（從 KAIRU 根目錄）：

```powershell
$dest = "path\to\assets\blockchains\robinhoodchain\assets\0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item launch/listings/trust-wallet/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/* $dest
```

### 3. 驗證

```bash
# Trust Wallet 官方驗證工具（若 repo 有）
npm install
npm run check
```

### 4. Commit & Push

```bash
git add blockchains/robinhoodchain/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/
git commit -m "Add UGLY (Ugly Deer) on Robinhood Chain"
git push origin add-ugly-robinhood-chain
```

### 5. 開 PR

- **Title:** `Add UGLY (Ugly Deer) on Robinhood Chain`
- **Body:** 使用 [`PR_BODY.md`](./PR_BODY.md)

## info.json 內容

```json
{
  "name": "Ugly Deer",
  "type": "ERC20",
  "symbol": "UGLY",
  "decimals": 18,
  "description": "UGLY DEER ($UGLY) is a community meme token on Robinhood Chain.",
  "website": "https://kairu.lol",
  "explorer": "https://robinhoodchain.blockscout.com/token/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c",
  "status": "active",
  "id": "0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c",
  "links": [
    { "name": "website", "url": "https://kairu.lol" },
    { "name": "twitter", "url": "https://x.com/DeerloveRu" }
  ],
  "tags": ["meme"]
}
```

## Logo 規格

| 要求 | 值 |
|------|-----|
| 檔名 | `logo.png` |
| 尺寸 | **256×256** 像素 |
| 格式 | PNG，正方形 |
| 背景 | 簡潔、小尺寸可辨識 |

檔案：`launch/listings/trust-wallet/assets/0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c/logo.png`

## 審核要點

- [ ] `info.json` 符合 [Trust Wallet assets guidelines](https://developer.trustwallet.com/developer/listing-new-assets)
- [ ] 合約已部署且可在 Blockscout 查詢
- [ ] 官網 live
- [ ] logo.png 256×256
- [ ] 地址 checksum 正確

## 費用

Trust Wallet 對部分 listing 可能收取 processing fee（見官方 PR 模板）。依 PR 評論指示支付。

## Merge 後

- 錢包內搜尋 `UGLY` 或貼合約應顯示 logo
- 可搭配 kairu.lol/swap 的 `wallet_watchAsset` 一鍵加入
- 更新 [`CHECKLIST.md`](../CHECKLIST.md)

---

© 2026 UGLY DEER
