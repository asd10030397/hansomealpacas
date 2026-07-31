# HANSOME Scan — Stalled Progress + Gradual Progress Hotfix

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 / 2026-07-29 |
| **Primary token** | `0x57ffd85d9f0744b7790dcdbbc2c0f188f81de00f` (NBD / No Big Deal, chainId 4663) |
| **Scope** | Scan reliability + progress-reporting hotfix only |
| **Pre-deploy Production tip (rollback)** | `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR` |
| **Deployed** | *(filled post-gate)* |
| **Verdict** | *(filled post-gate)* |

---

## 1. Mission summary

Users observed Deep scan lasting >5 minutes with bars stuck near Liquidity **25%**, Burn **25%**, Creator **10%**, Wallet Relationships **10%**, then jumping. Fix makes progress reflect real backend work with gradual monotonic updates, timeouts/recovery, and durable KV progress — without changing scores, classifications, or risk semantics.

## 2. Root cause

**Primary:** Fast Scan stamps `liquidity` / `creator` / `relationships` as `analyzing` (burn `partial`) immediately, while Deep work is **sequential** (`relationships → liquidity → creatorBurn`). UI progress was derived from those Fast stamps using coarse bands (10/25), so bars looked “active” at fixed low % for the entire preceding stage budget.

**Secondary:** ScanResponse publishes were **milestone-only** (stage start/end, optional known-positions, one `creatorBurn:recent`). Transfer-index advanced page-by-page in KV, but the polled snapshot did not — especially during historical paging after recent-tier. Blockscout/RPC lacked request timeouts, so a hung upstream could sit until stage race / 6‑minute stale recovery.

## 3. Exact blocking operation (primary token)

| Observation | Detail |
|-------------|--------|
| Warm production peek | Already `complete` with creator/burn `pages=5`, relationships `done` |
| Forced `refresh=1` | Brief `deep_running` with **liquidity re-analyzing**; creator/burn remained done from checkpoint |
| Cold-stall pattern (user + code) | UI frozen at Fast coarse bands while Deep still on **relationships funder fan-out** and/or **liquidity multi-version probes** and/or **transfer-index pages before first Scan publish** |
| Blocking ops | `fetchNativeFunder` × sample; `detectMultiVersionLpIntelligence` (v2/v3/v4); `fetchTokenTransfersPaged` without mid Scan publishes |

Warm timeline artifact: `reports/data/stall_progress_prod_trace.json`.

## 4. Stall-condition checklist (25)

| # | Condition | Result |
|---|-----------|--------|
| 1 | RPC no timeout | **HIT** — fixed (`rpc.ts` / LP detect transport 20s) |
| 2 | Blockscout no timeout | **HIT** — fixed (12s + retries) |
| 3 | Retry loops unbounded | **MITIGATED** — bounded 3 attempts + backoff |
| 4 | Same cursor stuck | Not observed on NBD (5 pages); checkpoints preserved |
| 5 | Empty pages loop | Not observed |
| 6 | Checkpoint persist failures | Soft-fail overlay already present; preserved |
| 7 | KV deep lock | Existing ~300s; unchanged semantics |
| 8 | Transfer-index lock | Existing; resume path now emits `onPageProgress` |
| 9 | Background xfer no UI publish | **HIT** — mid-page Scan publishes on Deep path |
| 10 | Serverless isolate switch | **HIT** — `deepProgress` on KV snapshot |
| 11 | Stale polling overwrite | **HIT** — client ignores older `sequence` |
| 12 | Memory-only progress | **HIT** — durable `deepProgress` |
| 13 | Fast/Deep race coarse bands | **HIT** — sequential queue honesty |
| 14 | Continuous rebuild | Not forced; resume preferred |
| 15 | 429 storms | Retries with backoff on 429/5xx |
| 16 | Incomplete data honesty | Preserved (Incomplete/Partial/Unknown) |
| 17 | Large history | Gradual page %; asymptotic when unknown |
| 18 | Multi-pool LP silence | Probe progress callbacks |
| 19 | Wallet graph silence | Funder mid-publishes (throttled) |
| 20 | Creator genesis wait | Per-page + recent-tier publishes |
| 21 | Stale cache key | Refresh cooldown unchanged |
| 22 | Stage-weight-only % | Fixed — internal progress × weight |
| 23 | after() zombie deep_running | Watchdog 45s stall flag + existing 6m recover |
| 24 | No AbortSignal cancel | Timeout races remain; requests now abort via `AbortSignal.timeout` |
| 25 | Jump ≤25%→100% | Mid milestones + cap &lt;100 until done |

## 5. Progress model

```
overallProgress = Σ(moduleProgress × moduleWeight) / 100
```

- Module progress uses **internal** work units (funders, probes, pages), not “full stage weight on start”.
- Later Fast-stamped stages stay **queued** (low %) until pipeline focus reaches them.
- Unknown totals: asymptotic 1–95%; 95→100 only after stage/workflow finalize.
- Monotonic within `deepAttemptId`; never timer-fabricated %.

