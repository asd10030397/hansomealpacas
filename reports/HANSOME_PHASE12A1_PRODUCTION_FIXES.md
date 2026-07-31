# HANSOME Scan — Phase 12A.1 Production Readiness Fixes

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Mode** | Blocker-only honesty / presentation / fence fixes (no new capability) |
| **Score / Titan / Hook algorithms** | **Unchanged** |
| **Production tip (www / game)** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**Phase 10P — unchanged**) |
| **Candidate** | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` (`https://hansomealpacas-eeedulj9i-the-67.vercel.app`) |
| **Promote www / apex / game?** | **NO** |
| **Final verdict** | **READY_FOR_REAUDIT** |

---

## 1. Audit findings addressed

From `reports/HANSOME_PHASE12A_FULL_PRODUCTION_AUDIT.md` Critical / High blockers in scope:

| # | Finding | Fix |
|---|---------|-----|
| **FIX 1** | Class B `lockDistribution` overwritten by `computeEconomicLockDistribution` in `scan.ts` / `scan-deep.ts` | Guard: when `ownershipClass === hook_native`, **do not** call economic lock%; retain `HOOK_NATIVE_LOCK_DISTRIBUTION_REASON` via `retainHookNativeLockDistribution` |
| **FIX 2** | UI can show Titan LOCKED / unlock date / lock% / badge / position lock for Hook Native | Presentation forces pool `lockStatus=UNKNOWN` for Class B; ScanClient hides Titan lock% bar, Titan position locks, and shows Hook Principal Lock / Unknown from 11H |
| **FIX 3** | `legacyStatus(aggregate)` ignored Class B force | `multi.ts` now returns `legacyStatus(finalAggregate)` |
| **FIX 4** | Hook Native block only on single-pool card | Identical `ownershipClass === "hook_native"` gate on single / multi / empty-aggregate layouts |
| **FIX 5** | Interactive Hook index skipped reorg hash check | Interactive resolve matches background: hash check → rollback overlap → replay |
| **FIX 6** | Fence failure ignored; silent publish | Save result honored; fence fail → `retryRequired` + durable prior state; never overwrite newer gens |
| **FIX 7** | Deployment scope isolation | Verified `hookPosIndexKey` remains scope-wrapped (`production` ≠ `candidate:*`); Phase 10C-4 isolation still PASS |

**Not fixed in this phase** (remain 12A limitations / P1–P2 debt — out of STRICT scope):

- OKC `createTx` still null in fixtures
- Hook allowlist still OKC + GME only
- KV fence still not Redis CAS (cross-isolate)
- Production-scope soak of Hook Intelligence
- POST `/api/scan` deployment-scope header parity
- Hook RPC client explicit timeouts

---

## 2. Files modified

| File | Change |
|------|--------|
| `lib/hansome-score/lp/hook-native-lock-dist.ts` | **New** — Class B lockDistribution retain helper + reason constant |
| `lib/hansome-score/scan.ts` | Skip economic lock% recompute for `hook_native` |
| `lib/hansome-score/scan-deep.ts` | Same guard inside `enrichLp` |
| `lib/hansome-score/lp/multi.ts` | `legacyStatus(finalAggregate)`; shared Class B reason |
| `lib/hansome-score/lp/presentation.ts` | Class B pool cards never Titan LOCKED |
| `lib/hansome-score/lp/v4-ownership-class.ts` | Apply retain helper (availability + pct/USD clear; no classifier change) |
| `lib/hansome-score/lp/hook-position-index/production.ts` | Interactive reorg parity + fence retry state |
| `components/scan/ScanClient.tsx` | Hook Native block all layouts; suppress Titan lock UI for Class B |
| `lib/hansome-score/__tests__/phase12a1-production-fixes.test.ts` | **New** — 10 regression items |
| `lib/hansome-score/__tests__/v4-ownership-class.test.ts` | Expect Class B `lockedPct=null` after retain |

---

## 3. Regression

