# HANSOME：羊駝 VS 美洲獅  
# 遊戲設計規格書（Game Design Specification）v1.1

| 欄位 | 內容 |
|------|------|
| 文件類型 | 內部遊戲設計規格書（GDS） |
| 版本 | v1.1 |
| 狀態 | Design Freeze Candidate |
| 語言 | 繁體中文 |
| 受眾 | 專案負責人、內部設計、後續修訂 |
| 鏈 | Robinhood Chain |
| 代幣 | HANSOME（固定供應） |
| 配套文件 | English GDS v1.1（規則與公式必須完全一致） |

**本文件不包含 Solidity 或其他實作程式碼。**  
本文件定義可實作的遊戲規則、狀態機、公式、不變量與邊界條件。英文版 GDS v1.1 必須描述同一套系統。

---

## 1. Project Overview（專案總覽）

### 1.1 產品定義

HANSOME：羊駝 VS 美洲獅（Alpacas vs Cougars）是一款建置於 Robinhood Chain 的非對稱日結算 NFT 策略遊戲。玩家持有羊駝（Alpaca）或美洲獅（Cougar）NFT，每日透過「秘密提交位置 → 公開揭示 → 系統結算 → 領取獎勵」完成一輪。

### 1.2 資產與供應約束

| 符號 | 定義 | 數值 |
|------|------|------|
| \(T_{\mathrm{supply}}\) | HANSOME 總供應 | \(1{,}000{,}000{,}000\) |
| — | 是否可增發 | 否（固定供應） |
| — | 遊戲獎勵來源 | 僅遊戲財庫（Game Treasury），禁止額外鑄造 |
| \(P_{\mathrm{ref}}\) | 參考市價（設計期快照，非常數） | \(\approx 0.00000571\) USD / HANSOME |
| \(L_{\mathrm{ref}}\) | 參考流動性（設計期快照） | \(\approx 5{,}930\) USD |

**不變量 I-SUPPLY：** 任何遊戲操作不得使 HANSOME 總供應超過 \(T_{\mathrm{supply}}\)，亦不得鑄造新代幣進入遊戲。

### 1.3 集合規模（最終）

| 集合 | 符號 | 數量 |
|------|------|------|
| 羊駝 Alpacas | \(N_A = 500\) | 500 |
| 美洲獅 Cougars | \(N_C = 50\) | 50 |
| NFT 總數 | \(N = N_A + N_C\) | 550 |

### 1.4 設計期財庫與日獎池假設

| 符號 | 定義 | 數值 |
|------|------|------|
| \(G_0\) | 遊戲財庫初始餘額（設計假設） | \(300{,}000{,}000\) HANSOME |
| \(R_0\) | 初始每日固定獎池 | \(400{,}000\) HANSOME / 日 |

美元價值隨市價變動；長期模型以 HANSOME 數量為準。

### 1.5 文件範圍

本 GDS 涵蓋：玩法、NFT、地圖、日狀態機、Commit/Reveal、結算、獎勵公式、特質、財庫、Sink、排放控制、隨機數、領取、安全、邊界情況、擴充與數學附錄。  
不涵蓋：合約原始碼、前端 UI 像素規格、行銷文案定稿。

---

## 2. Design Philosophy（設計哲學）

### 2.1 核心原則

1. **固定供應、零增發**：獎勵只從遊戲財庫撥出。  
2. **每日固定獎池**：當日排放量 \(R_d\) 由排放控制器決定，不因幣價自動改變。  
3. **策略重於躺平**：位置選擇與對手分布決定收益離散度。  
4. **不對稱角色**：羊駝追求權重與風險平衡；美洲獅追求匹配與狩獵池。  
5. **獨立獎池模型**：羊駝池、美洲獅基礎池、狩獵池分開會計；狩獵懲罰回流財庫，不流入美洲獅錢包。  
6. **美洲獅平均優勢**：在全數有效參與下，美洲獅期望收益嚴格高於羊駝均分基準（見數學附錄）。  
7. **可審計守恒**：每一日結算必須滿足獎池守恒與財庫守恒不變量。

### 2.2 非目標

- 不保證任何 NFT 的美元 ROI。  
- 不保證單一地點為最優純策略。  
- 不以增發補貼價格。

---

## 3. Core Gameplay（核心玩法）

