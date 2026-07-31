# HANSOME Scan — Phase 10C-4 Isolated Candidate Cache and Deterministic LP Publish

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Implementation + remote candidate gate (no promote without hard gates) |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **NPM tokenId** | `436637` |
| **Approved locker** | PonsLaunchLocker `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| **Chain** | Robinhood Chain `4663` |
| **Baseline / rollback tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Previous 10C-3 candidate** | `dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf` |
| **Best-proven 10C-4 candidate** | `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` |
| **Latest 10C-4 candidate tip** | `dpl_CHxTptrbHEYyC97Kg9GdJyDjjNVy` |
| **Final www/game tip** | **unchanged** — `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

## 1. Baseline tip

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`hansomealpacas-n6zq9i37h-the-67.vercel.app`).

Aliases after gate restore: `www.hansomealpacas.xyz`, `hansomealpacas.xyz`, `game.hansomealpacas.xyz`, `hansomealpacas.vercel.app` → baseline.

---

## 2. Previous candidate

| Role | ID |
|------|-----|
| Phase 10C-3 final | `dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf` |
| 10C-4 attempt A | `dpl_7HJrUY1gdrXo7F6kuL8JiPoPGH7o` |
| 10C-4 attempt B (BEER 3 cold+3 warm proven) | `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` |
| 10C-4 attempt C/D | `dpl_Gq8i7uXPT5gmLMMNaiS8JiX96B1B` / `dpl_CHxTptrbHEYyC97Kg9GdJyDjjNVy` |

---

## 3. Root blocker carried from 10C-3

Shared Production KV let candidates warm-reuse sticky timeout LP bodies; force-refresh re-armed stages without always clearing LP evidence; deep could terminal without a generation-safe dual-write publish of the new multi-version LP result.

---

## 4. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/deployment-scope.ts` | `production` vs `candidate:{deploymentId}` scope; scoped KV key helpers |
| `lib/hansome-score/lp/lp-result-publish.ts` | LP body clear/publish/read contracts; schema v1 |
| `lib/hansome-score/scan-cache.ts` | Scoped snapshot/meta/lock keys; dual-write publish; read reconcile; force clear |
| `lib/hansome-score/scan-progress.ts` | Force-refresh clears LP body; do not force-clear published Locked |
| `lib/hansome-score/lp/adapters/v3.ts` | Adapter-verified positions → `positionDiscoveryComplete` |
| `lib/hansome-score/types.ts` | `lpPublish` + `cache.deploymentScope` |
| `app/api/scan/route.ts` | `forceLp` + `X-Scan-Deployment-Scope` |
| `app/api/scan/status/route.ts` | Expose `deploymentScope` + header |
| `lib/hansome-score/__tests__/phase10c4-isolated-cache-lp-publish.test.ts` | Isolation / publish / read regressions |
| `scripts/phase10c4-remote-gate.mjs` | A–J remote gate harness |
| `scripts/phase10c4-beer-repeat.mjs` | BEER 3/3/3 repeat harness |

**Unchanged by policy:** Pons adapter verification gates, lock classification meaning, scoring, Holder/Creator/Burn/Market, V3 index architecture, Smart LP off, UI wording, no new lockers.

---

## 5. Candidate cache namespace design

```
scan:snapshot:{deploymentScope}:{chainId}:{token}
scan:meta:{deploymentScope}:{chainId}:{token}
scan:lock:{deploymentScope}:{chainId}:{token}
scan:lp:result:{deploymentScope}:{chainId}:{token}
```

`deploymentScope` auto = `candidate:{VERCEL_DEPLOYMENT_ID}` on Vercel deployments; override via `HANSOME_SCAN_DEPLOYMENT_SCOPE`.

Observed remote header: `X-Scan-Deployment-Scope: candidate:dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` (and later tips likewise).

V3 position index (`scan:v3pos:*`) remains shared (discovery inputs only; revalidated; no final lock aggregates).

---

## 6. Production namespace design

Live aliases remain on baseline tip (pre-10C-4 unscoped / production process). New code defaults to `candidate:{dplId}` when `VERCEL_DEPLOYMENT_ID` is set, so promoted code must set `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` (or invalidate) on promote — Production must not warm-read candidate keys.

Rate-limit keys stay global (`scan:rl:*`) — abuse protection only.

---

## 7. Forced-refresh clearing rules

When `lpEvidenceNeedsFullRefresh` **or** `forceLpFullRefresh`:

- delete published LP body for current scope
- clear positions / lock aggregates / timeout detail / discoverySources sticky markers
- set liquidity (+ score) to `analyzing`
- assign new `deepAttemptId`
- arm multi-version discovery

