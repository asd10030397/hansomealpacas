# HANSOME — DEXScreener Pair Suddenly Missing（診斷 only）

| 欄位 / Field | 內容 / Value |
|--------------|----------------|
| **Date** | 2026-07-28 |
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Suspect ID** | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |
| **Chain** | Robinhood Chain `4663` |
| **Suspect URL** | https://dexscreener.com/robinhood/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d |
| **Scope** | Diagnose only — ordered checks 1–5 |
| **Code changes** | **NO** |
| **Deploy** | **NO** |

**Classification (exactly one):** `DEXSCREENER_DELISTED_OR_HIDDEN`

---

## Summary table

| Check | Result |
|-------|--------|
| Pool exists on-chain | **YES** — Uniswap v4 **poolId** (bytes32), not a pool/pair contract. StateView `getSlot0` / `getLiquidity` succeed. |
| Liquidity still present | **YES** — `liquidity > 0`; PoolManager holds **~114.19M HANSOME**; GeckoTerminal reserve **~$15.56k** (≈5.72 ETH + 114.19M HANSOME). |
| Recent swaps exist | **YES (as of 2026-07-26)** — Blockscout shows PoolManager-linked transfers via Universal Router `execute`, `dagSwapByOrderId`, plus `modifyLiquidities`. Gecko OHLCV has volume through **2026-07-26 23:00 UTC**. Last ~24h quiet (Gecko txn/vol ≈ 0). |
| DEXScreener API returns pair | **NO** — all pair/token endpoints return `null` / `[]` for real CA + poolId. Other RH Uniswap **v4** pairs still return normally. |
| Current correct DEXScreener URL | **None for real HANSOME.** Old pair URL is the historically correct poolId but API/page no longer serves the pair. Name-search only surfaces a **different** impostor token (do not use). |
| GeckoTerminal status | **LIVE** — pool page + API OK; price ~$0.0000434; FDV ~$43.4k; liquidity ~$15.6k. |
| Website contains stale link | **YES** — hardcoded DEXScreener pair URL in `components/SocialBar.tsx` and `bot/src/config.ts`. |
| Root cause | DEXScreener **pair market data removed/hidden** for this poolId/CA while on-chain pool + Gecko/DEXTools remain live; not a drained pool and not a chain-wide RH v4 outage. |
| Recommended action | Treat as DEXScreener support/moderation issue; point community to GeckoTerminal/DEXTools/site Swap; optional later: change SocialBar/bot link off DEXScreener (no change in this diagnosis). |

---

## Exact working URLs (external)

| Source | URL | Status |
|--------|-----|--------|
| **GeckoTerminal (working)** | https://www.geckoterminal.com/robinhood/pools/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d | Live |
| **DEXTools (working)** | https://www.dextools.io/app/en/robinhood/pair-explorer/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d | Page loads |
| **DEXScreener (real pool)** | https://dexscreener.com/robinhood/0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d | API `pair: null` — **not usable** |
| **DEXScreener impostor (NOT HANSOME)** | https://dexscreener.com/robinhood/0x42aebfba7cadf6fbfd48abde85bca0a57aabb557 | Different CA `0xb98E…C7Eb` — **ignore** |

---

## 1. On-chain verification (Robinhood 4663)

### Address type

| Field | Value |
|-------|-------|
| Representation | **Uniswap v4 `poolId` (bytes32)** |
| Not | ERC-20 pair contract, v3 pool contract, or hook |
| Canonical key (repo) | `lib/chain.ts` → `POOL_ID` / `POOL_KEY` |
| Pool key | `currency0 = address(0)` (native ETH), `currency1 = HANSOME`, `fee = 500` (0.05%), `tickSpacing = 10`, `hooks = address(0)` |
| Infrastructure | PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`; StateView `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |

Bytecode when truncating poolId to 20 bytes: **empty / not a contract** — consistent with v4 identity, not a deployed pair.

