# HANSOME — Cursor 實作交接說明（Agent Handoff）

| 欄位 | 內容 |
|------|------|
| 檔名 | `docs/CURSOR_AGENT_HANDOFF.md` |
| 用途 | 讓**之後另一個 Cursor／代理人**立刻知道專案要幹嘛、先讀什麼、能改什麼、不能改什麼 |
| 版本 | `1.0.0` |
| 狀態 | 設計期交接（尚未進入合約實作） |
| 語言 | 繁體中文（路徑與檔名維持英文） |

---

## 0. 給下一個 Cursor 的第一句話

你正在協助 **HANSOME：羊駝 VS 美洲獅** 專案。

- **現在是設計／文件階段**，不是「隨便重做一款遊戲」的階段。
- **玩法、獎池、NFT 數量、排放規則已大致鎖定**（見 GDS v1.1）。
- **使用者若沒有明確要求，不要寫 Solidity、不要生成整包合約、不要改數值平衡。**
- 你的預設工作是：**讀懂規格 → 維持文件一致性 → 僅在被要求時才實作。**

若使用者說「開始實作／寫合約／做前端」，再進入實作模式，並以本文 §5 的順序進行。

---

## 1. 專案一句话

| 項目 | 內容 |
|------|------|
| 產品 | 鏈上非對稱日結算 NFT 策略遊戲 |
| 鏈 | Robinhood Chain |
| 代幣 | HANSOME，總供應 **1,000,000,000**，**不可增發** |
| NFT | **單一** Genesis ERC-721：**550**（羊駝 **500** + 美洲獅 **50**；一次 mint 隨機取得一方） |
| 日流程 | **Commit → Reveal → Settlement → Claim** |
| 日獎池（設計假設） | \(R_0 = 400{,}000\) HANSOME／日 |
| 財庫（設計假設） | \(G_0 = 300{,}000{,}000\) HANSOME |
| 獎池拆分 | **80%** 羊駝池 / **10%** 美洲獅基礎池 / **10%** 狩獵池 |
| 關鍵會計 | **獨立三角池**；狩獵懲罰與狩獵池殘額 **回流財庫**，不付給美洲獅 |

---

## 2. 開場必讀順序（依序打開）

1. **本檔** `docs/CURSOR_AGENT_HANDOFF.md`（你正在讀）
2. **文件架構**  
   - 英文：`docs/PROJECT_DOCUMENTATION_STRUCTURE.md`  
   - 繁中：`docs/PROJECT_DOCUMENTATION_STRUCTURE_zh-TW.md`
3. **玩法真相來源（目前）** — 在 `01_Core_Game_Rules_v1.1.md` 尚未產出前，以 GDS 為準：  
   - `docs/HANSOME_GDS_v1.1_zh-TW.md`  
   - `docs/HANSOME_GDS_v1.1_en.md`  
   （兩份規則必須一致；改規則要雙語同步，或先升版再改。）
4. 之後依架構產出／維護：`01`～`06` 編號文件（見架構說明）。

**衝突時：** 以「該主題的擁有文件」為準（見文件架構的 Source of Truth 表）。**禁止**默默發明第二套公式。

---

## 3. 已鎖定（不要擅自改）

除非使用者**明確**要求開新版本（例如 GDS v1.2 / Core Rules v1.2），否則視為 FINAL：

- 固定供應、不增發  
- 500 羊駝 / 50 美洲獅（含特質數量表）  
- Commit → Reveal → Settlement → Claim  
- 五地點與權重 `1 / 2 / 3 / 5 / 8`；美洲獅不能去 Home  
- 獨立獎池 **80 / 10 / 10**  
- 狩獵懲罰回財庫（不是付給美洲獅）  
- Farmer **歸一化**（不得超發）  
- 美洲獅：**50 隻相同**、無稀有度、無特殊能力、統一權重 \(w^C=1\)  
- Mint：**單一** HANSOME Genesis NFT 合約；side 以鏈上旗標判定（非分合約）  
- Mint 分配：Reserved 10 / Whitelist 100（公開前 **1 小時**）/ Public 440；錢包上限 WL 1、Public 5、合計 6  
- Royalty：Genesis 集合 **500 bps（5%）**  
- 玩法公式以 GDS v1.1 為準；mint 架構**不改**獎池／狩獵／懲罰／財庫／排放  
- 排放階梯：400k → 280k → 160k → 80k；安全值 **15M**；低於安全值暫停 Commit、只收 Sink  
- 文件架構：玩法／安全／數學／美術／路線圖／開發規範**分檔**，不要塞回單一巨檔亂改

