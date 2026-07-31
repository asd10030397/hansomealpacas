# HANSOME Scan — Phase 10C-3 Remote Candidate Deployment Gate Investigation

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Investigation + deployment validation (smallest proven fixes; no promote without hard gates) |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **NPM tokenId** | `436637` |
| **Approved locker** | PonsLaunchLocker `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| **Chain** | Robinhood Chain `4663` |
| **Baseline / rollback tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Failed 10C-2 candidate** | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` |
| **10C-3 candidates tried** | `dpl_Fn3pBueUyLFC2XHxooTj4HaXCwvY` → `dpl_GUbukraC8ZugZVn2LMXfDSnyBBvc` → **`dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf`** (final validated tip) |
| **Final www/game tip** | **unchanged** — `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

## 1. Exact pre-deploy live tip

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`hansomealpacas-n6zq9i37h-the-67.vercel.app`).

Aliases after gate restore: `www.hansomealpacas.xyz`, `hansomealpacas.xyz`, `game.hansomealpacas.xyz`, `hansomealpacas.vercel.app` → baseline.

---

## 2. Candidate deployment ID(s)

| Role | ID | URL |
|------|-----|-----|
| Failed 10C-2 | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` | `…dmrvprbt8…` |
| 10C-3 attempt A (version budgets) | `dpl_Fn3pBueUyLFC2XHxooTj4HaXCwvY` | `…mb4qmwbj9…` |
| 10C-3 attempt B (Pons parallel) | `dpl_GUbukraC8ZugZVn2LMXfDSnyBBvc` | `…6kag0t30k…` |
| **Final 10C-3 candidate** | **`dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf`** | `https://hansomealpacas-pz2b2ljdx-the-67.vercel.app` |

Method: `npx vercel deploy --prod --skip-domain --yes`. www/game never aliased to candidates. Gate access via temp `hansomealpacas.vercel.app` (Phase 8.1B pattern).

---

## 3. Files changed (smallest proven fixes)

| Path | Role |
|------|------|
| `lib/hansome-score/lp/multi.ts` | Per-version probe budgets; hung v4 must not erase sibling v3; BEER settle trace |
| `lib/hansome-score/lp/adapters/v3.ts` | Pons adapter parallel with factory/index + factory/index soft wall |
| `lib/hansome-score/lp/beer-remote-trace.ts` | Attempt-scoped BEER diagnostics (no secrets) |
| `lib/hansome-score/scan-cache.ts` | Refresh calls `recoverStaleDeepIfNeeded`; sticky timeout LP forces full LP re-arm |
| `lib/hansome-score/scan-progress.ts` | `lpEvidenceNeedsFullRefresh` + rearm forces liquidity analyzing |
| `lib/hansome-score/__tests__/phase10c3-version-probe-budget.test.ts` | Hung-v4 → BEER LOCKED regression |
| `lib/hansome-score/__tests__/phase10c3-pons-parallel-soft-wall.test.ts` | Hung factory → Pons LOCKED + sticky-LP refresh |
| `scripts/phase10c3-remote-gate.mjs` | Remote gate harness (timeout ≠ PASS; A–D failure classes) |
| `scripts/_tmp-10c3-beer-timing.ts` / `_tmp-10c3-beer-pm-multi.ts` | Local timing / PM-balance reproduce |

**Unchanged by policy:** lock semantics, Pons verification gates, score formulas, Holder/Creator/Burn/Market, Smart LP (off), no new locker adapters, Top-100 hard-drift not weakened.

---

