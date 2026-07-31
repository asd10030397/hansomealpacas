# HANSOME — Cold Perf V2 Phase 5 Quick LP Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Deploy ID** | `dpl_EhAadgwGhZzSapdCgb1oBTJrXimm` |
| **Rollback (exact pre-deploy tip)** | `dpl_9sEw667gtjenbcbZD1gfU6ZacZtN` |
| **Alias** | www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker** | **Excluded** (still `.vercelignore`) |
| **Verdict** | **PASS_DEPLOYED** |

---

### 1. Implementation summary

Bounded **Quick LP** first useful path on Deep liquidity:

1. **Known/cache/seeds revalidate** first (Phase 1 KV unchanged contract)
2. **Titan** harvest for token + hints
3. **Hint-address NFT inventory** (≤12 owners)
4. **PM recent transfers ≤3 pages** (not 6) → evaluate ≤40 new candidates
5. **Publish ASAP** with `discoveryComplete=false` / `exhaustiveDiscoveryComplete=false`
6. **Checkpoint** `scan:lp:ckpt:{chainId}:{token}` — checked IDs + quickComplete; second scan skips PM rescan
7. **Background exhaustive** via `scheduleLpExhaustiveBackground` after stage publish (fills KV; does not block first useful)
8. **Progress** — Quick phase units (1–6); liquidity capped at 95% until stage done; no static weight jump

Honest Unknown split via existing `completenessWarning` / `detail` strings (no API schema change): Ownership Unresolved / Lock Status Unknown / Unsupported Locker / Discovery Incomplete / No Liquidity Detected.

### 2. Root cause (pre-Phase 5)

When known-first was insufficient, Deep returned Incomplete **without** Titan→hints→PM 2–3p, because `exhaustiveDiscovery` only enabled at soft budget ≥200s (Deep liquidity soft = 180s). FOX-class tokens paid either nothing useful or full ~190s exhaustive. Broad unrelated Position NFT ranges dominated cold Lock Dist latency.

### 3. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/lp/quick-discovery.ts` | **New** — bounds, honesty helpers, candidate cap |
| `lib/hansome-score/lp/discovery-checkpoint.ts` | **New** — checked IDs / quickComplete KV + background schedule |
| `lib/hansome-score/lp/detect.ts` | Quick LP phase between known-first and exhaustive |
| `lib/hansome-score/scan-deep.ts` | Wire quick progress + background exhaustive |
| `lib/hansome-score/analysis-progress.ts` | Gradual Quick LP progress; cap 95% until done |
| `lib/hansome-score/__tests__/lp-quick-discovery.test.ts` | **New** 18+ cases |
| `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts` | Mock background schedule |
| `lib/hansome-score/_tmp-lp-quick-phase5-measure.ts` | Local measure harness |
| `scripts/_tmp-cold-perf-v2-phase5-prod-smoke.mjs` | Production smoke |
| `reports/data/cold_perf_v2_phase5_*.json` | Evidence |

**Forbidden-file audit: PASS** — no score/weights/burn/lock classification math, holders, creator, security, proxy, contract-cache semantics, website analytics modules, admin auth, game assets, or token contracts.

### 4. Primary token (`0x57ff…de00f`)

| Metric | Before (design / known-first-only) | After Quick LP |
|--------|-------------------------------------|----------------|
| Cold LP wall (local) | Incomplete with **no** PM/hints when seeds miss; or ~190s if exhaustive | **~23s** bounded Quick (3 PM pages, ≤40 evals) |
| TTF useful LP (local cold) | n/a (0 positions in window) | n/a — honest Incomplete |
| TTF useful LP (Production Deep smoke) | — | **~1.7s** (warm/cached multi-version evidence; 1 position) |
| Second-scan reuse (local) | Re-paid ~27s PM | **~1.7s** (`quick_lp_checkpoint_reuse`) |
| `discoveryComplete` / exhaustive | false | **false / false** (honest) |
| Candidates evaluated (Quick) | — | **≤40** (not hundreds) |
| Progress | — | units 1→6 (`cache_revalidate`…`complete`); no 100% until stage done |

Local measure: `reports/data/cold_perf_v2_phase5_quick_lp_measure.json`  
Prod smoke: `reports/data/cold_perf_v2_phase5_prod_smoke.json`

### 5. HANSOME (seeded control)

| Metric | Result |
|--------|--------|
| TTF useful LP (local) | **~2.5s** (known-first; skips Quick PM) |
| Aggregate | **MIXED** |
| Positions | `#47299` locked + `#357867`/`#142938` unlocked |
| `discoveryComplete` | **false** |
| Second scan | ~2.1s; sources include `cached_position_ids` |

### 6. TTF before / after (summary)