### 3.1 一輪的定義

以整數日索引 \(d \in \mathbb{Z}_{\geq 0}\) 標識「遊戲日」。每一日每個 NFT 最多完成一次完整參與（Commit → Reveal → 進入結算資格）。

### 3.2 玩家目標

- **羊駝**：在地點權重與狩獵風險之間最大化當日淨收益。  
- **美洲獅**：選擇可能聚集羊駝的可狩獵地點，以獲取基礎池與狩獵池份額。

### 3.3 資訊結構

- Commit 階段：位置私密。  
- Reveal 階段：位置公開。  
- Settlement：僅使用已成功揭示的有效參與集合，確定性計算。

### 3.4 獨立獎池模型（最終）

每日有效排放 \(R_d\) 拆分為：

\[
R_d^{A} = 0.8\, R_d,\quad
R_d^{C} = 0.1\, R_d,\quad
R_d^{H} = 0.1\, R_d
\]

且 \(R_d^{A} + R_d^{C} + R_d^{H} = R_d\)。

- \(R_d^{A}\)：羊駝基礎池（僅羊駝）。  
- \(R_d^{C}\)：美洲獅基礎池（僅有效參與美洲獅，平均分配）。  
- \(R_d^{H}\)：狩獵池（僅成功狩獵之美洲獅）。  
- 羊駝因狩獵產生的**懲罰額**進入財庫，**不**進入美洲獅地址。

---

## 4. NFT Collections（NFT 集合）

### 4.1 羊駝（Alpacas）— \(N_A = 500\)

| 類型 ID | 名稱 | 數量 | 特質效果（結算語義） |
|---------|------|------|----------------------|
| `ALPACA_COMMON` | Common | 479 | 無特殊減傷／加成 |
| `ALPACA_GUARDIAN` | Guardian | 5 | 狩獵懲罰率 × 0.5 |
| `ALPACA_LUCKY` | Lucky | 5 | 以機率 \(p_L=0.20\) 完全免疫當日狩獵懲罰 |
| `ALPACA_FARMER` | Farmer | 5 | 有效權重乘數 \(m_F=1.20\)（須歸一化） |
| `ALPACA_RUNNER` | Runner | 5 | 以機率 \(p_R=0.30\) 視為成功逃脫（懲罰為 0） |
| `ALPACA_KING` | King | 1 | 永遠免疫狩獵懲罰 |

**數量校驗：** \(479+5+5+5+5+1=500\)。

每個羊駝 NFT 具有唯一 `tokenId` \(\in \mathcal{A}\)，\(|\mathcal{A}|=500\)。類型互斥：一隻羊駝恰屬一種類型。

### 4.2 美洲獅（Cougars）— \(N_C = 50\)

| 類型 ID | 名稱 | 數量 | 權重 \(w^C\) |
|---------|------|------|--------------|
| `COUGAR` | Cougar | 50 | 1（統一） |

**數量校驗：** \(50=50\)。  
**權重總和（全集合）：** \(W^{C}_{\mathrm{all}} = 50\cdot 1 = 50\)。

**所有美洲獅完全相同。** 美洲獅沒有稀有度分級，也沒有任何特殊能力——全部 50 隻美洲獅共用同一份美術，並以相同的統一權重 \(w^C=1\) 參與。因此美洲獅權重僅決定 \(R_d^{C}\) 與 \(R_d^{H}\) 的「平均分配」，不影響羊駝池。

### 4.3 所有權與參與

- 參與資格綁定 NFT，不綁定錢包身份（同一錢包可持有多只 NFT）。  
- 同日同 `tokenId` 至多一次有效 Commit。

---

## 5. Map System（地圖系統）

### 5.1 地點集合

\[
\mathcal{L} = \{\mathrm{Home},\,\mathrm{Mountain},\,\mathrm{Grassland},\,\mathrm{Forest},\,\mathrm{River}\}
\]

編碼（建議穩定整數 ID，文件層面固定）：

| `locationId` | 地點 | 羊駝可選 | 美洲獅可選 | 權重 \(w(L)\) |
|--------------|------|----------|------------|----------------|
| 0 | Home | 是 | **否** | 1 |
| 1 | Mountain | 是 | 是 | 2 |
| 2 | Grassland | 是 | 是 | 3 |
| 3 | Forest | 是 | 是 | 5 |
| 4 | River | 是 | 是 | 8 |