### Live StateView / balances (RPC `https://rpc.mainnet.chain.robinhood.com`, ~block `21435233`)

| Metric | Value |
|--------|-------|
| `getSlot0` | `sqrtPriceX96 = 530507687743678704517983149677890`, `tick = 176193`, `lpFee = 500` |
| `getLiquidity` | `253124762623789048371827` (**> 0**) |
| Approx price | ~`2.23e-8` ETH per HANSOME (~matches Gecko native price) |
| PoolManager `balanceOf(HANSOME)` | **114191367.508…** HANSOME |
| Migrated / closed / emptied / replaced | **No** — same canonical poolId still has liquidity + inventory |
| Still canonical HANSOME/ETH | **Yes** — matches `POOL_ID` / Gecko `uniswap-v4-robinhood` |

Active-liquidity → reserve math is a rough CLMM approximation; **trust PoolManager ERC-20 balance + Gecko reserves** for inventory (~114.19M HANSOME / ~5.72 ETH).

### Recent activity

| Evidence | Detail |
|----------|--------|
| Blockscout token transfers involving PoolManager | e.g. `2026-07-26T21:42:29Z` Universal Router `execute` `0x6462cdb2…`; `23:50:49Z` `dagSwapByOrderId`; `23:32:48Z` PositionManager `modifyLiquidities` |
| Gecko OHLCV hour buckets | Volume present at `2026-07-26T09:00Z`, `21:00Z`, `23:00Z` UTC |
| Gecko trades API / 24h page stats | Currently **0** trades / $0 vol (quiet since ~Jul 26) |

**Verdict:** Pool is **live**, not drained. Absence on DEXScreener is **not** explained by on-chain disappearance.

---

## 2. DEXScreener API / indexing

Queried 2026-07-28:

| Endpoint | Result for real HANSOME |
|----------|-------------------------|
| `GET /latest/dex/pairs/robinhood/{poolId}` | `pairs: null`, `pair: null` |
| `GET /latest/dex/tokens/{CA}` | `pairs: null` |
| `GET /token-pairs/v1/robinhood/{CA}` | `[]` |
| `GET /tokens/v1/robinhood/{CA}` | `[]` |
| `GET /latest/dex/search?q={CA}` | `pairs: []` |
| `GET /latest/dex/search?q={poolId}` | `pairs: []` |
| `GET /latest/dex/search?q=HANSOME` | **Only impostor** v3 pair (wrong CA) |
| `GET /orders/v1/robinhood/{CA}` | Token **profile `approved`** + historical **boosts** still listed |

### Control: other Robinhood Uniswap v4 poolIds still work

| poolId (prefix) | DEXScreener API |
|-----------------|-----------------|
| `0xd33c8fd3…` STONKBROKER/ETH | OK (~$1.69M liq) |
| `0x00dd2df2…` Index/ETH | OK |
| `0x4c6a3ce1…` BOYZ/WETH | OK |
| `0x1165db4c…` **HANSOME** | **NULL** |

HTML pair page fetch returned **403** from this environment (Cloudflare), so browser UX not fully scraped; **API is authoritative**: pair is gone from market index while RH v4 indexing generally works.

### Classification against outage modes

| Hypothesis | Fit |
|------------|-----|
| Temporary frontend-only outage | Weak — API also empty |
| Chain-wide RH / v4 indexing outage | **Rejected** — peer v4 pairs OK |
| Pair ID changed | **Rejected** — no new pair for real CA; Gecko still uses same poolId |
| Liquidity threshold filter | Unlikely — ~$15.6k TVL; smaller/peer pairs still listed |
| Stale/wrong old URL format | Weak — URL uses correct poolId; API key is that id |
| Moderation / delist / hide | **Best fit** — pair null everywhere; token CMS profile still approved |

---

## 3. External sources vs DEXScreener-only

