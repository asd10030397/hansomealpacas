# HANSOME Phase 13D.1 — Persistent LP Snapshot

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13D.1 — Persistent LP Snapshots |
| **Worktree** | `C:\hansomealpacas-phase13a` |
| **Candidate (latest tip)** | `dpl_GJaLRGrqvSw313LBcUwSusT9ewUz` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted?** | **NO** |

## Deliverables

| Item | Status |
|------|--------|
| Snapshot module `lp/lp-persistent-snapshot.ts` | **DONE** |
| Persist position IDs, pool IDs, ownership/lock evidence refs | **DONE** |
| Discovery / publish generations + verification timestamp | **DONE** |
| KV `{scope}:scan:lp:snap:{chainId}:{token}` | **DONE** |
| Force Refresh reuse only with `requiresRevalidation=true` | **DONE** |
| Never bypass ownership verification | **DONE** (sanitize rejects full `positions` blobs) |
| Wired persist after liquidity settle in `scan-deep` | **DONE** |
| Unit tests | **PASS** (in `phase13d-known-bootstrap.test.ts`) |

## Contract

- Snapshots store **references** (IDs, owner hints, lockState hints) — never lock truth.
- `loadSnapshotForForceRefresh` always returns `requiresRevalidation: true`.
- Bootstrap resolver unions snapshot IDs into advisory seeds; classification still requires `ownerOf` / adapter PASS.

## Verdict

**IMPLEMENTED** — available on Candidate tip. Product Locked certification blocked by 13E BEER rediscovery (see Phase 13E RCA).
