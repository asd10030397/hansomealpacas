# HANSOME — Cold Perf V2 Phase 8.1 Known-First LP Early Exit Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Deploy under test (Phase 8.1 tip)** | `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` |
| **Live tip after rollback** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (Phase 8) |
| **Rollback target** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Alias** | www / game → Phase 8 tip **YES** (restored via `vercel promote`) |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Phase 7.1 Smart LP** | **Inactive** (`HANSOME_SMART_LP_REFRESH` unset) |
| **Verdict** | **ROLLED_BACK** |

---

### 1. Exact pre-deploy Production tip

Phase 8 tip `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` was live before Phase 8.1 ship. When this finish session started, www already pointed at Phase 8.1 `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` (prior agents shipped but died before gate report). Reconfirmed via `npx vercel inspect www.hansomealpacas.xyz` → `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` before measures; after rollback → `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`.

### 2. Root cause recap

Phase 8 clean warm HANSOME still spent ~20–30s on v4 Quick LP RPC on the interactive critical path even when known Position IDs + MIXED evidence were already sufficient. Phase 8.1 adds a narrow known-first planner to skip broad Quick when safe.

### 3. Known-first architecture

Module `lib/hansome-score/lp/known-first-early-exit.ts`:

- `planKnownFirstLpEarlyExit(evidence)` → outcome + reasons + freshness/skip flags
- Outcomes: `known_first_reuse` | `known_first_price_only` | `known_first_owner_revalidate` | `known_first_lock_revalidate` | `known_first_insufficient` | `full_quick_fallback` | `cold_fallback`
- Wired in `scan-deep.ts` liquidity job **only when Smart LP is off** (default)
- Smart LP remains disabled; Pons excluded

### 4. Early-exit eligibility

Requires chain/address match, compatible LP cache schema + analysis semantic version, prior LP payload present, verified known Position IDs, fresh or selectively revalidated owner/lock, no reorg / NFT transfer / LP invalidation / force-full / prior critical partial.

### 5. Sufficiency rules

MIXED early exit only when locked + non-fully-locked components remain reconstructible from known evidence; never ALL_LOCKED from incomplete known-first; never invent No Liquidity; preserve `discoveryComplete=false` when exhaustive incomplete.

### 6. Invalidation signals

Bounded sources only: transfer-index head, LP discovery checkpoint, known Position NFT transfer evidence, recent relevant logs, pool/locker checkpoint metadata, reorg overlap, cache version/freshness. No broad historical scan merely to decide early exit.

### 7. Freshness policies

Reuses Smart LP component TTLs via `KNOWN_FIRST_FRESHNESS` (no single global LP TTL): position owner / lock classification ~10m, price/TVL/pool balances short, near-expiry forces lock refresh.

### 8. Owner refresh behavior

- Structural reuse / price-only: reuse known owners (no broad `ownerOf` sweep)
- Selective: `detectV4` with `revalidatePositionIds` + `skipQuickDiscoveryExpansion` + `skipBroadTitanSweep`
- Insufficient → full Quick/multi fallback

### 9. Locker refresh behavior

Selective Titan-by-ID when needed; broad Titan skipped on known-first paths. PonsLaunchLocker remains excluded/unwired.

### 10. Market-data separation

Phase 8 Gecko/ETH-USD overlap preserved. Price/TVL may refresh independently of structural reuse (`known_first_price_only` / stale market flags). No price/TVL formula changes.

### 11. Background exhaustive behavior

Known-first must not stop background exhaustive discovery; interactive barrier may finish on known evidence; `discoveryComplete` stays false until existing completeness rules pass. No background work remains on the interactive barrier.

### 12. Progress sequence

Actions: `lp_known_first_plan` → `lp_known_evidence_load` → `lp_known_evidence_validate` → owner/lock reuse or revalidate → optional `lp_market_refresh` → `lp_known_first_early_exit` / `lp_full_quick_fallback` → `lp_final_validation` → `lp_background_exhaustive`. Monotonic; no fake 100%; Phase 7.3 bounded settlement retained.

