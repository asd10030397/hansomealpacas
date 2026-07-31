# HANSOME — Phase 11E — Hook Position Index

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Scope** | Discovery / indexing / replay / cache / completeness only |
| **USD / token amounts / lock% / LOCKED_VERIFIED / Score** | **Unchanged / not implemented** |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Candidate** | `dpl_8fPcMQ8wmpDUqShVWppbmijCMEMR` (not promoted) |
| **Verdict** | **PARTIAL_PASS_NOT_DEPLOYED** |

Canonical prior art:

- `reports/HANSOME_PHASE11D_HOOK_POSITION_RECONSTRUCTION_RESEARCH.md`
- `reports/HANSOME_PHASE11C_DOPPLER_AIRLOCK_HOOK_LOCK_VERIFICATION_RESEARCH.md`
- `reports/HANSOME_V4_OWNERSHIP_CLASS_DETECTION.md`

Artifacts:

- `reports/data/phase11e_hook_position_index_summary.json`
- `reports/data/phase11e_gme_index.json`
- `reports/data/phase11e_okc_index.json`
- `reports/data/phase11e_candidate_deploy.txt`

---

## 1. Implementation summary

Shipped a research-grade **Hook Position Index** for allowlisted Doppler Hook Native pools:

| Path | Role |
|------|------|
| `lib/hansome-score/lp/hook-position-index/` | Types, strict ML decoder, bootstrap/incremental sync, reorg, KV, production resolve |
| `lib/hansome-score/lp/adapters/v4.ts` | Class B only — non-blocking index attach |
| `lib/hansome-score/lp/multi.ts` | Propagates `hookPositionIndex` summary |
| `lib/hansome-score/types.ts` | `LpIntelligence.hookPositionIndex` |
| Scan UI + i18n (EN / zh-TW) | Hook Positions count + Complete/Partial |
| Tests | `hook-position-index-phase11e.test.ts` |
| Live driver | `scripts/phase11e-hook-position-index.ts` |

**Not implemented (by design):** USD, token amounts, TVL, lock%, Hook `LOCKED_VERIFIED`, Score changes, Production alias promotion.

---

## 2. Index schema

**Cache key (isolated):** `scan:v4hook:{scope}:{chainId}:{poolId}`

```ts
HookPositionKey = { chainId, poolId, owner, tickLower, tickUpper, salt }

HookPositionRecord = Key & {
  classification: hook_owned | foreign_posm | foreign_other | unknown
  firstSeenBlock, lastSeenBlock
  lastLiquidityDelta?, netLiquidityDelta?
  source: modify_liquidity_log | create_tx_receipt | init_data | fixture
  liveLiquidity?, stateViewValidated?, active?  // validation only
}

HookPositionIndexState = {
  positions[], hookDiscoveryComplete, foreignDiscoveryComplete
  discoveryMethod, incompleteReasons[], generation, terminalState
  lastSyncedBlock, lastSyncedBlockHash, safeHeadBlock, confirmationDepth
}
```

Public Scan payload exposes **summary counts only** (full keys in report artifacts / debug).

---

## 3. State machine

```
NEW → BOOTSTRAPPING → REPLAYING → PUBLISHING
  → SUCCESS_COMPLETE   (hookDiscoveryComplete == true)
  → SUCCESS_PARTIAL    (research-OK; incomplete reasons recorded)
  → FAILED_TERMINAL    (reason + lastSuccessfulBlock)
```

Rules:

- Never publish partial as complete.
- Generation fencing on KV writes; stale generations rejected.
- Zero-Δ fee pokes do not invent ownership keys.

---

## 4. Bootstrap and incremental algorithms

**Bootstrap priority**

1. Known create tx receipt → decode PoolManager `ModifyLiquidity` (client-side topic verify)
2. Bounded tip catch-up / log replay (adaptive `eth_getLogs` chunking)
3. InitData (stub — recorded as `init_data_unavailable`)
4. Trusted fixture seed
5. Otherwise `SUCCESS_PARTIAL`

**Incremental**

`lastSyncedBlock + 1 → safeHead` with net Δ aggregation; foreign indexing opt-in (`foreign_backfill_skipped` by default).