可狩獵地點：

\[
\mathcal{L}^{H} = \mathcal{L}\setminus\{\mathrm{Home}\}
\]

### 5.2 權重語義

- 權重進入羊駝基礎池分配分子。  
- 權重同時作為風險敘事錨點：較高權重對應較高基礎狩獵懲罰係數（見 §12）。  
- 美洲獅不可 Commit 至 Home；若錯誤揭示為 Home，該美洲獅當日無效。

---

## 6. Daily Game Flow（每日遊戲流程）

### 6.1 日狀態機

每一日 \(d\) 依序經歷：

```
IDLE → COMMIT_OPEN → COMMIT_CLOSED → REVEAL_OPEN → REVEAL_CLOSED
    → SETTLEMENT → CLAIMABLE → (次日 IDLE)
```

| 狀態 | 允許操作 | 禁止操作 |
|------|----------|----------|
| `COMMIT_OPEN` | Commit | Reveal / Settle / 改 Commit |
| `COMMIT_CLOSED` | （無玩家寫入） | Commit |
| `REVEAL_OPEN` | Reveal | Commit / 改位置 |
| `REVEAL_CLOSED` | （無玩家寫入） | Reveal |
| `SETTLEMENT` | 系統結算（一次） | 玩家改狀態 |
| `CLAIMABLE` | Claim | 重算結算 |

### 6.2 時間窗（規範性建議，UTC）

令日 \(d\) 之 UTC 日界為 \([t_d, t_{d+1})\)。

| 階段 | 區間（相對 \(t_d\)） |
|------|----------------------|
| Commit | \([t_d + 0\mathrm{h},\; t_d + 20\mathrm{h})\) |
| Reveal | \([t_d + 20\mathrm{h},\; t_d + 24\mathrm{h})\) |
| Settlement | \(t_d + 24\mathrm{h}\) 起可執行（須在 Reveal 結束後） |
| Claim | Settlement 完成後永久可領（或直至協議升級遷移） |

**實作可調整絕對小時，但不得改變狀態順序與「Commit 不可見、不可改」語義。**

### 6.3 有效參與集合

- \(\mathcal{A}_d\)：羊駝在日 \(d\) 成功 Commit 且成功 Reveal 者。  
- \(\mathcal{C}_d\)：美洲獅在日 \(d\) 成功 Commit 且成功 Reveal，且位置 \(\in \mathcal{L}^{H}\) 者。

未進入有效集合者：當日獎勵為 0，且不佔當日權重分母。

---

## 7. Commit Protocol（提交協議）

### 7.1 目的

在揭示前隱藏位置，降低跟單與搶跑。

### 7.2 Commit 承載

玩家提交：

\[
\mathrm{commitHash} = H\!\left(\mathrm{tokenId}\,\|\,d\,\|\,\mathrm{locationId}\,\|\,\mathrm{salt}\right)
\]

其中：

- \(H\)：密碼學雜湊（設計層要求：抗碰撞、輸出至少 256-bit）。  
- `salt`：玩家私密隨機數，長度足以使暴力枚舉不可行（建議 ≥ 128-bit 熵）。  
- Commit 一旦接受：**不可修改、不可撤銷**。

### 7.3 Commit 接受條件

1. 當前日狀態為 `COMMIT_OPEN`。  
2. `tokenId` 存在且呼叫者為當前授權操作者（所有者或批准者）。  
3. 該 `(tokenId, d)` 尚未 Commit。  
4. 不在 Commit 時驗證 `locationId` 合法性（合法性在 Reveal 驗證），以避免資訊洩漏通道；或僅驗證類型允許範圍但不公開。  
   **本規格採用：** Commit 不檢查 location 明文（因無明文）；Reveal 時檢查合法性。

### 7.4 Commit 儲存語義（邏輯）

記錄：`commitHash[tokenId][d]`、`committed[tokenId][d]=true`、`committer`（可選稽核）。

---

## 8. Reveal Protocol（揭示協議）

### 8.1 Reveal 輸入

玩家提交明文：`(tokenId, d, locationId, salt)`，系統驗證：

\[
H(\mathrm{tokenId}\,\|\,d\,\|\,\mathrm{locationId}\,\|\,\mathrm{salt}) = \mathrm{commitHash}[tokenId][d]
\]