### 13. HANSOME before / after wall

| Measure | Wall | Score | Lock | discoveryComplete | Notes |
|---------|-----:|------:|------|-------------------|-------|
| Phase 8 clean baseline | **40 009 ms** | 53 | MIXED | false | Tip `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| 8.1 prior partial (died) | ~10 698 ms | **52** | MIXED | false | Warm/cache path; only `final_validation` polled |
| 8.1 refresh #1 | **93 797 ms** | **54** | MIXED | false | Mode I `degraded_watchdog`; **full Quick** |
| 8.1 refresh #2 | **36 535 ms** | **54** | MIXED | false | **`known_first_price_only`**, skipQuick=true |
| 8.1 refresh #3 | 462 ms | 54 | MIXED | false | Rate-limited (not a real LP path) |

Clean known-first median (n=1): **36 535 ms** (~−9% vs 40s; **misses** ≤25s primary and &lt;90% of baseline improvement gate).

### 14. Three-run clean measurements

Required ≥3 spaced **real** LP-path refreshes: **not met** (only 2 real; 1 clean known-first; 1 degraded full Quick; 1 rate-limited). Cooldown 65–70s respected; connect timeouts retried in finish script.

### 15. v4 Quick calls before / after

| Run | Quick / probes | Known-first |
|-----|----------------|-------------|
| Phase 8 baseline | probe_v2/v3/v4 + quick_titan path | N/A |
| 8.1 #1 | **Yes** (full Quick) | plan published then fallback |
| 8.1 #2 | **No** (skipped) | `known_first_price_only` + source `known_first_early_exit` |
| 8.1 #3 | N/A (denied) | — |

### 16. ownerOf / readPosition before / after

Not instrumented with exact RPC counts in this finish session. Run #2 progress shows `lp_owner_reuse` + `lp_market_refresh` without probe/quick actions — consistent with structural reuse + market overlay only.

### 17. Locker calls before / after

Run #2 skipped `quick_titan` / broad Titan. Run #1 exercised full Titan path under watchdog degradation.

### 18. RPC / Blockscout / Gecko before / after

Qualitative: known-first clean run avoids v4 Quick RPC burst; Gecko/ETH-USD still allowed for price-only. Blockscout Rel/CreatorBurn unchanged on parallel wave. Exact request deltas not exported from Production spans in this session.

### 19. Known-first / full semantic equality

| Field | Phase 8 baseline | 8.1 measured | Equal? |
|-------|------------------|--------------|--------|
| Score | **53** | **54** (stable across 3 attempts) | **NO** |
| Lock | MIXED | MIXED | YES |
| discoveryComplete | false | false | YES |
| Components (8.1) | *(not frozen in Phase 8 report)* | structural 75 / liqDepth 45 / holders 43 / activity 34 / maturity 55 / dataConfidence 67 | — |

Direct tip-vs-tip refresh compare on `dpl_5xqS…` URL failed (Vercel Deployment Protection 401 on non-aliased deployment URLs). Therefore score 53→54 could not be proven market/state-driven under Phase 8 code on the same window → treated as **unexplained semantic drift** per gate policy.

Prior partial score **52** was a warm/cache sample (not a real LP refresh); real 8.1 refreshes settled at **54**.

### 20. Fallback scenarios

- Run #1: known-first plan → full Quick (watchdog degraded) — fallback works, terminates complete
- Run #2: early exit success
- PRIMARY refresh: `full_quick_fallback`, hit 150s poll cap still `deep_running` / lock `UNABLE_TO_DETERMINE` in this session (non-terminal for gate)

### 21. Phase 7.3 reliability validation

HANSOME runs reached terminal complete with no analyzing leftovers on the three www attempts. Watchdog path still bounded (run #1). PRIMARY + Core7 cached polls during concurrent deep load showed non-terminal analyzing — environment contention / short poll budget; not a clean 7.3 proof on this tip. Unit suites for bounded settlement were already present from Phase 7.3/8; not re-run in this finish-only session.

### 22. Core 7 results

| Token | Cached Deep (finish script) | Notes |
|-------|----------------------------|-------|
| HANSOME | complete / 54 / MIXED / incomplete | OK |
| FOX…WALLET | mostly `deep_running` @ ~25s budget | Contaminated by concurrent PRIMARY refresh; **core7Terminal=false** |

### 23. Top-100 semantic validation

N=25 fast sample: **semanticDrift=0** (no false ALL_LOCKED with incomplete discovery). Many locks `UNABLE_TO_DETERMINE` on fast path — honesty preserved.

### 24. Failure-injection results

Not re-executed in this finish session. Prior Phase 8.1 code includes `known-first-early-exit.test.ts` (false ALL_LOCKED, sufficiency, semantic equal helpers). Production gate failure dominated the decision.

### 25. Tests

Code + unit tests were already on the shipped tip from prior agents (`known-first-early-exit.test.ts`, wiring in `scan-deep.ts`). This session focused on Production gates after premature ship.

### 26. Typecheck

Assumed green from prior ship (tip Ready). Not re-run here.

### 27. Build

Production tip `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` was Ready (prior `vercel deploy --prod`). Not rebuilt in this session.

### 28. Deploy decision

**ROLLBACK** — hard gates failed:

1. Score **54 ≠ 53** without proven market/state equality vs Phase 8 tip code
2. &lt;3 clean real spaced HANSOME LP-path refreshes
3. Clean median **36.5s** did not meet ≤25s primary; not material enough vs 40s under incomplete sample
4. Core7 terminal gate failed in measured window
5. PRIMARY refresh non-terminal in measured window

Known-first path **was observed once** (`known_first_price_only`, skipQuick) — promising, but insufficient for PASS_DEPLOYED.

### 29. Deploy ID

Under test: `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1`  
Live after action: `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`

### 30. Alias

`www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` → **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`** after `npx vercel promote dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7 --yes`

