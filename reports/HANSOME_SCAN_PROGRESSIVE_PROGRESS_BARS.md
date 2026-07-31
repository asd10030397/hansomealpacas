# HANSOME — Honest Progressive Analysis Progress Bars

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Real Deep Analysis progress bars (no fake timers); live score/coverage display updates; EN/ZH copy |
| **Deployed** | **YES** — Production `dpl_HnybiUhsPuwWFi6ahcqbkunHwNZE` (see `HANSOME_SCAN_PROGRESSIVE_PROGRESS_BARS_PRODUCTION_SMOKE.md`) |
| **Overall pre-deploy verdict** | **PASS** (tests + typecheck); local `next build` prerender flaky (see below) |

---

## 1. Implementation summary

After Fast Scan returns, the provisional score remains visible. While Deep continues, a **Deep Analysis** panel (below the score summary / above Analysis Coverage) shows:

- Real overall workflow % (weighted module progress)
- Completed / total modules (6 architecture modules)
- Current active stage + Collecting / Retrying / Complete / Temporarily unavailable
- Per-module pixel progress bars with honest status copy
- ETA from existing stage estimate ceilings; otherwise “Time remaining varies by on-chain history.”

Scores, HANSOME Level, and Analysis Coverage update only when real polled Deep snapshots change. Numeric display may ease from old real → new real (`AnimatedRealNumber`); no fabricated intermediate score checkpoints.

**Progress ≠ Coverage:** workflow `%` is derived separately from `confidence.percent`.

**Unchanged:** score formulas, liquidity/burn/lock semantics, FOX dust materiality, HANSOME LP presentation, retry fencing (`deepAttemptId`), cache orchestration, scan-deep stage pipeline.

---

## 2. Changed files

| Path | Change |
|------|--------|
| `lib/hansome-score/analysis-progress.ts` | **New** — typed model + `deriveModuleProgress` / `deriveAnalysisProgress` / `calculateOverallWorkflowProgress` / monotonic helpers |
| `lib/hansome-score/analysis-progress-view.ts` | **New** — locale view model for panel copy |
| `lib/hansome-score/__tests__/analysis-progress.test.ts` | **New** — unit tests |
| `lib/hansome-score/__tests__/analysis-progress-view.test.ts` | **New** — component-contract / i18n tests |
| `components/scan/AnalysisProgressUI.tsx` | **New** — pixel bars + animated real numbers |
| `components/scan/ScanClient.tsx` | Wire panel below scores; live animated Overall / Structural / Coverage; compact bars in unfinished Deep sections |
| `content/i18n/types.ts` | Progress copy keys |
| `content/i18n/en.ts` | EN strings |
| `content/i18n/zh.ts` | ZH strings |
| `reports/HANSOME_SCAN_PROGRESSIVE_PROGRESS_BARS.md` | This report |

---

## 3. Progress derivation table (every module)

Weights (sum = 100): Structural 15 · Holders 15 · Liquidity 25 · Burn 15 · Creator 20 · Relationships 10.

| Module | Stage key | Primary real signals | Coarse / band rules |
|--------|-----------|----------------------|---------------------|
| **Contract / Structural** | `contract` | `contractRisk`, Fast `done` | pending 0/5 · analyzing 10 · evidence 25 · done **100** |
| **Holder** | `holders` | `topHolders`, `holdersCount`, concentration | same coarse map; Fast usually **100** |
| **Liquidity** | `liquidity` | pools/positions, `knownPositionsVerified`, lockDistribution, discovery/exhaustive flags | analyzing 10 → pools 25 → known 45 → lock 55 → discovery 80 → exhaustive 90; **cap &lt;100 until stage done** |
| **Burn** | `burn` | `burnActivity.pagesFetched` vs target 40; Fast `partial` = P0/P1 | Fast partial w/o pages → **25** collecting; pages → 25–90 band; done **100**; exhausted keeps last % |
| **Creator** | `creator` | `pagesFetched` / `transfersIndexed` / `paginationComplete` / `indexed` | pages → 25–90 band; done **100**; retry retains % |
| **Wallet Relationships** | `relationships` | stage + relationship signal evidence | analyzing 10 · evidence partial 40–60 · done **100** |

**Overall:** `sum(progress × weight) / 100`, capped at **99** until all modules `resolved`; then **100** (unavailable modules count as workflow-resolved but do **not** raise coverage).

**Monotonicity:** within the same `deepAttemptId`, UI never visibly decreases module/overall %; new generation (manual refresh) may reset.

**Not used for %:** elapsed-time alone, `confidence.percent` (coverage).

---

## 4. Test results

| Suite | Result |
|-------|--------|
| `analysis-progress` + `analysis-progress-view` | **PASS** |
| `scan-progress` | **PASS** |
| `scan-deep-reliability` | **PASS** |
| `scan-deep-retry-race` (fencing) | **PASS** |
| `scan-deep-stage-independence` | **PASS** |
| `heavy-token-ux` | **PASS** |
| `pool-materiality` + `lp-presentation` | **PASS** |
| Combined counted run | **69/69** (progress + reliability + LP set) |
| `npm run typecheck` | **PASS** |
| `npm run build` (local) | Compile + lint/types OK; **prerender failed** with `webpack-runtime` `Cannot read properties of undefined (reading 'call')` on `/scan` (matches prior “local build unreliable / use Vercel Production build as gate” practice) |

---

## 5. Textual UI evidence

Sample Fast + Deep collecting snapshot (derived, not timer-based):

```
Deep Analysis  43%  [Collecting]
2 / 6 modules completed
Analyzing Wallet Relationships…
- Contract Analysis: 100% — Complete
- Holder Analysis: 100% — Complete
- Liquidity Analysis: 10% — Collecting liquidity pools…
- Burn Analysis: 25% — Scanning burn history…
- Creator Analysis: 28% — Scanning creator history…
- Wallet Relationships: 10% — Tracing related wallets…
Coverage=48% (separate from progress 43%)
```

ZH:

```
深度分析  43%  [收集中]
已完成 2 / 6 個模組
正在分析 錢包關聯…
```

Placement: below Overall / Structural / HANSOME Level / Coverage cards; above Analysis Coverage breakdown. Compact bars also appear inside unfinished Liquidity / Burn / Creator sections.

---

## 6. Semantic confirmations

| Concern | Status |
|---------|--------|
| Score formulas unchanged | **Yes** — display-only transitions |
| Liquidity / burn / creator / holder / lock semantics unchanged | **Yes** |
| FOX dust materiality / no even USD split / no false ALL_LOCKED | **Untouched** (LP tests still PASS) |
| `deepAttemptId` fencing / monotonic retry | **Untouched** (retry-race PASS) |
| Progress vs Coverage separate | **Yes** — distinct fields; tests assert inequality |
| No fake timer-based percentages | **Yes** — stage + real work units only |

---

## 7. Deploy recommendation

**Recommend deploy to Production after approval**, then smoke:

- HANSOME, FOX, CASHCAT, PONS, TYGR
- Fast first → Deep progress advances on real stage/page/LP updates
- Scores/coverage update only on real snapshot changes
- Retryable partial stays Collecting; exhausted → Temporarily unavailable
- FOX one material pool (dust omitted); HANSOME LP + Lock Distribution intact
- No secrets exposed

**Gate:** Prefer Vercel Production build as compile gate (local prerender currently flaky).

---

## 8. Deploy status

**Deployed to Production** after explicit approval. Smoke report:

`reports/HANSOME_SCAN_PROGRESSIVE_PROGRESS_BARS_PRODUCTION_SMOKE.md`

PonsLaunchLocker was **not** included in this release.
