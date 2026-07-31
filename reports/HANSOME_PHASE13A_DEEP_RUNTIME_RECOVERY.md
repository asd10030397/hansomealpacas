# HANSOME Scan — Phase 13A Deep LP Runtime Recovery & Certification Readiness

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Mode** | Runtime reliability ONLY (no Ownership / Titan / Hook / Score / UI / isolation-rule changes) |
| **Verdict** | **READY_FOR_RELEASE_RECERTIFICATION** |
| **Source tag / commit** | `v1.0.0` @ `f23c7ff2047b0ebf15cc8346f4c2f45fb18ba456` |
| **Result commit** | `1a59a08038821e13af1198112cf2956fdc310b1c` (`phase-13a-deep-runtime-recovery`) |
| **Worktree** | `C:\hansomealpacas-phase13a` (clean of unrelated WIP) |
| **Failed Candidate (incident)** | `dpl_8UJfr8NjZZksF5UnXCLZzmGxPo9a` |
| **New Candidate** | `dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| **Candidate URL** | `https://hansomealpacas-aa4xqec98-the-67.vercel.app` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |

---

## 1. Root cause

Failed Candidate soak ended as `analysisStatus=partial`, `liquidity=analyzing`, `deepInflight=false`, empty pools (`LP evidence cleared`), `deepRetryCount=2`.

**Evidence-backed mechanism:** force-LP / settle / read-reconcile paths cleared LP bodies and left `liquidity=analyzing` on a terminal-shaped `partial` after auto-retries exhausted, while `deepInflight` is process-local only and no durable worker lease existed—so status polls could not schedule more work. Interactive-stale recovery + generation-fence `stale_publish_rejected` races and `after()` `DeepScanTimeoutError` amplified sticky analyzing without an execution path.

### Hypotheses (1–10)

| # | Hypothesis | Verdict | Evidence |
|---|------------|---------|----------|
| 1 | Deep worker never scheduled | **REJECTED** | Logs: `[scan-deep] start … attempt=d_ms934uof_v4awr9o0` |
| 2 | `after()` cancelled / not persisted | **CONTRIBUTING** | `[HANSOME] deep analysis after() failed: DeepScanTimeoutError` |
| 3 | Generation fence rejected publish | **CONTRIBUTING** | `stale_publish_rejected` incoming≠auth generations |
| 4 | Deployment scope blocked continuation | **REJECTED** | Candidate health `candidate:dpl_8UJ…`; isolation PASS |
| 5 | Status written before job registration | **CONTRIBUTING** | Analyzing published without durable lease metadata |
| 6 | Retry metadata lost / exhausted incorrectly | **CONTRIBUTING** | Final `deepRetryCount=2` + still analyzing |
| 7 | RPC/stage timeout without terminal publish | **CONTRIBUTING** | `liquidity:timeout`, hard_bound, protectLp skip |
| 8 | Lease expired without recovery | **CONTRIBUTING** | No lease existed pre-13A → orphan by definition |
| 9 | Prior-generation cleared LP cache retained | **CONTRIBUTING** | Cleared evidence + `reconcilePublishedLpOnRead` → analyzing |
| 10 | GET/POST/status disagree on inflight | **CONTRIBUTING** | Inflight = in-process Sets only across isolates |

---

## 2. Incident timeline (failed Candidate `dpl_8UJfr8…`)

| UTC (approx) | Event |
|--------------|--------|
| 15:14–15:16 | HANSOME deep start `d_ms932rr1_…`; interactive-stale recovery while `inflight=true` |
| 15:16 | Re-arm / new gen `d_ms934uof_…`; prior settle `stale_publish_rejected` |
| 15:16–15:20 | Parallel hard-bound / liquidity timeout / score finalize partial |
| 15:19+ | `after()` `DeepScanTimeoutError` (270s) logged |
| 15:21 | Snapshot settles `partial` + `liquidity=analyzing` + cleared pools; `deepRetryCount=2` |
| Post-soak polls | `deepInflight=false`, no retry path → **orphan analyzing** |

Live re-read (Phase 13A investigation): still `partial` / `liquidity=analyzing` / `deepInflight=false` / cleared LP on failed tip.

---

## 3. State machine before / after

### Before (invalid)

```
analyzing ∧ ¬inflight ∧ ¬retryScheduled ∧ ¬validLease  → sticky forever
partial + liquidity=analyzing + deepRetryCount≥MAX      → needsDeepWork=false
```

### After (Phase 13A invariant)

```
analyzing ⇒ deepInflight ∨ retryScheduled ∨ validLease
else → recoverOrphanAnalyzing:
  budget open  → retry_required + re-arm + schedule
  budget spent → terminalize stages (partial / unknown) + clear lease
```

Allowed terminals: success-shaped `complete`, honest `partial` / `failed` / force-LP `unknown`, or `retry_required` with scheduled work.

---

## 4. Lease and retry design

New module: `lib/hansome-score/deep-runtime.ts`

| Field | Role |
|-------|------|
| `deepRuntime.lease` | generation, workerId, startedAt, heartbeatAt, expiresAt, attempt, deploymentScope |
| TTL | 120s; heartbeat on Deep progress |
| Registration order | allocate gen → register lease → persist analyzing → start worker |
| Orphan recovery | status / ensureDeep / after() failure |
| Exhaustion | markScanPartial no longer protects liquidity when retries/force budget gone |

Wired in `scan-cache.ts`, `/api/scan`, `/api/scan/status`.