## 4. Primary questions 1–20 (evidence)

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Position-index path? | Yes on local warm; remote often never published new LP | Local `positionDiscoverySource=v3_position_index`; remote sticky detail lacked new index settle |
| 2 | tokenId? | **436637** (local + on-chain) | `phase10c2-beer-verify`, PM-multi script |
| 3 | ownerOf Pons? | **Yes** `0x736D…7F35` | Local verify + Pons adapter |
| 4 | Adapter? | **pons_launch only** | `V3_LOCKER_ADAPTERS=[ponsLaunchLockerAdapter]` |
| 5 | getLaunchedToken? | **Yes** (adapter PASS path) | `pons.ts` + local LOCKED |
| 6 | positions? | Local yes; remote gate JSON often **0** | Candidate timeline / TERMINAL dumps |
| 7 | L>0? | Local `36819258015569838458222` | BEER verify |
| 8 | discovery complete? | Local attach `positionDiscoveryComplete=true` (inline); interactive may be false until backfill | 10C-2 report + timing |
| 9 | lockAnalysisComplete? | Local **true** after classify | BEER verify |
| 10 | LOCKED_VERIFIED_ONCHAIN internally? | **Yes locally** via adapter PASS | Unit + live RPC |
| 11 | Where lost remotely? | (a) `Promise.all` v4 hang dropped v3; (b) factory/index starved Pons; (c) shared KV sticky timeout LP warm-reused; (d) deep watchdog before new multi publish | Sections 15–20 |
| 12 | Stale cache? | **Yes** — Production KV shared; timeout LP detail reused | Detail still said `60000ms` after 90s code shipped |
| 13 | Background publish? | Index background OK locally; not the primary remote loss | production.ts fencing unchanged |
| 14 | Generation overwrite? | Soft-fail / warm reuse more causal than gen overwrite | refresh + warm skipLiquidity |
| 15 | Deployment Protection scope? | See §6 A–E | Direct tip HTML; alias JSON OK |
| 16 | Timeout? | Production BEER LP often watchdog/partial; **timeout ≠ PASS** | Polls + gate policy |
| 17 | Top-100 failure class? | **B incomplete** dominant (no terminal comparable LP); not confirmed hard drift 0 | Gate harness design |
| 18 | Actual hard drift? | **Not completed** — incomplete states excluded | `hardSemanticDriftCompletedSet` not proven 0 |
| 19 | Promotion safe? | **No** | Remote BEER not LOCKED_VERIFIED_ONCHAIN |
| 20 | Final tip? | Baseline unchanged | Alias restore |

---

## 5. Root cause (1–2 sentences)

Remote BEER deep LP failed the promote gate because multi-version discovery was coupled to a slow/hanging v4 Quick path (non-zero PoolManager balance ~33k), and factory/index work could consume the v3 budget before Pons ran—then shared KV sticky “probe budget / did not finish in time” LP was warm-reused as `liquidity=done`, so later candidates never published `LOCKED_VERIFIED_ONCHAIN` despite local adapter PASS.

---

## 6. Deployment Protection (A–E)

| Probe | Target | Result |
|-------|--------|--------|
| A www | `www.hansomealpacas.xyz/api/scan` | **JSON 200** (app OK) |
| B temp alias | `hansomealpacas.vercel.app/api/scan` | **JSON 200** when aliased to candidate |
| C direct tip | `*.vercel.app` deployment URL | **HTML SSO / protection** (not usable for harness) |
| D status alias | `/api/scan/status` on temp alias | **JSON 200** |
| E game | `game.hansomealpacas.xyz` | baseline tip; smoke not broken by candidates |

**Fix policy:** harness uses temp alias / candidate auth — **do not** disable protection globally.

---

## 7. Classification / discovery architecture (unchanged meaning)

```
factory getPool (+ index attach Unknown)
  ∥ Pons getLaunchedToken → ownerOf → positions (10C-3 parallel)
  → classify → LOCKED_VERIFIED_ONCHAIN only on adapter PASS
```

Production enum remains `LOCKED_VERIFIED_ONCHAIN` (not bare `LOCKED_VERIFIED`).

---

## 8. Local BEER proof

| Check | Result |
|-------|--------|
| `phase10c2-beer-verify.ts` | **PASS** — tokenId 436637, Pons, LOCKED_VERIFIED_ONCHAIN, both completes true |
| PM-balance multi (`_tmp-10c3-beer-pm-multi.ts`) | **PASS** ~24.5s — Locked preserved with PM bal > 0 |
| v2/v3/v4 timing | v3 ~5s Locked; v4 instant if PM null; parallel ~5s |
| Suites | phase10c3 + phase10c2 + retry-race — **PASS** |

---

## 9. Remote BEER result (final candidate)

| Metric | Value |
|--------|--------|
| Candidate | `dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf` |
| Access | temp alias |
| Lock JSON | **Not** `LOCKED_VERIFIED_ONCHAIN` (positions empty / sticky incomplete detail) |
| Observed failure | Deep armed liquidity analyzing → watchdog/partial; detail retained prior `probe budget exceeded (60000ms)` (stale KV string) |
| Cold/warm remote Locked | **FAIL** for promote |

---

## 10. Fixed-block / RPC

| Item | Result |
|------|--------|
| Local public RPC vs Production `NEXT_PUBLIC_RPC_URL` | Credentials not logged; host-only |
| Required reads | getPool, balanceOf, getLaunchedToken, ownerOf, positions, slot0/index as applicable |
| Divergence | Remote wall much higher under parallel deep + PM Quick; local PM-multi still Passed with Locked |
| Fallback | Per-version soft incomplete only — no semantic weakening |

---

## 11. Cache layers

