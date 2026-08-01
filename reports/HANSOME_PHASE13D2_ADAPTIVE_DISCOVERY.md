# HANSOME Phase 13D.2 — Adaptive Discovery Budget

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13D.2 — Adaptive Discovery Budget |
| **Worktree** | `C:\hansomealpacas-phase13a` |
| **Candidate (latest tip)** | `dpl_GJaLRGrqvSw313LBcUwSusT9ewUz` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted?** | **NO** |

## Behavior

Replaces fixed per-version hard detach with adaptive budgets that continue while measurable progress / heartbeats exist.

| Termination | Meaning |
|-------------|---------|
| `success` | Work completed |
| `honest_partial` | Soft-incomplete onTimeout path |
| `no_forward_progress` | Stall window exceeded without progress/heartbeat |
| `max_budget_exhausted` | Hit max ceiling |
| `external_abort` | Abort signal |

## Diagnostics (`AdaptiveDiscoveryDiagnostics`)

- `elapsedMs`, `progressDelta` / `cumulativeProgress`
- `stageBudgetMs`, `baseBudgetMs`, `maxBudgetMs`
- `expansionCount`
- `lastProgressAtElapsedMs`, `stallMs`
- `terminationReason`

## Budgets

| Path | Base | Max | Stall |
|------|------|-----|-------|
| Liquidity stage | 180s | 255s | 28s |
| v2 probe | 30s | 45s | 12s |
| v3 probe | 90s | 160s | 25s |
| v4 probe | 55s | 130s | 20s |
| Parallel hard-bound ceiling | — | 260s | — |

Wired into `multi.ts` (adaptive version probes) and `scan-deep.ts` (`liqBudgetMs` + `computeAdaptiveHardBoundMs`).

## Tests

Unit tests in `phase13d-known-bootstrap.test.ts` — expand / stall / terminal reasons / hard-bound ceiling **PASS**.

## Verdict

**IMPLEMENTED** — does not alone guarantee BEER Locked publish under Candidate RPC/coalesce conditions (see 13E RCA).
