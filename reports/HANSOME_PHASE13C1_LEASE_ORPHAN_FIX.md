# HANSOME Phase 13C.1 — Lease Orphan / Zombie Coalesce Fix

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13C.1 — Lease orphan + `lp_read_rearm` honesty |
| **Mode** | Runtime reliability ONLY (no Known-First, no promote, no full 13C soak) |
| **Worktree** | `C:\hansomealpacas-phase13a` on `phase-13a-deep-runtime-recovery` |
| **Baseline DX** | `reports/HANSOME_PHASE13C_BEER_INVALID_STATE_DX.md` |
| **New Candidate** | `dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed` |
| **Candidate URL** | `https://hansomealpacas-bgzgnmjnc-the-67.vercel.app` |
| **Candidate scope** | `candidate:dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed` (`isProductionAlias=false`) |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**; www → Ready) |
| **Promoted www / apex / game?** | **NO** |
| **Final verdict** | **READY_FOR_PHASE13C_SOAK** |

Companion artifacts:

- `reports/data/phase13c1_deploy_out.txt`
- `reports/data/phase13c1_beer_runtime_gate.json`
- `reports/data/phase13c1_beer_runtime_gate_console.txt`
- `scripts/phase13c1-beer-runtime-gate.mjs`
- `lib/hansome-score/__tests__/phase13c1-beer-invalid-state.test.ts` (10/10 PASS)

---

## 1. What was fixed (items 1–8)

| # | Fix | Status |
|---|-----|--------|
| 1 | Treat `analyzing` + no valid durable lease + no `retryScheduled` as **orphan**, even if process-local `deepInflight` is true | **DONE** |
| 2 | Evict stale/zombie local coalesce (`inflight` / `backgroundRefresh`) on orphan recovery | **DONE** |
| 3 | `lp_read_rearm` sets `retryScheduled=true` (schedulable retry) or honest `lp_read_terminal` (no sticky analyzing) | **DONE** |
| 4 | Destructive LP clears only inside open Phase 13C force recovery txn (`armForceLpClearedAggregate`) | **DONE** |
| 5 | Diagnostics: `deepInflightLocal` vs `deepLeaseOwned` / `deepLeaseState` | **DONE** |
| 6 | BEER invalid-state regression tests | **DONE** (10/10) |
| 7 | Fresh isolated Candidate deploy | **DONE** (`dpl_2LG…`) |
| 8 | Targeted BEER runtime gate only (not full 13C soak) | **DONE** (PASS) |

---

## 2. Code changes (summary)

| File | Change |
|------|--------|
| `lib/hansome-score/deep-runtime.ts` | `isOrphanAnalyzing` ignores process-local inflight; diagnostics add `deepInflightLocal` / `deepLeaseOwned` |
| `lib/hansome-score/types.ts` | Invariant + diagnostic fields updated for 13C.1 |
| `lib/hansome-score/scan-cache.ts` | `evictLocalDeepCoalesce`; orphan recovery always durable-owned; `lp_read_rearm`/`lp_read_terminal`; clear guards on publish-fail / watchdog / force-recover settle |
| `lib/hansome-score/deep-settlement.ts` | Cancel reasons `orphan_zombie_coalesce` / `zombie_coalesce` |
| `lib/hansome-score/index.ts` | Export `recoverOrphanAnalyzingIfNeeded`, `evictLocalDeepCoalesce` |

**Not changed:** Titan / Pons / Hook / Score / UI product semantics; Known-First; Production tip; full soak matrix.

---

## 3. Unit tests

| Suite | Result |
|-------|--------|
| `phase13c1-beer-invalid-state.test.ts` | **10/10 PASS** |
| `phase13a-deep-runtime-recovery.test.ts` | **12/12 PASS** |
| `phase13c-force-lp-recovery.test.ts` | **19/19 PASS** |
| `tsc --noEmit` | **PASS** |

Key regressions covered:

1. BEER mid-state (`lp_read_rearm` + lease=none + retryScheduled=false) is orphan even with `deepInflight=true`
2. Orphan recovery stamps `retryScheduled=true` (or terminalizes when exhausted)
3. Diagnostics distinguish local coalesce from durable lease ownership
4. Cleared-shell publish still rejected; force txn arm is the only intentional clear path tested

---

## 4. Candidate deploy + isolation

| Check | Result |
|-------|--------|
| Deploy | `npx vercel deploy --prod --skip-domain --yes` |
| ID | `dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed` |
| Health scope | `candidate:dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed` |
| `isProductionAlias` | `false` |
| Production tip (www) | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` Ready — **unchanged** |
| Note | `--prod --skip-domain` may move project alias `*-the-67.vercel.app` (known 12C debt); custom domains untouched |

---

## 5. BEER runtime gate (targeted)

Script: `scripts/phase13c1-beer-runtime-gate.mjs`  
Base: `https://hansomealpacas-bgzgnmjnc-the-67.vercel.app`  
Scope expect: `candidate:dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed`

| Gate criterion | Result |
|----------------|--------|
| Invalid state hits (`analyzing` + inflightLocal + lease=none + !retryScheduled) | **0** |
| Sticky cleared shell unrecovered without metadata | **false** |
| Scope isolation | **OK** |
| Force path honesty | Early after-force: `retryScheduled=true` while lease still `none` (not orphan-masked); then `lease=valid` + heartbeats |
| Cleared shell invented mid-flight | **No** (`cleared=false` throughout after-force samples) |
| Gate verdict | **PASS** |

Cold status-only polls returned empty snapshot (status does not cold-start Fast Scan on virgin candidate KV). Force + after-force path is the live proof for the DX invalid-state class.

**Out of scope for this gate (still known from 13C):** BEER Locked / tokenId 436637 product certification — rediscovery timeout / `parallel_hard_bound` remains a soak product risk, not a lease-orphan bug.

---

## 6. Verdict

**READY_FOR_PHASE13C_SOAK**

Lease-orphan / zombie-coalesce / `lp_read_rearm` honesty fixes are on Candidate `dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed`. Targeted BEER runtime gate PASS (0 invalid-state hits). Production tip unchanged. Full Phase 13C soak matrix and Known-First bootstrap were **not** run.

### Unblock notes for soak resume

1. Use Candidate `dpl_2LG…` (or successor from this tip).
2. Run `scripts/phase13c-force-lp-soak.mjs` — expect no `analyzing + inflight + lease=null + !retryScheduled` class.
3. Product Locked gates may still fail until rediscovery budgets allow a durable BEER Locked publish (separate from 13C.1).

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **READY_FOR_PHASE13C_SOAK** |
| **Report** | `reports/HANSOME_PHASE13C1_LEASE_ORPHAN_FIX.md` |
| **Candidate** | `dpl_2LGPrEKxuYu5Cf72HgarNnKP3qed` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (confirmed unchanged) |
| **BEER gate** | PASS — 0 invalid-state hits; no sticky cleared-without-metadata; lease→valid after force |
| **Items 1–8** | All **DONE** |
| **Promoted?** | **NO** |
