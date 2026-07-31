# HANSOME Scan — Supply & Burn Intelligence P0+P1 Validation

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Scope** | P0 (dead inventory) + P1 (burn mechanisms) only |
| **Verdict** | **PASS** |
| **Deploy / commit** | Not done (per request) |
| **P2/P3 history** | Not implemented |

---

## Verdict: PASS

P0+P1 meet the refined product spec:

- Four primary answers: Known Burned, Burn Function, Automatic Burn, Admin Burn
- Unknown never silently becomes No
- Dead-address inventory ≠ `totalSupply` reduction (reduction stays Unknown in P0/P1)
- Voluntary burn does not raise Structural / Overall Score
- Privileged/admin arbitrary-holder burn maps to Contract Risk (−12, blacklist band)
- No 24H/7D/all-time burn windows

---

## Archetype results

| # | Archetype | Evidence | Burn Function | Automatic | Admin | Known Burned | Result |
|---|-----------|----------|---------------|-----------|-------|--------------|--------|
| 1 | No burn | Live **HANSOME** + unit fixture | No | No | No | 0 · 0% | **PASS** |
| 2 | Dead-address only | Live **PONS** (~21.7%), **TYGR** (~7.0%), **LEMON.FUN** (~1.0%), **CASHCAT** (~1.0%) + unit fixture | No | No | No | > 0 | **PASS** |
| 3 | Holder `burn()` | Unit fixture (public `burn(uint256)`) | Yes | No | No | n/a | **PASS** |
| 4 | `burnFrom()` | Unit fixture (ERC20Burnable / `burnFrom`) | Yes | No | No | n/a | **PASS** |
| 5 | Automatic burn/tax | Unit fixture (`_update` + `burnFee` + `_burn`) | No* | Yes | No | n/a | **PASS** |
| 6 | Privileged/admin burn | Unit fixture (`onlyOwner burn(address,uint256)`) + score test | No | No | Yes → Contract Risk −12 | n/a | **PASS** |
| 7 | Unverified / incomplete | Unit fixture (unverified) + live **ASTEROID** (verified flag but no ABI/source → incomplete) | Unknown | Unknown | Unknown | spot OK | **PASS** |

\* Automatic-burn fixture may still show Burn Function No when there is no public `burn`/`burnFrom` — capability rows are independent of inventory.

### Live RH samples (light probe, 2026-07-27)

| Token | Known Burned % | Burn Function | Automatic | Admin | Notes |
|-------|----------------|---------------|-----------|-------|-------|
| HANSOME | 0% | No | No | No | Clean no-burn baseline |
| ASTEROID | ~0% (dust at dead) | Unknown | Unknown | Unknown | Verified metadata without usable ABI/source → honest Unknown |
| LEMON.FUN | ~1.00% | No | No | No | Dead inventory only |
| PONS | ~21.75% | No | No | No | Dead inventory; Burn Function No (capability ≠ burned) |
| CASHCAT | ~0.98% | No | No | No | Dead inventory only |
| TYGR | ~7.04% | No | No | No | Dead inventory only |

No live RH sample in the regression set currently exposes holder `burn()` / `burnFrom()` / auto-tax / admin-burn; those archetypes are covered by unit fixtures.

---

## What is reliable vs Unknown

| Capability | Reliable now | Unknown when |
|------------|--------------|--------------|
| Total Supply | RPC (+ Blockscout fallback) | RPC/meta fail |
| Known Burned (allowlisted dead balances) | RPC `balanceOf(0x0)` + `balanceOf(0xdead)` | All balanceOf calls fail |
| Burned % | Both supply + known burned known | Either missing |
| Remaining* | `totalSupply − knownDead` when both known; UI shows only if known burned > 0 | Inventory incomplete |
| Supply permanently reduced | **Always Unknown in P0/P1** | Needs P3 events/baseline |
| Burn Function (`burn`/`burnFrom`) | Verified ABI/source | Unverified / missing ABI+source / unclear modifiers |
| Automatic Burn | Clear transfer/tax `_burn` or dead-fee path in source | Incomplete analysis, ambiguous reflect/rebase |
| Admin Burn | `onlyOwner`/`onlyRole` burn of arbitrary holders | Incomplete; GoPlus alone never sets Yes |

