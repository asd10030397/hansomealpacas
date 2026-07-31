# HANSOME — Generic Locker Adapter + PonsLaunchLocker

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Scope | Implementation — **no deploy** |
| Investigation | `reports/HANSOME_LOCKER_0xbcbdf667_INVESTIGATION.md` |
| Subject example | The Doggfather `0xBcbDF667…` → Position NFT **#419712** |
| Verdict | **PASS** |

---

## Verdict (one line)

Generic locker-adapter framework lands under `lib/hansome-score/lp/lockers/`; **PonsLaunchLocker** is the second registry entry after Titan. V3 discovery replaces material `v3-pool:` stubs with real NPM ids only after `getLaunchedToken` → `ownerOf` → `positions` verification. Permanent escrow maps to `LOCKED_VERIFIED_ONCHAIN` with **null expiry**. Unsupported lockers stay Unknown. **NO DEPLOY.**

---

## Design

### Generic extension point

```text
lib/hansome-score/lp/
  registry.ts              # LOCKER_REGISTRY + expiryPolicy + classifyOwnerLockState
  lockers/
    types.ts               # LockerAdapter, VerifiedLockerPosition, toPositionInfo
    index.ts               # V3_LOCKER_ADAPTERS + discoverV3LockerPositions
    pons.ts                # PonsLaunchLocker adapter (2nd after Titan)
  adapters/v3.ts           # pool stubs → merge verified locker hits
  titan.ts + detect.ts     # Titan remains on v4 PositionManager path (unchanged formulas)
```

**Contract for adapters**

1. Token-scoped discovery only — never invent lock from pool inventory alone.
2. Emit `VerifiedLockerPosition` only after on-chain ownership revalidation.
3. Failures / empty → leave synthetic stubs → Unknown / incomplete coverage.
4. Registry `expiryPolicy` drives classification without changing Score formulas.

Titan stays first in `LOCKER_REGISTRY` and continues via `detect.ts` + `titan.ts` (v4 NPM). It is **not** duplicated into `V3_LOCKER_ADAPTERS` — that list is for v3 NPM token-scoped adapters.

### Registry entry

| Order | id | Name | Address | expiryPolicy |
|------:|----|------|---------|--------------|
| 1 | `titan_v2` | TitanLockerManagerV2 | `0x26b0654A…` | `timed` |
| 2 | `pons_launch` | PonsLaunchLocker | `0x736D76699C26D0d966744cAe304C000d471f7F35` | `permanent_null` |

### Permanent / null-expiry policy (Pons)

PonsLaunchLocker ABI has **no** unlock / withdraw-LP path (fee collection only — permanent escrow).

| Policy | Behavior |
|--------|----------|
| `permanent_null` | Owner is registered locker → `LOCKED_VERIFIED_ONCHAIN`, `unlockTimestamp = null` |
| Do **not** | Invent a fake expiry timestamp |
| Do **not** | Map to `LOCK_DETECTED_EXPIRY_UNKNOWN` (that means “timed lock, expiry unread”) |
| Titan `timed` | Unchanged — null unlock still → `LOCK_DETECTED_EXPIRY_UNKNOWN` |

---

## Flow (Pons + V3)

```text
Scan token
  │
  ├─ discoverV3Liquidity
  │     factory.getPool × quotes × fees → materiality
  │     material → synthetic stub v3-pool:{pool}:{fee} (Unknown)
  │     │
  │     └─ discoverV3LockerPositions → ponsLaunchLockerAdapter
  │           getLaunchedToken(token)
  │             ├─ !exists / positionId=0 → []
  │             ├─ positionManager ≠ RH v3 NPM → []
  │             ├─ ownerOf(positionId) ≠ PonsLaunchLocker → []  (no claim)
  │             ├─ positions(positionId) token mismatch → []
  │             └─ verified → real NFT id + liquidity/ticks/fee + pool
  │     │
  │     mergeV3LockerPositions: replace stub for matching pool
  │     lockAnalysisComplete = no unresolved material/inventory_unknown
  │
  └─ multi-version orchestrator (unchanged formulas)
        real NFT id (not v3-pool:) participates in lock distribution filter
```

**Honesty gates**

- Wrong `ownerOf` → stub remains → Unknown
- Non-Pons token (`exists=false`) → stub / no hit → Unknown
- Pool inventory alone never upgrades to Locked
- Unsupported contract owners still `UNSUPPORTED_LOCKER`

---

## Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/constants.ts` | `PONS_LAUNCH_LOCKER`, `ponsLaunchLockerAbi`, `uniswapV3NpmAbi` |
| `lib/hansome-score/lp/registry.ts` | `pons_launch` + `LockerExpiryPolicy` |
| `lib/hansome-score/lp/lockers/types.ts` | **new** adapter interface |
| `lib/hansome-score/lp/lockers/pons.ts` | **new** Pons adapter |
| `lib/hansome-score/lp/lockers/index.ts` | **new** v3 adapter runner |
| `lib/hansome-score/lp/adapters/v3.ts` | locker merge + lockAnalysisComplete |
| `lib/hansome-score/lp/adapters/index.ts` | export `mergeV3LockerPositions` |
| `lib/hansome-score/lp/deployments.ts` | public locker support note |
| `lib/hansome-score/lp/detect.ts` | evidenceLevel for `permanent_null` |
| `lib/hansome-score/__tests__/pons-locker-adapter.test.ts` | **new** |
| `lib/hansome-score/__tests__/v3-pool-materiality-adapter.test.ts` | FOX fixture returns Pons `exists=false` |
| `reports/HANSOME_PONS_LOCKER_ADAPTER.md` | this report |

---

## Tests

| Suite | Result |
|-------|--------|
| `pons-locker-adapter.test.ts` | Pass — happy path #419712, wrong owner, non-Pons, foreign NPM, registry order, permanent policy, merge, presentation |
| `v3-pool-materiality-adapter.test.ts` | Pass — FOX dust/material stubs unchanged |
| `lp-presentation.test.ts` / `lp-multi-version` / `lp-mixed` / `lp-known-first` | Pass |
| Full `lib/hansome-score/__tests__/` | **26 files / 253 tests passed** |
| `npm run typecheck` | **Pass** |

Coverage exercised:

1. Pons path: `getLaunchedToken` → `ownerOf` → `positions` → real NFT replaces stub  
2. Wrong owner → do not claim locked  
3. Non-Pons tokens unaffected  
4. Titan timed classification unchanged  
5. FOX materiality stubs / Unknown preserved  
6. Unsupported locker remains `UNSUPPORTED_LOCKER`  
7. LP presentation / aggregate (Pons complete → LOCKED; unresolved stub → UNKNOWN)

---

## Non-goals / constraints honored

- Scoring formulas, Burn semantics, risk thresholds — **unchanged**
- No FOX-specific hardcodes
- No inventing lock from pool inventory alone
- Unknown / Partial honesty preserved when evidence incomplete
- **NO DEPLOY** (not approved in the request)

---

## PASS / REVISE

| Item | Status |
|------|--------|
| Generic locker adapter framework | **PASS** |
| Registry: Pons second after Titan | **PASS** |
| getLaunchedToken → ownerOf → positions | **PASS** |
| Replace `v3-pool:` stub with real NFT | **PASS** |
| Permanent null-expiry policy documented | **PASS** |
| Titan / FOX / HANSOME regression tests | **PASS** |
| Typecheck | **PASS** |
| Deploy | **NOT DONE** (explicitly out of scope) |

**Overall: PASS**
