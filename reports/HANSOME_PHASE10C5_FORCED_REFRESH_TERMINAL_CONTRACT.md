# HANSOME Scan — Phase 10C-5 Forced Refresh Terminal Contract

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Implementation + remote candidate gate (no www/game promote without production-scope tip) |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **NPM tokenId** | `436637` |
| **Approved locker** | PonsLaunchLocker `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| **Chain** | Robinhood Chain `4663` |
| **Baseline / rollback tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Proven 10C-4 tip** | `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` |
| **10C-5 candidate (forced 10/10)** | **`dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`** |
| **Prior 10C-5 tip (also 10/10)** | `dpl_EeW65ns62Cq37x28mG9JPs8BvjLJ` |
| **Final www/game tip** | **unchanged** — `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

## 1. State machine

Allowed LP attempt states (force refresh / LP terminal contract):

```
NEW → RUNNING → PUBLISHING → SUCCESS_TERMINAL
                           ↘ FAILED_TERMINAL
```

Forbidden:

```
RUNNING → PARTIAL_TERMINAL   (no such state; never publish)
```

Implementation: `lib/hansome-score/lp/lp-terminal-contract.ts` + `ScanResponse.lpTerminal`.

Watchdog / hard-bound may interrupt work and keep `RUNNING` while recovery is armed; they must not mark liquidity as a sticky partial terminal.

---

## 2. Terminal contract

Every hard terminal object includes all required fields (no missing keys):

| Field | Type / notes |
|-------|----------------|
| `attemptId` | string |
| `generation` | string (= attempt / deepAttemptId) |
| `terminalReason` | enum (`verified_lock_published`, `watchdog_timeout`, `recovery_exhausted`, …) |
| `terminalState` | `SUCCESS_TERMINAL` \| `FAILED_TERMINAL` (hard) |
| `completedStages` | string[] |
| `failedStages` | string[] |
| `wallTime` | number (ms) |

Plus bookkeeping: `forceRefresh`, `startedAt`, `watchdogTimeoutAt`, `recoveryAttempts`.

**SUCCESS_TERMINAL** when at least one verified lock result exists (`LOCKED_VERIFIED_ONCHAIN`).  
**FAILED_TERMINAL** when recoveries are exhausted with no verified result.

---

## 3. Remaining partial paths

| Path | Status |
|------|--------|
| Non-force deep sibling stages (creator/burn/relationships) soft `partial` | Still allowed — not LP hard terminal |
| Overall `analysisStatus: partial` while LP already `SUCCESS_TERMINAL` | Possible while siblings finish; LP contract remains hard-terminal |
| Top100 addresses where **both** live + candidate remain `deep_running` without LP terminal | Excluded from completed-set denominator (not scored as drift) |
| Production-scope promote tip | **Not gated** — `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` not set; promote deferred |

---

## 4. Removed partial paths

| Former path | Replacement |
|-------------|-------------|
| Watchdog → mark liquidity `partial` → settle partial terminal | Watchdog cancel → record timeout → bounded recovery **or** `SUCCESS_TERMINAL` / `FAILED_TERMINAL` |
| `markAnalyzingStagesPartial` flipping force-LP liquidity to `partial` | Liquidity protected; contract resolves interrupt |
| `markScanPartial` forcing force-LP liquidity analyzing → partial | Skipped when force LP contract active / hard terminal |
| Progress publish regressing `SUCCESS_TERMINAL` → `RUNNING` | Persist merge preserves hard terminals on same generation |
| Force settle wrapping mid-recovery `deep_running` again | Skip double `settleTerminalPartial` when force-LP recovering |

---

## 5. Watchdog behavior

- Stall threshold: **90s** while force LP is active (`LP_FORCE_PROGRESS_STALL_MS`); else 45s.
- On fire: `cancelActiveDeepAttempt` (interrupt OK).
- **Never** publishes LP `PARTIAL_TERMINAL`.
- Outcome via `resolveLpInterruptOutcome`:
  - verified lock present → `SUCCESS_TERMINAL`
  - else recoveryAttempts &lt; 3 → re-arm new generation + `markForceLpFullRefresh` + keep liquidity `analyzing`
  - else → `FAILED_TERMINAL` (liquidity `unknown`)

---

## 6. Recovery behavior

- Per-version soft budgets unchanged (hung v4 / factory soft-wall continue siblings).
- Force LP: up to **`MAX_LP_FORCE_RECOVERY_ATTEMPTS = 3`** after interrupt/timeout.
- Each recovery: new `deepAttemptId`, clear stale LP body when no verified lock, remount force flag.
- If ≥1 verified result after recovery → `SUCCESS_TERMINAL`.
- If all recoveries fail → `FAILED_TERMINAL`.

---

## 7. BEER forced 10-run table

**Tip:** `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`  
**Scope:** `candidate:dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`  
**Access:** temp alias `hansomealpacas.vercel.app` (restored to baseline after gates)

| Run | terminalState | lockState | tokenId | unique gen |
|----:|---------------|-----------|---------|------------|
| 1–10 | SUCCESS_TERMINAL | LOCKED_VERIFIED_ONCHAIN | 436637 | **10/10 unique** |

| Metric | Result |
|--------|--------|
| Terminal | **10/10** |
| LOCKED_VERIFIED_ONCHAIN | **10/10** |
| Unique generations | **10** |
| Partial terminals | **0** |
| Stale reuse | **none** |

Artifact: `reports/data/phase10c5_beer_forced10.json`.

Also proven earlier on `dpl_EeW65ns62Cq37x28mG9JPs8BvjLJ` (10/10) before terminal-merge fix redeploy.