## 6. Durable progress record

`ScanResponse.deepProgress`:

| Field | Purpose |
|-------|---------|
| `sequence` | Monotonic publish version |
| `updatedAt` | Last real work publish (ISO) |
| `stage` | relationships / liquidity / creatorBurn / score / partial / complete |
| `action` | start / funder / probe_* / page_* / done / timeout / watchdog_stall |
| `completedUnits` / `totalUnits` | Real counters |
| `pagesFetched` / `transfersIndexed` | Transfer-index mirrors |
| `stalled` / `stallReason` | Honest watchdog |

Persisted via existing fenced KV snapshot writes. No secrets.

## 7. Polling

- `/api/scan/status` remains `Cache-Control: no-store`.
- Client ignores older `deepProgress.sequence` on same `deepAttemptId`.
- No WebSockets added.

## 8. Timeout / recovery / watchdog

| Layer | Behavior |
|-------|----------|
| Blockscout | 12s timeout, 3 attempts, exp backoff + jitter |
| RPC | 20s transport timeout |
| Stage budgets | Unchanged (rel 45s / creatorBurn 120s / liq 180s) |
| Progress watchdog | 45s no publish → `stalled` + UI stall copy; does **not** fake % |
| Stale deep | Existing 360s recovery → Partial/Incomplete |

## 9. UI

- Per-module real internal %; queued stages show waiting (not static 25%).
- Last progress update age + stall message after threshold.
- Index pages/transfers line retained.
- Creator Explainability tooltips/i18n left intact (only added progress stall keys).

## 10. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/deep-progress.ts` | **New** durable progress helpers |
| `lib/hansome-score/types.ts` | `DeepProgressMeta` on ScanResponse |
| `lib/hansome-score/analysis-progress.ts` | Sequential honesty + unit-based % |
| `lib/hansome-score/scan-deep.ts` | Mid-stage / per-page publishes |
| `lib/hansome-score/transfer-index/paging.ts` | `onPageProgress` |
| `lib/hansome-score/blockscout.ts` | Timeout + bounded retries |
| `lib/hansome-score/rpc.ts` / `lp/detect.ts` | RPC timeout |
| `lib/hansome-score/lp/multi.ts` | Probe progress callback |
| `lib/hansome-score/lp/detect.ts` | `onVersionProbeProgress` |
| `lib/hansome-score/scan-cache.ts` | 45s stall watchdog stamp |
| `components/scan/AnalysisProgressUI.tsx` | Stall / last-update lines |
| `components/scan/ScanClient.tsx` | Sequence guard + stall wiring |
| `content/i18n/{en,zh,types}.ts` | Stall/last-update copy |
| `lib/hansome-score/__tests__/scan-stalled-progress-hotfix.test.ts` | 22 cases |
| `scripts/_tmp-stall-progress-prod-trace.mjs` | Production timeline tracer |

## 11–16. Tests / typecheck / build

| Gate | Result |
|------|--------|
| Hotfix 22 cases | **PASS** |
| analysis-progress / view / scan-progress | **PASS** |
| scan-deep reliability / retry-race / stage-independence | **PASS** |
| transfer-index recent-first / checkpoint / reuse | **PASS** |
| creator / holder / burn / supply-burn / contract-cache / LP | **PASS** |
| `npm run typecheck` | **PASS** |
| Game visual smoke | **PASS** (pre-deploy) |
| Website Analytics smoke | *(filled)* |
| Vercel Production build | *(filled)* |

## 17. Pre-deploy tip (rollback target)

`dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR`

(Recorded live via `vercel inspect www.hansomealpacas.xyz` immediately before deploy. Tip had already moved past earlier analytics/holder/visual ships.)

## 18. Deploy ID

*(filled)*

## 19. Production progress sequence (primary token)

*(filled from post-deploy instrumentation)*

## 20. Semantic regression

Forbidden scoring/classification/risk paths untouched. Top100 hard-field compare filled post-deploy.

## 21. PonsLaunchLocker

Still vercelignored — **not** in this release.

## 22. Secrets

No secrets in progress records, logs, or report artifacts.

## 23. Post-deploy smoke checklist

- [ ] Uncached Deep primary token + progress sequence capture
- [ ] Second scan checkpoint reuse
- [ ] Core 7 tokens
- [ ] 20 Top100 sample semantic
- [ ] Analytics + game healthy

## 24. Rollback

On freeze / decrease / stale overwrite / semantic change / false Complete / low→100 jump → alias back to `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR`.

## 25–29. Verdict fields

| # | Field | Value |
|---|-------|--------|
| 25 | Blocking cause identified | **YES** |
| 26 | Gradual intermediate progress | **YES** (implementation + tests; prod sequence post-deploy) |
| 27 | Watchdog + timeout/retry | **YES** |
| 28 | Checkpoint resume preserved | **YES** |
| 29 | Overall verdict | *(PASS_DEPLOYED / PASS_NOT_DEPLOYED / NEEDS_REVIEW)* |