| Source | Pool / pair | Liquidity | Price / FDV | Recent activity |
|--------|-------------|-----------|-------------|-----------------|
| **On-chain StateView + PM balance** | Same poolId | Non-zero L + ~114.19M HANSOME in PM | ~2.23e-8 ETH/token | Swaps/LP through Jul 26 |
| **GeckoTerminal API + page** | Same poolId, `uniswap-v4-robinhood` | ~$15,563 | ~$0.0000434 / FDV ~$43.4k | OHLCV through Jul 26; UI 24h txn quiet |
| **DEXTools** | Same poolId explorer URL | (widget/page present) | N/A in this pass | Page HTTP 200 |
| **Blockscout** | Token verified; PM top holder | PM #1 holder | — | Transfers through Jul 26 |
| **DEXScreener** | **Missing** | — | — | — |

**Conclusion:** Real pool problem **no**. **DEXScreener-only** indexing/visibility failure (delist/hide) for this pair.

---

## 4. Website / bot integrations（read-only）

### Hardcoded DEXScreener pair URL (broken for users now)

| Location | Usage |
|----------|--------|
| `components/SocialBar.tsx` | Hero/social “website” globe → hardcoded pair URL |
| `bot/src/config.ts` | `DEFAULTS.DEXSCREENER_URL` same pair URL |

### Same poolId used correctly elsewhere (not DEXScreener)

| Location | Role |
|----------|------|
| `lib/chain.ts` | `POOL_ID` canonical |
| `lib/market/constants.ts` | GeckoTerminal + DEXTools IDs/URLs |
| `lib/market/pool.ts` | On-chain StateView market reads |
| `lib/hansome-score/*` | Scan / LP known pool |
| `content/transparency.ts` | Transparency poolId note |

### Link strategy note

- Current SocialBar links **by pair/poolId on DEXScreener** — now dead in their API.
- Prefer **token CA** links only if an indexer still resolves them; today DEXScreener does **not** resolve the real CA.
- Safer public charts: **GeckoTerminal / DEXTools / in-site Swap** (already wired for market UI).

**No code or deploy performed in this diagnosis.**

---

## 5. Final classification

### `DEXSCREENER_DELISTED_OR_HIDDEN`

| Rejected alternative | Why |
|----------------------|-----|
| `DEXSCREENER_TEMPORARY_INDEXING` | Peer RH v4 pairs healthy; HANSOME-specific null across all endpoints |
| `DEXSCREENER_PAIR_ID_CHANGED` | No replacement pair for real CA; poolId unchanged on-chain + Gecko |
| `POOL_STILL_LIVE_EXTERNAL_UI_ISSUE` | True that pool is live, but too vague — specific failure is DEXScreener delist/hide |
| `POOL_LIQUIDITY_REMOVED` | Liquidity and PM inventory present |
| `WRONG_OR_STALE_URL` | URL matches canonical poolId; problem is DEXScreener not serving that id |
| `OTHER` | Not needed |

### Recommended actions (ops / product — not executed here)

1. **Community:** Share GeckoTerminal + DEXTools + official Swap; warn that DEXScreener name search may show an **impostor**.
2. **DEXScreener:** Open support ticket with CA + poolId + proof peer v4 pairs still index; ask why pair market data is null while profile/boosts remain.
3. **Site/bot (future, needs explicit ask):** Retarget SocialBar / bot DEXScreener URL to GeckoTerminal or remove until pair returns — **not done in this pass**.

---

## Evidence appendix (raw highlights)

```text
DEXScreener pair-by-id:
{"schemaVersion":"1.0.0","pairs":null,"pair":null}

DEXScreener token-pairs:
[]

GeckoTerminal pool:
address=0x1165db4c…1a0d
name=HANSOME / WETH 0.05%
reserve_in_usd≈15563
base=0x2c38df5f…0875
dex=uniswap-v4-robinhood

On-chain:
liquidity=253124762623789048371827
tick=176193
poolManager HANSOME bal≈114191367.508
```