### 8.2 Reveal 接受條件

1. 狀態為 `REVEAL_OPEN`。  
2. 已 Commit。  
3. 雜湊匹配。  
4. 該日尚未 Reveal。  
5. 位置合法：  
   - 羊駝：`locationId ∈ {0,1,2,3,4}`  
   - 美洲獅：`locationId ∈ {1,2,3,4}`

### 8.3 揭示窗資訊政策

- 在 `REVEAL_CLOSED` 之前，協定**不得**因單一 Reveal 而提前彙總並公開「各地點計數」給未揭示玩家作為可操作優勢的即時 API（若鏈上不可避免可見，則設計上接受公開記憶體，並依賴截止同時性；產品層可提示風險）。  
- **規範要求：** 所有 Reveal 在同一窗內完成；結算僅在窗關閉後執行，使策略基於 Commit 時資訊集。

### 8.4 未揭示

若已 Commit 未 Reveal：該 NFT ∉ \(\mathcal{A}_d\) 或 \(\mathcal{C}_d\)，獎勵 0。不佔分母。

---

## 9. Settlement Algorithms（結算演算法）

### 9.1 觸發

狀態進入 `REVEAL_CLOSED` 後，結算可被呼叫一次。結算必須**確定性**：相同有效揭示集合 → 相同結果。

### 9.2 演算法大綱（日 \(d\)）

**輸入：** 有效揭示位置 \(\ell(i)\) 對所有 \(i \in \mathcal{A}_d \cup \mathcal{C}_d\)；當日 \(R_d\)；特質；隨機種子（見 §16）。

**步驟：**

1. **排放確認：** 由 Emission Controller 讀取 \(R_d\)；確認財庫 \(G \ge R_d\)。若否，進入安全模式規則（§15）。  
2. **池拆分：** \(R_d^{A}, R_d^{C}, R_d^{H}\)。  
3. **地點計數：**  
   - \(A_d(L) = |\{i\in\mathcal{A}_d:\ell(i)=L\}|\)  
   - \(C_d(L) = |\{j\in\mathcal{C}_d:\ell(j)=L\}|\)  
4. **羊駝毛額分配**（§10，含 Farmer 歸一化）。  
5. **狩獵懲罰**（§12）：自羊駝毛額扣除懲罰；懲罰總和 \(P_d^{\mathrm{pen}}\) 記入待回流財庫。  
6. **美洲獅基礎池分配**（§11.1）。  
7. **狩獵成功集合與狩獵池分配**（§11.2）；未分配殘額 \(R_d^{H,\mathrm{dust}}\) 回流財庫。  
8. **守恒檢查**（§9.3）。  
9. **記帳：** 寫入可領取餘額；更新財庫：  
   \[
   G \leftarrow G - R_d + P_d^{\mathrm{pen}} + R_d^{H,\mathrm{dust}} + S_d
   \]  
   其中 \(S_d\) 為當日已入帳 Sink（可與結算異步，但日報需可對帳）。  
10. 標記 `settled[d]=true`。

### 9.3 日結算守恒不變量

**I-DAY-CONSERVE：**

\[
\sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{net}}
+ \sum_{j\in\mathcal{C}_d} r_j^{C}
+ P_d^{\mathrm{pen}}
+ R_d^{H,\mathrm{dust}}
= R_d
\]

其中 \(r_j^{C}\) 含基礎池與狩獵池份額；無有效參與時，未分配部分全部回流財庫並仍滿足守恒。

**I-SINGLE-SETTLE：** 每日至多成功結算一次。

**I-NO-MINT：** 結算不鑄造代幣。

---

## 10. Alpaca Reward Formula（羊駝獎勵公式）

### 10.1 有效權重

對 \(i \in \mathcal{A}_d\)：

\[
\omega_i =
\begin{cases}
m_F \cdot w(\ell(i)) & \text{若 } i \text{ 為 Farmer}\\
w(\ell(i)) & \text{否則}
\end{cases}
\quad(m_F=1.20)
\]

\[
\Omega_d = \sum_{i\in\mathcal{A}_d}\omega_i
\]

若 \(\mathcal{A}_d=\emptyset\)，則 \(R_d^{A}\) 全額回流財庫，所有羊駝收益為 0。

