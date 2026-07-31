# HANSOME Scan — 付費 RPC 延遲／成本效益評估

| Field | Value |
|-------|-------|
| **Date** | 2026-07-29 |
| **Scope** | READ / MEASURE / REPORT only |
| **Code changed** | Benchmark script only (`scripts/rpc-provider-benchmark.mjs`) |
| **Production RPC** | **未修改** |
| **Deploy** | **No** |
| **Paid API keys available** | **NO** |
| **Verdict** | **CONDITIONAL** — 先試 Alchemy **免費**層；付費 RPC **不是** 40s→15s 的主解 |

---

## 0. 結論摘要（給決策者）

| 問題 | 答案 |
|------|------|
| Production 現在用什麼 RPC？ | **Robinhood 官方公開節點** `rpc.mainnet.chain.robinhood.com`（免費、有 rate-limit） |
| 換成付費 RPC 能省多少？ | **誠實區間：約 0–10s**（典型）；若 Production 併發下其實被限流，**上限約 10–15s** — **未用付費 key 實測對照** |
| 40s → 30s？ | **有機會（CONDITIONAL）** — 需 A/B 證明 |
| 40s → 25s？ | **單靠換 RPC 不太可能** |
| 40s → 15s？ | **不可能單靠換 RPC** |
| 值得買？ | **CONDITIONAL**：先換 Alchemy **free**（$0）做可靠性；**不要**為了「砍到 15s」去買高階方案 |
| 真瓶頸若換 RPC 無效？ | **v4 Quick／Titan／position 的 RPC 工作量** + Phase 8 已標出的 **Liquidity 關鍵路徑演算法**（非 Blockscout；也非 Vercel 方案） |

**機器可讀量測：** `reports/data/rpc_provider_benchmark.json`  
**Benchmark：** `scripts/rpc-provider-benchmark.mjs`（≥20 iterations；無付費 key 時只打 current）

---

## 1. Production 現況確認

### 1.1 Provider／環境變數名（不含值）

| 來源 | 發現 |
|------|------|
| Vercel Production env names | `NEXT_PUBLIC_RPC_URL`、`NEXT_PUBLIC_GAME_RPC_URL`（Encrypted） |
| 本地 `.env.vercel.tmp` host（redacted） | 兩者皆為 `rpc.mainnet.chain.robinhood.com` |
| `.env.example` 預設 | 同上公開 URL |
| 程式 fallback | `lib/chain.ts` → `DEFAULT_RPC_URL = https://rpc.mainnet.chain.robinhood.com` |
| Scan transport | `lib/hansome-score/rpc.ts`、`lp/detect.ts`、`lp/titan.ts`、v2/v3 adapters：viem `http(NEXT_PUBLIC_RPC_URL \|\| DEFAULT_RPC_URL, { timeout: 20_000 })` |
| 付費 provider env | Production **無** `ALCHEMY_*` / QuickNode / Chainstack / Tenderly 名稱 |
| 本機付費 key | **無**（`.env.local` / `contracts/.env` 未見付費 RPC URL） |

### 1.2 RPC 類型

| 判定 | 說明 |
|------|------|
| **類型** | **Public free node**（Robinhood 官方公開端點） |
| **是否私人／Alchemy 等** | **否** — hostname 為 `rpc.mainnet.chain.robinhood.com`，非 `*.g.alchemy.com` / `*.quiknode.pro` / Chainstack / Tenderly gateway |
| **官方立場** | Robinhood docs：**公開端點有 rate-limit，不建議 Production**；推薦 Alchemy，並列 QuickNode、Blockdaemon、dRPC、Validation Cloud |

### 1.3 v4 Quick LP — RPC 呼叫數估計（HANSOME）

程式常數（`lp/quick-discovery.ts` / `detect.ts` / `titan.ts`）：

