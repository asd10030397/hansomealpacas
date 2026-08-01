# HANSOME Scan — Phase 13C Force LP Refresh Recovery Contract

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13C — Force LP Refresh Recovery Contract |
| **Final verdict** | **PARTIAL** |
| **Mode** | LP refresh reliability ONLY (no Ownership / Titan / Pons / Hook / Score / UI / isolation-rule changes) |
| **Worktree** | `C:\hansomealpacas-phase13a` on `phase-13a-deep-runtime-recovery` |
| **Baseline** | `ca5b3c4` (+ 13B.1 docs) → 13C tip uncommitted in worktree |
| **Failed soak tip (13B.1)** | `dpl_HmF5vkSc6aRTkSaTaXwyP9e2g9vW` |
| **New Candidate** | `dpl_7UAgndNAhdZrAnq9BJm71bxtGpC9` |
| **Candidate URL** | `https://hansomealpacas-cf4ixzmti-the-67.vercel.app` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |

Companion artifacts:

- `reports/data/phase13c_deploy4_out.txt` (final candidate deploy)
- `reports/data/phase13c_force_lp_soak_console.txt` (earlier aborted soaks on prior tips)
- `lib/hansome-score/lp/force-lp-recovery.ts`
- `lib/hansome-score/__tests__/phase13c-force-lp-recovery.test.ts` (16 + invariants A|B|C)

---

## 1. Part 1 — Root cause (evidence-backed, first broken transition)

### Mechanism (13B.1 Candidate `dpl_HmF5…`)

Force LP was **destructive clear-then-rediscover**, not a transaction:

1. `forceLp=1` → `deleteLpPublishedBody` + `clearStaleLpEvidence` **before** successful republish  
2. Deep rediscovery often hit `parallel_hard_bound` / stage timeout  
3. Read reconcile (`reconcilePublishedLpOnRead`) converted soft-fail `missing_scan_meta` + “did not finish in time” into a **cleared shell** (`lp_read_rearm`) ~53s into cold  
4. Auto-rearm (`rearmPartialForDeepRetry`) also cleared bodies when `lpEvidenceNeedsFullRefresh`  
5. FAILED_TERMINAL could **publish** cleared shells as `lpPublish`, making sticky clear durable  

No recovery slot existed → BEER Locked / HANSOME positions could not be restored after force.

### First broken transition per token (13B.1 soak JSON)

| Token | First broken transition | Evidence |
|-------|-------------------------|----------|
| **BEER** | After force clear, rediscovery never republished Locked; terminal stayed cleared shell (`positions=0`, detail cleared, `lpGeneration` stuck / meta mismatched) | `phase13b1_candidate_soak.json` `afterForce.cleared=true`, `lock/tokenId` false |
| **HANSOME** | Same clear-without-restore; score 77 but `ownershipClass=null`, `positionsCount=0` | soak `gateForced.ownership/positions/pools=false` |
| **GME** | Cleared / incomplete publish; honesty OK but `hook_native` + hook intel not restored | `hasHookIntel=false` |
| **OKC** | Forced cycle not terminal in budget (`deep_running`/`analyzing` at force gate) | `gateForced.terminal=false` |

### Live re-prove on 13C tip `dpl_7UAg…` (cold BEER)

| Check | Result |
|-------|--------|
| Sticky cleared @~53s | **FIXED** — detail stays honest timeout (“did not finish in time”), not “LP evidence cleared” |
| Lease mid-flight | **valid** (`deepLeaseState=valid`, heartbeats) |
| LOCKED_VERIFIED / 436637 | **Not established** — rediscovery still times out (`parallel_hard_bound`) before Pons Locked publish |
| Production tip | **`dpl_995…` unchanged** |

---

## 2. Parts 2–8 — Durable refresh transaction model

New module: `lib/hansome-score/lp/force-lp-recovery.ts`

| Piece | Behavior |
|-------|----------|
| **Recovery slot** | `{scope}:scan:lp:recovery:{chainId}:{token}` via `scanLpRecoveryKvKey` |
| **prepareForceLpRefresh** | Stash durable prior; keep active KV body until commit (`mayDeleteActiveBody=false`) |
| **commitForceLpRefresh** | On successful new-gen publish — drop slot, mark `committed` |
| **rollbackForceLpRefresh** | Restore prior body + `stale_forced_refresh` |
| **Dedup** | `FORCE_LP_DEDUP_MS=45s` reuse open txn |
| **TTL** | `FORCE_LP_TXN_TTL_MS=6m` → expire → rollback on read |
| **Durable force flag** | KV `scan:lp:force-flag:…` (cross-isolate Deep) |
| **Deep priorLp** | `loadPriorLpForForceDeep` prefers recovery slot over cleared aggregate |

Wired into:

- `scan-cache.ts` — `beginForceLpRefreshArm`, reconcile serve/restore, publish commit/fail rollback, settle restore  
- `scan-deep.ts` — durable force consume + recovery priorLp  
- `scan-progress.ts` — **rearm no longer clears bodies**  
- `lp-result-publish.ts` — **never publish cleared shells** (incl. FAILED_TERMINAL)  
- `types.ts` — `LpForceRecoveryMeta`, `stale_forced_refresh` reason  
- `deployment-scope.ts` — recovery KV key helper  

**Not changed:** lock classification, Titan/Pons/Hook ownership/valuation/lock rules, Score formulas, UI product semantics, deployment isolation rules (only added scoped recovery key family).

---

## 3. Part 9 — Tests + invariants

| Suite | Result |
|-------|--------|
| `phase13c-force-lp-recovery.test.ts` | **19 PASS** (16 scenarios + A|B|C) |
| Related 10C-4 / 10C-5 / 10C-3 / 13A batch | **PASS** |
| `tsc --noEmit` | **PASS** |

**Invariants after force ends:**

| ID | Meaning | Unit | Live |
|----|---------|------|------|
| **A** | No sticky cleared-only when durable prior existed | PASS | N/A (no durable Locked prior established on candidate) |
| **B** | Open force + durablePrior ⇒ slot or active body | PASS | N/A |
| **C** | Hard-terminal ⇒ new gen committed OR prior restored | PASS | N/A |

---

## 4. Part 10 — Candidate soak

| Item | Result |
|------|--------|
| Deploy | `npx vercel deploy --prod --skip-domain --yes` → `dpl_7UAgndNAhdZrAnq9BJm71bxtGpC9` |
| Health scope | `candidate:dpl_7UAg…`, `isProductionAlias=false` |
| Promotion guard | PASS on prior tip; same isolation pattern |
| Full script soak (BEER 10 / HANSOME 5 / GME 5 / OKC 5) | **Not completed** — long soak launches blocked mid-session; earlier tips aborted after sticky-clear diagnosis |
| Targeted BEER cold probe on final tip | Terminal honesty improved (no invented cleared shell); **Locked product gate still FAIL** (timeout rediscovery) |
| www / apex / game | **Unchanged** → `dpl_995…` |

### Soak summary (product gates)

| Token | Force soak | Notes |
|-------|------------|-------|
| **BEER** | **FAIL** (no 10/10 Locked) | Recovery contract cannot restore what rediscovery never published; cold still times out before 436637/Pons |
| **HANSOME** | **Incomplete** | Full ×5 matrix not finished on final tip |
| **GME** | **Incomplete** | Full ×5 matrix not finished on final tip |
| **OKC** | **Incomplete** | Full ×5 matrix not finished on final tip |

Script ready: `scripts/phase13c-force-lp-soak.mjs`.

---

## 5. Remaining blockers

1. **HIGH — Candidate Deep rediscovery still times out before BEER Locked publish** (`parallel_hard_bound` / stage timeout). 13C stops destroying evidence; it does not lengthen discovery budgets or change Pons adapters.  
2. **MEDIUM — Full cold/warm/forced×N matrix** needs an uninterrupted soak run on `dpl_7UAg…` once a durable Locked prior exists (or after rediscovery budget work outside 13C).  
3. Known debt unchanged: KV fence not Redis CAS; `--prod --skip-domain` may move project alias `*-the-67.vercel.app`; CLI `buildId`/`gitCommit` null.

---

## 6. Final verdict

**PARTIAL**

Recovery transaction + tests + sticky-clear root cause are landed on Candidate `dpl_7UAgndNAhdZrAnq9BJm71bxtGpC9`. Production tip remains `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`. Not **READY_FOR_FINAL_RELEASE_RETRY** until BEER Locked (and HANSOME/GME/OKC force terminals) are proven live after forceLp.

### Unblock for READY_FOR_FINAL_RELEASE_RETRY

1. On Candidate `dpl_7UAg…` (or successor from same 13C tip): obtain at least one durable BEER Locked publish (436637 / Pons), then run `phase13c-force-lp-soak.mjs` to completion.  
2. Confirm force cycles restore via commit **or** `stale_forced_refresh` (never sticky cleared).  
3. Pass HANSOME×5 / GME×5 / OKC×5 terminal gates.  
4. Only then: final release retry (13B.1 Part 7+).

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **PARTIAL** |
| **Report** | `reports/HANSOME_PHASE13C_FORCE_LP_RECOVERY.md` |
| **Root cause** | ForceLp eagerly deleted/cleared durable LP; read reconcile + auto-rearm invented sticky “LP evidence cleared” shells (`lp_read_rearm` / `missing_scan_meta`) with no recovery slot — so BEER/HANSOME could not be restored after failed rediscovery. |
| **New Candidate** | `dpl_7UAgndNAhdZrAnq9BJm71bxtGpC9` |
| **BEER** | Recovery path fixed (no invented cleared); Locked 10/10 **not** certified (rediscovery timeout) |
| **HANSOME / GME / OKC** | Full force soak matrix incomplete on final tip |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (confirmed unchanged) |
| **Promoted?** | **NO** |