### 10.2 毛額（Farmer 歸一化）

\[
r_i^{A,\mathrm{gross}} = R_d^{A}\cdot\frac{\omega_i}{\Omega_d}
\]

**I-FARMER-NORM：** \(\sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{gross}} = R_d^{A}\)（在 \(\Omega_d>0\) 時）。Farmer 的 +20% 不得導致超發。

### 10.3 淨額

狩獵懲罰後：

\[
r_i^{A,\mathrm{net}} = r_i^{A,\mathrm{gross}}\cdot(1-\pi_i)
\]

其中 \(\pi_i\in[0,1]\) 為有效懲罰率（§12）。  

\[
P_d^{\mathrm{pen}} = \sum_{i\in\mathcal{A}_d} r_i^{A,\mathrm{gross}}\cdot\pi_i
\]

**I-PENALTY-TREASURY：** \(P_d^{\mathrm{pen}}\) 必須回到遊戲財庫，不得支付給美洲獅。

---

## 11. Cougar Reward Formula（美洲獅獎勵公式）

### 11.1 基礎池

所有美洲獅完全相同，故每隻美洲獅皆帶有相同的統一權重 \(w^C(j)=1\)。  

\[
W_d^{C} = \sum_{j\in\mathcal{C}_d} w^C(j) = |\mathcal{C}_d|
\]

若 \(W_d^{C}=0\)（無有效美洲獅），則 \(R_d^{C}\) 回流財庫。否則基礎池平均分配：

\[
r_j^{C,\mathrm{base}} = R_d^{C}\cdot\frac{1}{|\mathcal{C}_d|}
\]

### 11.2 狩獵成功判定

美洲獅 \(j\in\mathcal{C}_d\) 於地點 \(L=\ell(j)\) **狩獵成功**當且僅當：

\[
L\in\mathcal{L}^{H}\ \wedge\ A_d(L)\ge 1
\]

成功集合：\(\mathcal{C}_d^{+} = \{j\in\mathcal{C}_d:\text{成功}\}\)。

### 11.3 狩獵池分配

對成功者定義狩獵分數（權重統一，故僅取決於該地點的羊駝數量）：

\[
\sigma_j = w^C(j)\cdot A_d(\ell(j)) = A_d(\ell(j))
\]

\[
\Sigma_d = \sum_{j\in\mathcal{C}_d^{+}}\sigma_j
\]

若 \(\Sigma_d=0\)（無成功者），則 \(R_d^{H,\mathrm{dust}}=R_d^{H}\)，全員狩獵份額為 0。  
否則：

\[
r_j^{C,\mathrm{hunt}} =
\begin{cases}
R_d^{H}\cdot\dfrac{\sigma_j}{\Sigma_d} & j\in\mathcal{C}_d^{+}\\
0 & \text{otherwise}
\end{cases}
\]

\[
R_d^{H,\mathrm{dust}} = R_d^{H} - \sum_{j\in\mathcal{C}_d} r_j^{C,\mathrm{hunt}}
\]

（在整數化實作時，殘塵進 `dust` 回流財庫。）

### 11.4 美洲獅總收益

\[
r_j^{C} = r_j^{C,\mathrm{base}} + r_j^{C,\mathrm{hunt}}
\]

### 11.5 期望優勢（全數有效參與、無懲罰近似）

若 \(|\mathcal{A}_d|=500\)、\(|\mathcal{C}_d|=50\) 且狩獵池完全分完、忽略懲罰：

\[
\bar{r}^{A} = \frac{0.8 R_d}{500},\quad
\bar{r}^{C} = \frac{0.2 R_d}{50}
= 2.5\,\bar{r}^{A}
\]

若狩獵全失敗：\(\bar{r}^{C}=\dfrac{0.1 R_d}{50}=1.25\,\bar{r}^{A}\)（仍嚴格大於羊駝均分毛額）。懲罰會降低羊駝淨額，進一步擴大相對差距，但不改變「獨立池」會計。

---

## 12. Trait Resolution（特質結算）

### 12.1 基礎懲罰率

對地點 \(L\)，定義基礎懲罰係數 \(\pi^{0}(L)\)：

| \(L\) | \(\pi^{0}(L)\) |
|-------|----------------|
| Home | 0 |
| Mountain | 0.10 |
| Grassland | 0.15 |
| Forest | 0.22 |
| River | 0.30 |