| 項目 | 值 |
|------|----:|
| Seeds（HANSOME） | **3**（`#47299` / `#357867` / `#142938`） |
| `readPosition` / ID | **3× `eth_call`**（`ownerOf` ∥ `getPositionLiquidity` ∥ `getPoolAndPositionInfo`）+ **1× `eth_getCode`** |
| Position 批次 | `POSITION_EVAL_BATCH = 8` |
| Titan | `tokenLockerCount` + **全量** `getTokenLockData`（`TITAN_BATCH = 24`） |
| 目前鏈上 `tokenLockerCount` | **27**（2026-07-29 單次 `eth_call` 量測） |
| Quick 上限（若 known-first 不足） | ≤40 新候選 × ~4 RPC；PM hint 頁走 **Blockscout**（付費 RPC **加速不到**） |
| HANSOME known-first 足夠時 | **跳過** Quick PM／hint 擴張（仍會發 `cache_revalidate`→`titan`→`publish`→`complete` 進度） |

**HANSOME warm／known-first 主路徑 RPC 估計（HTTP 請求數）：**

| 區塊 | 估計 calls |
|------|----------:|
| Titan count + 27× lock data | **~28** |
| 3 seeds × (3 call + getCode) | **~12** |
| slot0 / enrich / multi-version v2∥v3 probes | **~10–40**（路徑相依） |
| **合計（Deep liquidity／v4 相關）** | **~50–120** |
| 若掉進 Quick 擴張上限 | **+最多 ~160** |

**Phase 8 牆鐘（Production，非本地模型）：** v4 Quick／cache revalidate→titan→known→complete **排他約 20–30s**；HANSOME clean warm refresh **~40.0s**。

> Hint inventory / PM recent pages 使用 **Blockscout HTTP**（`blockscout.ts`），**換付費 RPC 不會變快**。

---

## 2. 量測結果（Current／Public RPC）

**條件：** 本機 → 公開 RPC；`ITERATIONS=20`；**無付費 key 對照**。  
**證據：** `reports/data/rpc_provider_benchmark.json`

### 2.1 單呼叫延遲（ms）

| Probe | Avg | P50 | P95 | P99 | Max | RL | Timeout | Success |
|-------|----:|----:|----:|----:|----:|---:|--------:|--------:|
| `eth_blockNumber` | 247 | **243** | 272 | 274 | 274 | 0 | 0 | 100% |
| `eth_chainId` | 258 | 250 | 268 | 411 | 411 | 0 | 0 | 100% |
| `ownerOf` (`eth_call`) | 252 | **253** | **263** | 279 | 279 | 0 | 0 | 100% |
| `balanceOf` (`eth_call`) | 253 | 252 | 266 | 290 | 290 | 0 | 0 | 100% |
| `eth_getCode` | 273 | **275** | — | — | — | 0 | 0 | 100% |
| `eth_getLogs`（1 block PM） | — | **258** | — | — | — | 0 | 0 | 100% |

**解讀：** 公開節點在**低併發、本機**下健康（~0.25s／call，本次無 429）。**這不能直接等於** Vercel Production 併發 Deep 下的行為。

### 2.2 與 Phase 8 Production 牆鐘對齊

| 指標 | 值 | 來源 |
|------|---:|------|
| HANSOME warm refresh（clean） | **40 009 ms** | Phase 8 after |
| Liquidity 關鍵路徑 | ~7.2s → ~37.9s | Phase 8 |
| v4 Quick RPC 排他 | **~20–30s** | Phase 8 §26 |
| Rel / CreatorBurn | 較早結束（非終端關鍵路徑） | Phase 8 |

### 2.3 一輪 HANSOME manual refresh 的 RPC 時間／佔比

| 估計 | 值 | 信心 |
|------|---:|------|
| RPC（v4 Quick／Titan／position）牆鐘 | **~20–30s** | **HIGH**（Phase 8） |
| 佔 ~40s 總牆 | **~50–75%** | **HIGH** |
| 本機單呼叫模型推估 RPC exclusive | ~2–4s（27 locks、理想並行） | **僅作下界** — 與 Prod 差大 |
| Prod vs 本機差距意涵 | 區域 RTT、併發、重試、額外 probe／cache ID、serverless 排程 | **MEDIUM** |

**未對付費 provider 猜延遲數字**（無 key → 無 A/B）。

### 2.4 能否到 30 / 25 / 15？

