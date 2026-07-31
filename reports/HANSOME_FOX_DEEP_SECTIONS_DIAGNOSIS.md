# HANSOME — FOX Deep Sections Diagnosis（診斷 only）

| 欄位 / Field | 內容 / Value |
|--------------|----------------|
| **Date** | 2026-07-28 |
| **Token** | FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| **Chain** | Robinhood Chain `4663` |
| **Production** | https://www.hansomealpacas.xyz |
| **Scope** | Sections 1–4 diagnose only |
| **Code changes** | **NO** |
| **Deploy** | **NO** |

Evidence: Production `/api/scan` + `/api/scan/status`, Robinhood RPC, Blockscout, DEXScreener, code-path inspection (`lp/adapters/v3.ts`, `lp/presentation.ts`, `scan-deep.ts`, `blockscout.ts`, `ScanClient.tsx`).

---

## Summary table / 總表

| Section | Current status<br>目前狀態 | Elapsed<br>耗時 | Retry<br>重試 | Root cause<br>根因 | ETA<br>預估 | Final expectation<br>最終預期 |
|---------|---------------------------|-----------------|---------------|-------------------|-------------|------------------------------|
| **1. Liquidity** | Stage `done`；UI Pool Liquidity=unavailable；Lock=unknown | Deep liquidity 已完成（此輪 snapshot 內） | N/A（liq 已 done） | **雙池 presentation 不掛 aggregate USD** + V3 **synthetic pool stub**（NPM 未枚舉）+ 第二池幾乎為 dust；非報價/USDG decimals 失效 | 無需再等 Deep liq | **Honest Unknown / Incomplete** 鎖倉；主池 TVL 外部可知 ~$96k，UI 每池仍可能 unavailable，除非改 presentation/per-pool TVL（**未做**） |
| **2. Burn Activity** | Stage `partial`；24H/7D/30D/all = unknown；**Collecting → 現為 terminal unavailable** | `deepStartedAt`≈07:34Z → settle/stale ~6min；總牆鐘含 retry | **`deepRetryCount=2` / max=2（耗盡）** | P2 transfer index **未寫入任何頁**（`pages=0`）；creatorBurn 在 deadline / soft budget / 平台 300s 下超時，**進度不落盤**；token **114,124** transfers | Auto-retry **已結束**；需 **手動 Refresh** 才可能再跑 | 即使成功：40 頁≈2k transfers≈~1–2 日，**24H 可能夠、7D/30D 不夠 complete**；all-time 必為 partial |
| **3. Creator Behaviour** | Stage `partial`；`available=false`；`pages=0` | 與 Burn 同 stage（共用 transfer index） | **同 2/2 耗盡** | 同上（共用 `fetchTokenTransfersPaged`）；另：newest-first 40 頁**看不到** 07-10 deployer 早期轉帳 | 同 Burn；手動 Refresh | Deployer **已確認**；direct sell / transfer-then-sell **尚未可判定**；必須維持 provisional / incomplete，**不可**當 clean |
| **4. Wallet Relationships** | Stage **`done`** | 通常快於 Burn/Creator（本 token 已完成） | 不需為 stage 再 retry | 取樣完成但 funder 解析率低（1/19）→ confidence incomplete | 已完成 | Stage done；圖為 **sampled / honest partial coverage**，非卡死 |

---

## 1. FOX Liquidity

### Found pools（on-chain confirmed）

| Pool | Pair | Fee | token0 | token1 | `liquidity` (pool) | Reserves (approx) | Notes |
|------|------|-----|--------|--------|--------------------|-------------------|-------|
| `0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685` | FOX / WETH（UI: FOX/ETH） | **10000** | WETH `0x0Bd7…AD73` | FOX | **non-zero** `~4.43e22` | FOX ≈ **70.36M**；WETH ≈ **24.27** | Factory `getPool` OK；`slot0` readable |
| `0x765657607a7e1a0D822513c0233F2fEE793D6ed0` | FOX / USDG | **500** | FOX | USDG `0x5fc5…d168` | **0** | FOX=**1 wei**；USDG=**1 wei** | Factory 有池，但實質 **dust / 空池** |

- Factory: `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`
- RPC reads: `token0` / `token1` / `fee` / `slot0` / `liquidity` / `balanceOf` — **all readable**
- Labeled aggregate TVL（Gecko via scan）: **`liquidityUsd ≈ $96.4k–96.5k`**；`lockDistribution.poolLiquidityUsd ≈ $95.5k`
- DEXScreener main V3 FOX/WETH: **~$96.1k**（同地址）
- DEXScreener 另有極小 **V4** FOX/ETH、FOX/USDG（不同 id）；HANSOME UI 顯示的 FOX/USDG 是 **V3 dust** `0x7656…`，不是 DEX 上較顯眼的 V4 USDG 池

