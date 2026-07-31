# HANSOME Scan — Phase 10A V3 Position Discovery Coverage Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Mode** | Read-only investigation + architecture design |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Known pool** | `0xC71E763a0a258f266d1481295115ea4f291D95ED` |
| **Fee** | `10000` |
| **Chain** | Robinhood Chain `4663` |
| **Code / deploy** | **NONE** |
| **Verdict** | **PASS_NOT_DEPLOYED** |

Artifacts:

- `reports/data/phase10a_beer_v3_discovery.json`
- `reports/data/phase10a_probe2.json`
- `reports/data/phase10a_pools.json`
- Temporary diagnostics: `reports/data/_tmp_phase10a_*.ts` (not Production paths)

---

## 1. Executive summary

Production correctly shows **material V3 pool + Gecko TVL + synthetic Unknown** because it never resolves a real NPM `tokenId` (`V3_LOCKER_ADAPTERS=[]`, no general NPM enumeration).

This audit **did** resolve the real position on-chain:

| Fact | Value |
|------|--------|
| Pair (on-chain) | **WETH / BEER** (not USDG) |
| NPM `tokenId` | **`436637`** |
| Owner | **PonsLaunchLocker** `0x736D7669…7F35` |
| Active L | Equals `pool.liquidity()` (100% of active pool L) |
| Exhaustiveness (this pool) | **EXHAUSTIVE** |
| Production classification | Synthetic **Unknown remains correct** until discovery is wired |
| Deploy | **NO** |

**Pair correction:** Prompt/DX wording “BEER/USDG” is wrong for this pool address. `factory.getPool` matrix shows only `WETH×10000` non-zero; pool `token0=WETH`, `token1=BEER`; pool USDG balance = 0. Prior DX labeled `0x0Bd7…` as USDG — that address is **WETH**.

---

## 2. Scope, constraints, and non-goals

**In scope:** V3 position discovery coverage for the known BEER pool; methods A–G; architecture Options 1–5; generalization samples (non–HANSOME V4).

**Out of scope / forbidden (honored):**

- No Production scanner changes, no deploy, no Smart LP, no UI/score/lock semantic changes
- Do **not** classify Production Unknown → Locked/Unlocked
- Do **not** use pool-level raw L for lock %
- Do **not** wire `PonsLaunchLocker` (document relevance only)
- No txs, keys, contract mods, RPC secret exposure

---

## 3. Canonical V3 deployments (Robinhood)

| Role | Address | Evidence |
|------|---------|----------|
| Factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | `UNISWAP_RH_DEPLOYMENTS.v3`; `pool.factory()` match; `PoolCreated` |
| NPM | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Deployments; mint sender/owner; `npm.factory()` → factory |
| SwapRouter02 | `0xCaf681a66D020601342297493863E78C959E5cb2` | Pool Swap logs |
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Pool `token0` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Quote probe (no BEER/USDG pool) |
| PonsLaunchLocker | `0x736D76699C26D0d966744cAe304C000d471f7F35` | `ownerOf(436637)`; Blockscout name |

NPM `totalSupply` ≈ **449k** at audit time — full NPM enumeration is expensive.

---

## 4. Fixed-block reconstruction snapshot

| Field | Value | Source |
|-------|--------|--------|
| Block | **22586257** | `eth_getBlockByNumber` latest |
| Hash | `0x2ff01e3a72fd7fa074eb7c1aafad299f264959a6f0e477fffeb5141487e4af77` | same |
| Timestamp | `1785341404` → **2026-07-29T16:10:04.000Z** | same |
| RPC host | `rpc.mainnet.chain.robinhood.com` | public (no secrets printed) |

All `ownerOf` / `positions` / pool reads below are at this block unless noted.

---

## 5. Pool facts (questions — pool layer)