---

## 4. 目前倉庫裡有什麼、還沒有什麼

### 已有

| 路徑 | 是什麼 |
|------|------|
| `docs/HANSOME_GDS_v1.1_zh-TW.md` | 完整設計規格（繁中） |
| `docs/HANSOME_GDS_v1.1_en.md` | 同上（英文，規則相同） |
| `docs/PROJECT_DOCUMENTATION_STRUCTURE.md` | 文件架構（英文） |
| `docs/PROJECT_DOCUMENTATION_STRUCTURE_zh-TW.md` | 文件架構（繁中） |
| `docs/CURSOR_AGENT_HANDOFF.md` | 本交接檔 |
| `docs/HANSOME_Genesis_Mint_Spec_v1.0.md` | 單一 550 mixed mint 規格（權威） |
| `docs/HANSOME_Alpaca_Mint_Spec_v1.0.md` | 羊駝側 metadata／Reserved Special |
| `docs/HANSOME_Cougar_Mint_Spec_v1.0.md` | 美洲獅側 identity（非獨立合約） |
| `docs/HANSOME_Contract_Architecture_v1.0.md` | NFT + Game 合約架構（無 Solidity） |

### 架構已定義、內容可能尚未寫完的正式檔

| 檔名 | 用途 |
|------|------|
| `01_Core_Game_Rules_v1.1.md` | 純玩法規格（從 GDS 抽取，不重新設計） |
| `02_Appendix_A_Security_and_Fair_Play.md` | 安全與公平（含弱 salt、VRF、市場風險等） |
| `03_Appendix_B_Mathematical_and_Economic_Verification.md` | 守恒與驗證清單 |
| `04_NFT_Design_Bible_v1.0.md` | 美術／metadata（不含遊戲公式） |
| `05_Project_Roadmap.md` | 里程碑（非規格） |
| `06_Development_Bible.md` | 工程規範 |

### 明確還沒做（預設不要擅自開工）

- 遊戲結算合約 `HansomeGame`（Genesis NFT 已實作；見 `docs/HANSOME_Solidity_Structure_Plan_v1.0.md`）  
- 前端 DApp  
- 鏈上部署（有 `contracts/scripts/deploy-genesis.ts` 草稿）  
- 改經濟數值「順便平衡」

### 合約已開始

- `contracts/contracts/genesis/HansomeGenesisNFT.sol` — 單一 550 mixed mint + reveal  
- 結構計畫：`docs/HANSOME_Solidity_Structure_Plan_v1.0.md`

---

## 5. 若使用者要求「開始實作」——建議工作順序

照此順序，避免先寫合約卻公式不一致：

### Phase A — 文件對齊（仍可不寫碼）

1. 從 GDS **忠實抽取** `01_Core_Game_Rules_v1.1.md`（只留玩法）。  
2. 補 `02` 安全附錄（可吸收先前「玩家破解」分析：弱 salt、未領獎隨 NFT 等）。  
3. 補 `03` 數學驗證（守恒、Farmer、殘塵、極端情況）。  
4. 需要美術時才寫 `04`；需要排程才寫 `05`；開 repo 規範才寫 `06`。

### Phase B — 實作規格凍結檢查

實作前用清單確認（全部應能指向 GDS／`01` 条文）：

- [ ] 日狀態機與時間窗  
- [ ] Commit hash 語義與 salt 要求  
- [ ] Reveal 合法性（獅不可 Home）  
- [ ] 羊駝分潤 + Farmer 歸一化  
- [ ] 懲罰率與特質順序（King → Runner → Lucky → Guardian → 其他）  
- [ ] 美洲獅基礎池與狩獵池公式；殘額回財庫  
- [ ] 排放控制器與安全模式  
- [ ] Claim 記在 `tokenId`、隨轉移  
- [ ] VRF 需求（Lucky／Runner）  
- [ ] 日結算守恒不變量  

### Phase C — 工程實作（僅在被要求時）

建議模組邊界（名稱可調，職責別混）：