| Layer | Finding |
|-------|---------|
| Memory isolate | Serves sticky deep_running / partial |
| KV `scan:` snapshot | **Shared across Production tips** — candidate inherits BEER timeout LP |
| LP discovery cache | Unions pools; does not invent Locked |
| V3 pos index `scan:v3pos:*` | Separate namespace; fencing unchanged |
| Sticky timeout LP | Detected via `lpEvidenceNeedsFullRefresh`; refresh forces liquidity analyzing + `markForceLpFullRefresh` |

---

## 12. Background settlement / fencing

| Item | Status |
|------|--------|
| V3 pos background backfill | Generation-fenced; not primary remote loss |
| Deep publish fencing | Intact; watchdog can partial-settle without new LP body |
| Async DAG (remote BEER sample) | refresh → warm validate stuck → watchdog → re-arm siblings; LP multi often not published |
| Timing table (representative) | See §13 |

---

## 13. Timing table (remote BEER final attempt)

| atMs | action / stage | note |
|-----:|----------------|------|
| 0 | refresh → liq analyzing | sticky-LP force path engaged |
| ~9–44k | checkpoint_validate | warm path; no probe_v3 publish |
| ~52k | watchdog_timeout | liq → partial |
| ~77k+ | parallel_wave / funder | siblings; LP detail still stale |
| ~103k | TERMINAL | still no LOCKED positions |

Local PM-multi contrast: **~24.5s** → LOCKED_VERIFIED_ONCHAIN.

---

## 14. FINAL JSON / serialization

| Check | Result |
|-------|--------|
| Enum | `LOCKED_VERIFIED_ONCHAIN` (maps from internal LOCKED_VERIFIED) |
| Regression test | JSON.stringify round-trip asserts exact enum + display |
| Remote payload | Did not reach Locked position row |

---

## 15. Failure injection (1–20) — coverage summary

Covered by unit tests + live observation:

1–4 Hung v4 / Promise.all coupling → version budgets  
5–8 Factory/index hang before Pons → parallel Pons + soft wall  
9–12 Sticky timeout LP as done → `lpEvidenceNeedsFullRefresh`  
13–14 Refresh without stale recover → refresh calls recover  
15–16 Protection HTML vs alias JSON  
17–18 Timeout ≠ PASS in gate harness  
19–20 Heuristic Locked forbidden (prior 10C-2 suites still PASS)

---

## 16. Top-100 hard drift

| Metric | Value |
|--------|--------|
| Policy | No PASS without terminal comparable states |
| Discovery-only diffs | Excluded (tokenId stub→real, provenance, positionDiscoveryComplete) |
| hardSemanticDriftCompletedSet | **Not confirmed 0** (incomplete remote LP) |
| Classification | Predominantly **B incomplete**; harness/protection = **C**; true drift **D** not established |
| Gate | **FAIL** for promote |

---

## 17. Core 7

Local Core/deep/LP suites exercised with 10C-3 fixes — **PASS**. Remote Core7 hard compare incomplete while BEER/LP sticky.

---

## 18. Smart LP / adapters

| Item | Value |
|------|--------|
| Smart LP | **off** (`HANSOME_SMART_LP_REFRESH` unset in Production env) |
| `V3_LOCKER_ADAPTERS` | `[pons_launch]` only |
| UNCX / new lockers | **not** added |

---

## 19. Analytics / admin / game smoke

www/game tip unchanged — prior Production smoke baseline intact. No promote → no post-promote smoke required. Game alias remained on baseline during candidate gates.

---

## 20. Typecheck / build / tests

| Check | Result |
|-------|--------|
| Candidate Vercel build | **Ready** (`dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf`) |
| phase10c3 unit tests | **PASS** |
| phase10c2 classification | **PASS** |
| scan-deep-retry-race | **PASS** |

---

## 21. Temp alias pattern

During gate: `hansomealpacas.vercel.app` → candidate.  
After gate: **restored** → `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`.

---

## 22. Promotion gates (all must be true)

| Gate | Result |
|------|--------|
| Remote BEER LOCKED_VERIFIED_ONCHAIN (adapter) | **FAIL** |
| positionDiscovery/lockAnalysis honest | Local PASS / remote not proven |
| Top-100 hard drift 0 on completed set | **FAIL** (incomplete) |
| Timeout not treated as PASS | **PASS** (policy held) |
| Smart LP off / Pons only | **PASS** |
| www tip unchanged before promote | **PASS** |
| **Promote?** | **NO** |

---

## 23. Deploy decision

**Do not promote www/game.**

Local architecture fixes are proven; remote BEER Locked JSON + Top-100 hard-drift completion remain unmet.

---

## 24. Alias / rollback status

| Alias | Tip |
|-------|-----|
| www / apex / game / vercel.app | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Candidate | `dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf` (available, not promoted) |
| Rollback | **N/A** — nothing promoted; baseline intact |

---

## 25. Post-promotion smoke

**N/A** — not promoted.