| # | Question | Answer | Source |
|---|----------|--------|--------|
| — | Factory | `0x1f7d7550…2EfA` | `pool.factory()`, deployments |
| — | NPM | `0x73991a25…E0D3` | deployments + mint path |
| — | token0 / token1 | **WETH / BEER** | `pool.token0/1` |
| — | fee | **10000** | `pool.fee`, `PoolCreated` |
| — | tickSpacing | **200** | `pool.tickSpacing`, `PoolCreated` |
| — | creation block | **20913772** | `PoolCreated` + `Initialize` + sole `Mint` |
| — | creation tx | `0x264c978c89b9aab8d5b1c9ba164f319ef063e3e3db2a96a963ed199a888315be` | same |
| — | slot0.tick / sqrtPriceX96 | `185530` / `846088510225045669409392189792753` | `pool.slot0` |
| — | pool.liquidity() | `36819258015569838458222` | active in-range L only — **not** lock % |
| — | balances | BEER ≈ `3.935e8`; WETH in position math ≈ `2.09`; **USDG = 0** | `balanceOf` |

`factory.getPool(BEER, quote, fee)` matrix:

| Quote \ Fee | 100 | 500 | 3000 | 10000 |
|-------------|-----|-----|------|-------|
| USDG | 0 | 0 | 0 | 0 |
| WETH | 0 | 0 | 0 | **`0xC71E763a…95ED`** |

---

## 6. Primary questions 1–17 (position NFT layer)

Only **one** numeric NPM position exists for this pool.

### Position `436637`

| # | Question | Answer | Source |
|---|----------|--------|--------|
| 1 | Position ID | **`436637`** (numeric NPM tokenId) | Mint tx receipt `Transfer`/`IncreaseLiquidity` |
| 2 | `ownerOf` | **`0x736D76699C26D0d966744cAe304C000d471f7F35`** (PonsLaunchLocker) | `npm.ownerOf` @ fixed block |
| 3 | Pool key | token0=WETH, token1=BEER, fee=10000, pool=`0xC71E763a…95ED` | `positions()` + factory |
| 4 | `tickLower` | **-887200** | `positions()` |
| 5 | `tickUpper` | **204200** | `positions()` |
| 6 | Liquidity `L` | **`36819258015569838458222`** | `positions()` (= pool active L) |
| 7 | `slot0` | tick **185530** (in range) | `pool.slot0` |
| 8 | `sqrtPriceX96` | `846088510225045669409392189792753` | `pool.slot0` |
| 9 | Amount math executed? | **Yes** (audit script using Production `amountsForLiquidity`) | `lib/hansome-score/lp/position-value.ts` |
| 10 | amount0 / amount1 | **`2092116464288837374` WETH** / **`393197950998501923797566942` BEER** | amount math |
| 11 | If incomplete, why? | N/A for audit path; Production stub still skips math | DX + `syntheticUnknownPosition` |
| 12 | Overflow? | **No** | math returned |
| 13 | Price outside range? | **No** — `inRange=true` | tick vs bounds |
| 14 | `readPosition` incomplete? | **No** on audit path; Production never calls it for this pool | adapters empty |
| 15 | Reject raw L for %? | **Yes** — share-of-`pool.liquidity()` reported only as diagnostic, labeled **NOT lock %** | correctness rules |
| 16 | USD reliable? | **Not from inventory mid** (no USDG in pool; BEER price needs oracle/ETH book). Labeled Gecko TVL ≈ **$10,502** remains external label only | Gecko / balances |
| 17 | Lock classification | **Audit:** owner = Pons locker contract with on-chain escrow semantics *if* adapter approved. **Production:** stays **Unknown** (`V3_LOCKER_ADAPTERS=[]`; do not reclassify) | pons.ts design + lockers/index.ts |

**Historical NPM tokenIds for this pool:** only **`436637`** (single Mint; Transfer mint→router/helper→Pons in same tx). No other tokenIds matched pool key.

**Active / inactive / empty / burned:**

| State | Result |
|-------|--------|
| Active (in-range, L>0) | **Yes** |
| Inactive material | **None** |
| Empty (L=0) | **No** |
| Burned NFT | **No** (`ownerOf` succeeds) |
| Withdrawn | **No** (`DecreaseLiquidity` count = 0) |