**Exception:** do **not** force-clear a published adapter-verified `LOCKED_VERIFIED_ONCHAIN` body solely because a sibling version recorded `v4_probe_budget_timeout`.

---

## 8. Publish contract

`publishDeepLpResult`:

1. validate generation vs authoritative  
2. validate `deploymentScope` vs process scope  
3. persist LP body (`scan:lp:result:…`)  
4. persist scan aggregate with `lpPublish` meta  
5. mark liquidity terminal only after both writes  

Failures: bounded retry; partial write → nonterminal + reason; stale late publish → `stale_publish_rejected`.

---

## 9. Read contract

`readLpContract` / `reconcilePublishedLpOnRead`:

- require schema v1  
- require scope match  
- require LP generation match  
- no Production fallback in candidate mode  
- transient missing LP body: keep generation-aligned embedded Locked  
- incompatible / timeout shells: clear + demote liquidity to analyzing  

---

## 10. Generation fencing

Deep progress/settle still require current `deepAttemptId`. Publish rejects stale generations with `stale_publish_rejected`. Concurrent refresh: winner = current generation only.

---

## 11. Cache compatibility / versioning

`LP_RESULT_SCHEMA_VERSION = 1`. Pre-10C-4 bodies without `lpPublish` that are terminal `UNKNOWN_INCOMPLETE` trigger full LP refresh. Promote must not consume old incompatible LP (scope switch / invalidate).

---

## 12. New candidate ID

| Role | ID | URL |
|------|-----|-----|
| Best proven | `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` | `https://hansomealpacas-qoqcirfk4-the-67.vercel.app` |
| Latest tip | `dpl_CHxTptrbHEYyC97Kg9GdJyDjjNVy` | `https://hansomealpacas-if2q6jfrl-the-67.vercel.app` |

Method: `npx vercel deploy --prod --skip-domain`; gate via temp `hansomealpacas.vercel.app`.

---

## 13. BEER cold 3-run table

**Proven on `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` (forceLp + 65s refresh cooldown):**

| Run | lockState | tokenId | owner | disc/lock complete | lpGeneration |
|----:|-----------|---------|-------|--------------------|--------------|
| 1 | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | `d_ms72300n_hv7z5o5i` |
| 2 | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | `d_ms726688_lbh749if` |
| 3 | LOCKED_VERIFIED_ONCHAIN | 436637 | Pons | true/true | `d_ms72b8ol_ah20qmcv` |

**Result:** **3/3 PASS** (unique generations). Scope: `candidate:dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y`.

Later tips (`dpl_Gq8i…`, `dpl_CHxT…`) saw class **H** deep timeouts under load before Locked republish — not promoted.

---

## 14. BEER warm 3-run table

Same tip `dpl_GZQq…`: **3/3 PASS** reading published Locked (`d_ms72b8ol_ah20qmcv`) without refresh.

---

## 15. BEER forced-refresh 3-run table

| Attempt | Result | Class |
|---------|--------|-------|
| On `dpl_GZQq…` (no pre-forced cooldown) | Locked JSON returned but only 2 unique gens / 3 runs | refresh cooldown (**B**/harness) |
| Forced-only retries | Cleared-body race then deep **H** | B/H |
| Later tips | Deep partial “liquidity did not finish in time” | **H** |

**Result:** **not 3/3 unique-generation PASS** on a single tip → blocks promote.

---

## 16. Concurrent refresh result

Unit: stale generation rejected; current generation accepted (`phase10c4` suite). Remote concurrent injection not completed as a hard promote gate after forced gap.

---

## 17. Restart result

Not fully closed on final tip (blocked by forced/deep H). Prior tip showed Locked surviving refresh restart when deep completed.

---

## 18. Stale generation result

Unit + publish contract: `stale_publish_rejected`. Logs emit JSON tag `stale_publish_rejected`.

---

## 19. Stale Production snapshot injection result

Candidate scope headers never equal Production; candidate keys cannot read Production snapshots. Isolation probe: **PASS** (`candidateScopeIsolated=true` on temp alias).

---

## 20. Final BEER JSON

On proven tip: `LOCKED_VERIFIED_ONCHAIN`, tokenId `436637`, owner Pons, ticks `-887200`/`204200`, liquidity `36819258015569838458222`, `lpPublish.schemaVersion=1`, scope `candidate:dpl_GZQq…`. Sibling v4 may still note probe-budget soft-incomplete — Locked row preserved.

---

## 21. positionDiscoveryComplete

**true** on proven tip (adapter-verified complete path when factory/index soft-wall).

---

## 22. lockAnalysisComplete

**true** on proven tip.

---

## 23. Top-100 completion

**Not run** for promote — BEER forced 3/3 unique-generation gate incomplete on a single tip.

