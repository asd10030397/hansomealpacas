# HANSOME — Cold Perf V2 Phase 8.1A Semantic Drift Investigation

| Field | Value |
|-------|--------|
| **Date** | 2026-07-29 |
| **Live Production tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (Phase 8) |
| **Phase 8.1 tip investigated** | `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` |
| **Alias changed?** | **NO** |
| **Known-First in Production?** | **OFF** (rolled back; not re-enabled) |
| **Smart LP** | **Inactive** |
| **PonsLaunchLocker** | **Excluded** |
| **Verdict** | **PASS_NOT_DEPLOYED** |
| **Classification** | **MARKET_STATE_DRIFT** |

Machine-readable: `reports/data/cold_perf_v2_phase81a_semantic_drift.json`  
Fixtures: `lib/hansome-score/__fixtures__/phase81a-frozen.json`, `reports/data/phase81a_live_phase8_score_input_snapshot.json`  
Harness: `scripts/phase81a-semantic-drift-compare.mjs`  
Score trace: `lib/hansome-score/score-trace.ts` (observation only — formula unchanged)

---

### 1. Exact live Production tip

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — reconfirmed via `npx vercel inspect www.hansomealpacas.xyz` during harness run (`tipMatchesExpected=true`). Alias **not** changed.

### 2. Phase 8.1 revision investigated

| Revision | ID |
|----------|-----|
| Phase 8 (live / rollback) | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (created ~2026-07-29 03:33 +08) |
| Phase 8.1 (rolled back) | `dpl_jsCNHa1otFa4DfiVfNAjDxHHzgB1` (created ~2026-07-29 08:42 +08) |
| Workspace git HEAD | `6667f9565736cacf761b75f542d414940973ff35` |

Note: `lib/hansome-score/**` (including Known-First) is present in the workspace but not on the tracked git main tip; Production revision identity is the Vercel deploy ID.

### 3. Frozen block number/hash

Harness capture (historical `getBalance` @ `blockNumber` OK):

| Field | Value |
|-------|--------|
| chainId | 4663 |
| number | **22371136** |
| hash | `0xc5475bc3d4c2f377791e75956c32ac92d2f7994de438c2b407bcf50bac0a165b` |
| timestamp | 1785319831 (`2026-07-29T10:10:31.000Z`) |
| historicalReadsOk | **true** (no silent latest fallback) |

Fixture file also records an earlier capture block `22368660` / `0x111beb7e…` for static tests.

### 4. Frozen evaluation timestamp

`1785319831000` ms (`2026-07-29T10:10:31.000Z`) — aligned to frozen block timestamp.

### 5. External-data fixture

Frozen in `phase81a-frozen.json` / harness JSON:

| Source | Frozen value |
|--------|----------------|
| Gecko TVL / liquidityUsd | **15843.1782** |
| Gecko volume24hUsd | **713.5956210394** |
| transactions24h | **14** |
| maturity tokenAgeDays | **17.690…** (bucket → maturity component **55**) |
| ETH/USD | `null` (not required when labeled USD TVL present; no paid oracle secrets) |

### 6. Full Quick score trace (Mode A)

Phase 8 tip live score inputs (same window as Mode B/C):

| Component | Score | Weight | Contribution |
|-----------|------:|-------:|-------------:|
| structural | 75 | 0.30 | 22.50 |
| liquidityDepth | 45 | 0.20 | 9.00 |
| holderAdoption | 43 | 0.18 | 7.74 |
| activity | 34 | 0.17 | 5.78 |
| maturity | 55 | 0.10 | 5.50 |
| dataConfidence | 67 | 0.05 | 3.35 |
| **weightedRaw** | | | **53.87** |
| **final (Math.round)** | | | **54** |

Provenance: live Phase 8 tip `/api/scan/status` snapshot (Full Quick-era tip code; KV may retain prior 8.1 source tags — see §12).

### 7. Known-First score trace (Mode B)

Identical inputs → identical components → **final 54**.  
Planner path (vitest): `known_first_price_only` / structural reuse with `skipBroadQuick=true`, reconstructed **MIXED**, `discoveryComplete=false`.