**Owner type:** **locker (PonsLaunchLocker)** — contract, Blockscout name `PonsLaunchLocker`. Not EOA, not multisig-proven, not “unknown contract” once name/address matched to known locker registry address. **Still not Production-locked** while adapter unwired.

**Share of material pool liquidity:** position L == pool active L → **100% of active pool L** (diagnostic only; **not** lock %).

---

## 7. BEER position table (required)

| tokenId | owner | owner type | liquidity | tickLower | tickUpper | active | amount0 (WETH) | amount1 (BEER) | USD | lock classification | evidence |
|---------|-------|------------|-----------|-----------|-----------|--------|----------------|----------------|-----|---------------------|----------|
| **436637** | `0x736D7669…7F35` | locker_pons | `36819258015569838458222` | -887200 | 204200 | yes | `2.092…` | `393197950.99…` | **unreliable** (no oracle; Gecko TVL label ~$10.5k separate) | **Production: Unknown / UNABLE_TO_DETERMINE.** Audit-only: would be LOCKED_VERIFIED if Pons adapter approved + still `ownerOf==Pons` | Mint tx + `ownerOf` + `positions` + pool Mint/Burn exhaust + Pons `getLaunchedToken` |
| *(Production stub)* | `null` | n/a | stub `"1"` | null | null | null | null | null | null | UNKNOWN | `syntheticUnknownPosition` — **no numeric tokenId in Production** |

If Production had “no real tokenId,” the missing source was **NPM enumeration / locker adapter**, not pool existence. This audit supplies the missing tokenId via pool-scoped discovery.

**Synthetic Unknown remains correct in Production:** **YES.**

---

## 8. Method A — NPM Transfer-event index

**Mechanism:** `Transfer(from=0)` on NPM → candidate `tokenId` → `positions()` filter by pool key → `ownerOf`.

| Dimension | Evidence |
|-----------|----------|
| Works in principle | Yes — mint Transfer for `436637` exists in creation tx |
| Pool filter | **None** at log layer — must `positions()` every mint id |
| Block range (pool life) | ~**1.67M** blocks (20913772 → ~22586257) |
| Cost sample | Last 10k blocks: **345** mint Transfers in **~354ms**; extrapolate ~**57k** mints over pool life → ~**57k** `positions()` calls |
| NPM supply class | ~**450k** total NFTs — full history worse |
| Blockscout recent pages | 8 pages / 221 ids — **did not include 436637** (mint too old) → recent-first explorer alone = **BOUNDED_PARTIAL** |
| False positives | All other pools’ mints until filtered |
| Misses | Burned ids still appear historically; need `ownerOf`/`positions` |

**Verdict for BEER:** Correct but **costly** as sole method. Inferior to pool-scoped Method C→receipt.

---

## 9. Method B — IncreaseLiquidity / DecreaseLiquidity / Collect

| Event | BEER tokenId 436637 | Notes |
|-------|---------------------|-------|
| IncreaseLiquidity | **1** | Same mint tx; L matches |
| DecreaseLiquidity | **0** | No withdrawal |
| Collect | **10** | Fee collects; pool also emitted Burn with **amountL=0** |

| Risk | Detail |
|------|--------|
| False positives | NPM-wide IncreaseLiquidity includes all pools |
| Misses | Relying on Collect alone misses liquidity shape; Decrease alone misses never-decreased positions |
| Best use | After candidate `tokenId` known — **tokenId-indexed** logs are cheap |

**Verdict:** Useful confirmation / lifecycle; not a good primary discovery scan without pool scoping.

---

## 10. Method C — Pool Mint / Burn

| Metric | Value |
|--------|-------|
| Mint count (creation→now) | **1** |
| Burn count | **10** (all `amountL=0` — Collect-related, not liquidity removal) |
| Wall time (single getLogs window) | **~653ms** |
| Mint owner | **NPM** (always for NPM-routed concentrated liquidity) |

**Critical rule confirmed:** Pool Mint `owner` = NPM ≠ NFT owner. Same tx transferred NFT to Pons.