**Completeness**

| Flag | When true |
|------|-----------|
| `hookDiscoveryComplete` | Create receipt (or complete fixture) closed mint set **and** tip catch-up reached safe head |
| `foreignDiscoveryComplete` | Exhaustive pool-scoped ML replay (not claimed this phase) |

---

## 5. Reorg strategy

- `safeHead = latest − confirmationDepth` (default 64)
- Persist `lastSyncedBlock` + `lastSyncedBlockHash` + `generation`
- On hash mismatch: roll back overlap window, drop first-seen-in-window keys, bump generation, replay forward

---

## 6. GME result

| Field | Value |
|-------|--------|
| Token | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` |
| poolId | `0x3623694d…11c2` |
| createTx | `0xf3dfb544…8c82` |
| **hookOwnedCount** | **8** |
| Salts | **0…7** |
| Owner | DopplerHookInitializer |
| StateView | Live L validated per key |
| PosM collision | Same ticks/salt under PosM → L = 0 |
| `hookDiscoveryComplete` | **true** |
| `foreignDiscoveryComplete` | **false** |
| Terminal | **SUCCESS_COMPLETE** |
| Method | `create_receipt` |
| Wall | ~7.2s · ~21 RPC calls |

Fixture assertion only — salt count 8 is **not** general protocol behavior.

---

## 7. OKC result

| Field | Value |
|-------|--------|
| Token | `0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3` |
| poolId | `0xd3073ec4…35cf` |
| ownershipClass | `hook_native` (unchanged Class B) |
| createTx | Unknown (RPC / prior research limits) |
| hookOwnedCount | 0 (this session) |
| Terminal | **SUCCESS_PARTIAL** |
| Incomplete | `create_tx_unknown`, `create_block_unknown`, `rpc`/`safe_head` related |
| Lock claim / lock% | **None** |

Partial is expected and honest under public RPC limits.

---

## 8. HANSOME regression

| Check | Result |
|-------|--------|
| ownershipClass | `posm_nft` |
| Hook index primary path | **Skipped** (`class_a_posm_nft`) |
| Titan / PosM path | Unchanged |
| Score / lock formulas | Unchanged |
| Duplicate V4 ownership rows | None |

---

## 9. Test results

| Suite | Result |
|-------|--------|
| `hook-position-index-phase11e.test.ts` | **20 passed** |
| `v4-ownership-class.test.ts` | **20 passed** (regression) |
| Topic / signed decode / FP reject / dedupe / zero-Δ | PASS |
| Owner classify / net Δ / generation fence / reorg | PASS |
| GME 8 salts + StateView mock | PASS |
| OKC no false completeness | PASS |
| HANSOME Class A skip | PASS |
| `tsc --noEmit` | **PASS** |
| `next build` | See §11 |

---

## 10. Performance results

| Path | Observation |
|------|-------------|
| GME create receipt + tip catch-up | ~7s interactive budget path |
| OKC without create | Fails fast (~0.3s) → partial |
| Adaptive getLogs | Shrink on RPC errors; bounded retries |
| Scan coupling | Per-pool lock; failures non-blocking; background-compatible |
| Cache | Keys only (not economics); deployment-scoped |

---

## 11. Candidate deployment

```
npx vercel deploy --prod --skip-domain --yes
```

| Field | Value |
|-------|--------|
| Candidate ID | `dpl_8fPcMQ8wmpDUqShVWppbmijCMEMR` |
| URL | https://hansomealpacas-qj9pgp4vr-the-67.vercel.app |
| Promoted www / apex / game | **No** |

Details: `reports/data/phase11e_candidate_deploy.txt`

---

## 12. Production tip confirmation

| Alias tip | Value |
|-----------|--------|
| Expected Production | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Promoted? | **No** |

---

## 13. Final verdict

**PARTIAL_PASS_NOT_DEPLOYED**

Index infrastructure is correct and GME fixture is complete (8 hook-owned positions, salts 0–7, StateView-validated, `SUCCESS_COMPLETE`). OKC remains **partial** solely due to public RPC / missing create-tx recovery — allowed by phase policy. No valuation, lock%, Score, or Production alias changes.