### Position / locker results

| Item | Result |
|------|--------|
| Real V3 Position NFTs | **未發現**（適配器**尚未做** NPM enumeration） |
| Published “positions” | 2× **synthetic** `v3-pool:{pool}:{fee}`，`liquidity:"1"` placeholder，`amount0/1=null`，`valueUsd=null`，`owner=null` |
| Titan / locker | `discoverySources` 含 `titan_locker`；**無** verified locked positions |
| Aggregate | `UNKNOWN_INCOMPLETE` / Lock Status **unknown** |
| Lock % | `available=false` — 無法對 synthetic stub 做 token amounts × USD（**raw L never used** — 設計正確） |
| `knownPositionsVerified` / `exhaustiveDiscoveryComplete` | **false** |

### Why UI shows Pool Liquidity: unavailable

| Hypothesis | Verdict |
|------------|---------|
| Missing quote price | **No** — aggregate `liquidityUsd` / Gecko TVL 存在 |
| Decimals / USDG recognition bug | **No** — USDG 在 `RH_QUOTE_TOKENS` + `position-value` 有 `$1`；問題在**沒有真實 position amounts** |
| V3 TVL math broken | **Partial** — 適配器**不算** pool reserve USD；只做 `getPool` + token `balanceOf` |
| RPC / Blockscout timeout | **No** for pool discovery（pools found；stage `liquidity=done`） |
| Stale cache | **No** as primary — live RPC 與 scan 池地址一致 |
| Parser / adapter bug | **Yes（presentation + dust inclusion）** — 見下 |
| Honest unknown | **Yes** for **Lock Status**（V3 NPM incomplete by design） |

**UI root cause（Pool Liquidity unavailable）**

`buildPresentationPools` **only** attaches `liquidityUsd` when `poolCount === 1`. FOX 有 2 個 presentation pools → 每池 `liquidityUsd=null` → `formatUsdLiquidity` → **Unavailable**，即使 token-level TVL ~$96k 已有。

**Secondary:** V3 adapter 用 `balanceOf(pool) !== 0` 納入 FOX/USDG；**1 wei** 通過門檻 → 多一張幾乎空的池卡，進一步觸發 multi-pool USD 隱藏。

**Where HANSOME is “stuck” vs DEXScreener/Gecko**

- Externals: per-pool / aggregate **reserve TVL**
- HANSOME: finds pools + labeled aggregate USD，但 **不枚舉 V3 NPM**、不把 aggregate 拆到多池卡片、不把 pool reserves 當成 lock valuation
- Lock % 正確拒絕用 raw L；在只有 synthetic stubs 時顯示 unknown = **Honest Unknown**，不是 Score/lock 語義錯誤

### Section 1 classification

| Kind | Item |
|------|------|
| Honest partial / unknown | Lock Status unknown；no verified Position NFT locks |
| Presentation / adapter gap（可修，非 lock 語義） | Multi-pool hides USD；dust pool included |
| Upstream / perf | Not primary for liq stage on this token |
| Must NOT modify | Score weights；Burn semantics；LP lock classification rules；risk thresholds |

---

## 2. Burn Activity

### Observed Production state

| Metric | Value |
|--------|------:|
| Stage | `partial` |
| `deepRetryCount` | **2**（`MAX_DEEP_AUTO_RETRIES=2` → **auto exhausted**） |
| `deepInflight` | **false**（worker **not** running now） |
| `pagesFetched` | **0** |
| `transfersIndexed` | **0** |
| `headIndexed` | false |
| `paginationComplete` | false |
| `fetchFailed` | false |
| `source` | `none` |
| Token `transfersCount` | **114,124** |
| Windows 24H / 7D / 30D / all | completeness **unknown**；note = temporarily unavailable / did not finish in time |
| Dead inventory（Fast / P0） | **OK** — ~44.66M at `0x…dEaD`（~4.47%） |

### Why it stayed “Collecting”

