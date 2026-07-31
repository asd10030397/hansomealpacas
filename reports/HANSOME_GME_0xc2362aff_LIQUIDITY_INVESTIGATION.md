# HANSOME — Investigation: GME `0xc2362aff…` Pool Liquidity Unavailable / Lock Unknown

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Scope | **Investigate only — no code changes — no deploy** |
| Subject (normalized) | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` |
| Chain | Robinhood Chain · **4663** |
| Production UI symptom | Detected pools **2**; Total Liquidity **~$470,168**; Uniswap V2 (GME/ETH) **Pool Liquidity Unavailable**, **Lock Unknown**; Uniswap V3 (GME/ETH) **Pool Liquidity Unavailable**, **Lock Unknown** |
| Production API | `POST https://www.hansomealpacas.xyz/api/scan` (HTTP 200; liquidity stage `done`) |
| Recommendation | **C** — Expected Unknown / Unavailable is correct for this token today |

---

## Verdict (one line)

GME is a **DopplerERC20V1** (EIP-1167) Airlock launch with primary inventory in **Uniswap V4 PoolManager**; Scan surfaces **two synthetic stubs** (dust-economics V2 + material V3). Per-card **Pool Liquidity Unavailable** is **PR1 multi-pool presentation nulling** (not missing reserves). **Lock Unknown** is honest — V2 has no circulating LP; V3 liquidity is fragmented across many NPM positions (seed NFT `#330859` now has `liquidity=0`); no Titan/Pons/UNCX/Team Finance locker owns the book.

---

## 1. Pool discovery

### Token

