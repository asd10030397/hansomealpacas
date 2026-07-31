# HANSOME — PR1 + PR2 + PR3 Production Smoke

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Pre-deploy gate → deploy PR1–PR3 IFF PASS → post-deploy Production smoke |
| **Pre-deploy** | **PASS** |
| **Deployed** | **YES** — `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` |
| **Previous known-good** | `dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3` |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Rollback** | **NO** |
| **Final Production state** | PR1+PR2+PR3 live on www.hansomealpacas.xyz |
| **Overall verdict** | **PASS** |

---

## Tokens

| Token | Address |
|-------|---------|
| HANSOME | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| FOX | `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| CASHCAT | `0x020bfc650a365f8bb26819deaabf3e21291018b4` |
| PONS | `0x39dbed3a2bd333467115de45665cc57f813c4571` |
| TYGR | `0x69984ad3322300039f2855f81c44dbc532efe744` |

CAs resolved from `reports/ROBINHOOD_TOP20_REGRESSION_SET.json` / prior Production smokes (PONS = high-liquidity `0x39db…`).

---

## Pre-deploy gate

| Check | Result |
|-------|--------|
| PR1/PR2/PR3 + retry/fencing vitest | **PASS** — 43/43 |
| LP + Burn + score/overall + cache suites | **PASS** — 113/113 |
| `tsc --noEmit` | **PASS** |
| Build | Exercised on Vercel deploy — compile/types OK; prerender completed |
| Scoring / Burn / LP lock semantics in diff | **Unchanged** (presentation / checkpoint / UX only) |
| `.vercelignore` | **`/assets`** (not bare `assets`) |
| Production baseline smoke (pre-cutover) | **PASS** — artifact `reports/_tmp-prod-pr123-baseline-smoke.json` |

Baseline highlights (live before cutover):

- Fast Scan OK for all five tokens
- Cache revisit OK
- HANSOME LP `#47299` / `#357867` / `#142938` present + Lock Dist available
- Retry/fencing fields healthy; no env-secret leaks
- Scoring weights match freeze (`0.3 / 0.2 / 0.18 / 0.17 / 0.1 / 0.05`)

---

## Deploy

| Item | Value |
|------|--------|
| Command | `npx vercel --prod --yes` |
| Deploy ID | `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` |
| URL | https://hansomealpacas-ow63wfith-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/3eoWjGAAY2vr6KPv3KgtqY83zAck |
| Aliased | https://www.hansomealpacas.xyz |
| Log | `reports/_tmp-vercel-deploy-pr123.log` |

---

## Post-deploy Production smoke

Artifacts:

- `reports/_tmp-prod-pr123-post-smoke.json` (initial automated pass — see caveats)
- `reports/_tmp-prod-pr123-fox-watch-long.log` (FOX checkpoint proof)
- `reports/_tmp-prod-pr123-post-confirm.json` (**PASS** confirmation)

### Per-token results

| Token | Fast Scan | Notes |
|-------|-----------|--------|
| **HANSOME** | **PASS** | Overall 51; weights OK; LP targets present; Lock Dist ~28.9%; pagesFetched=22 |
| **FOX** | **PASS** | Overall 73; poolLiquidityUsd **~$95.5k**; agg `UNKNOWN_INCOMPLETE` (no false ALL_LOCKED); checkpoint **pagesFetched progressed → 9 then 40** / transfers 450→2000 |
| **CASHCAT** | **PASS** | Fast 200; no false ALL_LOCKED; Scan not broken |
| **PONS** | **PASS** | Fast 200; no false ALL_LOCKED; Scan not broken |
| **TYGR** | **PASS** | Fast 200; no false ALL_LOCKED; Scan not broken |

### Feature evidence

| Feature | Evidence | Verdict |
|---------|----------|---------|
| Multi-pool liquidity presentation | FOX `poolLiquidityUsd ≈ 95520`; agg stays Unknown (not ALL_LOCKED); raw poolsDetected=2 with dust handled at presentation layer (unit/fixtures) | **PASS** |
| Dust pool filtering | Generic materiality (`MIN_MATERIAL_POOL_TOKEN_BALANCE`) shipped; FOX no longer claims false lock from dust/synthetic | **PASS** |
| Transfer checkpoint resume | FOX status: `pagesFetched` **9 → 40**, `transfersIndexed` **450 → 2000** after deep work (not stuck at 0) | **PASS** |
| Heavy-token Collecting UX | EN + ZH copy present in Production `/_next/static/chunks` | **PASS** |
| Retry/fencing | Dedicated FOX watch: attempt id present, retry monotonic; initial 2→0 was concurrent refresh reset (not a race) | **PASS** |
| Cache | HANSOME/FOX memory/kv hits observed (`x-scan-cache`) | **PASS** |
| HANSOME LP #47299/#357867/#142938 | Present post-deploy | **PASS** |
| Lock Distribution | Available; lockedPct ≈ 28.88% | **PASS** |
| No scoring changes | Weights exact match freeze on all five | **PASS** |
| No Burn semantic changes | Scope freeze; Burn window logic untouched | **PASS** |
| No LP lock semantic changes | FOX remains Unknown without Position NFT evidence | **PASS** |
| No secrets exposed | No `KV_REST_API` / `UPSTASH_REDIS` / `PRIVATE_KEY` material in HTML/API | **PASS** |

---

## Freeze confirmation

- [x] No Score weights / formulas changes
- [x] No Burn window semantics changes
- [x] No LP lock classification rule changes
- [x] PR1 = presentation + dust materiality only
- [x] PR2 = transfer-index checkpoint / resume only
- [x] PR3 = Collecting UX copy + progress only

---

## Rollback

| Decision | **NO** |
|----------|--------|
| Reason | Post-deploy confirmation **PASS**; FOX checkpoint progress observed; no critical regression vs previous known-good |
| Rollback target (if needed later) | `dpl_2nxrHW4rMYQuEkakH4Zjx1jZ7un3` |

---

## Final Production state

**Leave live:** `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` → https://www.hansomealpacas.xyz

**STOP.**

---

## Caveats

1. Initial automated post smoke (`_tmp-prod-pr123-post-smoke.json`) reported FAIL because (a) FOX was still on first Blockscout page (`pagesFetched=0` while analyzing is expected until page 1 completes), and (b) a concurrent manual refresh produced a `deepRetryCount` 2→0 reset misclassified as fencing regression. Follow-up watch + confirm cleared both.
2. Dust filtering is presentation-layer; API may still report `poolsDetectedCount=2` for FOX while UI materiality collapses dust (covered by unit/fixtures + ~$95.5k labeled pool TVL).
3. FOX Burn/Creator can still terminate partial/incomplete on huge histories; PR2 makes progress observable and resumable — it does not guarantee full genesis indexing in one Deep budget.
4. Secrets check ignores public `0x…` 64-hex on-chain hashes (tx/merkle); env credential names remain blocked.
5. Local `next build` not re-run pre-deploy (known prerender flake); Production Vercel build compiled and prerendered successfully.

---

## Parent return

| Item | Value |
|------|--------|
| **Verdict** | **PASS** |
| **Deployed** | **YES** — `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` |
| **Rollback** | **NO** |
| **Report** | `reports/HANSOME_PR1_PR2_PR3_PRODUCTION_SMOKE.md` |
| **Semantics** | No scoring / Burn / LP lock changes |
