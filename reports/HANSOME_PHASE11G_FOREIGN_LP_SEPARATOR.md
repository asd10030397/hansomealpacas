# HANSOME — Phase 11G — Foreign LP Separator

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Scope** | Separate Hook-owned vs foreign PosM / foreign other in same PoolKey |
| **Verdict** | Covered by parent **PARTIAL_PASS_NOT_DEPLOYED** |

---

## 1. Classification

Owner-only:

- `owner == DopplerHookInitializer` → `hook_owned`
- `owner == PositionManager` → `foreign_posm`
- else → `foreign_other`

Never classify from token balance, PM inventory, fee beneficiary, or Airlock owner.

Same ticks/salt under different owner = distinct positions.

---

## 2. Completeness

| Flag | Meaning |
|------|---------|
| `hookOwnedAmountsComplete` | hook discovery + valuation complete |
| `poolReconstructionComplete` | hook + foreign discovery + both valuations |
| `hookShareOfReconstructedPool` | only when pool reconstruction complete |

GME: Hook-owned value may show; pool share **unavailable** (`foreignDiscoveryComplete=false`).

---

## 3. Output

`lpIntelligence.hookForeignLpSeparation` public summary — no raw RPC.