### 31. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (Phase 8 PASS_DEPLOYED tip). **Rollback performed: YES.**

### 32. Analytics / admin smoke

www **200**, game **200** post-rollback. Admin auth / analytics beacon not re-exercised in this finish session beyond HTTP smoke (no secret exposure in reports).

### 33. Game visual smoke

HTTP game **200** post-rollback. Full `test:visual:game-landing` not re-run in this session (prior Phase 8 tip already had visual gate).

### 34. Remaining limitations

- Known-first early exit works intermittently; cold/degraded paths still hit full Quick (~40–90s+)
- Stretch ≤15s / primary ≤25s not met on measured clean run (36.5s)
- Non-aliased deployment URLs are SSO-protected — tip A/B score proof needs alias promote or bypass
- Smart LP stays OFF; do not re-enable without full 7.1 re-gate
- Next attempt should freeze component snapshot on Phase 8 tip **before** ship, then compare structural/lock/discoveryComplete hard fields + overall score with documented market components

### 35. Final verdict

**ROLLED_BACK**

Phase 8.1 tip was already live without a finished report. Finish validation observed known-first early exit once (36.5s, skipQuick, MIXED/incomplete) but failed hard gates on unexplained score drift (54 vs baseline 53), insufficient clean-run sample, and Core7/PRIMARY terminal issues under load. Production alias restored to Phase 8 `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`. Smart LP remains off; Pons remains excluded.

---

### Return summary (for parent)

- **Live tip:** `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (after rollback)
- **HANSOME:** score **54** on 8.1 measures (baseline 53); lock **MIXED**; clean known-first median **36 535 ms** (n=1)
- **Known-first observed?** YES (run #2 `known_first_price_only`)
- **v4 Quick skipped?** YES on that clean run; NO on degraded run #1
- **Deploy decision:** ROLLBACK
- **Verdict:** **ROLLED_BACK**
- **Report:** `reports/HANSOME_COLD_PERF_V2_PHASE8_1_KNOWN_FIRST_LP_PRODUCTION.md`
- **Rollback performed:** **YES**
