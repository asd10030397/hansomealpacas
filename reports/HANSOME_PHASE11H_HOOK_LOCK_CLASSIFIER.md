# HANSOME — Phase 11H — Hook Lock Classifier

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Scope** | Distinct Hook principal lock enum (predicates A–H) |
| **Titan / Score** | **Not merged / unchanged** |
| **Verdict** | Covered by parent **PARTIAL_PASS_NOT_DEPLOYED** |

---

## 1. Enum

```
HOOK_PRINCIPAL_LOCKED_ONCHAIN
HOOK_TIMED_LOCK
HOOK_PERMANENT_LOCK
HOOK_UNLOCKABLE
HOOK_MIGRATION_PENDING
HOOK_EXITED
HOOK_GRADUATED_INCOMPLETE
UNKNOWN_INCOMPLETE
```

Does **not** map to Titan `LOCKED_VERIFIED` / generic Locked / lock%.

---

## 2. Predicate A (live GME)

All required:

- `ownershipClass == hook_native`
- allowlisted `DopplerHookInitializer`
- `status == Locked`
- allowlisted `NoOpMigrator`
- hook PosM NFT balance == 0
- `hookDiscoveryComplete` + `hookValuationComplete`
- material hook-owned principal proven
- no principal exit while Locked

**GME result:** `HOOK_PRINCIPAL_LOCKED_ONCHAIN`  
**OKC result:** `UNKNOWN_INCOMPLETE` (index/valuation incomplete)

---

## 3. Lock amounts

Principal = valued Hook-owned only. Foreign / PM inventory / fees excluded.  
`lockAmountComplete` may be true while `poolShareAvailable` is false.
