# HANSOME — Phase 11F/G/H — Hook Intelligence Engine

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Scope** | Combined Candidate: Valuer + Foreign LP Separator + Hook Lock Classifier |
| **Score formulas** | **Unchanged** |
| **Titan lock semantics** | **Not merged** |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Candidate** | `dpl_3rijeWsHEKxNV546Ku2MqFLPq1wS` (not promoted) |
| **Verdict** | **PARTIAL_PASS_NOT_DEPLOYED** |

Child reports:

- `reports/HANSOME_PHASE11F_HOOK_POSITION_VALUER.md`
- `reports/HANSOME_PHASE11G_FOREIGN_LP_SEPARATOR.md`
- `reports/HANSOME_PHASE11H_HOOK_LOCK_CLASSIFIER.md`

Artifacts:

- `reports/data/phase11f_gme_valuation.json`
- `reports/data/phase11f_okc_valuation.json`
- `reports/data/phase11g_foreign_lp_summary.json`
- `reports/data/phase11h_hook_lock_classification.json`
- `reports/data/phase11fgh_candidate_summary.json`
- `reports/data/phase11fgh_candidate_deploy.txt`

---

## 1. Combined implementation summary

Shipped three **separate** modules on top of Phase 11E Hook Position Index:

| Phase | Module | Path |
|-------|--------|------|
| 11F | Hook Position Valuer | `lib/hansome-score/lp/hook-position-valuer/` |
| 11G | Foreign LP Separator | `lib/hansome-score/lp/hook-foreign-lp/` |
| 11H | Hook Lock Classifier | `lib/hansome-score/lp/hook-lock-classifier/` |
| Orchestrator | Shared resolve (keeps outputs separate) | `lib/hansome-score/lp/hook-intelligence/resolve.ts` |
| Registry | Allowlisted Doppler/Airlock addresses | `lib/hansome-score/lp/hook-doppler-registry.ts` |

Wiring: `lp/adapters/v4.ts` (Class B only) → `LpIntelligence` public summaries → Scan UI compact Hook Native block (EN + zh-TW).

---

## 2. Module boundaries

```
11E Index records
  → 11F valueHookPositions (StateView L + amountsForLiquidity + optional USD)
  → 11G separateForeignLp (owner classification + completeness)
  → 11H readHookProtocolSnapshot + classifyHookPrincipalLock
```

Separate output objects: `hookPositionValuation`, `hookForeignLpSeparation`, `hookLockClassification`.  
No collapse into Titan `LOCKED_VERIFIED` or Score lock %.

---

## 3. Valuation schema (11F)

Per-position: `liquidity`, `amount0/1` raw+normalized, optional USD, `valuationComplete` (amounts), `stateViewValidated`.

Aggregate: hook-owned amounts/USD, foreign buckets, `hookValuationComplete`, `priceDataComplete`, `valuedAtBlock`, `stale`.

---

## 4. Foreign LP separation schema (11G)

Buckets: `hookOwned` / `foreignPosm` / `foreignOther`.  
`hookShareOfReconstructedPool` only if `poolReconstructionComplete`.

---

## 5. Hook lock classification schema (11H)

`HookPrincipalLockState` enum + evidence + `lockAmountComplete` + `poolShareAvailable` (no generic pool lock %).

---

## 6. GME live result

| Field | Value |
|-------|--------|
| Token | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` |
| ownershipClass | `hook_native` |
| Index | `SUCCESS_COMPLETE`, **8** hook-owned, salts **0…7** |
| Valuation | amounts complete; Σ amount0 ≈ `3.30e21`, Σ amount1 ≈ `4.92e27` |
| USD | Incomplete in driver (prices unavailable) — amounts retained |
| Foreign discovery | **false** → no pool share |
| Lock state | **`HOOK_PRINCIPAL_LOCKED_ONCHAIN`** |
| Protocol | Locked + NoOpMigrator + hook PosM bal 0 |
| Generic lock% / Score | **None / unchanged** |

---

## 7. OKC live result

| Field | Value |
|-------|--------|
| Token | `0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3` |
| ownershipClass | `hook_native` |
| Index | incomplete (`create_tx_unknown` path) |
| Lock state | **`UNKNOWN_INCOMPLETE`** |
| Inventory lock | **Not used** |

---

## 8. HANSOME regression

| Check | Result |
|-------|--------|
| ownershipClass | `posm_nft` |
| Hook intelligence primary | **Skipped** (`class_a_posm_nft`) |
| Titan / PosM / Score | Unchanged |

---

## 9. Completeness behavior

- Partial index → incomplete valuation → `UNKNOWN_INCOMPLETE` lock
- Hook lock may complete while foreign discovery / pool share remain incomplete
- Never publish partial as complete

---

## 10. Test results

| Suite | Result |
|-------|--------|
| `hook-position-valuer-phase11f.test.ts` | **PASS** |
| `hook-foreign-lp-phase11g.test.ts` | **PASS** |
| `hook-lock-classifier-phase11h.test.ts` | **PASS** |
| Phase 11E index | **PASS** |
| Phase 11A ownership | **PASS** |
| Phase 10 Titan / V3 / Pons / Score / Smart LP | **PASS** |
| `tsc --noEmit` | **PASS** |
| `next build` | **PASS** |

---

## 11. Performance

- Reuses 11E cached keys (no full ML replay every valuation)
- Bounded concurrency (4) for StateView position reads
- Shared protocol snapshot across 11H
- Non-blocking on Scan path; Class A skip
- Deployment-scoped index KV + generation fencing preserved from 11E

---

## 12. Security / honesty checks

1. No PoolManager ERC-20 for ownership/TVL/lock%
2. `getLiquidity` not used as total Hook L
3. Per-position live L only
4. Foreign LP separated
5. Hook Locked ≠ Titan Locked
6–7. Fee beneficiaries / collectFees ≠ principal
8–9. Missing create tx / partial index propagate
10. Reconstruction alone ≠ lock (11C predicates required)
11. Lock may complete without pool %
12. Score / aggregate lock formulas untouched

---

## 13. Candidate deployment

```
npx vercel deploy --prod --skip-domain --yes
```

| Field | Value |
|-------|--------|
| Candidate ID | `dpl_3rijeWsHEKxNV546Ku2MqFLPq1wS` |
| URL | https://hansomealpacas-h5h69t3gu-the-67.vercel.app |
| Promoted www / apex / game | **No** |

Details: `reports/data/phase11fgh_candidate_deploy.txt`

---

## 14. Production tip confirmation

| Alias tip | Value |
|-----------|--------|
| Expected Production | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Promoted? | **No** |

---

## 15. Final verdict

**PARTIAL_PASS_NOT_DEPLOYED**

GME Hook positions valued (8) and classified `HOOK_PRINCIPAL_LOCKED_ONCHAIN` under live 11C predicates; foreign discovery remains non-exhaustive (no pool lock %). OKC safely `UNKNOWN_INCOMPLETE`. HANSOME / Titan / Score / Production aliases unchanged.