| 目標 | 單靠換付費 RPC？ | 理由 |
|------|------------------|------|
| **40 → 30**（−10s） | **CONDITIONAL** | 需付費端在 Prod 併發下明顯優於公開節點（限流／佇列消失） |
| **40 → 25**（−15s） | **不太可能** | 需吃掉大半 20–30s RPC 帶；單 RTT 改善通常不夠 |
| **40 → 15**（−25s） | **否** | 非 RPC 地板仍在（warm prelude ~5s、score、API、平行階段殘餘）；且 Titan／position **工作量**仍在 |

**誠實加速區間（換付費／Alchemy free 後預期）：**

| 情境 | 預估節省 | 預估總牆 |
|------|--------:|---------:|
| 公開節點已夠快、僅 RTT 小幅改善 | **0–5s** | ~35–40s |
| Prod 有限流／排隊，付費改善吞吐 | **5–12s** | ~28–35s |
| 樂觀上限（未實測） | **~10–15s** | ~25–30s |
| 達 15s 總牆 | **需工程**（Smart LP／減少 Titan 全掃／少 eth_call），非 URL 互換 | — |

---

## 3. Free vs Paid：維度比較（非猜測延遲）

| 維度 | Public RH RPC（現況） | Paid（Alchemy / QN / Chainstack / …） |
|------|----------------------|----------------------------------------|
| **單呼叫延遲** | 本機量測已 ~250ms；Prod 可能較差 | 可能更好，**需 key 後 A/B** |
| **併發／RPS** | 公開限流；Deep 多 `Promise.all` 易觸頂 | 較高 RPS／CUPS — **Scan 最可能受益點** |
| **Rate limit** | Docs 明示 rate-limited | 付費／free tier 仍有上限，但通常遠高於公開 |
| **Retry／穩定性** | 429／502 會把 position 標 uncertain | 較少 transient → 少重跑 |
| **同步／ tip** | 一般夠用 | 類似；Archive 另計 |
| **Archive** | 公開未必適合深歷史 | Alchemy 等明確提供 archive — Scan 主路徑多為 `latest`，**非主痛點** |

---

## 4. 已確認支援 Robinhood Chain（4663）的提供者

| Provider | RH 支援 | 依據 | 備註 |
|----------|:-------:|------|------|
| **Alchemy** | **Yes** | Robinhood **官方推薦**；`robinhood-mainnet.g.alchemy.com` | **首選試用** |
| **QuickNode** | **Yes** | Robinhood docs + QN 產品頁 | `*.robinhood-mainnet.quiknode.pro` |
| **Blockdaemon** | **Yes** | Robinhood docs「Other Providers」 | |
| **dRPC** | **Yes** | Robinhood docs | |
| **Validation Cloud** | **Yes** | Robinhood docs | |
| **Chainstack** | **Yes** | Chainstack docs chainId **4663** | RU 計費 |
| **Tenderly** | **Yes** | Gateway 見公開列表／Actions 網路；`robinhood-chain.gateway.tenderly.co` | 公開 gateway 仍限流 |
| **Public Robinhood** | Yes（現況） | 官方公開端點 | **不建議 Production** |

---

## 5. 月費／配額／併發（公開定價，2026-07 查詢）

| Provider | 入門價（公開） | 配額／吞吐（摘要） | Scan 適用性 |
|----------|----------------|-------------------|-------------|
| **Alchemy Free** | **$0** | **30M CU/mo**；~25 rps / 500 CU/s | **最便宜可行**；多數現況流量可能 $0 |
| **Alchemy PAYG** | **$0.45 / 1M CU**（300M 後 $0.40） | 高於 free 後按用量 | 流量起來再付 |
| **QuickNode** | Free trial；**Build ~$49/mo** | Credits + RPS 分級（Accelerate ~$249…） | 超買風險高（對目前 Scan） |
| **Chainstack** | Developer $0；Growth 常見 **~$49/mo** 級 | 1 RU／full request；archive 2 RU | 可作備援 |
| **Tenderly** | 公開 gateway 限流；專用 Node 另計 | Dashboard key | 可作觀測／備援 |

**本專案流量假設（無可靠 analytics 月報時的假設）：**