**Verdict:** Best **pool-scoped candidate generator**. Must join mint **tx receipt** → NPM `Transfer`/`IncreaseLiquidity` → `tokenId`, then `ownerOf`.

---

## 11. Method D — Blockscout / explorer APIs

| Endpoint | Use | Completeness / limits |
|----------|-----|------------------------|
| `/api/v2/addresses/{pool}` | creator=factory; creation_tx often empty | Partial meta |
| `/api/v2/addresses/{pool}/logs` | Full pagination **18 pages** → 1 Mint, 10 Burn, Initialize | **Complete for this pool** (~2–15s/page; rate-limit risk) |
| `/api/v2/tokens/{NPM}` | name, supply ~450k | OK |
| `/api/v2/tokens/{NPM}/transfers` | Recent-first ERC-721 transfers | **Misses old 436637** within 8 pages |
| `/api/v2/addresses/{owner}/nft` | Owner inventory | Used for Pons samples; pagination/depth limits |
| `/api/v2/tokens/{NPM}/instances/{id}` | Instance meta | OK once id known |

**Latency:** address meta ~9s observed; transfer pages ~3–14s. **Not sufficient alone** for exhaustive NPM history; **sufficient** for small pool log history.

---

## 12. Method E — Existing project transfer-index

| Question | Answer |
|----------|--------|
| Can it index NPM ERC-721 Transfers today? | **No** |
| Why | Schema is ERC-20 token transfers (`scan:xfer:{chainId}:{token}`, `valueRaw`, creator digests). Not ERC-721 `tokenId` ownership keyed by NPM+pool |
| Schema changes needed | **New namespace** e.g. `scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}` with `tokenIds[]`, `lastSyncedBlock`, `generation`, `poolAddress` — **do not overload** ERC-20 index |
| Incremental sync safety | Separate lock/generation from ERC-20 transfer-index; cursor from `PoolCreated`/first Mint; fenced writers |

---

## 13. Method F — Known locker adapters (this pool only)

| Check | Result |
|-------|--------|
| `V3_LOCKER_ADAPTERS` in Production | **`[]`** (Pons file exists, intentionally unwired) |
| `Pons.getLaunchedToken(BEER)` | **`exists=true`**, `positionId=436637`, `pairedToken=WETH`, `poolFee=10000`, NPM match |
| `ownerOf(436637) == Pons` | **Yes** @ fixed block |
| Adapter would verify | Yes — matches `pons.ts` flow (mapping + ownerOf + positions + token in pair) |

**Pons relevance:** On-chain evidence for **this** pool is strong. Per Phase 10A constraints: **keep excluded** from Production; do not classify live Unknown as Locked. Wiring Pons is a **separate approved deploy**, not a substitute for general V3 discovery architecture.

---

## 14. Method G — Commercial / indexer options

Not required for BEER (pool-scoped eth_getLogs + receipt resolved exhaustively). Document only if scaling to all RH V3 pools with poor RPC log depth: hosted log indexers / subgraph equivalents. **No purchase/integration in this phase.**

---

## 15. Correctness rules (applied)

| Rule | Applied |
|------|---------|
| Pool ≠ Position NFT ≠ ownership ≠ lock | Pool found in Production; NFT/owner only in audit; lock not flipped in Production |
| Never treat `pool.liquidity()` as position amount / lock % | Used only for reconciliation diagnostic |
| Pool Mint owner ≠ NFT owner | Mint owner=NPM; NFT owner=Pons |
| `liquidity=0` not material | N/A (L>0); zero-L generalization sample recorded |
| Burned ≠ unlocked | N/A (not burned) |
| Contract owner ≠ automatically locked | Pons is a **known** locker address with escrow semantics — still **not** Production-locked while adapter unwired |
| Unknown stays Unknown unless ownership **and** lock semantics verified in product path | Production Unknown **retained** |

---

## 16. Exhaustiveness

**Label: EXHAUSTIVE** (for BEER pool `0xC71E…` / fee 10000)

Proof criteria met:

