# HANSOME Score — Production LP Orchestration Fix Smoke

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Deploy LP orchestration fix only (`scan-deep.ts` stage independence + liquidity before/independent of creatorBurn); focused HANSOME Production smoke |
| **Deploy ID** | `dpl_HoBjGmsJiyzjnAdT8TSfnbMWGhdg` |
| **Deployment URL** | https://hansomealpacas-lk3cxxdda-the-67.vercel.app |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Inspect** | https://vercel.com/the-67/hansomealpacas/HoBjGmsJiyzjnAdT8TSfnbMWGhdg |
| **PASS / FAIL** | **PASS** |
| **GO / NO-GO** | **GO** |

---

## Pre-deploy / Deploy

| Check | Result |
|-------|--------|
| Code changes before deploy | **None** — deployed current working tree as-is |
| Command | `npx vercel --prod --yes` |
| Build | Next.js 15.5.20 — `/api/scan`, `/api/scan/status`, `/scan`, `/scan/[address]` present |
| Aliased | https://www.hansomealpacas.xyz |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Production) | **Present** (Encrypted) |
| Runtime `X-Scan-KV` | **`1`** (`cache.kvConfigured=true`) |

Secret values were not printed.

### Fix included

1. Soft-fail relationships / creatorBurn / liquidity independently (no cross-stage abort).
2. Deep order: **relationships → liquidity (known-first) → creatorBurn**.
3. Honest terminal `partial` when stages remain unresolved; preserve completed LP / Lock Dist.
4. Scoring formulas/weights unchanged.

---

## Timings table (HANSOME `0x2C38…0875`)

| Metric | Value |
|--------|------:|
| Fast TTFR (warm / memory) | **453 ms** |
| Time to Lock Distribution **first appears** | **217,801 ms (~3.63 min)** |
| Time to known positions verified | **217,801 ms** |
| Time to all three target positions | **217,801 ms** |
| Locked USD / % | **$4,639.15 / 28.88%** |
| Unlocked USD / % | **$11,422.05 / 71.12%** |
| Pool liquidity USD | **$15,986.43** |
| Total position USD | **$16,061.20** |
| Reconciled with pool | **true** (`token_amounts`) |
| Positions #47299 / #357867 / #142938 | **Y** (all three) |
| Progressive Deep done-count (peak) | **4 / 7** |
| Final Deep state | **`partial`**, `deepInflight=false` (cleared after terminal) |
| Liquidity stage at Lock Dist first appear | **`analyzing`** (creator still `analyzing`, burn `partial`) |
| Final liquidity / creator / burn | **`partial` / `partial` / `partial`** |
| Cached revisit | **273 ms**, `hit=true`, `source=memory`, `kvConfigured=true` |
| Overall / Structural | **51 / 75** (provisional; creator_behaviour incomplete) |
| KV | **on** (`X-Scan-KV: 1`) |

Weights observed unchanged: structural **0.3** / liquidityDepth **0.2** / holderAdoption **0.18** / activity **0.17** / maturity **0.1** / dataConfidence **0.05**.

Raw artifact: `reports/_tmp-prod-lp-orch-smoke.json`.

---

## Checklist vs approval criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Fast Scan available normally | **PASS** — HTTP 200, TTFR 453 ms, Fast phase, KV on |
| 2 | Progressive Deep UI continues updating | **PASS** — stages/done-count progressed during poll (`4/7`; liquidity/creator/burn transitioned) |
| 3 | Liquidity runs even if Creator/Burn times out | **PASS** — Lock Dist published at ~218s while **creator still `analyzing`** and burn already `partial` |
| 4 | Positions #47299, #357867, #142938 | **PASS** — all three present |
| 5 | Actual Production time until Lock Dist first appears | **PASS** — **217.8 s** measured |
| 6 | Locked USD / % and Unlocked USD / % | **PASS** — locked $4,639.15 (28.88%); unlocked $11,422.05 (71.12%) |
| 7 | Reconciliation with current pool liquidity | **PASS** — `reconciledWithPool=true` |
| 8 | Creator/Burn partial does not remove completed Liquidity data | **PASS** — Lock Dist + positions remained available through creator/burn `partial` and terminal `partial` |
| 9 | Cached revisit remains fast | **PASS** — 273 ms memory hit |
| 10 | Deep reaches complete or honest partial — never indefinitely analyzing | **PASS** — terminal `partial`; `deepInflight` cleared to `false` |
| 11 | Scoring formulas/weights unchanged | **PASS** — live weights match documented Overall blend |
| 12 | No secrets exposed | **PASS** — no KV/Upstash/private-key material in `/scan`, `/`, or scan JSON |

---

## Independence evidence (critical)

At first Lock Dist publish (`t≈217.8s`):

- `liquidity`: still `analyzing` (known-first progressive publish)
- `creator`: `analyzing`
- `burn`: `partial`
- `lockDistribution.available`: **true**
- `knownPositionsVerified`: **true**
- positions: **47299, 357867, 142938**

Later, creator/burn settled `partial` while Lock Dist stayed available — proving liquidity is no longer gated on creatorBurn timeout early-return (the prior Production failure mode).

Other-token cross-check: **not required** — HANSOME alone confirmed independence under creator/burn timeout pressure.

---

## Verdict

**PASS** · **GO**

LP orchestration fix is live on Production. Lock Distribution, known positions, locked/unlocked economics, and pool reconciliation all observed. Fast Scan, KV, cache revisit, secrets, and scoring remain healthy. Production stays live.

### Notes / caveats

1. Production time-to-Lock-Dist (~3.6 min) is slower than local known-first measure (~30s) under refresh load / RPC contention, but Lock Dist **did** appear independently of creatorBurn.
2. Liquidity stage may finish as honest `partial` when exhaustive discovery does not complete; known-first Lock Dist remains published.
3. No Explore / Analytics / Just Launched / Week 2B / unrelated feature work performed.
4. No further code changes after deploy.

### Critical production break?

**None.** Lock Dist succeeded as expected — **STOP**. Production left live. No further feature work.

---

## Confirmations

- [x] Deployed to Production (`dpl_HoBjGmsJiyzjnAdT8TSfnbMWGhdg`)
- [x] KV verified on Production + runtime (`X-Scan-KV: 1`)
- [x] No additional code changes before/after deploy for this task
- [x] Focused HANSOME Production smoke only
- [x] Scoring formulas unchanged
- [x] Secrets not exposed client-side
- [x] No unrelated features started
- [x] STOP after Lock Dist success — Production remains live
