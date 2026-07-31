# HANSOME — Lock Status Unknown Diagnosis (`0xc2abBcC7…`)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Scope** | Read-only root-cause — why Lock Status = Unknown despite pool + TVL + listed position |
| **Token** | BEER (Beercoin) `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Production** | `GET https://www.hansomealpacas.xyz/api/scan?address=0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Code / deploy** | **NONE** (this task) |
| **Verdict** | **Confirmed root cause** from live Production payload + code path (optional on-chain pool corroboration) |

Artifacts:

- Live payload: `reports/_tmp-c2ab-scan.json`
- LP excerpt: `reports/_tmp-c2ab-lp-excerpt.json`

---

## Root cause (1–2 sentences)

Production discovers one **material Uniswap v3 BEER/USDG pool** via `factory.getPool`, but **never resolves a real NPM Position NFT / locker owner** (`V3_LOCKER_ADAPTERS` is empty; Pons not wired; no general NPM enumeration). It therefore emits a **synthetic ownership stub** (`lockState = UNABLE_TO_DETERMINE`, placeholder `liquidity = "1"`, null ticks/amounts), which forces token aggregate `UNKNOWN_INCOMPLETE` → UI **Lock Status = Unknown**, while **~$10,502 TVL** comes from **labeled Gecko market liquidity**, not from per-position token-amount math.

---

## Exact Unknown assignment sites

### A. Position-level lock state (first assignment)

**File:** `lib/hansome-score/lp/adapters/types.ts`  
**Function:** `syntheticUnknownPosition`  
**Lines:** **52–53** (and stub fields 55–81)

```ts
const lockState: LpLockState = "UNABLE_TO_DETERMINE";
const lockStateDisplay: LpLockStateDisplay = "UNABLE TO DETERMINE";
// ...
liquidity: "1",
amount0Raw: null,
amount1Raw: null,
tickLower: null,
tickUpper: null,
owner: null,
```

Created from `discoverV3Liquidity` → `syntheticUnknownPosition(...)` in `lib/hansome-score/lp/adapters/v3.ts` (~186–196) when a material pool is found but no verified locker hit replaces the stub. Verified hits require `V3_LOCKER_ADAPTERS` (`lib/hansome-score/lp/lockers/index.ts:24` → **`[]`**).

### B. Token-level aggregate → UNKNOWN_INCOMPLETE

**File:** `lib/hansome-score/lp/aggregate.ts`  
**Function:** `computeTokenAggregate`  
**Lines:** **144–148** (default return when only unknown material positions exist: no locked, no removable)

```ts
return {
  aggregate: "UNKNOWN_INCOMPLETE",
  display: LP_AGGREGATE_STATE_DISPLAY.UNKNOWN_INCOMPLETE,
  scoreLockState: "UNABLE_TO_DETERMINE",
};
```

Called via `computeMultiVersionAggregate` in `lib/hansome-score/lp/multi.ts` (~260–266). Live: `hasUnknown=true`, `hasLocked=false`, `hasRemovable=false`, `discoveryComplete=false`.

### C. Legacy API field `lpLockStatus: "unknown"`

**File:** `lib/hansome-score/lp/multi.ts`  
**Function:** `legacyStatus`  
**Lines:** **177–178** (`default` → `"unknown"` for `UNKNOWN_INCOMPLETE`)

### D. UI “Lock Status = Unknown”

**File:** `lib/hansome-score/lp/presentation.ts`  
**Function:** `userFacingAggregateLock`  
**Lines:** **45–48** (`UNKNOWN_INCOMPLETE` / `NONE` → `"UNKNOWN"`)

Also per-pool: `poolLockStatus` **lines 124–125** when all material positions map to UNKNOWN.

**UI bind:** `components/scan/ScanClient.tsx` ~1192 (`userFacingAggregateLock`), ~1209–1217 / ~1265–1267 (`lockStatusLabel` → `s.lockStatusUnknown`).

### E. Percentage unavailable reason (UI message source)

**File:** `lib/hansome-score/lp/position-value.ts`  
**Function:** `computeEconomicLockDistribution`  
**Lines:** **186–201** when `valued.length === 0`:

> `Lock percentage unavailable — could not derive reliable current token amounts / USD value for discovered positions (raw L is never used).`