1. **Token / Treasury 會計**（不鑄造；只撥款與回流）  
2. **NFT 註冊與類型表**  
3. **Day / Phase 狀態機**  
4. **Commit / Reveal**  
5. **Settlement**（純函數邏輯可先離線測守恒）  
6. **Claim**  
7. **Sink 入口**  
8. **Emission Controller**  
9. **Randomness（VRF）適配**  
10. 前端最後接狀態機與說明文案  

**測試優先於炫技：** 先寫守恒與邊界案例測試，再擴功能。

---

## 6. 明確不要做的事

| 不要 | 原因 |
|------|------|
| 重做玩法／改 80/10/10「覺得比較好」 | 設計已凍結；需升版流程 |
| 把狩獵懲罰改成付給美洲獅 | 破壞獨立池模型 |
| Farmer +20% 直接外加發放 | 必須歸一化，否則超發 |
| 只用可預測 blockhash 當唯一 RNG | 規格要求 VRF／等效 |
| 未審核一次產完 550 張圖 | 違反文件／開發原則 |
| 把美術、安全、公式全寫進同一個 md 無限膨脹 | 違反文件架構 |
| 把市價／流動性寫進鏈上公式 | 美元只是參考，不是參數 |
| 在使用者只要文件時產出大段 Solidity | 使用者曾明確只要文件 |
| 做歷史賽季排行榜瀏覽／封存頁／past-season API | 現階段只做**當前活躍賽季**；優先完成玩法與 Season 1。歷史查看留待日後有活躍玩家再加 |

---

## 7. 關鍵不變量（實作時天天核對）

用白話記：

1. **不鑄造**：獎勵只從遊戲財庫出。  
2. **當日三角池加總 = \(R_d\)**。  
3. **羊駝毛額加總 = 羊駝池**（有參與時）；Farmer 不得破壞此式。  
4. **羊駝淨額 + 懲罰 = 羊駝毛額**；懲罰進財庫。  
5. **美洲獅基礎份額加總 = 基礎池**（有參與時）。  
6. **狩獵份額 + 殘塵 = 狩獵池**；殘塵進財庫。  
7. **一日只結算一次**；結算確定性（同輸入同輸出）。  
8. **財庫 \(G \ge 0\)**；低於安全值走安全模式。

詳細符號與公式：打開 GDS §9–§15、§21（或未來的 `01` / `03`）。

---

## 8. 已知「玩家會鑽」的點（實作／產品要防，不是改玩法）

詳見未來 `02`；摘要：

- **弱 salt** → Commit 期可能被暴力猜位置（最危險）  
- 提前 Reveal **不能改當日位置**，但會洩漏習慣給隔日  
- **未 Claim 餘額跟 NFT 走** → 市場套利（規則如此；產品可提示賣家先領）  
- 同人持駝+獅：**獵自己通常虧**；獵別人才是優勢玩法  
- 無「永遠 River／永遠 Home」的封閉最佳解（在參數合理時）

---

## 9. 和使用者溝通時的預設態度

- 先問：這次是 **改文件 / 對齊架構 / 開始實作** 哪一種？  
- 改數值或玩法：提醒需要 **版本升級**，不要默默改 v1.1。  
- 給路徑時用**絕對路徑或 `docs/...`**，方便下載與開啟。  
- 產出新 md 時更新本交接檔 §4「已有／未有」表。

---

## 10. 專案根目錄提示

 magento 主要文件目錄：

`C:\Users\0099452\HANSOME\docs\`

若 Cursor 工作區不在此資料夾，**先確認／移動到 `HANSOME` 專案根**再改檔，避免寫到別的空視窗專案。

---

## 11. 一句話驗收「下一個 Cursor 是否讀懂」

若代理人能回答以下問題，即算讀懂：

1. 日獎池怎麼拆？懲罰給誰？  
2. 現在能不能寫合約？要先滿足什麼？  
3. 改玩法該改哪個檔、要不要升版？  
4. `01`～`06` 各管什麼、什麼不能寫進去？

答得出來，就可以開工；答不出來，先讀 §2 的文件，不要寫碼。

---

## 變更紀錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2026-07-17 | 1.0.0 | 初版 Cursor／代理人實作交接說明 |

---

**End — 給未來 Cursor 的交接檔。先讀規格，再實作；未受指示不改玩法、不寫合約。**