| 假設 | 值 |
|------|---:|
| Deep／manual refresh／日 | **20–100**（低流量產品假設） |
| RPC calls／Deep（HANSOME 級） | **~80–150** |
| Alchemy CU／`eth_call`（量級） | **~20–30 CU** |
| 月 CU（中位假設：50 Deep/日 × 120 call × 26 CU） | **≈ 4.7M CU/mo** |
| **Alchemy 月費** | **$0**（遠低於 30M free） |
| 若 Deep 放大 10× 或 exhaustive 常開 | 可能逼近／超過 free → **$0–20/mo** 級 |

**最便宜可行：** Alchemy **Free** URL 互換。  
**最推薦首試：** 同上（官方推薦 + $0 + 足夠 CU）；驗證後再考慮 PAYG／備援。

---

## 6. URL-only vs 需要改碼？

| 項目 | 需要？ |
|------|--------|
| 把 `NEXT_PUBLIC_RPC_URL`（及可選 `NEXT_PUBLIC_GAME_RPC_URL` / `GAME_RPC_URL`）指到 Alchemy | **URL／env only** — **不需改遊戲規則／Score** |
| Primary + secondary failover | **小改碼**（建議）：transport 列表、failover、health |
| Timeout 已有 | `RPC_TRANSPORT_TIMEOUT_MS = 20_000`（已存在） |
| Circuit breaker／429 退避 | **建議小改**（目前靠 catch → uncertain／stale） |
| Multicall 合併 ownerOf 批次 | **工程優化**（可再砍 RPC 次數；與是否付費正交） |
| 減少 Titan 全掃 | **工程**（`lookupTitanLocksByPositionIds` 現掃 **全部** lock id） |

---

## 7. 架構建議：Primary／Secondary／Fallback

| 層級 | 建議 |
|------|------|
| **Primary** | Alchemy Robinhood mainnet（先 free key） |
| **Secondary** | QuickNode **或** Chainstack（另一家，避免同廠故障） |
| **Fallback** | 官方公開 `rpc.mainnet.chain.robinhood.com`（降級唯讀） |
| **Timeout** | 維持 ~8–20s／request；避免無限掛 |
| **Retry** | 冪等 `eth_call`：429/5xx 指數退避 1–2 次；勿盲目放大並發 |
| **Circuit breaker** | 連續失敗 N 次 → 切 secondary 30–60s |
| **Health check** | 週期 `eth_chainId===4663` + `eth_blockNumber` 新鮮度 |
| **分離** | Scan 重讀 vs Game wallet：可考慮 Scan 用 server-only RPC（避免把付費 key 暴露在 `NEXT_PUBLIC_*`）— **若改 public env 需接受瀏覽器可見風險**；較佳為 server route 專用 `RPC_URL`／`GAME_RPC_URL` |

> 注意：現況 Scan 多用 `NEXT_PUBLIC_RPC_URL`。付費 key 若放進 `NEXT_PUBLIC_*` 會進前端 bundle — **強烈建議** server-only 變數給 Deep Scan。

---

## 8. 十三點對照表（任務清單）

| # | 項目 | 結果 |
|---|------|------|
| 1 | Current RPC avg/P50/P95/P99 | 見 §2.1（公開節點本機） |
| 2 | ownerOf / eth_call / multicall / getLogs / position | ownerOf/eth_call/getCode/getLogs 已測；**未用 multicall 合約**（程式為平行單 call） |
| 3 | 一輪 refresh 總 RPC 時間 | Phase 8：**~20–30s** 排他 |
| 4 | RPC 佔 ~40s | **~50–75%** |
| 5 | 付費預估節省秒數 | **0–10s** 典型；樂觀 **≤15s**（未 A/B） |
| 6 | 40→30/25/15 | 30 **CONDITIONAL**；25 難；**15 否** |
| 7 | Free vs paid 維度 | §3 |
| 8 | 確認支援 4663 的付費商 | §4 |
| 9 | 月費／配額 | §5 |
| 10 | 月請求／CU | §5 假設（無 live analytics 月報） |
| 11 | 最便宜 vs 最推薦 | Alchemy Free；同 |
| 12 | URL-only vs 改碼 | 基本 URL；failover／server-only key 建議小改 |
| 13 | Primary/secondary/… | §7 |

---

## 9. 最終結論（五點）