1. Burn P2/P3 share Deep stage **`creatorBurn`** with Creator（`fetchTokenTransfersPaged`, default **max 40 pages**）。
2. Soft budgets: relationships **45s** → liquidity **180s** → creatorBurn **120s**；global **`DEEP_SCAN_MAX_EXECUTION_MS=270s`**；Vercel **`maxDuration=300s`**；stale recover **360s**.
3. First pass often **spends most budget on liquidity**；creatorBurn gets little wall time → timeout → soft-fail → **in-flight page progress discarded** → UI still `pages=0`.
4. Status poll showed **retryable Collecting** while `partial` + `deepRetryCount < 2` / inflight。
5. After **retry=2** + inflight false：auto Collecting **should end** → terminal **Temporarily unavailable**（not infinite Collecting）。若 UI 仍轉圈，多半是客戶端仍把 retryable/inflight 當 collecting，或未 refresh status。

### Coverage math（if 40 pages ever succeed）

| Item | Estimate |
|------|----------|
| Blockscout page1 | ~2.0–2.3s；50 items；~70 min span at current pace |
| 40 pages | ~2,000 transfers；~**1–2 days** newest-first |
| 24H | **Possibly enough** if fetch completes |
| 7D / 30D / all | **Not enough** for `paginationComplete`（need ~2,283 pages for full 114k @50/page） |
| Over-estimate note | UI 若仍顯示短 ETA：應改文案為 *“Still analyzing — this token has more on-chain history than usual.”*（**診斷 only — 未實作**） |

### P2 / P3 stuck where

| Layer | Stuck? |
|-------|--------|
| P0/P1 dead inventory + burn flags | **Done** |
| P2 transfer windows | **Stuck / failed to start persist** — 0 pages |
| P3 supply-reduction history | **Unavailable**（depends on transfer/burn-method evidence） |
| Blockscout API itself | **Healthy** without bogus `?type=`（bare `/transfers` = 200） |

### Section 2 classification

| Kind | Item |
|------|------|
| Upstream / performance | 114k transfers；40-page cap；stage budget vs liq ordering；timeout drops progress |
| Honest partial | Terminal unavailable after retries；incomplete windows ≠ “0 burned in 24H” |
| Code / reliability gap（needs fix later） | No incremental persist of transfer pages； timeout ⇒ `pages=0`；heavy-token ETA copy |
| Must NOT modify | Burn **semantics** / window meaning；Score burn rules |

---

## 3. Creator Behaviour

### Observed

| Metric | Value |
|--------|------:|
| Stage | `partial` |
| `status` | `incomplete` |
| `available` | **false** |
| `pagesFetched` / `transfersIndexed` | **0 / 0** |
| `paginationComplete` | false |
| `dumpDetected` / `transferThenSellDetected` | `false` / `false`（**defaults — not a clean verdict**） |
| Deployer（confirmed） | `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB` |
| Deployer FOX token-transfers（Blockscout account API） | **2 rows**：mint → deployer；deployer → V3 pool（2026-07-10）— **no sell sample in that endpoint page** |
| Structural Score | Provisional deduction `creator_behaviour_unindexed`（**8**）；`incompleteCategories` includes creator |

### Why Collecting / incomplete

- Same failed **`creatorBurn`** transfer index as Burn（0 pages, retries exhausted）。
- Even with 40 successful newest pages，deployer activity from **2026-07-10** is **outside** the recent ~2-day window → direct-sell history can still be **incomplete** for “all-time creator behaviour”.
- UI mapping：`transfersIndexed<=0 && !available` → visual **`insufficient`**（not “clean”）while collecting；Score already treats unknown ≠ safe。
- **Risk if terminal gap mishandled:** raw `dumpDetected=false` + `sellTransferCount=0` must not be read as “not detected = good”. Current `creatorVisualStatus` guards the headline； field-level “None” for transfer-then-sell when not collecting should stay **provisional/unavailable**, not clean absolutes.

### Determinability

| Question | Answer |
|----------|--------|
| Deployer confirmed? | **Yes** |
| Direct sells determinable now? | **No**（index empty） |
| Transfer-then-sell determinable now? | **No** |
| Done vs honest partial? | **Honest partial / terminal unavailable** — not done |

### Section 3 classification

| Kind | Item |
|------|------|
| Upstream / performance | Shared transfer pagination bottleneck |
| Honest partial | Must remain incomplete / provisional |
| Needs fix（later） | Progress persistence； heavy-token UX； possibly deployer-targeted fetch（design change — not done） |
| Must NOT modify | Creator scoring thresholds； “unknown ≠ safe” |

---

## 4. Wallet Relationships

### Observed