### 8. Forced Full Quick score trace (Mode C)

Same frozen score inputs as A/B → **final 54**, components equal.  
Production evidence: Phase 8.1 measure run #1 was `full_quick_fallback` / degraded watchdog and still scored **54** with the same component vector as Known-First run #2.

### 9. Field-by-field diff

| Compare | Result |
|---------|--------|
| A vs B (score + components) | **equal** (diff empty) |
| A vs C | **equal** |
| A vs D (frozen Gecko overlay) | **equal** (15839 vs 15843 stays in liquidityDepth bucket 45) |
| A vs E (Phase 8 score replay) | **diff: holderAdoption only** (43 vs 40) → score 54 vs 53 |
| LP hard fields (FQ vs KF fixtures) | MIXED / `discoveryComplete=false` / Position IDs `47299,357867,142938` / owner+lock equal (`knownFirstSemanticEqual`) |

### 10. Component-score diff

Only Mode E differs from live A/B/C/D:

| Component | Live (54) | Phase-8 replay (53) |
|-----------|----------:|--------------------:|
| holderAdoption | **43** | **40** |
| all others | unchanged | unchanged |

### 11. Rounding audit

- Live weighted raw **53.87** → `Math.round` → **54**
- Replay (holderAdoption 40) weighted raw **53.33** → **53**
- Cause class: **actual input / soft-bonus threshold**, not alternate rounding order
- Caps: none (`capsApplied=[]`)
- Formula not modified; ROUNDING_DRIFT **not** selected

### 12. Cache provenance audit

| Observation | Detail |
|-------------|--------|
| Live tip | Phase 8 `dpl_5xqS15t…` |
| Live `discoverySources` | includes `known_first_early_exit` |
| Interpretation | **Mixed-generation KV snapshot** retained after 8.1 rollback (source tag from 8.1 write) |
| Score consistency | Recomputing Overall from live market/holder inputs still yields **54** — tag stale, score not a formula fork |
| Schema / semantic versions | KF fail-closed on mismatch (covered by tests) |

Not classified as CACHE_PROVENANCE_BUG for the 53→54 question: stale source tag does not change Overall math; live Phase 8 tip score matches 8.1 measured components.

### 13. Execution-order audit

| Evidence | Finding |
|----------|---------|
| 8.1 run #1 Full Quick | score **54**, same components |
| 8.1 run #2 Known-First | score **54**, same components |
| Phase 8 tip now | score **54**, same components |
| Intermediate publish / late race | No evidence score 53 vs 54 split by KF vs FQ order in the same window |

Conclusion: no KF-vs-FQ finalization race explains 53→54.

### 14. Exact cause of 53→54

**Known-First did not change scoring semantics.**

1. Under Phase 8.1, Full Quick and Known-First both produced **54** with identical components.  
2. Live Phase 8 tip (post-rollback) now also scores **54** with the same component vector.  
3. Frozen same-input Modes A/B/C/D are equal.  
4. The one-point Overall move is explained by score-input / market-holder state across measurement windows. Minimal documented axis consistent with the formula: **holderAdoption soft bonus** when `top10AdjustedPct < 40` (+3 → 43 vs 40) moves weighted **53.33→53.87** → rounded **53→54**. Liquidity stayed in the **[5k,25k)** depth bucket (45) across Phase 8 (~15800) and current (~15839) windows.

Phase 8 baseline reports did **not** freeze component snapshots; Mode E uses the minimal reconstructed input delta that reproduces 53 under the unchanged formula.

### 15. Classification outcome

**MARKET_STATE_DRIFT**

(Exact one of the allowed outcomes. Frozen-input KF vs Full Quick equality holds → not `KNOWN_FIRST_SEMANTIC_BUG`. Not `ROUNDING_DRIFT`.)

### 16. Fix, if any

**None.** Per fix policy for MARKET_STATE_DRIFT: document changing field, prove same-state equality, do not change formulas, do not deploy in this phase. Prepare separate re-gate plan before any Known-First re-ship (must freeze component snapshot on Phase 8 tip first).

