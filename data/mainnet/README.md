# Mainnet 白名單（Whitelist）— 維護說明

這是 **Mainnet Genesis WL 地址的唯一來源**。持續編輯此名單即可；**現在不要上鏈**。

| 項目 | 內容 |
|------|------|
| 名單檔 | [`whitelist-addresses.txt`](./whitelist-addresses.txt) |
| 產生腳本 | `contracts/scripts/generate-mainnet-whitelist-merkle.ts`（離線、無交易） |
| npm | `cd contracts && npm run genesis:merkle:mainnet` |
| 前端 proofs | `lib/game/mainnet/whitelistProofs.MAINNET.json`（產生後覆寫） |
| Ops JSON | `contracts/deployments/robinhood-genesis-whitelist.mainnet.json` |
| 完整流程 | [`docs/MAINNET_LAUNCH_RUNBOOK.md`](../../docs/MAINNET_LAUNCH_RUNBOOK.md) §5 |

## 怎麼加地址

1. 打開 `data/mainnet/whitelist-addresses.txt`
2. 在檔案下方（註解區之後）**每行貼一個地址**
3. 存檔。可反覆增刪，直到定稿

```text
# 註解可留
0xYourAddressHere…
0xAnotherAddress…
```

規則：

- `#` 開頭與空行忽略
- 重複地址會被跳過
- **不要**填假地址／Testnet 名單
- 建議人數 ≤ **100**（鏈上 WL mint 上限 100；每錢包最多 1）

## 產生 Merkle（離線 — 不上鏈）

名單至少有一筆真實地址後：

```powershell
cd C:\hansomealpacas\contracts
npm run genesis:merkle:mainnet
```

等價：

```powershell
npx hardhat run scripts/generate-mainnet-whitelist-merkle.ts --network hardhat
```

可選：指定名單路徑

```powershell
$env:WHITELIST_ADDRESSES_FILE = "..\data\mainnet\whitelist-addresses.txt"
npm run genesis:merkle:mainnet
```

產出後請人工核對 JSON 裡的 `merkleRoot` 與 `addressCount`。

## 之後才上鏈（尚未執行）

流程：**編輯名單 → 產生 Merkle → 人工核對 root → 再** `scheduleWhitelistMerkleRoot`

| 截止 | UTC | 台北 |
|------|-----|------|
| 最晚排程 Merkle | **2026-07-23 11:00 UTC** | 2026-07-23 19:00 |
| WL 開窗（Public − 1h） | 2026-07-24 11:00 UTC | 2026-07-24 19:00 |

詳見 Runbook §5。本目錄與產生腳本**不會送交易**。