### 1) 每月 USD 估計
- **現況流量假設下：Alchemy Free = $0/mo**  
- 放大後：**$0–20/mo** PAYG 量級；**不建議**一開始就買 QuickNode $49+ 只為 Scan

### 2) 預估加速（秒與%）
- **相對 ~40s：約 0–25%**（0–10s）典型  
- 樂觀（限流解除）：**最多 ~25–35%**（10–15s）  
- **不是** 50%+ 產品級躍進

### 3) 值得買嗎？
**CONDITIONAL — YES to Alchemy free trial / env swap；NO to paid tiers as the latency strategy.**

理由：
- 官方不建議公開 RPC 作 Production → **可靠性**值得換  
- Phase 8 關鍵路徑雖是 RPC 工作，但本機單呼叫已快 → **未必**是「公開節點太慢」單一原因  
- 無付費 key → **不能**宣稱已證明付費更快  
- 達 15s 需要 **減少 RPC 次數／Smart LP／Titan 掃描策略**，不是換 URL

### 4) 最佳首試計畫
1. 申請 Alchemy Robinhood mainnet **free** app  
2. 設 **server-only** `RPC_URL`（或暫用 `NEXT_PUBLIC_RPC_URL` 僅 Preview 驗證 — 注意 key 暴露）  
3. 跑 `scripts/rpc-provider-benchmark.mjs`（設 `ALCHEMY_RPC_URL`）≥20 iter  
4. Production **Preview 或短期 A/B**：HANSOME warm refresh ×3（遵守 60s cooldown），對照 Phase 8 的 40s  
5. 若節省 **&lt;3s** → 停止加錢，改工程熱點  
6. 若節省 **≥8s** 或 429 消失 → 保留 Alchemy；再加 secondary

### 5) 若效果很小 — 真瓶頸是什麼？
1. **Liquidity／v4 路徑的 RPC 工作量**（Titan **全量** lock 掃描、每 position 多 `eth_call`、multi-version probes）  
2. **非 RPC：** warm prelude、Gecko／市場 API（Phase 8 已部分重疊）、score finalize  
3. **Blockscout** 仍佔 Rel／CreatorBurn（平行，通常不決定 HANSOME 終端牆，但佔資源）  
4. **工程槓桿：** Smart LP（現 **off**）、Titan 按 ID 索引而非全掃、multicall、更少 cache 重驗證  

---

## 10. Keys 到位後的建議測試清單

```text
1. ALCHEMY_RPC_URL=... QUICKNODE_RPC_URL=... node scripts/rpc-provider-benchmark.mjs
2. 比較 ownerOf P50/P95、rateLimitCount、timeoutCount
3. 併發批（24× eth_call wave）— 在各自 dashboard 允許的 RPS 內，勿打爆公開節點
4. Production HANSOME warm refresh 牆鐘（spaced ≥65s）before/after
5. FOX-class exhaustive / Quick 擴張路徑（RPC 次數更高）
6. 記錄 429 與 uncertain position 比例
```

---

## 11. 證據索引

| Artifact | Role |
|----------|------|
| `reports/HANSOME_COLD_PERF_V2_PHASE8_PROFILING_HOTSPOT_PRODUCTION.md` | 40s wall；v4 Quick 20–30s |
| `reports/HANSOME_SCAN_LATENCY_COST_BENEFIT.md` | 先前成本架構結論 |
| `reports/data/rpc_provider_benchmark.json` | 本次公開 RPC 量測 |
| `scripts/rpc-provider-benchmark.mjs` | 可重跑 benchmark |
| `lib/chain.ts` / `.env.example` / Vercel env names | Production RPC 來源 |
| `lib/hansome-score/lp/detect.ts` / `titan.ts` | 呼叫型態與批次 |
| https://docs.robinhood.com/chain/connecting/ | 官方 provider 列表 |

---

## Confirmations

- [x] **未修改** Production RPC  
- [x] **未 deploy**  
- [x] **未列印** API keys（僅 host）  
- [x] 付費延遲 **未臆測為已量測**  
- [x] 報告繁中為主；結論可給 parent 摘要  
- [x] Benchmark script **已建立**；paid keys **NO**