**Forbidden (enforced):** inaccessible/idle wallets, LP lockers, treasury, vesting, ordinary contracts — not counted as burned.

---

## Contract Risk wiring

| Signal | Path | Score effect |
|--------|------|--------------|
| Holder `burn()` / dead sends / burned % | Display only | **None** (no Structural/Overall boost) |
| Admin / privileged burn (arbitrary holders) | `ContractRiskResult.privilegedBurn` + finding `privileged_burn` | **−12** Contract Risk (blacklist band) |
| GoPlus `owner_change_balance` | Labeled info finding only | **Never** sole Yes evidence |

`scanToken` runs `analyzeSupplyBurnIntelligence` once, then passes `privilegedBurn` into `analyzeContractRisk` (no second ABI/source fetch; detector not re-run when tri-state is provided).

---

## UI (refined)

Primary pane matches:

```
🔥 SUPPLY & BURN
Total Supply: …
Known Burned: … · …%
Remaining*: …          # only when known burned > 0 and method reliable
No known token burn detected.   # when known burned = 0
Burn Function: Yes / No / Unknown
Automatic Burn: Yes / No / Unknown
Admin Burn: ⚠ Yes / No / Unknown
```

Advanced Details: dead vs supply-reduced copy, `burn()` / `burnFrom()` split, allowlisted balances, findings, completeness notes, scoring disclaimer.

---

## Unit tests

`npm run test:scoring -- lib/hansome-score/__tests__/supply-burn.test.ts` → **14/14 passed**

Also covered: voluntary burn does not change Overall when Structural unchanged; privileged burn lowers Structural; non-allowlisted wallets excluded from Known Burned.

---

## Blind spots / REVISE-later (not blocking PASS)

1. **P3** — cannot yet prove permanent `totalSupply` reduction; always Unknown.
2. **P2** — no 24H/7D/all-time dead inflows.
3. **Live mechanism diversity** — RH regression tokens are mostly dead-address inventory; burn()/auto/admin rely on fixtures until more verified examples appear.
4. **Verified-without-ABI** (e.g. ASTEROID) — correctly Unknown, but UX may look odd next to a green “verified” badge elsewhere.
5. **Automatic burn heuristics** — source pattern based; unusual fee routers may stay Unknown (preferred over false No).
6. **`burnFrom` admin bypass** — standard allowance `burnFrom` is not Admin Burn; exotic dual-path contracts may need tighter modifier parsing later.
7. **Dust dead balances** — Remaining* shows whenever known burned > 0 (including dust); still mathematically reliable.

---

## Explicit non-goals confirmed

- [x] No P2/P3 burn history
- [x] No voluntary-burn Structural/Overall boost
- [x] No `/explore` / Just Launched / Week 2B expansion
- [x] No production deploy
- [x] No git commit

---

## Files changed (implementation)

| Path | Role |
|------|------|
| `lib/hansome-score/supply-burn/*` | Dedicated P0+P1 module |
| `lib/hansome-score/types.ts` | `supplyBurn` on overview; `privilegedBurn` on Contract Risk |
| `lib/hansome-score/contract-risk.ts` | Privileged burn + GoPlus supplement labeling |
| `lib/hansome-score/score.ts` | −12 `privileged_burn` deduction |
| `lib/hansome-score/scan.ts` | Minimal wire-in |
| `lib/hansome-score/index.ts` | Exports |
| `components/scan/ScanClient.tsx` | Supply & Burn UI |
| `content/i18n/{en,zh,types}.ts` | Copy |
| `lib/hansome-score/__tests__/supply-burn.test.ts` | Archetype unit tests |
| `lib/hansome-score/__tests__/{score,overall,week2a}.test.ts` | Fixture field updates |
| `lib/hansome-score/_tmp-latency-audit.ts` | Stub `supplyBurn` for concurrent audit compile |
| `reports/HANSOME_SUPPLY_AND_BURN_P0P1_VALIDATION.md` | This report |