---

## 24. Top-100 hard drift

**N/A / incomplete** — skipped by policy until BEER repeated gates pass.

---

## 25. Core7

Spot fetches exercised; no promote-grade completed-set hard compare (BEER forced gate incomplete). Local Core/LP suites with 10C-4 code: **PASS**.

---

## 26. Failure classifications

| Class | Meaning | Observed |
|-------|---------|----------|
| A | auth/protection | Direct tip 401; game HTML; alias JSON OK |
| B | cache isolation / sticky | Mitigated by scope; residual refresh-cooldown false “forced” |
| C | stale generation | Unit covered |
| D | publish failure | Unit covered (partial write nonterminal) |
| E | read-generation mismatch | Unit covered |
| F | RPC timeout | Occasional fetch abort |
| G | adapter failure | Not observed when deep completed |
| H | overall deep timeout | Dominant on later tips / forced retries |
| I | harness parse | PowerShell JSON quirks on huge bodies |
| J | true semantic mismatch | Not established on completed Locked set |

---

## 27. Tests

| Suite | Result |
|-------|--------|
| phase10c4-isolated-cache-lp-publish | **PASS** |
| phase10c2-verified-locker-classification | **PASS** |
| phase10c3-pons-parallel-soft-wall | **PASS** |
| phase10c3-version-probe-budget | **PASS** |
| scan-deep-retry-race | **PASS** |
| deep-bounded-settlement | **PASS** |
| lp-multi-version / warm-incremental | **PASS** |

---

## 28. Typecheck

`npm run typecheck` — **PASS**.

---

## 29. Build

Vercel candidate builds Ready (`dpl_GZQq…`, `dpl_CHxT…`, etc.) — **PASS**.

---

## 30. Analytics / admin / game smoke

www/game tip never moved off baseline during gates. Temp alias restored to baseline after gates.

---

## 31. Promotion decision

**Do not promote.**

Missing hard gate: forced-refresh **3 consecutive unique-generation** Locked settles on one tip; Top-100 completed-set hard drift therefore not executed.

---

## 32. Final deployment ID

www/game: `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (unchanged).

New candidate available: `dpl_CHxTptrbHEYyC97Kg9GdJyDjjNVy` (not promoted). Best evidence tip: `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y`.

---

## 33. Alias status

| Alias | Tip |
|-------|-----|
| www / apex / game / vercel.app | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Candidate tips | available, not aliased to www/game |

---

## 34. Post-promotion result

**N/A** — not promoted.

---

## 35. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — still live; no rollback required.

---

## 36. Remaining limitations

1. Forced-refresh 3/3 unique-generation gate not green on a single tip (cooldown + deep **H** under load).  
2. Remote deep wall-time still occasionally exceeds interactive budgets (v4 Quick soft-incomplete / hard bound).  
3. Promote path must set `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` (or invalidate) so live tip does not stay forever on `candidate:{dplId}` warm islands.  
4. Top-100 hard drift still required after BEER forced gate.  
5. Direct deployment URLs remain Deployment Protection–blocked for JSON harnesses.

---

## 37. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Root fix summary | Deployment-scoped KV isolation + LP body clear on force + generation-safe dual-write publish/read; adapter-complete discovery flag; sibling v4 soft-timeout no longer erases published Locked |
| BEER cold 3/3 | **PASS** on `dpl_GZQq…` (unique gens) |
| BEER warm 3/3 | **PASS** on `dpl_GZQq…` |
| BEER forced 3/3 | **FAIL** (unique-gen / deep H) |
| Top-100 hard drift | incomplete / not run |
| New candidate ID | `dpl_CHxTptrbHEYyC97Kg9GdJyDjjNVy` (latest); proven `dpl_GZQqEkWXxyykU8WXgfHc8eoJpC9y` |
| Final tip | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Promoted | **NO** |
| Smart LP | off |
| Adapters | Pons only |
| Rollback | N/A (baseline intact) |

### Recommended next steps

1. Re-run forced 3/3 on a quiet tip with ≥65s between refreshes and wait-until-Locked (not wait-until-partial).  
2. Then Core7 + Top-100 completed-set hard drift.  
3. On promote: set `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` and invalidate incompatible LP bodies.

### Artifacts

| Artifact | Path |
|----------|------|
| Candidate cfg | `reports/data/phase10c4_candidate.json` |
| Proven BEER summary | `reports/data/phase10c4_beer_proven_gzq.json` |
| Deploy logs | `reports/data/phase10c4_deploy*_out.txt` |
| Gate scripts | `scripts/phase10c4-remote-gate.mjs`, `scripts/phase10c4-beer-repeat.mjs` |