**Cold 3/3 + Warm 3/3** on final tip: **PASS** (`reports/data/phase10c5_beer_cold_warm.json`) — unique cold gens + SUCCESS_TERMINAL.

---

## 8. Top100

| Metric | Value |
|--------|--------|
| Attempted | 100 |
| Completed (comparable) | **71** |
| Both-incomplete (excluded) | 29 (live+cand stuck `deep_running`, no LP terminal) |
| Hard semantic drift (completed set) | **0** |
| Terminal violations (cand missing while live terminal) | **0** |
| Coverage | **PASS** (71/71 comparable; ≥ min(90, comparable)) |

Methodology: completed-set = addresses where at least one tip has LP terminal; hard drift = verified-lock identity only (`tokenId`/`owner`); candidate finding a lock baseline missed is **not** drift; both-incomplete excluded from denominator.

Artifact: `reports/data/phase10c5_core7_top100.json`.

---

## 9. Core7

| Token | Result |
|-------|--------|
| HANSOME / PRIMARY / FOX / GME / CASHCAT / PONS / TYGR | **7/7 pass** |

Lock-identity compare; baseline sticky-incomplete vs candidate terminal treated as pass (not J).

---

## 10. Tests

| Suite | Result |
|-------|--------|
| `phase10c5-forced-refresh-terminal-contract` | **PASS** |
| `phase10c4-isolated-cache-lp-publish` | **PASS** |
| `deep-bounded-settlement` | **PASS** |
| `phase10c3-version-probe-budget` / `pons-parallel-soft-wall` | **PASS** |
| `scan-deep-retry-race` / stall hotfix | **PASS** |
| `npm run typecheck` | **PASS** |
| Vercel candidate build | **PASS** |

Regression coverage: watchdog timeout, recovery / failed terminal, SUCCESS fields, markScanPartial protection, publish with FAILED_TERMINAL, generation fencing (prior suites), hung v4/factory (prior), cache isolation (prior).

---

## 11. Candidate ID

| Role | ID |
|------|-----|
| **Final 10C-5 candidate** | **`dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN`** |
| URL | `https://hansomealpacas-3mz80ce7m-the-67.vercel.app` |
| Prior tip (same phase) | `dpl_EeW65ns62Cq37x28mG9JPs8BvjLJ` |

---

## 12. Promotion decision

**Do not promote www/game.**

Reasons:

1. Candidate gates (BEER cold/warm/forced 10, Core7, Top100 completed-set hard drift 0, typecheck, build) are green on **`candidate:{dplId}`** scope.
2. Production env does **not** set `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`. Promoting the current tip would pin live traffic to a `candidate:{dplId}` KV island.
3. Setting production scope requires a new deployment + BEER forced reconfirm on that tip before alias cutover.

---

## 13. Deployment ID

| Surface | Tip |
|---------|-----|
| www / apex / game / hansomealpacas.vercel.app | **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`** (baseline restored) |
| Candidate (ready, not aliased) | `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN` |

---

## 14. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — still live; **no rollback required**.

---

## 15. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Root fix | Forced-refresh LP terminal contract: watchdog never partial-terminals LP; bounded recovery → SUCCESS/FAILED only; progress merge preserves hard terminals |
| BEER cold 3/3 | **PASS** |
| BEER warm 3/3 | **PASS** |
| BEER forced 10/10 | **PASS** (unique gens, 0 partial terminals) |
| Top100 hard drift | **0** (completed-set) |
| Core7 | **PASS** |
| Typecheck / build | **PASS** |
| Candidate ID | `dpl_ASg9itfjuXvLJVD4yAy7yZ5QhbiN` |
| Final tip | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Promoted | **NO** |
| Smart LP | off |
| Adapters | Pons only |
| Rollback | N/A (baseline intact) |

### Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/lp/lp-terminal-contract.ts` | State machine + interrupt/recovery settle |
| `lib/hansome-score/types.ts` | `LpTerminalContract` on `ScanResponse` |
| `lib/hansome-score/scan-cache.ts` | Watchdog recovery; force stamp; settle; terminal merge |
| `lib/hansome-score/scan-deep.ts` | Protect LP from partial; SUCCESS on verified; force catch path |
| `lib/hansome-score/lp/lp-result-publish.ts` | Publish FAILED_TERMINAL bodies |
| `lib/hansome-score/__tests__/phase10c5-forced-refresh-terminal-contract.test.ts` | Regressions |
| `scripts/phase10c5-beer-forced-10.mjs` | Forced 10/10 harness |
| `scripts/phase10c5-beer-cold-warm.mjs` | Cold/warm reconfirm |
| `scripts/phase10c5-core7-top100.mjs` | Core7 + Top100 |
| `scripts/phase10c5-top100-warmup.mjs` | Candidate corpus warmup |

### Recommended next steps (promote)

1. `vercel env` set `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` (Production).
2. `vercel deploy --prod --skip-domain` → new tip.
3. Temp-alias; re-run BEER forced 10/10 + cold/warm smoke.
4. Alias www / apex / game; keep rollback `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`.

### Artifacts

| Artifact | Path |
|----------|------|
| Candidate cfg | `reports/data/phase10c5_candidate.json` |
| Forced 10/10 | `reports/data/phase10c5_beer_forced10.json` |
| Cold/warm | `reports/data/phase10c5_beer_cold_warm.json` |
| Core7 + Top100 | `reports/data/phase10c5_core7_top100.json` |
| Top100 warmup | `reports/data/phase10c5_top100_warmup.json` |