---

## 26. Remaining limitations

1. Shared Production KV means candidate gates must **force-invalidate** sticky LP (partially addressed; remote deep still can stall before multi publish).  
2. Remote RPC + parallel deep load can still exceed interactive budgets; Pons-parallel reduces but does not eliminate stall classes.  
3. Top-100 hard drift cannot be green while BEER/LP terminal states are missing.  
4. Direct tip URLs remain Deployment Protection–blocked for JSON harnesses.

---

## 27. Async DAG (background settlement)

```
GET refresh
 └─ recoverStale / lpEvidenceNeedsFullRefresh → force LP analyzing
 └─ scheduleDeepAnalysis → after(ensureDeepAnalysis)
     └─ runFreshScan → enrichScanDeep
         └─ warm plan? skipLiquidity?
         └─ parallel: relationships ∥ liquidity(multi v2∥v3∥v4) ∥ creatorBurn
             └─ v3: Pons ∥ factory+index(soft wall)
             └─ v4: Quick PM (budget 55s) — no longer blocks forever
```

---

## 28. Semantic gates

Score / Holder / Creator / Burn / Market / Smart LP / Pons meaning — **unchanged**. No formula edits.

---

## 29. Cold / warm performance (local)

| Case | Wall | Notes |
|------|-----:|-------|
| BEER discovery+classify (10C-2 script) | ~14s / ~9s | PASS Locked |
| BEER multi + PM bal | ~24.5s | PASS Locked |
| Remote candidate | not settled Locked | see §9 |

---

## 30. Instrumentation

`BEER_10C3_TRACE` JSON logs (token prefix only): attempt/phase, tokenId, ownerOf, Pons flag, adapter, L>0, discovery/lock complete, lockState, where/versionTimedOut, wallMs, detail slice. Enabled for BEER on Production env; scrub allow-list avoids secret keys.

---

## 31. Gate harness notes

`scripts/phase10c3-remote-gate.mjs`: classifies A completed / B incomplete / C harness / D true drift; refuses timeout-as-PASS; discovery-only fields excluded from hard compare.

---

## 32. Comparison to Phase 10C-2 failure

10C-2: remote deep stuck analyzing / `v3 not searched` on fast snapshot; Top-100 incomplete; PASS_NOT_DEPLOYED.  
10C-3: confirmed coupling + sticky KV + Pons starvation; shipped smallest fixes; **still** PASS_NOT_DEPLOYED pending remote Locked settle.

---

## 33. What was proven fixed (local / unit)

1. Hung v4 Quick no longer erases v3 Locked (budget + allSettled-style soft incomplete).  
2. Hung factory/index no longer prevents Pons Locked (parallel + soft wall).  
3. Sticky timeout LP forces refresh re-arm.  
4. Serialization keeps `LOCKED_VERIFIED_ONCHAIN`.

---

## 34. What remains blocking promote

1. Remote candidate BEER JSON not reliably `LOCKED_VERIFIED_ONCHAIN`.  
2. Top-100 hard-drift completed set not proven empty.  
3. Residual remote deep stall before multi-version publish under shared KV/warm path.

---

## 35. Analytics / admin / game

No alias move → no regression introduced on www/game. Admin secrets untouched.

---

## 36. Security / secrets

No RPC keys, bypass tokens, or auth secrets logged. Protection left enabled.

---

## 37. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — still live.

---

## 38. Recommended next steps (if continuing)

1. Ensure forced LP refresh clears prior LP intelligence body (not only stage flags) so warm cannot reuse timeout detail.  
2. Candidate-only scan cache namespace **or** explicit BEER snapshot delete before gate.  
3. Re-run temp-alias BEER until Locked publishes; then Core7 + Top-100 completed-set hard drift.  
4. Promote only when §22 all true.

---

## 39. Artifacts

| Artifact | Path |
|----------|------|
| Candidate cfg | `reports/data/phase10c3_candidate.json` |
| Deploy logs | `reports/data/phase10c3_deploy*_out.txt` |
| BEER dumps | `reports/_tmp-10c3-beer-*.json` |
| Gate script | `scripts/phase10c3-remote-gate.mjs` |

---

## 40. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Root cause | v4/factory coupling + sticky shared-KV timeout LP prevented remote BEER Locked publish |
| Local BEER Locked | **LOCKED_VERIFIED_ONCHAIN** |
| Remote BEER Locked | **not proven** |
| New candidate ID | `dpl_6rkMJjYaco9s71NeQjFKAPUAsZhf` |
| Final tip | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Top-100 hard drift | incomplete / not 0-confirmed |
| Promoted | **NO** |
| Smart LP | off |
| Adapters | Pons only |
| Rollback | N/A (baseline intact) |