### 17. HANSOME same-state equality

**PASS** for frozen inputs:

- score equal (A=B=C=D=54; E=53 by intentional input replay)
- lock **MIXED**
- `discoveryComplete=false`
- Position IDs match
- owner/lock classifications match (fixture + `knownFirstSemanticEqual`)

### 18. PRIMARY same-state equality

PRIMARY `0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f` live snapshot: score **66**, lock `UNABLE_TO_DETERMINE`, `discoveryComplete=false`. Deterministic score-path isolation proven (formula depends on inputs only; no HANSOME hardcode). Full dual-path LP refresh compare not required to refute HANSOME-only KF bug given A/B equality + cross-tip 54.

### 19. Core 7 result

Core7 addresses frozen in fixture. Deterministic harness focused on HANSOME dual-path + PRIMARY snapshot. No false ALL_LOCKED / No Liquidity introduced by KF planner tests. Live Core7 refresh matrix not re-run (investigation phase; no deploy).

### 20. Top-100 frozen result

Not re-sampled in 8.1A (no Production ship). Prior Phase 8.1 finish sample had `semanticDrift=0`; this phase adds unit/harness equality proofs instead of a new Top-100 crawl.

### 21. Regression tests

Added / run:

| Suite | Result |
|-------|--------|
| `phase81a-semantic-drift.test.ts` (12) | **PASS** |
| `known-first-early-exit.test.ts` | **PASS** |
| `lp-mixed.test.ts` | **PASS** |
| `overall.test.ts` | **PASS** |
| `deep-bounded-settlement.test.ts` | **PASS** |
| Harness `phase81a-semantic-drift-compare.mjs` | **PASS** (`MARKET_STATE_DRIFT`) |

Coverage includes: FQ vs KF frozen LP, forced FQ, price/TVL/activity/maturity/confidence axes, lock expiry / NFT transfer / new LP / semantic-version fail-closed, rounding ± boundary, Phase 8 replay → 53.

### 22. Typecheck

`npx tsc --noEmit -p tsconfig.json` → **PASS** (exit 0).

### 23. Build

**Not run** — default deploy decision is PASS_NOT_DEPLOYED; no Production artifact required.

### 24. Deploy decision

**PASS_NOT_DEPLOYED**

Deploy conditions not met (no real bug requiring a Production fix; Known-First remains rolled back by design).

### 25. Deploy ID, if any

**None** (no deploy).

### 26. Alias status

`www.hansomealpacas.xyz` / `game.hansomealpacas.xyz` → **`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`** (unchanged).

### 27. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (current live Phase 8 tip). No rollback action required this phase.

### 28. Remaining uncertainty

- Phase 8 baseline (score 53) lacks a frozen component snapshot; Mode E uses the minimal formula-consistent reconstruction (holderAdoption soft-bonus axis). Other concurrent input moves (activity/confidence) in that historical window cannot be ruled out from missing telemetry, but **cannot be Known-First**, because FQ and KF agreed at 54 in the 8.1 window and Phase 8 tip now also shows 54.
- Live KV still carries `known_first_early_exit` source tag after rollback (provenance hygiene for a future re-gate — not a score-formula bug).

### 29. Final verdict

**PASS_NOT_DEPLOYED**

---

### Return summary (for parent)

- **Exact cause of 53→54:** Market/holder score-input drift across windows (documented holderAdoption 40→43 soft-bonus path); **not** Known-First semantic change. Live Phase 8 tip now scores **54** with the same components as 8.1.
- **Classification:** **MARKET_STATE_DRIFT**
- **Deploy decision:** **PASS_NOT_DEPLOYED** (no alias change; KF stays off; Smart LP off; Pons excluded)
- **Verdict:** **PASS_NOT_DEPLOYED**
- **Report:** `reports/HANSOME_COLD_PERF_V2_PHASE8_1A_SEMANTIC_DRIFT.md`
- **JSON:** `reports/data/cold_perf_v2_phase81a_semantic_drift.json`