壓力調整：若 \(L\in\mathcal{L}^{H}\) 且 \(C_d(L)\ge 1\)：

\[
\pi^{\mathrm{pre}}_i = \min\left(0.90,\ \pi^{0}(L)\cdot\left(1+\frac{C_d(L)-1}{A_d(L)+1}\right)\right)
\]

若 \(C_d(L)=0\) 或 \(L=\mathrm{Home}\)：\(\pi^{\mathrm{pre}}_i=0\)。

### 12.2 特質順序（固定）

對每隻羊駝 \(i\)，按下列順序解析 \(\pi_i\)：

1. 若類型為 **King**：\(\pi_i=0\)；結束。  
2. 否則計算 \(\pi^{\mathrm{pre}}_i\)。  
3. **Runner**：取隨機位元 \(\rho_i^{R}\)。若 \(\rho_i^{R}=1\)（機率 \(p_R=0.30\)），則 \(\pi_i=0\)；結束。  
4. **Lucky**：取 \(\rho_i^{L}\)。若 \(\rho_i^{L}=1\)（機率 \(p_L=0.20\)），則 \(\pi_i=0\)；結束。  
5. **Guardian**：\(\pi_i = 0.5\cdot\pi^{\mathrm{pre}}_i\)。  
6. **Common / Farmer**：\(\pi_i = \pi^{\mathrm{pre}}_i\)。  
   （Farmer 只影響 \(\omega_i\)，不直接改懲罰率。）

**I-TRAIT-ORDER：** 特質解析順序全協議一致，禁止並行歧義。

### 12.3 美洲獅特質

美洲獅**沒有任何特質，也沒有特殊能力**。全部 50 隻美洲獅完全相同，並以相同的統一權重 \(w^C=1\) 進入 §11。

---

## 13. Treasury Accounting（財庫會計）

### 13.1 財庫定義

遊戲財庫餘額 \(G\) 是總供應中**撥給遊戲**的可動用 HANSOME，與市值、流動性池、團隊錢包分離。

### 13.2 允許變動

| 方向 | 事件 |
|------|------|
| 減少 | 日獎池撥出 \(R_d\)；（若有）核准之財庫支出（本 GDS 預設無） |
| 增加 | 狩獵懲罰 \(P_d^{\mathrm{pen}}\)；狩獵池殘額；Token Sink \(S\)；未分配池回流 |

### 13.3 不變量

**I-TREASURY-NONNEG：** \(G\ge 0\) 恒成立。  
**I-REWARDS-FROM-G：** \(R_d \le G\)（在非安全模式）；安全模式見 §15。

---

## 14. Token Sink（代幣回收）

### 14.1 Sink 項目（最終清單）

玩家消耗 HANSOME 並**回流遊戲財庫**（非強制市場賣出）：

| Sink ID | 用途 |
|---------|------|
| `UPGRADE` | NFT 升級 |
| `ITEM` | 道具 |
| `SHIELD` | 護盾 |
| `SEASON_ENTRY` | 季賽報名 |
| `TRAIT_REROLL` | 特質重擲 |

### 14.2 會計

每次 Sink 金額 \(s>0\)：\(G \leftarrow G+s\)（從玩家支付）。  
**本版本不規定各 Sink 單價表**（由經濟附錄或營運表後續鎖定）；GDS 只鎖定「回流財庫」語義。

### 14.3 與排放關係

Sink 提高 \(G\)，延長跑道；但不自動提高 \(R_d\)（除非排放控制器顯式讀取規則）。

---

## 15. Emission Controller（排放控制器）

### 15.1 初始參數

\[
R_0 = 400{,}000,\quad G_0 = 300{,}000{,}000
\]

門檻相對**初始財庫** \(G_0\)（非浮動高水位）：

| 條件 | 當日獎池 \(R_d\) |
|------|------------------|
| \(G \ge 0.70\,G_0\) | \(400{,}000\) |
| \(0.40\,G_0 \le G < 0.70\,G_0\) | \(280{,}000\) |
| \(0.20\,G_0 \le G < 0.40\,G_0\) | \(160{,}000\) |
| \(G_{\mathrm{safe}} \le G < 0.20\,G_0\) | \(80{,}000\) |
| \(G < G_{\mathrm{safe}}\) | \(R_d = S_d^{\mathrm{net}}\)（當日 Sink 淨回收，無固定獎池） |