Note: User phrasing “**Local** percentage unavailable…” matches this string with **Lock** (i18n also surfaces `lockPercentageUnavailable` / `lockPctUnavailable` / raw `reason` in `ScanClient.tsx` ~1354–1361 and ~1594–1598). There is no separate “Local percentage” copy in repo.

---

## Live Production facts (2026-07-29)

| Field | Value |
|-------|--------|
| Symbol / name | BEER / Beercoin |
| `liquidityUsd` (labeled TVL) | **10502.1274** |
| `lpLockStatus` | `unknown` |
| `aggregateState` | `UNKNOWN_INCOMPLETE` |
| `aggregateStateDisplay` | `UNKNOWN / INCOMPLETE` |
| `poolDetected` | true |
| `poolsDetectedCount` | 1 |
| Versions with liquidity | **V3 only** |
| `v3.lockAnalysisComplete` | **false** |
| `v3.detail` | `… material=1 … — position NFT/locker analysis incomplete for material/unknown.` |
| `discoveryComplete` | false |
| `lockDistribution.available` | false |
| `lockDistribution.poolLiquidityUsd` | 10502.1274 |
| `lockDistribution.reason` | Lock percentage unavailable — could not derive reliable current token amounts… (raw L is never used). |
| Position count | detected=1, material=1, locked=0, unlocked=0, **unknown=1** |

---

## Position-by-position answers (questions 1–17)

Only **one** discovered ownership slot exists.

### Position 1 — synthetic v3 stub

| # | Question | Answer |
|---|----------|--------|
| 1 | Position ID | `v3-pool:0xC71E763a0a258f266d1481295115ea4f291D95ED:10000` (**not** a numeric NPM tokenId) |
| 2 | `ownerOf` result | **Never called.** Stub `owner: null`. This id is not an ERC-721 tokenId. |
| 3 | Pool key | Pool address `0xC71E763a0a258f266d1481295115ea4f291D95ED`, fee **10000**. Stub currencies: `currency0=BEER`, `currency1=USDG` (`0x0Bd7D308…`). On-chain pool order is **token0=USDG, token1=BEER** (stub order follows probe token/quote, not pool `token0`/`token1`). |
| 4 | `tickLower` | **null** |
| 5 | `tickUpper` | **null** |
| 6 | Liquidity `L` | Stub placeholder **`"1"`** (not pool liquidity). On-chain pool `liquidity()` ≈ `36819258015569838458222` (corroboration only; unused by stub path). |
| 7 | `slot0` | **Not read** on the synthetic stub path. (Optional RPC: tick **185533**, `sqrtPriceX96` ≈ `846222872680122436024692399497051`.) |
| 8 | `sqrtPriceX96` | **Not attached** to the position object / never passed into amount fill for this stub. |
| 9 | Was `LiquidityAmounts.getAmountsForLiquidity` / `amountsForLiquidity` executed? | **No.** Stub never enters `detect.ts` `evaluateOne` → `fillPositionTokenAmounts`. Even if called, `fillPositionTokenAmounts` early-returns when ticks/`sqrtPriceX96` missing (`position-value.ts:112–118`). |
| 10 | Did it return token0/token1 amounts? | **No.** `amount0Raw: null`, `amount1Raw: null`. |
| 11 | If not, why? | Incomplete ownership decode: no real NPM position → no ticks/real L/`slot0` wiring on the stub; amount math skipped by design until those inputs exist. |
| 12 | Was overflow detected? | **No.** Amount math never ran; no catch/overflow path hit. |
| 13 | Was price outside range? | **N/A** for stub (`inRange: null`). Not a cause of failure. |
| 14 | Was `readPosition` incomplete? | **N/A / yes at protocol layer:** no NPM id to `readPosition`. v3 locker discovery returned **0** verified hits (`V3_LOCKER_ADAPTERS=[]`). v4 quick PM path also found **0** positions for this token. |
| 15 | Did we intentionally reject raw liquidity? | **Yes.** Stub `L="1"` is only for materiality counting; `computeEconomicLockDistribution` / comments explicitly **never** use raw L for lock %. Pool-level L is also not used for %. |
| 16 | Why did USD valuation fail? | `attachPositionUsdValues` → `positionEconomicUsd` requires `amount0Raw`/`amount1Raw` (`position-value.ts:144`); both null → `valueUsd: null` → `valued.length === 0` → reason at lines 186–201. |
| 17 | Why did lock classification become Unknown? | Stub `lockState=UNABLE_TO_DETERMINE` → `isPositionUnknown` true → `computeTokenAggregate` → `UNKNOWN_INCOMPLETE` → `userFacingAggregateLock` → UI **UNKNOWN**; `legacyStatus` → `lpLockStatus: "unknown"`. |