| Suite | Result |
|-------|--------|
| `phase12a1-production-fixes.test.ts` (items 1–9 + scope) | **PASS** (9) |
| Phase 11A / 11A1 `v4-ownership-class.test.ts` | **PASS** (20) |
| Phase 11E `hook-position-index-phase11e.test.ts` | **PASS** (20) |
| Phase 11F `hook-position-valuer-phase11f.test.ts` | **PASS** (10) |
| Phase 11G `hook-foreign-lp-phase11g.test.ts` | **PASS** (7) |
| Phase 11H `hook-lock-classifier-phase11h.test.ts` | **PASS** (12) |
| Phase 10C-2 / 10C-3 / 10C-4 / 10C-5 | **PASS** |
| Phase 10B / 10C-1 V3 index | **PASS** |
| `lp-presentation` / `lp-multi-version` / `position-value` / `score` | **PASS** |
| `tsc --noEmit` | **PASS** |
| `next build` | **PASS** |

### Brief regression checklist

1. Hook Native never computes lockDistribution — **PASS**
2. Hook Native never displays Titan lock badge — **PASS**
3. Hook Native legacyStatus never LOCKED — **PASS**
4. Hook Native always renders Hook block (gating) — **PASS**
5. Class A unchanged — **PASS**
6. Titan unchanged — **PASS**
7. Score unchanged — **PASS**
8. Interactive reorg matches background — **PASS**
9. Generation fence rejects stale publish — **PASS**
10. Phase10 / 11A / 11A1 / 11E / 11FGH — **PASS**

### Fixture honesty (unit / presentation)

| Token | Expectation | Status |
|-------|-------------|--------|
| **HANSOME** | Class A unchanged; Titan path intact | **PASS** |
| **GME** | Hook block gated; no Titan badge / lock%; Hook lock only | **PASS** (unit + presentation) |
| **OKC** | Unknown incomplete; no Titan lock% | **PASS** (unit; createTx still null by design) |

---

## 4. Performance impact

| Path | Impact |
|------|--------|
| Scan / Deep enrich | **Negligible** — one ownershipClass branch; skips economic lock% work for Class B |
| Hook interactive resolve | Slightly more work on hash-mismatch path only (parity with background) |
| Fence fail | Returns prior durable state (no extra publish) |
| Class A / Titan / Score | No hot-path change |

---

## 5. Remaining limitations

1. Production tip still Phase 10P — Hook Intelligence **not** live on www/game.
2. Hook allowlist = OKC + GME only.
3. OKC createTx/createBlock missing → perpetual incomplete Hook index/lock.
4. Foreign discovery still off by default.
5. KV generation fence is not Redis CAS (multi-instance last-write-wins risk remains).
6. No Production-scope soak of this candidate under `HANSOME_SCAN_DEPLOYMENT_SCOPE=production`.
7. Side-by-side Unknown Lock Status vs Hook Principal Locked remains intentional separation.
8. ≥5 additional Hook Native RH fixtures still unavailable.

---

## 6. Candidate deployment

| Item | Value |
|------|--------|
| Command | `npx vercel deploy --prod --skip-domain --yes` |
| Candidate ID | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |
| Candidate URL | `https://hansomealpacas-eeedulj9i-the-67.vercel.app` |
| Inspector | `https://vercel.com/the-67/hansomealpacas/FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |
| Custom domains promoted? | **NO** |

---

## 7. Production confirmation

| Check | Result |
|-------|--------|
| `www.hansomealpacas.xyz` tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| `game.hansomealpacas.xyz` tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| Tip changed by this phase? | **NO** |
| Promote requested? | **NO** |

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **READY_FOR_REAUDIT** |
| **Report** | `reports/HANSOME_PHASE12A1_PRODUCTION_FIXES.md` |
| **Candidate** | `dpl_FH9WdJ8hrC9wNzNPFTC2QttirmMZ` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
| **Fixes applied** | FIX 1–7 (lockDistribution invariant, presentation, legacyStatus, Hook block layouts, interactive reorg, fence retry, scope verify) |
| **Remaining unfixed 12A items** | OKC createTx; allowlist=2; Redis CAS; Production soak; POST scope header; Hook RPC timeouts |
| **READY_FOR_PRODUCTION?** | **NO** — awaiting re-audit |
