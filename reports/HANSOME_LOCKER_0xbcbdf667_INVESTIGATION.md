# HANSOME — Investigation: `0xbcbdf667…` / Doggfather V3 Unknown

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Scope | **Investigate only — no code changes** |
| Subject (normalized) | `0xBcbDF667bc853dB297B6ea57ec525817B39F3630` |
| Chain | Robinhood Chain · **4663** |
| Production UI symptom | Lock Status **Unknown**; Locked/Unlocked Liquidity + Lock % **Unavailable**; Position `#v3-pool:0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02:10000` |
| Recommendation | **A** — support in a future release (leave **Unknown** until then) |

---

## Verdict (one line)

`0xbcbd…` is **not a locker** — it is the scanned ERC-20 **The Doggfather** (`PonsLauncherToken`). Production shows a **synthetic V3 pool stub** because the v3 adapter discovers the material pool but **does not enumerate NPM / PonsLaunchLocker**. The real locked Position NFT is **#419712**, owned by verified **`PonsLaunchLocker`** `0x736D76699C26D0d966744cAe304C000d471f7F35` — unsupported today (registry = Titan only).

---

## Answers 1–6

### 1. Does this address implement a supported locker protocol? Which? If not, why detected as locker candidate?

| Question | Answer |
|----------|--------|
| Supported locker? | **No** |
| Protocol on this address? | **None** — it is an ERC-20 launch token, not Titan / not any `LOCKER_REGISTRY` entry |
| Detected as locker candidate? | **No** — address does **not** appear in codebase as a locker; `lockerCandidates` only persist known Titan / locker owners from **real** position evaluation (`detect.ts`). This CA is the **scan token** |

**Real locker (related, not the subject address):**

| Contract | Address | Role |
|----------|---------|------|
| `PonsLaunchLocker` | `0x736D76699C26D0d966744cAe304C000d471f7F35` | Holds UNI-V3-POS NFTs for Pons launches |
| `PonsLaunchFactory` | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` | `launchToken` → mints pool + NPM, transfers NFT into locker |
| Titan (only supported) | `0x26b0654A0756DCd036D4e7215324f3D2Be34D79e` | **Not involved** |

`LOCKER_REGISTRY` (`lib/hansome-score/lp/registry.ts`) contains **only** `titan_v2`. Pons is absent → never classified as verified lock.

### 2. Contract verified? ABI? Proxy / minimal proxy / custom?

**Subject token `0xBcbDF667…`**

| Property | Value |
|----------|-------|
| Verified | **Yes** (Blockscout) |
| Name | `PonsLauncherToken` |
| Source | `contracts/src/PonsLauncherToken.sol` |
| Compiler | `v0.8.30+commit.73712a01`, optimization on |
| Proxy | **No** (`proxy_type: null`, no implementations) |
| Type | Custom launch ERC-20 (not minimal proxy) |
| Relevant views | `liquidityPool`, `positionManager`, `poolFee`, `dexFactory`, `pairToken`, `launchFactory`, `deployer` |

**Related locker `PonsLaunchLocker` `0x736D76…`**

| Property | Value |
|----------|-------|
| Verified | **Yes** |
| Source | `contracts/src/PonsLaunchLocker.sol` |
| Proxy | **No** |
| Key API | `getLaunchedToken(token)`, `lockPosition`, `collectFees`, event `PositionLocked` |
| Unlock / withdraw LP | **No** unlock/withdraw functions in ABI — fee collection only (permanent escrow pattern) |

**Pool `0xC03fF676…`:** created by Uniswap V3 Factory; **not** independently verified as named source (factory clone pool); RPC `token0/token1/fee` readable.

### 3. Why can't Scan derive locked position?

| Cause | Applies? |
|-------|----------|
| Unsupported locker (Pons ≠ Titan) | **Yes** (secondary — even if NFT found) |
| Synthetic stub instead of real NFT | **Yes — primary UI failure mode** |
| No NFT owned by **token** CA | Token `balanceOf(NPM)=0` (expected) |
| NPM `ownerOf` inaccessible | **No** — works for #419712 |
| Custom locker storage | Partially — mapping is `getLaunchedToken(token)` on factory/locker, not Titan `getTokenLockData` |
| RPC/explorer failure | **No** |
| Decode failure of Titan path | N/A — Titan never hits this NFT |
| V3 NPM position enumeration incomplete | **Yes — designed gap** |

**Failure mode (confirmed):** Production Position id `#v3-pool:{pool}:{fee}` is emitted by `syntheticUnknownPosition` when factory pool inventory is material but NPM/locker ownership is not decoded:

```text
lib/hansome-score/lp/adapters/v3.ts
  → discoverV3Liquidity
  → syntheticUnknownPosition({ id: `v3-pool:${pool}:${fee}`, … })
  → lockState = UNABLE_TO_DETERMINE
  → lockAnalysisComplete = false (material pool present)
```

Then multi-version orchestrator keeps aggregate incomplete:

```text
lib/hansome-score/lp/multi.ts
  → detectMultiVersionLpIntelligence
  → buildUniswapVersionCoverage (v3 lockAnalysisComplete=false → INCOMPLETE COVERAGE)
  → computeMultiVersionAggregate / computeTokenAggregate
  → aggregateState = UNKNOWN_INCOMPLETE
```

UI maps that to **Unknown** / **Unavailable**:

```text
lib/hansome-score/lp/presentation.ts
  → userFacingAggregateLock("UNKNOWN_INCOMPLETE") → "UNKNOWN"
  → userFacingPositionLock("UNABLE_TO_DETERMINE") → "UNKNOWN"
  → lockDistribution.available=false → Locked/Unlocked/Lock% Unavailable
components/scan/ScanClient.tsx
  → renders lockStatusUnknown / lockedLiquidityUnavailable / …
```

### 4. Is a Position NFT actually owned by this contract?

**By the token CA `0xbcbd…`:** **No** (`NPM.balanceOf(token) = 0`).

**For this token’s liquidity — yes, elsewhere:**

| Field | Value |
|-------|-------|
| NPM | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |
| tokenId | **`419712`** |
| Current owner | **`0x736D76699C26D0d966744cAe304C000d471f7F35`** (`PonsLaunchLocker`) |
| Pool | `0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02` |
| Pair | WETH / Doggfather · fee **10000** (1%) |
| Ticks | `tickLower=-887200`, `tickUpper=204200` |
| Liquidity (NPM `positions`) | `36819258015569838458222` (matches pool `liquidity()`) |
| Readable? | **Yes** via `ownerOf` + `positions` |

`PonsLaunchLocker.getLaunchedToken(0xBcbDF667…)` returns `positionId=419712`, `exists=true`, `poolFee=10000`, `positionManager=NPM`, `pairedToken=WETH`.

`PonsLaunchLocker` currently holds **~176,618** UNI-V3-POS NFTs (`balanceOf`) — a platform-wide escrow, not a one-off.

### 5. Future support possible? Difficulty + ABI/decoding needs

**Yes — reasonably supportable.** Difficulty: **medium** (cleaner than blind NPM history scan).

| Need | Detail |
|------|--------|
| Registry | Add `PonsLaunchLocker` (+ optional factory) to `LOCKER_REGISTRY` |
| Discovery | Prefer `locker.getLaunchedToken(token)` / factory mapping → `positionId` (O(1) per token) |
| Ownership | V3 NPM `ownerOf(positionId)` must equal locker |
| Liquidity / range | NPM `positions(tokenId)` |
| Lock semantics | ABI has **no unlock time** → map carefully (`LOCKED_VERIFIED_ONCHAIN` with null expiry vs `LOCK_DETECTED_EXPIRY_UNKNOWN`); do **not** invent expiry |
| Fees | `collectFees` proves fee-only path; still not LP withdraw |
| V3 adapter | Replace/augment synthetic `v3-pool:` stub when Pons (or generic NPM) position proven |
| Do not | Treat factory `launchToken` alone as lock without `ownerOf` + registry |