1. Blockscout pool logs pagination exhausted (1 Mint, 10 zero-L Burns, 1 Initialize)
2. `eth_getLogs` Mint/Burn over creation→now agrees
3. Sole Mint tx resolves to single NPM id `436637`
4. `positions(436637)` pool key matches; L == `pool.liquidity()`
5. No inactive material positions possible without additional Mint events
6. `DecreaseLiquidity` = 0; NFT not burned

Therefore for a future implementation covering this pool: `discoveryComplete=true` **only after** real NFT ownership decode (Production today must keep `discoveryComplete=false` / incomplete lock analysis).

---

## 17. Coverage metrics (audit run)

| Metric | Value |
|--------|--------|
| RPC calls (resolve script) | **197** |
| Explorer calls | **11** |
| Wall time | **~204s** (includes generalization sampling + NPM-wide samples) |
| Pool Mint/Burn getLogs | **~0.65s** for full pool life |
| NPM mint Transfer sample (10k blocks) | 345 logs / ~0.35s |
| Extrapolated NPM-wide filter cost | ~**57k** `positions()` over pool life |
| Incremental sync estimate (pool-scoped) | After index: poll new Mint logs from `lastSyncedBlock` — typically **≪1s** + few `eth_call`s per new mint |
| Log pages (Blockscout pool) | **18** to genesis |

**Pool-scoped path cost for BEER-class pools:** O(pool events) ≪ O(NPM mints).

---

## 18. Architecture options (compare)

| Option | Description | Pros | Cons | Fit for RH Scan |
|--------|-------------|------|------|-----------------|
| **1. On-demand full NPM scan** | Each scan: Transfer/IncreaseLiquidity over wide range + `positions()` filter | No durable storage | Too slow/expensive (~450k supply; public RPC limits) | Poor |
| **2. Persistent NPM-global transfer index** | Index all NPM Transfers | Complete candidate set | Huge cardinality; weak pool key; competes with ERC-20 index resources | Heavy |
| **3. Pool-scoped tokenId index** | Key: `chainId+NPM+token0+token1+fee` (and/or pool address); store tokenIds + sync cursor from `PoolCreated`/Mint | Cheap; matches factory discovery; incremental; enables exhaustiveness claims per pool | Needs durable KV; must still `ownerOf` at read time | **Best** |
| **4. Locker-only** | Pons/Titan/etc. adapters only | Cheap for known launches | Misses EOA / unknown lockers; BEER would work **only if Pons wired** | Necessary but **not sufficient** |
| **5. Hybrid** | Option 3 + approved locker adapters + bounded Blockscout assist | Honest Unknown when incomplete; fast known lockers | More moving parts | Production end-state |

---

## 19. Recommendation (exactly one)

### Recommend: **Option 3 — Pool-scoped persistent V3 Position Index**, with Option 5 layering when lockers are approved

**Why evidence supports this:**

- BEER proves Method C→receipt→tokenId is **exhaustive and cheap** for a live material pool
- Method A/B NPM-wide is **~2 orders of magnitude** more expensive and recent Blockscout pages **miss** old ids
- Existing ERC-20 transfer-index **must not** be overloaded
- Locker-only (Option 4) cannot cover EOA/multi-LP pools; Pons remains **policy-gated**

**Suggested schema (design only — not implemented):**

```
key: scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}
fields:
  version, poolAddress, tokenIds[],
  firstMintBlock, lastSyncedBlock, generation,
  paginationComplete / exhaustiveFlag,
  updatedAt
```

Read path: factory `getPool` → load index → `ownerOf`+`positions`+slot0 amounts → classify; if index incomplete → Unknown + `discoveryComplete=false`.

**Do not implement in this phase.**

---

## 20. Production synthetic Unknown assessment

| Production fact | Status |
|-----------------|--------|
| Material V3 pool via `getPool` | Yes (WETH/10000) |
| Gecko TVL | ~$10,502 label |
| Numeric NPM tokenId | **Missing** |
| `ownerOf` | **Not called** |
| `V3_LOCKER_ADAPTERS` | `[]` |
| Aggregate | `UNKNOWN_INCOMPLETE` |

