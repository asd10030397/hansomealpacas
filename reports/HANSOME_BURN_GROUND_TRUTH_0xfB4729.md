# HANSOME Scan — Burn Ground Truth: ROBIN (`0xfB4729…`)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Token** | `0xfB4729659eeF22Bfc1c2B680F6F873f8147aaaab` |
| **Name / Symbol** | Robin / ROBIN |
| **Chain** | Robinhood Chain `4663` |
| **RPC** | `https://rpc.mainnet.chain.robinhood.com` |
| **Scope** | On-chain ground truth for Supply & Burn (Known Burned / dead inventory) |
| **Verdict** | **PASS** |
| **Code changed** | **No** (investigation + report only) |

---

## Verdict: PASS

On-chain RPC matches HANSOME Scan’s reported Supply & Burn numbers for this token (within UI integer rounding). Known burned is **solely** the allowlisted `0xdead` balance — classic **dead-address inventory**, not a proven `totalSupply` reduction. No LP, locker, treasury, vesting, or ordinary contract is counted.

---

## 1. `totalSupply` + decimals

| Field | On-chain | Scan UI |
|-------|----------|---------|
| `decimals()` | **6** | (used for formatting) |
| `totalSupply()` raw | `1000000000000000` | — |
| `totalSupply` human | **1,000,000,000** | **1,000,000,000** |

**Confirmed:** still exactly **1,000,000,000** ROBIN (human units).

---

## 2. Allowlisted burn addresses (code citation)

HANSOME recognizes **only** these addresses as burned/dead inventory:

```57:60:lib/hansome-score/constants.ts
export const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);
```

Consumed by P0 dead inventory:

```14:26:lib/hansome-score/supply-burn/dead-inventory.ts
/** Sorted, de-duplicated allowlisted dead/burn addresses — never heuristic “stuck” wallets. */
export function allowlistedBurnAddresses(): Address[] {
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const raw of BURN_ADDRESSES) {
    const addr = getAddress(raw) as Address;
    // ...
  }
  return out.sort((a, b) => a.localeCompare(b));
}
```

`fetchDeadAddressInventory` sums `balanceOf` for that allowlist only — no holder heuristics, no unlabeled contracts.

---

## 3. Address contribution table

| Address | Label (code) | `balanceOf` (raw) | Human (decimals=6) | % of totalSupply | Why classified as recognized burn | Bytecode |
|---------|--------------|-------------------|--------------------|------------------|-----------------------------------|----------|
| `0x0000000000000000000000000000000000000000` | `burn_dead` via `BURN_ADDRESSES` | `0` | `0` | `0%` | Allowlisted zero address in `constants.ts` → `dead-inventory.ts` | Empty (`0x`) |
| `0x000000000000000000000000000000000000dEaD` | `burn_dead` via `BURN_ADDRESSES` | `93275392644630` | **93,275,392.64463** | **~9.3275%** | Allowlisted `0xdead` in `constants.ts` → `dead-inventory.ts` | Empty (`0x`) |

| Aggregate | Value |
|-----------|-------|
| Sum allowlisted balances (raw) | `93275392644630` |
| Known Burned (exact human) | **93,275,392.64463** |
| Known Burned % | **~9.3275%** (~9.3% at 1 decimal) |
| Supply Excluding Known Burns (exact) | **906,724,607.35537** |

### Scan UI vs exact RPC

UI uses `toLocaleString(..., { maximumFractionDigits: 0 })` in `components/scan/ScanClient.tsx` (`formatSupplyAmount`):

| Metric | Exact RPC | Scan UI (rounded) | Match |
|--------|-----------|-------------------|-------|
| Total Supply | 1,000,000,000 | 1,000,000,000 | Exact |
| Known Burned | 93,275,392.64463 | **93,275,393** | Rounding only |
| Known Burned % | 9.3275…% | **~9.3%** (`toFixed(1)`) | Display |
| Supply Excluding Known Burns | 906,724,607.35537 | **906,724,607** | Rounding only |
| Dead-address inventory line | 93,275,392.64463 at `0xdead` | **93,275,393** | Rounding only |

**No material mismatch** — UI integers are rounded display of the same on-chain balances.

---

## 4. Forbidden categories not counted

| Category | Counted? | Evidence |
|----------|----------|----------|
| LP / PoolManager | **No** | Not in `BURN_ADDRESSES`; inventory is allowlist-only |
| Locker (e.g. TitanLocker) | **No** | Same |
| Treasury / vesting | **No** | Same |
| Ordinary contracts | **No** | Same |
| Inactive / “inaccessible-looking” wallets | **No** | Explicitly forbidden by `dead-inventory.ts` comment + design; only zero + `0xdead` |

Both allowlisted holders have **no contract bytecode** — null/dead sinks, not protocol contracts.

---

## 5. Dead-address inventory vs proven supply reduction

| Question | Answer |
|----------|--------|
| Is Known Burned a **dead-address inventory**? | **Yes** — tokens sit at `0xdead`; `totalSupply` still includes them |
| Is this a proven **`totalSupply` reduction**? | **No** — `totalSupply` remains 1e9; reduction would require burn-method evidence (P3) |
| Scan effective remaining method | `total_minus_known_dead` (`analyze.ts`) — display math only |

Code separation (dead inventory ≠ supply-reducing burn):

- `analyze.ts`: notes that effective remaining is dead-inventory view; supply reduction needs P3.
- `burn-history.ts`: sends to `0xdead` are dead-inventory only — never counted as proven supply reduction.

Mechanism flags reported by Scan (Burn Function / Automatic / Admin = **No**) are ABI/source capability signals, orthogonal to dead balances; this ground-truth task validates inventory math, not mechanism detection.

---

## 6. Method

1. Read `BURN_ADDRESSES` + `fetchDeadAddressInventory` path.
2. viem `readContract` on chain 4663: `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf(0x0)`, `balanceOf(0xdead)`.
3. `getBytecode` on both burn addresses (empty).
4. Sum allowlisted balances; compare to Scan UI after `formatSupplyAmount` rounding.

---

## 7. Return summary (for parent)

| Item | Result |
|------|--------|
| **Verdict** | **PASS** |
| **totalSupply** | Confirmed **1,000,000,000** (decimals **6**) |
| **Contributors** | Only `0xdead` = **93,275,392.64463** (~9.33%); `0x0` = 0 |
| **Type** | **Dead-address inventory** (not proven supply reduction) |
| **UI mismatch** | None material — integer rounding only |
| **Forbidden holders** | None counted |
| **Code changed** | **No** |