**安全值（本規格鎖定）：** \(G_{\mathrm{safe}} = 15{,}000{,}000\) HANSOME。

### 15.2 安全模式

當 \(G < G_{\mathrm{safe}}\)：  
- 不撥固定 \(R_d\)。  
- 當日可分配總額等於當日已確認回流財庫的 Sink（及可選：當日懲罰若仍產生——安全模式建議先停止固定池遊戲或僅允許 Sink 積累；**本規格：安全模式暫停 Commit，僅接受 Sink，直至 \(G\ge G_{\mathrm{safe}}\)**）。

### 15.3 零回收毛跑道（資訊性）

\(G_0 / R_0 = 750\) 日（不計 Sink／懲罰回流／降階）。

---

## 16. Randomness（隨機數）

### 16.1 需要隨機的事件

- Lucky 免疫判定  
- Runner 逃脫判定  

### 16.2 設計要求

1. 結算前不可被玩家偏置。  
2. 對同一 `(d, tokenId, purpose)` 可重放驗證。  
3. 禁止僅依賴「可預測區塊雜湊」作為唯一熵源。  

**規範：** 使用可驗證隨機函數（VRF）或等效 beacon；種子綁定：

\[
\mathrm{seed}_{d} \rightarrow \rho_i^{\mathrm{purpose}} = \mathrm{Bernoulli}(p\mid \mathrm{seed}_d,\,tokenId,\,\mathrm{purpose})
\]

### 16.3 確定性

給定種子與有效參與集合，全結算確定性可重現。

---

## 17. Claim Rules（領取規則）

### 17.1 模型

採用 **pull** 模式：結算後累計 `claimable[tokenId]`（或 `claimable[owner]` 聚合，但以 token 維度稽核為準）。

### 17.2 規則

1. 僅 `settled[d]=true` 後對應日收益可領。  
2. 同一 `(tokenId, d)` 收益不得重複計入。  
3. Claim 可合併多日未領餘額。  
4. Claim 不改變已結算分配結果。  
5. 轉讓 NFT 不轉讓已計入原 `claimable` 的權益（**本規格鎖定：收益歸結算時所有者**；或歸 token 內建可領餘額隨 token——**鎖定為：可領餘額記在 tokenId，隨所有權轉移**）。  

**最終鎖定：** `claimable` 按 `tokenId` 記帳，NFT 轉移時未領餘額隨 token 轉移。

---

## 18. Security Considerations（安全考量）

### 18.1 機制層

| 風險 | 緩解 |
|------|------|
| Commit 後改位置 | 禁止修改 |
| 揭示窗跟單 | 同時窗 + 結算在關閉後 |
| 鹽值過短 | 要求高熵 salt |
| 重複領取 | settled 標記 + claimable 單調支付 |
| 未揭示堵死 | 未揭示者不入分母 |
| RNG 操縱 | VRF／beacon |
| 超發 | 守恒不變量 + Farmer 歸一化 |
| 財庫掏空 | 排放階梯 + 安全值 |
| 同人駝獅配合 | 允許但自稀釋狩獵分潤；非共識漏洞 |

### 18.2 經濟層

- 不以美元保證收益。  
- 參考市價與流動性僅資訊性，不進入公式。

### 18.3 營運層

- \(G_0\)、\(R_0\)、門檻為協議參數；變更須走正式治理解凍（本 GDS 視 v1.1 為凍結候選）。

---

## 19. Edge Cases（邊界情況）