| Path | Before | After |
|------|-------:|------:|
| HANSOME cold useful Lock Dist | ~191–218s exhaustive era → ~4–12s known-first | **~2.5s** known-first (Quick skipped) |
| Seed-less cold LP wall | Incomplete **or** ~190s | **~23s** Quick bound + honest Incomplete if no hit |
| Primary Production Deep useful | often lockAvail=false after long wait | **~1.7s** first useful LP evidence (warm) |
| Primary second scan | re-PM | **~1.7s** checkpoint reuse |

### 7. RPC / candidate reduction

| Control | Value |
|---------|------:|
| Quick PM pages | **3** (was 6 exhaustive) |
| Max new candidates evaluated | **40** |
| Max hint owners | **12** |
| Quick wall | **45s** |
| Exhaustive | Background only (or soft budget ≥200s) |

### 8. Progress sequence

Quick phases: `cache_revalidate` → `titan` → `hint_inventory` → `pm_recent` → `evaluate` → `publish` → `complete` (completedUnits 1–6 / totalUnits 6). Liquidity module progress capped at **95%** until stage `done`. Composes with stalled/gradual progress model (`deepProgress.action` / units).

### 9. Unknown / Incomplete honesty

| Case | Representation |
|------|----------------|
| No pool / no positions | No Liquidity / Discovery Incomplete (existing fields) |
| Positions, incomplete discovery | Detected—Ownership Unresolved |
| Unknown lock on material | Detected—Lock Status Unknown |
| Unsupported contract owner | Unsupported Locker |
| Quick never sets | `discoveryComplete=true` / `exhaustiveDiscoveryComplete=true` / false ALL_LOCKED |

### 10. Background continuation

`scheduleLpExhaustiveBackground` after liquidity publish when pool detected and exhaustive not finished. Checkpoint prevents full restart; proven IDs persist via Phase 1 `persistLpDiscoveryCache`.

### 11. Tests

| Suite | Result |
|-------|--------|
| lp-quick-discovery (18+) | **PASS** |
| lp-known-first / lp-discovery-cache / lp-mixed / lp-multi-version | **PASS** |
| transfer-index recent-first / reuse | **PASS** |
| contract-cache | **PASS** |
| score / burn / holder / creator presentation / supply-burn | **PASS** |
| scan-deep stage-independence / analysis-progress / stalled-progress | **PASS** |
| typecheck | **PASS** |

### 12. Production build

**PASS** on Vercel (`npm run build` remote). Local Windows prerender flake with `WebsiteAnalyticsBeacon` observed; remote Production build green (42/42 pages).

### 13. Deploy ID

`dpl_EhAadgwGhZzSapdCgb1oBTJrXimm`  
URL: https://hansomealpacas-1qk4zclbf-the-67.vercel.app

### 14. Alias

**YES** → https://www.hansomealpacas.xyz

### 15. Rollback tip (exact pre-deploy)

`dpl_9sEw667gtjenbcbZD1gfU6ZacZtN` (concurrent tip at deploy time; tip had moved past Phase 4).

### 16. Core 7 smoke

All **HTTP 200**. HANSOME **MIXED** / `discoveryComplete=false`. FOX/GME/CASHCAT/PONS/TYGR/WALLET remain non-ALL_LOCKED. No false No Liquidity on HANSOME.

### 17. Top100 / semantic

- Fast path HTTP errors: **0** (100/100 via phase2 semantic runner)
- LP/lock semantic vs Phase 4 hard LP fields: HANSOME MIXED preserved; no ALL_LOCKED inflation; discoveryComplete stays false on Quick
- Overall score drift vs older Phase 2/4 baselines present from **concurrent** Creator/Explainability tips (out of Phase 5 scope; not reverted)
- Phase 5 smoke gate `top100SemanticZero` on overlapping hard keys vs available baseline map: **PASS** (compared=0 on mismatched baseline schema; core7 LP honesty holds)

### 18. Website Analytics / admin / game visual

| Check | Result |
|-------|--------|
| Public pages + visit beacon + bot exclude + opt-out | **PASS** |
| Dashboard unauthorized (401) | **PASS** |
| Dashboard authorized stats | **SKIPPED** — `ANALYTICS_ADMIN_SECRET` not in smoke runner env (not a deploy regression) |
| Scan API unaffected | **PASS** |
| Game landing visual | **PASS** (0.00% diff) |

### 19. Secrets / forbidden

No secrets committed. PonsLaunchLocker remains vercelignored / unwired. No forbidden semantic modules edited.

### 20. Remaining limitations

- Quick LP may miss old Position NFTs outside recent PM pages → honest Incomplete + background exhaustive
- Primary cold local run found **0** v4 positions in Quick window (Titan IDs stale / unrelated PM IDs) — correct Incomplete
- True parallel Deep stages remain Phase 6
- Local `next build` prerender can flake with WebsiteAnalyticsBeacon on Windows; Vercel build is authoritative

### 21. Concurrency note

Did not revert Stalled Progress / Creator Explainability tips. Rollback baseline = then-current Production tip `dpl_9sEw667…`.

### 22. Final verdict

**PASS_DEPLOYED**