---

## TVL vs position-amounts divergence

| Path | Source | What it needs | Result for BEER |
|------|--------|---------------|-----------------|
| **Labeled TVL (~$10,502)** | Gecko / market overlay (`scan-deep` `gecko.liquidityUsd` → `response.liquidityUsd` / `lockDistribution.poolLiquidityUsd`) | External pool TVL label | **Available** |
| **Per-position token amounts** | Real NPM (or verified locker) position: ticks + L + `slot0.sqrtPriceX96` → `amountsForLiquidity` → `amount0Raw`/`amount1Raw` | Decoded concentrated position | **Unavailable** (synthetic stub) |
| **Position USD / lock %** | `amount*Raw` × decimals × token/quote USD; reconcile vs pool TVL | All material positions valued | **Fails** (`valued.length === 0`) |
| **Pool card USD** | `buildPresentationPools`: single presentation pool may show labeled `liquidityUsd` | Exactly one presentation pool + labeled TVL | Can show **~$10.5k** while lock still Unknown |
| **Lock Status** | Ownership classification of material positions | Verified lock / EOA / unsupported locker | Stays **Unknown** until ownership decoded |

**Why divergence is expected:** TVL answers “how much liquidity is in the market pool?” Ownership/amounts answer “which Position NFT(s) control that liquidity, and what share is locked?” Factory `getPool` + Gecko TVL do not identify NFT owners; without NPM/locker decode, amounts/lock % honestly stay unavailable while TVL can still display.

---

## Execution path (function call chain)

```
GET /api/scan
  → scan-deep / scan liquidity stage
    → detectMultiVersionLpIntelligence (lp/multi.ts)
      → Promise.all:
          discoverV2Liquidity          → 0 pairs
          discoverV3Liquidity (v3.ts)
            → factory.getPool(token, quote, fee) × quotes × fee tiers
            → classifyPoolInventoryMateriality → material=1
            → syntheticUnknownPosition(...)     ← UNABLE_TO_DETERMINE stub
            → discoverV3LockerPositions         ← V3_LOCKER_ADAPTERS=[] → []
            → mergeV3LockerPositions            ← stub retained
          discoverV4Liquidity / detectV4LpIntelligence
            → titan + quick PM transfers → 0 real positions for BEER
      → merge positions = [v3 stub]
      → computeMultiVersionAggregate
          → computeTokenAggregate               ← UNKNOWN_INCOMPLETE (lines 144–148)
      → computeLockDistribution (placeholder; excludes v2-/v3- stubs)
    → enrichLp (scan-deep)
      → attachPositionUsdValues                 ← valueUsd stays null
      → computeEconomicLockDistribution         ← available:false, reason lines 186–201
  → UI ScanClient LiquidityPanel
      → buildPresentationPools / poolLockStatus → UNKNOWN
      → userFacingAggregateLock(UNKNOWN_INCOMPLETE) → "UNKNOWN"
      → show lockDistribution.reason
```

---

## Contributing design constraints (not bugs by themselves)

1. **Honesty:** one material pool ≠ verified lock; incomplete ownership → Unknown, never invent ALL_LOCKED / Unlocked.
2. **No raw L for %:** even real pool `liquidity()` must not drive lock percentage.
3. **V3 locker adapters empty in Production path:** comment in `lockers/index.ts` — Pons intentionally not activated until approved.
4. **Synthetic stub currency order** may not match on-chain `token0`/`token1` — further reason not to invent amounts from pool inventory alone.

---

## Verdict

| Item | Status |
|------|--------|
| Root cause | **Confirmed** |
| Live data gap | **None material** — Production JSON + code path sufficient; on-chain slot0/L only corroborate that a real v3 pool exists while the scanner still lacks NFT ownership |
| Amounts failed due to | **Other: incomplete ownership decode / synthetic stub** (not overflow, not out-of-range, not primarily missing market price) |
| Secondary | Intentional reject of raw L; missing ticks/`sqrtPriceX96` on stub prevent `amountsForLiquidity` |

**No code changes. No deploy.**