| # | 情況 | 規定處理 |
|---|------|----------|
| E1 | 無任何羊駝有效參與 | \(R_d^{A}\) 回流財庫；美洲獅仍可結算其池 |
| E2 | 無任何美洲獅有效參與 | \(R_d^{C}+R_d^{H}\) 回流財庫 |
| E3 | 有美洲獅但各地 \(A_d(L)=0\) | 狩獵全失敗；\(R_d^{H}\) 全回流；基礎池仍分 |
| E4 | 全部羊駝在 Home | 美洲獅無法成功狩獵；同 E3 狩獵部分 |
| E5 | 單一地點極擁擠 | 權重擁擠自然降單隻毛額；懲罰可能升高 |
| E6 | Farmer 為當日唯一羊駝 | 仍歸一化：取得全部 \(R_d^{A}\) 毛額 |
| E7 | King 羊駝在 River | 懲罰率 0；仍佔權重分母 |
| E8 | 美洲獅揭示 Home | Reveal 失敗，不進入 \(\mathcal{C}_d\) |
| E9 | Commit 未 Reveal | 獎勵 0 |
| E10 | \(G<R_d\) 但未低於安全值 | 不應發生若控制器正確；若發生則拒絕結算並告警 |
| E11 | 安全模式 | 暫停 Commit，直至 \(G\ge G_{\mathrm{safe}}\) |
| E12 | 整數除法殘塵 | 殘塵進財庫，不得丟棄到無主 |
| E13 | 同日重複 Commit | 拒絕 |
| E14 | 結算後 Reveal | 拒絕 |
| E15 | 獎池為 0 的日 | 無分配；狀態仍可推進 |

---

## 20. Future Expansion（未來擴充）

以下**不得**破壞 v1.1 不變量，除非發行新版本規格：

- 新地點或季節地圖修飾符  
- 聯盟／公會分數  
- 外觀類 NFT（無經濟權重）  
- Sink 單價與季節節奏  
- 跨日任務（不得增發）  
- 治理參數微調（\(R_0\)、門檻）須版本化  

**明確禁止之擴充：** 增發 HANSOME；讓狩獵懲罰支付給美洲獅而破壞獨立池模型；取消 Farmer 歸一化。

---

## 21. Mathematical Appendix（數學附錄）

### 21.1 符號表

| 符號 | 意義 |
|------|------|
| \(d\) | 遊戲日 |
| \(R_d\) | 當日獎池 |
| \(R_d^{A},R_d^{C},R_d^{H}\) | 三角池 |
| \(w(L)\) | 地點權重 |
| \(\omega_i\) | 羊駝有效權重 |
| \(\Omega_d\) | 羊駝有效權重和 |
| \(\pi_i\) | 羊駝有效懲罰率 |
| \(P_d^{\mathrm{pen}}\) | 懲罰總額（回財庫） |
| \(w^C(j)\) | 美洲獅權重（統一，全為 \(1\)） |
| \(\sigma_j\) | 狩獵分數 |
| \(G,G_0,G_{\mathrm{safe}}\) | 財庫與安全值 |
| \(m_F,p_L,p_R\) | 1.20, 0.20, 0.30 |

### 21.2 池恆等式

\[
R_d^{A}+R_d^{C}+R_d^{H}=R_d
\]

\[
\sum r_i^{A,\mathrm{gross}}=R_d^{A}
\quad(\Omega_d>0)
\]

\[
\sum r_i^{A,\mathrm{net}}+P_d^{\mathrm{pen}}=R_d^{A}
\]

\[
\sum r_j^{C,\mathrm{base}}=R_d^{C}
\quad(W_d^{C}>0)
\]

\[
\sum r_j^{C,\mathrm{hunt}}+R_d^{H,\mathrm{dust}}=R_d^{H}
\]

### 21.3 臨界優勢（基礎池）

\[
\frac{R_d^{C}/N_C}{R_d^{A}/N_A}=\frac{0.1}{0.8}\cdot\frac{500}{50}=1.25
\]

### 21.4 參數凍結表（v1.1）

| 參數 | 值 |
|------|-----|
| \(N_A,N_C\) | 500, 50 |
| 池比例 | 0.8 / 0.1 / 0.1 |
| \(R_0\) | 400,000 |
| \(G_0\) | 300,000,000 |
| \(G_{\mathrm{safe}}\) | 15,000,000 |
| 階梯 R | 400k / 280k / 160k / 80k |
| \(W^{C}_{\mathrm{all}}\) | 50 |
| 地點權重 | 1,2,3,5,8 |
| \(\pi^{0}\) | 0,0.10,0.15,0.22,0.30 |
| \(m_F,p_L,p_R\) | 1.20, 0.20, 0.30 |

---

## Document Control

| 版本 | 說明 |
|------|------|
| v1.1 | 設計凍結候選：獨立三角池、懲罰回財庫、Farmer 歸一化、排放階梯與安全值鎖定 |

**End of Document — HANSOME GDS v1.1（繁體中文）**