Also needed for honest ALL_LOCKED: generic v3 NPM coverage for non-Pons positions (still incomplete by design).

### 6. If not reliably supportable today, why Unknown is correct

Unknown is correct **today** because:

1. Scan never resolved a real Position NFT id — only a presentation stub.
2. PonsLaunchLocker is **unsupported** (not Titan).
3. Claiming LOCKED from pool inventory alone would invent safety.
4. Lock % / Locked-Unlocked USD require economic valuation of **classified** positions; stubs are excluded from lock distribution (`multi.ts` filters `v3-` / `v2-` ids).

Until a verified Pons (or generic V3 NPM + locker) path lands, **Unknown / Unavailable** is the honest UI.

---

## On-chain / tx evidence

### Launch transaction

| Field | Value |
|-------|-------|
| Tx | [`0xe2d69696b0efbd2951cee7bd76f16b259423c5376cf024a34a77445b41837504`](https://robinhoodchain.blockscout.com/tx/0xe2d69696b0efbd2951cee7bd76f16b259423c5376cf024a34a77445b41837504) |
| Time | 2026-07-27T03:04:12Z |
| Method | `launchToken((…), launchConfigId=0, dexId=0, salt=…)` |
| From (deployer EOA) | `0xbE8af7E12B536aB55fbaf92EDbb512972e0504dA` |
| To (factory) | `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB` (`PonsLaunchFactory`) |
| Created token | `0xBcbDF667bc853dB297B6ea57ec525817B39F3630` |
| Created pool (same tx / factory) | `0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02` |

### Decoded ownership chain (same launch tx token transfers)

1. Mint full supply → factory  
2. Transfer ~1e27 tokens → V3 pool (seed LP)  
3. Mint **UNI-V3-POS #419712** → factory  
4. Transfer **#419712** factory → **`PonsLaunchLocker` `0x736D76…`**  
5. Initial buy / WETH path via SwapRouter02 into pool  

### Relevant contract calls (live RPC, 2026-07-28)

| Call | Result |
|------|--------|
| `token.liquidityPool()` | `0xC03fF676…` |
| `token.positionManager()` | V3 NPM |
| `token.poolFee()` | `10000` |
| `token.launchFactory()` | `PonsLaunchFactory` |
| `factory.locker()` | `PonsLaunchLocker` |
| `locker.getLaunchedToken(token).positionId` | `419712` |
| `NPM.ownerOf(419712)` | `PonsLaunchLocker` |
| `NPM.positions(419712).liquidity` | `36819258015569838458222` |
| `pool.liquidity()` | same |
| `NPM.balanceOf(token)` | `0` |

### Owner relationships

```text
Deployer EOA 0xbE8af7…
    └─ launchToken → PonsLaunchFactory 0xA5aAb3…
           ├─ deploys token PonsLauncherToken 0xBcbDF667…  (scan subject)
           ├─ creates V3 pool 0xC03fF676… (Doggfather/WETH 1%)
           ├─ mints NPM #419712
           └─ locks NFT → PonsLaunchLocker 0x736D76…  (real locker; unsupported)
TitanLockerManagerV2 — not in path
```

---

## Pipeline trace (discovery → UI Unknown)

```text
Scan token 0xBcbDF667… (Doggfather)
  │
  ├─ discoverV2Liquidity — no material pair (or incomplete; not the stub shown)
  ├─ discoverV3Liquidity — factory.getPool(WETH, 10000) → 0xC03fF676…
  │     material inventory → emit stub id "v3-pool:0xC03fF676…:10000"
  │     lockState=UNABLE_TO_DETERMINE, owner=null, lockerName=null
  │     lockAnalysisComplete=false
  ├─ discoverV4Liquidity / Titan — no v4 positions / no Titan hit for this token
  │
  └─ detectMultiVersionLpIntelligence
        aggregateState = UNKNOWN_INCOMPLETE
        presentation Position = #v3-pool:…  ← matches Production UI
        userFacing lock = UNKNOWN
        lockDistribution.available = false → Unavailable
```

**Exact failure point:** V3 adapter stops at pool discovery and emits a synthetic unknown ownership slot — it never calls V3 NPM `ownerOf` / never queries `PonsLaunchLocker.getLaunchedToken`.

**Which source files return / surface Unknown:**

| Layer | File | What it returns |
|-------|------|-----------------|
| Stub creation | `lib/hansome-score/lp/adapters/types.ts` → `syntheticUnknownPosition` | `lockState: "UNABLE_TO_DETERMINE"` |
| Stub emission | `lib/hansome-score/lp/adapters/v3.ts` → `discoverV3Liquidity` | `v3-pool:{pool}:{fee}`, `lockAnalysisComplete: false` |
| Aggregate | `lib/hansome-score/lp/aggregate.ts` → `computeTokenAggregate` | `UNKNOWN_INCOMPLETE` when only unknown slots |
| Orchestration | `lib/hansome-score/lp/multi.ts` | merges stub; incomplete coverage |
| User-facing label | `lib/hansome-score/lp/presentation.ts` → `userFacingAggregateLock` / `userFacingPositionLock` | **`"UNKNOWN"`** |
| UI strings | `components/scan/ScanClient.tsx` | Lock Status Unknown; liquidity Unavailable |

---

## Synthetic stub confirmation

Production Position id:

`#v3-pool:0xC03fF676EB6c3Bbd96dc725718A35acda60b6b02:10000`

Matches the designed stub format in `v3.ts` (`v3-pool:${getAddress(pool)}:${fee}`), **not** a decimal NPM tokenId. This is the same failure class as FOX dust/materiality reports (`v3-pool:…` stubs → Unknown), but here a **real** locked NPM **#419712** exists off-path in PonsLaunchLocker.

---

## Recommendation

| Option | Choice |
|--------|--------|
| **A — support in future release** | **Selected** |
| B — leave Unknown forever | Rejected as final product stance |

**Rationale for A:** Verified ABI, stable singleton locker address via `factory.locker()`, and O(1) `getLaunchedToken(token) → positionId` make Pons **more tractable** than generic third-party lockers. Until shipped, keep Production **Unknown** (do not soft-claim lock from pool balance or stub).

**Suggested future work order (not implemented here):**

1. Registry entry for `PonsLaunchLocker`  
2. Token-scoped `getLaunchedToken` → NPM revalidation  
3. Replace material `v3-pool:` stub when position proven  
4. Explicit permanent-lock / null-expiry display policy  
5. Tests: Doggfather #419712 fixture + non-Pons V3 still Unknown  

---

## Confirmation

- **NO code changes** in this investigation.
- Report path: `reports/HANSOME_LOCKER_0xbcbdf667_INVESTIGATION.md`

---

## Future work (approved backlog)

**Decision (2026-07-28):** Recommendation **A accepted**. **No PonsLaunchLocker code or deploy in this turn** (or any release that only ships honest progressive progress bars).

### Current Production (unchanged)

- Pons V3 stays **Unknown / Unavailable** when the real Position NFT is not resolvable by a supported adapter.
- Do **not** infer lock from pool inventory or a synthetic `v3-pool:` stub.

### Future implementation (when explicitly approved)

1. Registry entry for `PonsLaunchLocker` (+ optional factory).
2. Token-scoped `getLaunchedToken(token) → positionId`, then NPM `ownerOf` + `positions` revalidation.
3. Replace material `v3-pool:` stub **only after** ownership/position verification.
4. Explicit permanent-lock / null-expiry display policy (ABI has no unlock).
5. Other unsupported V3 lockers remain **Unknown**.

**This release:** Pons locker support is **not** implemented.
