# HANSOME Score — Deep Scan Reliability

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deep timeout / stale recovery · progressive stage UX · invalid CA → 400 · `after()` investigation |
| **Deployed** | **No** |
| **Verdict** | **PASS** (code + unit tests; production deep finalize still needs post-deploy smoke) |

---

## Verdict

**PASS** — Deep no longer can remain `deep_running` indefinitely in KV; Fast Scan is preserved; stages can settle to temporarily unavailable; invalid CA returns **400**; `maxDuration` / progressive enrich address the production smoke hang.

Remaining residual risk: cold Deep for heavy tokens (LP ~190s + creator ~106s) can still hit the 270s soft budget and finish as **partial** rather than full complete — by design, with retry via Refresh.

---

## Max timeout values chosen

| Constant | Value | Role |
|----------|------:|------|
| `/api/scan` + `/api/scan/status` `maxDuration` | **300 s** | Vercel serverless / `after()` ceiling (was 60s — killed Deep) |
| `DEEP_SCAN_MAX_EXECUTION_MS` | **270_000** (4.5 min) | Soft deadline inside `after()`; leave buffer under 300s |
| `DEEP_STALE_THRESHOLD_MS` | **360_000** (6 min) | Zombie `deep_running` recovery if isolate died without finalize |
| `SCAN_DEEP_LOCK_TTL_SEC` | **300** | Deep lock covers max execution (was 90s — too short) |
| Stage budgets | rel **45s** · creator/burn **120s** · liquidity **180s** | Soft per-stage; global deadline wins |

---

## Invalid CA status code

| Check | Result |
|-------|--------|
| `assertValidTokenAddress` / `getCachedScan` | Throws `Invalid token address` before viem `getAddress` path |
| `/api/scan` GET/POST | Maps invalid-address messages → **HTTP 400** |
| `/api/scan/status` | Same → **HTTP 400** |
| Unit coverage | `scan-deep-reliability.test.ts` |

---

## Root cause: `after()` / stale `deep_running`

### What production smoke saw

- Fast Scan OK (~8–10s); status stayed `deep_running` with liquidity/creator/relationships `analyzing` for **≥15–17 min**.
- KV kept the Fast snapshot; Deep never finalized.

### Why

1. **`maxDuration = 60`** on `/api/scan` and `/api/scan/status` bounded Next.js `after()` work. Deep cold wall time is ~**300s** (latency audit) → isolate terminated mid-Deep.
2. **Monolithic `scanToken()`** re-ran the whole Fast wave inside Deep, wasting the short `after()` window before LP/creator.
3. **No progressive persist** — stages stayed `analyzing` until a single all-or-nothing write that never happened.
4. **No stale recovery** — after termination, memory `inflight` vanished but KV still said `deep_running` forever.
5. **Status nudge** used fire-and-forget `scheduleDeepAnalysis` without always wrapping in `after()`, so follow-up polls often could not keep the isolate alive.
6. **Deep lock TTL 90s** expired while Deep was still meant to run, allowing conflicting workers.

### Dominant bottlenecks (from `HANSOME_SCAN_LATENCY_AUDIT.md`)

| Rank | Stage | ~ms (HANSOME cold) |
|-----:|-------|-------------------:|
| 1 | Uniswap multi-version LP discovery | ~191_000 |
| 2 | Creator transfer pagination (≤40 pages) | ~106_000 |
| 3 | Holder funding / relationships | ~5_000–12_000 |
| 4 | Wave1 Blockscout / market (Fast path) | ~6_000 |

Deep now **skips redoing Fast wave1** via `enrichScanDeep` and persists after each stage.

---

## What shipped (code)

1. **`lib/hansome-score/scan-deep.ts`** — progressive enrich (relationships → creator/burn → liquidity → score), stage budgets, `markScanPartial`, `isDeepStale`, instrumentation logs `[scan-deep]`.
2. **`lib/hansome-score/scan-cache.ts`** — wire progressive Deep; `recoverStaleDeepIfNeeded`; longer deep lock; never leave terminal job as `deep_running`; Refresh re-arms `partial` for retry.
3. **API routes** — `maxDuration = 300`; invalid CA → 400; status always `after(ensureDeepAnalysis)` when Deep still in progress.
4. **UX** — stage strip shows ✓ / analyzing / temporarily unavailable; `partial` stops endless “Analyzing” poll; Fast body remains visible.
5. **Tests** — stale recovery, invalid CA, partial markers, existing Fast/cache tests green (15/15 in touched suites).
6. **Typecheck** — clean for touched areas.

### Scoring formulas

**Unchanged.** Progressive path recomputes Structural/Overall with the same helpers and available inputs only.

---

## Measurements (this session)

| Item | Result |
|------|--------|
| Unit: stale recovery → `partial`, Fast score preserved | **PASS** |
| Unit: invalid CA throw / 400 mapping | **PASS** |
| Unit: Fast cold path still returns provisional without awaiting Deep | **PASS** |
| `tsc --noEmit` | **PASS** |
| Production re-smoke after deploy | **Not run** (deploy not requested) |

---

## Remaining risks

1. Tokens where LP + creator exceed **270s** will settle **partial** until Refresh — honest UX, not stuck Analyzing.
2. Cross-isolate Deep still depends on KV + status `after()` nudges; Pro plan `maxDuration` 300 required.
3. Hung in-process promises past stale threshold no longer block recovery, but cannot be forcibly aborted (JS); later completion may overwrite `partial` with `complete` (acceptable upgrade).
4. Homepage hero CTA may be touched by another agent — intentionally avoided here.

---

## Files changed

- `lib/hansome-score/scan-deep.ts` *(new)*
- `lib/hansome-score/scan-cache.ts`
- `lib/hansome-score/scan-fast.ts`
- `lib/hansome-score/types.ts`
- `lib/hansome-score/index.ts`
- `app/api/scan/route.ts`
- `app/api/scan/status/route.ts`
- `components/scan/ScanClient.tsx`
- `content/i18n/en.ts` / `zh.ts` / `types.ts`
- `lib/hansome-score/__tests__/scan-deep-reliability.test.ts` *(new)*
- `lib/hansome-score/__tests__/scan-cache.test.ts`
- `lib/hansome-score/__tests__/scan-fast.test.ts`
- `reports/HANSOME_DEEP_SCAN_RELIABILITY.md` *(this file)*

---

## Deployed?

**No.** User did not request deploy. Recommend production smoke after deploy: cold HANSOME Fast TTFR, status progressive stages, Deep complete or honest `partial` within ~6 min, invalid CA → **400**.