**Synthetic Unknown remains correct:** **YES** — honesty gap is missing ownership decode in product path, not a false pool detection.

Audit knowledge (tokenId + Pons owner) must **not** silently change Production lock state without an approved adapter/index ship.

---

## 21. Generalization samples (non–HANSOME V4)

| Case | Sample | Evidence |
|------|--------|----------|
| EOA-owned resolvable V3 | tokenId **`488806`**, owner `0xC017…11FD`, WETH/USDG fee 100, L>0 | Recent NPM mint + `ownerOf` + `getCode` empty |
| EOA-owned #2 | tokenId **`488807`**, owner `0x2cd9…D2e3`, WETH/other fee 10000 | same |
| Verified locker-owned V3 | **BEER `436637` → Pons** (also `getLaunchedToken`) | `ownerOf` + Blockscout name + Pons mapping |
| Multi-position pool | Not found in short recent-mint grouping window | Needs dedicated pool Mint scan on a busy pool (e.g. WETH/USDG); architecture still requires multi-id lists per pool key |
| Zero-liquidity | tokenId **`488802`**, L=`0`, owner EOA | `positions.liquidity==0` — **not material**; ≠ unlocked claim |

---

## 22. Discovery method comparison (BEER summary)

| Method | Finds 436637? | Exhaustive for pool? | Cost | Primary? |
|--------|---------------|----------------------|------|----------|
| A NPM Transfer index | Yes if full history | If complete + filter | High | No |
| B Liq events | Yes if full history | With filter | High global / low token-scoped | Secondary |
| C Pool Mint→receipt | **Yes** | **Yes** here | **Low** | **Yes** |
| D Blockscout | Pool logs yes; NPM transfers no (recent) | Pool yes / NPM no | Medium latency | Assist |
| E Existing transfer-index | No | N/A | N/A | Needs new schema |
| F Pons adapter | **Yes** (if wired) | For Pons launches only | Very low | Complementary |
| G Commercial | Not needed for BEER | — | — | Optional later |

---

## 23. Deploy decision

| Item | Decision |
|------|----------|
| Deploy Production changes | **NO** |
| Wire Pons | **NO** (this phase) |
| Enable Smart LP | **NO** |
| Change UI / scores / lock semantics | **NO** |
| Implement V3 position index | **NO** (design only) |

---

## 24. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Report | `reports/HANSOME_PHASE10A_V3_POSITION_DISCOVERY_COVERAGE_AUDIT.md` |
| Canonical factory | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| Canonical NPM | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |
| Real BEER tokenIds | **`436637`** (only) |
| Pair | **WETH/BEER fee 10000** (not USDG) |
| Exhaustiveness | **EXHAUSTIVE** (this pool) |
| Recommended architecture | **Pool-scoped persistent V3 Position Index (Option 3)**, hybrid with approved lockers later |
| Synthetic Unknown still correct | **YES** |

**NEEDS_REVIEW triggers (none hit):** RPC totally blocked; inability to read NPM/factory; contradictory ownership without resolution. Public RPC lacked deep historical `eth_getCode`, but logs/receipts/`eth_call` at latest were sufficient.

---

## Appendix A — Ownership path (mint tx)

Tx `0x264c978c…15be` @ block **20913772**:

1. NPM `Transfer` mint → `0xA5aAb3F0…51feB`
2. NPM `IncreaseLiquidity` tokenId **436637**, L = pool L
3. NPM `Transfer` → **PonsLaunchLocker**
4. Pool `Initialize` + `Mint` (owner=NPM)

## Appendix B — Production gap map

```
factory.getPool → material stub (Unknown)
                 ↘ (missing) pool Mint → receipt → tokenId
                 ↘ (missing / unwired) Pons.getLaunchedToken → ownerOf
```

## Appendix C — Cleanup

Temporary scripts under `reports/data/_tmp_phase10a_*.ts` are audit-only. JSON under `reports/data/phase10a_*.json` retain measurement evidence. No Production `lib/hansome-score` paths modified.