---

## 5. Timeout behavior

| Layer | Bound | On timeout |
|-------|-------|------------|
| Stage budgets / parallel hard bound | existing Phase 7.3 | soft-fail / settle |
| Deep wall | `DEEP_SCAN_MAX_EXECUTION_MS` (270s) | settle / after() recover |
| `withDeepLpRpcTimeout` | 45s (ETH-USD + helper) | structured `deep_lp_rpc_timeout` |
| Lease | 120s without heartbeat | orphan recovery |

Timeouts must not leave analyzing without lease/retry/terminal — enforced by orphan recovery.

---

## 6. Fence behavior

- Settle/progress still generation-fenced (no Redis CAS in this phase).
- Fence rejection annotated: `fenceResult=rejected`, `lastErrorCode=stale_publish_rejected`.
- Auth snapshot wins; current gen must not remain analyzing without worker (orphan recovery).
- Redis CAS **not** introduced (not required to fix demonstrated incident once lease + terminalize exist).

---

## 7. Test results

| Suite | Result |
|-------|--------|
| `phase13a-deep-runtime-recovery.test.ts` (12 scenarios) | **PASS** |
| Required assertion: no path ends analyzing∧¬inflight∧¬retry∧¬lease | **PASS** |
| Related: 10C-5, retry-race, bounded-settlement, scan-progress, 12C isolation | **PASS** (66 tests in batch) |
| Vercel Candidate build | **PASS** |

Scenarios covered: worker launch failure, after() cancel, RPC timeout, lease expiry, fence rejection, scope isolation, stale analyzing, retry exhaustion, successful retry, partial terminal, concurrent duplicate, prod vs candidate metadata.

---

## 8. HANSOME / GME / OKC live soak (new Candidate)

| Token | Terminal? | `liquidity` | Orphan? | Notes |
|-------|-----------|-------------|---------|-------|
| **HANSOME** | **YES** (`partial`) | `done` | **NO** | Class A path terminal; score 77 |
| **GME** | **YES** (`partial`) | `partial` | **NO** | Honest partial (`lp_read_terminal` / missing_scan_meta) |
| **OKC** | **YES** (`partial`) | `done` | **NO** | Ran with `lease=valid` + inflight mid-soak; terminated honestly |

Scope on all status polls: `candidate:dpl_14tztaC9rK5x355hhNC1BujHSKyk`.

During OKC deep: `deepInflight=true`, `deepLeaseState=valid`, heartbeats observed — invariant held mid-flight.

---

## 9. Deployment-scope evidence

| Check | Result |
|-------|--------|
| Candidate health scope | `candidate:dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| `isProductionAlias` | `false` |
| Promotion guard | **PASS** (`promote: false`) |
| www inspect tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Production KV writes from Candidate | **None observed** (separate namespace) |
| Alias cutover www/apex/game | **NOT performed** |

Note: `--prod --skip-domain` still moves project alias `hansomealpacas-the-67.vercel.app` (known 12C risk); custom domains remain on `dpl_995…`.

---

## 10. Remaining blockers

1. **Product certification still incomplete for full Hook/Titan live proof** — GME terminalized as partial with missing LP publish meta; Phase 13A certifies runtime recovery, not Class B product completeness.  
2. **KV generation fence still not Redis CAS** — known multi-instance last-write-wins risk; mitigated by leases + orphan recovery, not eliminated.  
3. **OKC `createTx` null / Hook allowlist** — known V1 debt; OKC may remain honest incomplete.  
4. **CLI Candidate `buildId` / `gitCommit` null** — no GitHub-linked metadata on this deploy path.  
5. **Main developer workspace still dirty** — Phase 13A work lived in clean worktree; do not ship from dirty main tree.  
6. **HANSOME `pools=0` with `liquidity=done` on this soak** — stage terminal (runtime OK); product LP richness should be re-checked in 13B cert matrix.

---

## 11. Recommendation for Phase 13B

**Proceed to Phase 13B — Release Recertification** on Candidate `dpl_14tztaC9rK5x355hhNC1BujHSKyk` (or a fresh tip from the same commit):

1. Re-run full certification matrix (Ownership / Titan / Hook / valuation / Foreign LP / Hook Lock / presentation / Score) now that Deep reaches terminals without orphan analyzing.  
2. Optionally force-refresh HANSOME/GME once more to confirm non-empty verified LP bodies on Class A/B paths.  
3. Keep Production tip `dpl_995…` until recert **PASS** + explicit human promote.  
4. Defer Redis CAS fence unless a new multi-instance overwrite incident is demonstrated.  
5. Do **not** promote on runtime recovery alone.

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **READY_FOR_RELEASE_RECERTIFICATION** |
| **Report** | `reports/HANSOME_PHASE13A_DEEP_RUNTIME_RECOVERY.md` |
| **Root cause** | Exhausted Deep settled `partial` while force-LP/read paths left `liquidity=analyzing` with no durable lease and process-local inflight only, so polls could not continue; fence/timeout races contributed. |
| **New Candidate** | `dpl_14tztaC9rK5x355hhNC1BujHSKyk` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (confirmed unchanged) |
| **HANSOME** | terminal `partial`, `liquidity=done`, no orphan |
| **GME** | terminal `partial`, `liquidity=partial`, no orphan |
| **OKC** | terminal `partial`, `liquidity=done`, no orphan |
| **Promoted?** | **NO** |