| Metric | Value |
|--------|------:|
| Stage | **`done`** |
| Sample | `wallet_graph_sampled_n=19` |
| Funders resolved | **1 / 19**（&lt;35% → confidence incomplete） |
| Shared funding | 1 address；funder `0xa5a5…a142` |
| Equal-balance cluster | size 1（the V3 pool） |
| Same-block early buys | 1（pool address in early set） |
| vs Burn/Creator/Liquidity | **Faster / finished**；not stuck on a single funder sample forever |

### Classification

| Kind | Item |
|------|------|
| Honest partial | Low funder resolution； sampled graph only |
| Upstream | Blockscout native funder lookups sparse/slow for many holders |
| Needs fix? | Optional coverage improvement only； **not blocking** like Burn/Creator |
| Must NOT modify | Relationship scoring meaning（probabilistic flags） |

---

## Cross-cutting lists

### Code bugs / product gaps（fix later — not this task）

1. **Multi-pool presentation** hides per-pool USD even when aggregate Gecko TVL exists.
2. **V3 dust pool** included when `balanceOf == 1 wei`.
3. **V3 NPM position enumeration incomplete**（documented `protocolSupportStatus: partial`）→ synthetic unknowns only.
4. **Transfer-index progress not checkpointed** — stage timeout ⇒ `pagesFetched=0` despite work possibly done in-memory.
5. **Heavy-token ETA / Collecting copy** over-optimistic for 100k+ transfer tokens.
6. Creator field defaults (`dumpDetected=false`) are easy to misread if UI ever skips the `insufficient` path.

### Upstream / performance

- Blockscout transfer volume **114k** pages.
- Deep soft budget + Vercel 300s vs rel+liq+creatorBurn sequencing.
- Auto-retry budget **2** then stop.
- Funder resolution sparsity for relationships confidence.

### Honest partial（correct behaviour — keep）

- LP Lock **unknown** without valued ownership positions.
- Burn windows **unknown** without transfer index.
- Creator **incomplete** / Score provisional when unindexed.
- Relationships stage done but wallet confidence incomplete.
- Refusal to use raw concentrated-liquidity L for lock %.

### Need fixes（recommended later）

- Per-pool or aggregate-aware Liquidity USD presentation for multi-pool.
- Dust / minimum inventory threshold for V3 pool cards.
- V3 NPM discovery（when product prioritizes lock % for V3）.
- Incremental transfer-index persist + heavy-history UX copy.
- Manual refresh path already exists for exhausted terminal partials（confirm UX）.

### Should NOT be modified

- Score formulas / weights / risk thresholds  
- Burn window **semantics**  
- LP lock classification rules（locked vs unlocked vs unknown）  
- “Unknown ≠ safe” creator/liquidity posture  
- No FOX-specific hardcodes / Position ID seeds  

---

## Confirmations

- [x] Diagnosed sections **1 → 2 → 3 → 4** sequentially  
- [x] Production `/api/scan` + `/api/scan/status` used  
- [x] On-chain RPC pool reads performed  
- [x] **NO code changes**  
- [x] **NO deploy**  

---

## Parent return (copy block)

**Report:** `reports/HANSOME_FOX_DEEP_SECTIONS_DIAGNOSIS.md`

| Section | Status | Elapsed | Retry | Root cause | ETA | Final expectation |
|---------|--------|---------|-------|------------|-----|-------------------|
| Liquidity | done; UI liq unavailable; lock unknown | liq finished | n/a | multi-pool USD hide + V3 synthetic/dust; not quote bug | n/a | honest lock unknown; external TVL ~$96k |
| Burn | partial terminal | ~6min+/retries | **2/2 exhausted** | P2 pages=0; timeout drops progress; 114k txs | needs manual refresh | 24H maybe; 7D/30D/all incomplete |
| Creator | partial terminal | shared w/ burn | **2/2** | same transfer index; deployer OK; sells not indexed | needs manual refresh | provisional — not clean |
| Relationships | **done** | faster | n/a | sampled; funders 1/19 | done | honest partial coverage |

**Code bugs/gaps:** multi-pool USD presentation; dust V3 pool; V3 NPM not enumerated; transfer pages not checkpointed; heavy-token Collecting ETA.

**Upstream/perf:** Blockscout volume; Deep/Vercel budgets; retry cap.

**Honest partial:** lock unknown; burn/creator unavailable; wallet sample incomplete.

**Need fixes:** presentation/TVL split; dust filter; NPM/index persistence/UX（later）.

**Do not modify:** Score / Burn semantics / LP lock rules / risk thresholds.

**NO code / NO deploy.**