| Property | Value |
|----------|-------|
| Name / symbol | GameStop / **GME** |
| Decimals | 18 |
| Total supply | `100_000_000_000` (1e29 raw) |
| Verified | **Yes** (Blockscout) |
| Proxy | **EIP-1167** → impl `DopplerERC20V1` `0x3Be8B97Fd0e713B5aBE0649Fa830223B6B4BC599` |
| Bytecode size (proxy) | 44 bytes |
| Deployer (Blockscout) | `0x1B37D3a72082029c44B35B604Ea473617580b69a` |
| Creation tx | [`0xf3dfb544…`](https://robinhoodchain.blockscout.com/tx/0xf3dfb544e8ab2ff8041b087c879095eb9c36790fb9c7207ba095a72d240b8c82) via ERC-4337 EntryPoint `handleOps` |
| `token.owner()` | `0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862` (**Airlock**) |
| `token.pool()` | `0xdeaD…dEaD` (bonding-curve pool migrated / retired) |
| Pons views (`liquidityPool`, `launchFactory`, …) | **N/A** (revert — not a PonsLauncherToken) |

### Canonical RH Uniswap deployments (codebase)

| Version | Factory | Router / NPM | Source |
|---------|---------|--------------|--------|
| V2 | `0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f` | Router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` | `lp/deployments.ts` |
| V3 | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | SwapRouter02 `0xCaf681a66D020601342297493863E78C959E5cb2` · NPM `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | same |
| Quotes probed | WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`, USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | | |
| V3 fee tiers | 100 / 500 / **3000** / 10000 | | |

### On-chain discovered pools (RPC `https://rpc.mainnet.chain.robinhood.com`)

| Ver | Address | Pair / fee | token0 / token1 | Inventory (raw) | Materiality (adapter rules) | On-chain TVL note |
|-----|---------|------------|-----------------|-----------------|-----------------------------|-------------------|
| **V2** | `0xcBeE302535aDAb23A42632d8Eb8e6ECF6072824E` | GME/WETH | WETH / GME | GME `1.060774436700411e15` · WETH `52439307` · reserves match · `totalSupply=1000` | **material** (raw ≥ 1000 both sides) | **Economically ~$0** (~5e-11 ETH) |
| **V3** | `0xB7eeDF33D02C743507c38E1eE20eF421e60661C6` | GME/WETH · **fee 3000 (0.3%)** | WETH / GME | GME ~`1.62e27` · WETH ~`3.53e18` (~3.53 ETH) · `liquidity()` ~`2.52e23` | **material** | ~$6–14k if 2× ETH side @ ~$1875 (order-of-magnitude); **not** the full $470k label |
| V3 | `0x3C6684A72D314B98D246DC3279523B4f93ceB944` | GME/WETH · 10000 | WETH / GME | GME `3` · WETH `11` · L=`0` | **dust** | omitted from cards |
| V3 | `0xEBa85753b8F3A725d9327BEb88B8984c95793cf3` | GME/USDG · 10000 | USDG / GME | GME `12` · USDG `10` · L=`0` | **dust** | omitted from cards |

### Production `/api/scan` alignment

| Field | Production value |
|-------|------------------|
| `liquidityUsd` (Gecko labeled) | **470168.1681** |
| `lpIntelligence.poolsDetectedCount` | **4** (discovered inventory hits) |
| Presentation / UI “Detected pools” | **2** (material stubs only) |
| `positions` | `v2-pair:0xcBeE3025…` + `v3-pool:0xB7eeDF33…:3000` |
| `byVersion.v2` | poolsFound=1, material=1, `lockAnalysisComplete=false` |
| `byVersion.v3` | poolsFound=3, material=1, dust=2, `lockAnalysisComplete=false` |
| `byVersion.v4` | poolsFound=0 positions, discovery incomplete; PoolManager holds ~7.3B GME |
| `aggregateState` | **`UNKNOWN_INCOMPLETE`** |
| `lockDistribution.available` | **false** · `poolLiquidityUsd=470168.1681` |

Artifacts: `reports/_tmp_gme_scan.json`, `reports/_tmp_gme_onchain.json`, `reports/_tmp_gme_deep.json`, `reports/_tmp_gme_nft_hunt.json`.

---

## 2. V2 analysis

| Question | Answer |
|----------|--------|
| LP token (= pair) | `0xcBeE302535aDAb23A42632d8Eb8e6ECF6072824E` (UNI-V2) |
| Reserves | `reserve0=52439307` (WETH), `reserve1=1060774436700411` (GME) — **readable** |
| `totalSupply` | **`1000`** (= Uniswap V2 `MINIMUM_LIQUIDITY`) |
| LP holders | **None circulating** — `balanceOf(0x0)=1000`; Blockscout `holders_count=0`; empty holders API |
| Readable? | **Yes** (factory `getPair`, `getReserves`, `totalSupply`, balances) |
| Why UI Unavailable / Unknown | Stub `v2-pair:…` with `lockState=UNABLE_TO_DETERMINE` (adapter never decodes LP ownership). Pair is a **second presentation card**, so PR1 sets `liquidityUsd=null` on **both** cards. |

**Implication:** There is no meaningful V2 LP to lock or unlock — the burned minimum accounts for the entire supply. Showing a V2 card is a **raw-floor materiality false positive** (both sides ≥ 1000 wei while USD ≈ 0).

---

## 3. V3 analysis

| Question | Answer |
|----------|--------|
| Material pool | `0xB7eeDF33D02C743507c38E1eE20eF421e60661C6` · fee **3000** |
| Active pool `liquidity()` | ~`2.52e23` (live; changes with swaps/LPs) |
| Production stub id | `#v3-pool:0xB7eeDF33D02C743507c38E1eE20eF421e60661C6:3000` (**synthetic**, not an NFT id) |
| Seed Position NFT | **`#330859`** minted in pool-create tx [`0x76151d4e…`](https://robinhoodchain.blockscout.com/tx/0x76151d4e75e1b46ddfc9e54ce510f99b89995c3314578d6a16fc8f32efa73c2a) |
| `ownerOf(330859)` | **`0xe871Ab6a2c025763260447315C555300E8bb9386`** (EOA) |
| `positions(330859).liquidity` | **`0`** (emptied — does **not** match pool `liquidity()`) |
| Locker / protocol on NFT | **None** — EOA-owned empty position; no Titan/Pons transfer |
| Real active liquidity | **Fragmented** — many Mint/IncreaseLiquidity events after create; not a single escrow NFT |

Pool create path (not Doppler launch tx): EOA `0xe871Ab…` → NPM multicall → create pool + mint `#330859`. This is **secondary/market V3 liquidity**, separate from the Airlock/Doppler V4 bootstrapping path.

`PonsLaunchLocker.getLaunchedToken(GME).exists = false`. NPM `balanceOf(GME)=0`, `balanceOf(Titan)=0`.

---

## 4. Locker investigation

| Protocol | Involved? | Evidence |
|----------|-----------|----------|
| **TitanLockerManagerV2** | **No** | NPM balance 0; not in ownership path; registry-only supported locker today |
| **PonsLaunchLocker** | **No** | `getLaunchedToken` → `exists=false`; token is Doppler clone, not PonsLauncherToken; adapter list empty in this release anyway (`V3_LOCKER_ADAPTERS=[]`) |
| **Team Finance / UNCX** | **No** | No registry entries; no ownership hits |
| **Arrow Locker** | **No** | Not in codebase / not observed on these positions |
| **Doppler / Airlock** | **Launch path only** | Airlock `0xeb7C…`, `DopplerHookInitializer` `0x4e3468…`, `RehypeDopplerHookInitializer` `0x6f0232…`; 85% supply routed at create toward V4 PoolManager `0x8366a39C…` |
| **Custom V3 locker** | **No** | Seed NFT still on EOA; active V3 book is multi-LP |

**Why unsupported / Unknown:** There is **no verified locker holding the material V3 book**. Doppler’s economic lock story (if any) lives in **V4 hook / PoolManager** inventory, which the multi-version path still reports as incomplete (`v4` positionsFound=0). Inventing LOCKED from pool balances or stubs would be unsafe.

---

## 5. Pipeline trace

```text
POST /api/scan  GME 0xc2362AfF…
  │
  ├─ discoverV2Liquidity (v2.ts)
  │     factory.getPair(GME,WETH) → 0xcBeE3025…
  │     balances → classifyPoolInventoryMateriality → material (raw floor)
  │     emit syntheticUnknownPosition id=v2-pair:0xcBeE3025…
  │     lockAnalysisComplete=false
  │
  ├─ discoverV3Liquidity (v3.ts)
  │     factory.getPool × fees × quotes → 3 pools (material=1, dust=2)
  │     emit stub id=v3-pool:0xB7eeDF33…:3000
  │     discoverV3LockerPositions → [] (Pons not wired)
  │     lockAnalysisComplete=false
  │
  ├─ discoverV4 / Titan (detect/multi)
  │     PoolManager inventory present; position NFT decode incomplete
  │
  ├─ aggregate (aggregate.ts / multi.ts)
  │     aggregateState = UNKNOWN_INCOMPLETE
  │     lockDistribution.available = false
  │     poolLiquidityUsd = labeled Gecko ~470168
  │
  ├─ presentation (presentation.ts)
  │     buildPresentationPools → 2 cards
  │     presentationPoolCount !== 1 → reliableSinglePoolUsd = null  ← per-card Unavailable
  │     sectionLiquidityTotals → labeled_aggregate ~$470k          ← section Total Liquidity
  │     userFacingAggregateLock(UNKNOWN_INCOMPLETE) → UNKNOWN
  │     userFacingPositionLock(UNABLE_TO_DETERMINE) → UNKNOWN
  │
  └─ ScanClient.tsx LiquiditySection
        Detected pools = presentation count (2)
        Pool Liquidity = formatUsdLiquidity(null) → Unavailable
        Lock = Unknown
```

### First layer causing each UI string

| UI string | First responsible layer | Mechanism |
|-----------|-------------------------|-----------|
| **Pool Liquidity Unavailable** (per card) | **`presentation.ts` → `buildPresentationPools`** | Multi-pool rule: do not attribute labeled TVL when `presentationPoolCount !== 1` → `liquidityUsd=null` |
| **Total Liquidity ~$470k** | **`sectionLiquidityTotals` + Gecko `liquidityUsd`** | `source: "labeled_aggregate"` when cards lack per-pool USD |
| **Lock Unknown** | **`adapters/v2.ts` + `adapters/v3.ts` → `syntheticUnknownPosition`** | Emits `UNABLE_TO_DETERMINE` stubs; never reaches a verified locker enum → aggregate `UNKNOWN_INCOMPLETE` → presentation `UNKNOWN` |

**Not the Unavailable cause:** missing `getReserves` / failed RPC / absent pools. Reserves and V3 balances are fully readable.

---

## 6. Root cause

| Class | Applies? | Evidence |
|-------|----------|----------|
| RPC failure | **No** | Live factory/pair/pool/NPM reads succeed |
| Adapter incomplete (V2 LP / V3 NPM) | **Yes — Lock** | Stubs only; `lockAnalysisComplete=false` |
| Registry / locker unsupported | **N/A as primary** | No locker holds the active V3 book; Pons/Titan absent |
| Position enum incomplete | **Yes — Lock / V3** | Seed NFT empty; many other LPs not enumerated |
| **Presentation multi-pool nulling** | **Yes — Unavailable** | 2 material stubs → PR1 nulls per-card USD |
| Materiality false positive (V2) | **Yes — aggravates Unavailable** | V2 raw balances ≥ 1000 wei but ~$0; forces second card |
| Intentional limitation | **Yes** | Partial v2/v3 adapters + honest Unknown; PR1 never invents per-pool splits |
| Missing Doppler/V4 decode | **Secondary** | Explains why labeled $470k ≫ V3 ETH inventory alone |

**Primary root cause (UI pair):**

1. **Unavailable:** Presentation layer intentionally withholds per-pool USD when ≥2 presentation pools exist; GME has two stubs (V2 false-material + V3 real). Section banner still shows Gecko labeled aggregate.
2. **Unknown:** Ownership/lock adapters stop at synthetic stubs — correct given no supported locker and incomplete V3 NPM enumeration.

---

## 7. Recommendation

| Option | Choice |
|--------|--------|
| A Bug→Fix | Rejected as **primary** (Unavailable is PR1-by-design given 2 cards; Lock Unknown must not become LOCKED) |
| B Missing protocol→roadmap | Useful **later** (Doppler/V4 position decode; generic V3 NPM enum) — not required to justify today’s UI |
| **C Expected Unknown→correct** | **Selected** |

**Why C:**

- Claiming LOCKED / a lock % from pool inventory or stubs would invent safety.
- Per-card Unavailable + section labeled TVL is the **documented multi-pool PR1 contract** (`presentation.ts`), not a broken reserve read.
- V3 seed NFT is empty and EOA-owned; active liquidity is multi-LP — Unknown is the honest lock label.
- Doppler/Airlock is a launch stack, not a registered HANSOME locker adapter.

**Optional future polish (not this investigation’s ship):** tighten V2/quote materiality (or USD floor) so ~$0 V2 pairs do not create a second card — that would restore single-card USD for GME’s V3 pool **without** changing Lock Unknown. Treat as a separate materiality ticket, not as “GME locker support.”

---

## 8. Impact

| Question | Answer |
|----------|--------|
| Would a fix help other RH tokens? | **Materiality polish (optional A):** yes — any token with a dust-economics V2 pair + real V3/V4 book hits the same dual-card Unavailable pattern (same class as FOX dust/materiality). |
| **Lock Unknown → LOCKED?** | Only after real ownership decode. Helps Doppler/Bankr-style launches **only if** a V4/Doppler adapter is built; helps Pons only via the separate Pons backlog; does **not** auto-fix organic multi-LP V3 books. |
| Protocols / launchpads | **Doppler + Airlock** (this CA); **Pons** (different failure class — see `HANSOME_LOCKER_0xbcbdf667_INVESTIGATION.md`); generic Uniswap V2/V3 multi-pool meme launches on RH. |
| Titan / Team Finance / UNCX | No change for this CA — not in path. |

---

## On-chain / launch evidence (summary)

### Doppler / Airlock create (token)

| Step | Detail |
|------|--------|
| Tx | `0xf3dfb544e8ab2ff8041b087c879095eb9c36790fb9c7207ba095a72d240b8c82` |
| Flow | EntryPoint `handleOps` → mint 15B to token, 85B to Airlock → initializer → **PoolManager** `0x8366a39C…` |
| Named contracts | Airlock, DopplerHookInitializer, RehypeDopplerHookInitializer |

### V3 seed NFT

| Field | Value |
|-------|-------|
| tokenId | **330859** |
| Owner | EOA `0xe871Ab6a2c025763260447315C555300E8bb9386` |
| Current L | **0** |
| Transfers | Mint only (no locker transfer) |

---

## Confirmation

- **NO code changes** in this investigation.
- **NO deploy**.
- Report path: `reports/HANSOME_GME_0xc2362aff_LIQUIDITY_INVESTIGATION.md`

---

## Return to parent (compact)

| Item | Value |
|------|-------|
| Recommendation | **C** — Expected Unknown / Unavailable correct |
| Root cause (one line) | Multi-pool PR1 nulls per-card USD (V2 dust stub + V3 stub); Lock Unknown from undecoded synthetic ownership — not a missing-reserves RPC bug |
| V2 pair | `0xcBeE302535aDAb23A42632d8Eb8e6ECF6072824E` |
| V3 pool (fee 3000) | `0xB7eeDF33D02C743507c38E1eE20eF421e60661C6` |
| Report | `reports/HANSOME_GME_0xc2362aff_LIQUIDITY_INVESTIGATION.md` |
| Code / deploy | **NONE** |
