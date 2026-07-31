# HANSOME Scan — Phase 10C-1 Production V3 Position Index Integration

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Production discovery integration |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Known pool** | `0xC71E763a0a258f266d1481295115ea4f291D95ED` |
| **Chain** | Robinhood Chain `4663` |
| **Pre-deploy live tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Candidate** | `dpl_AXAFVpTY8ANf7hWqqDg14Muqur9y` |
| **Final deploy (www/game)** | **unchanged** — `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

## 1. Exact pre-deploy live tip

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`  
Aliases confirmed still on this tip after candidate ship: `www.hansomealpacas.xyz`, `hansomealpacas.xyz`, `game.hansomealpacas.xyz`.

---

## 2. Candidate deployment ID

| Item | Value |
|------|--------|
| ID | `dpl_AXAFVpTY8ANf7hWqqDg14Muqur9y` |
| URL | https://hansomealpacas-8kgmhygee-the-67.vercel.app |
| Status | Ready (Production target, `--skip-domain`) |
| Custom www/game | **not** aliased |

Deployment Protection blocked unauthenticated JSON scrape of candidate `/api/scan` (HTML challenge). Local public-RPC BEER verification used instead.

---

## 3. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/lp/v3-position-index/types.ts` | Semantic `1.0.0-phase10c1` |
| `lib/hansome-score/lp/v3-position-index/store.ts` | Edge-safe validation/memory (no `node:fs`) |
| `lib/hansome-score/lp/v3-position-index/store-json.ts` | Node JSON helpers for scripts only |
| `lib/hansome-score/lp/v3-position-index/production-kv.ts` | Durable `scan:v3pos:*` KV + test Map |
| `lib/hansome-score/lp/v3-position-index/chain-port.ts` | viem port + known BEER creation block |
| `lib/hansome-score/lp/v3-position-index/attach.ts` | Index → `V4PositionInfo` (Unknown lock) |
| `lib/hansome-score/lp/v3-position-index/production.ts` | Interactive resolve + background backfill |
| `lib/hansome-score/lp/v3-position-index/index.ts` | Public exports |
| `lib/hansome-score/lp/adapters/v3.ts` | Wire index into `discoverV3Liquidity` |
| `lib/hansome-score/lp/adapters/types.ts` | `positionDiscoveryComplete*` fields |
| `lib/hansome-score/lp/multi.ts` | Pass-through coverage slice |
| `lib/hansome-score/types.ts` | Optional `positionDiscoveryComplete` on slice |
| `lib/hansome-score/__tests__/v3-position-index-phase10c1.test.ts` | Integration + failure injection |
| `scripts/phase10c1-beer-verify.ts` | Live BEER cold/warm verifier |

**Unchanged by policy:** `V3_LOCKER_ADAPTERS=[]`, Pons unwired, score/UI/aggregate formulas, Smart LP off, Holder/Creator/Burn/Market/Relationships.

---

## 4. Production index architecture

Pool-scoped Option 3 (Phase 10A/10B):

1. `factory.getPool` discovers material V3 pools  
2. Resolve canonical `token0/token1/fee` from pool  
3. Load `scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}`  
4. Missing → schedule bounded background backfill (interactive settles with stub)  
5. Present → fresh revalidate or incremental overlap sync  
6. Attach real numeric NPM positions as Unknown (no locker semantics)  
7. Merge over synthetic stubs for same pool  

---

## 5. Storage key / schema

```
scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}
```

BEER example:  
`scan:v3pos:4663:0x73991a25…e0d3:0x0bd7d308…ad73:0xc2abbcc7…7804:10000`

Fields: schemaVersion=1, semanticVersion=`1.0.0-phase10c1`, factory/npm/pool, sync cursors, generation, exhaustive range, discoveryComplete, tokenIds[], updatedAt.  
Per-tokenId: ownerOf-validated owner, ticks, L, burned/zeroLiquidity/status, source, errors.  
**Never** reuses `scan:xfer:*`.

---

## 6. Interactive flow

- Load + validate index (schema/semantic/pool key)  
- If missing: schedule background; return synthetic stub honestly  
- If present & fresh (`discoveryComplete`, tip lag ≤256): ownerOf/positions revalidate only  
- Else: bounded incremental Mint overlap sync + revalidate  
- Attach material L>0 positions; merge over stubs  
- Settle; no infinite Promise; no fake `discoveryComplete` / 100%

---

## 7. Background backfill flow

`scheduleV3PosIndexBackgroundBackfill` — fire-and-forget, in-flight de-dupe, generation-fenced KV save, corrupt records rebuild from empty. Does not block interactive barrier; cannot overwrite newer generation.

---

## 8. Reorg / fencing behavior

- Overlap default 96; checkpoint hash on tip  
- Hash mismatch → incompleteness + rescan path (Phase 10B algorithms retained)  
- `saveV3PosIndexProduction` rejects stale generation and expectedGeneration fence misses  
- Phase 7.3 deep fencing untouched (no scan-deep settlement rewrite)

---

## 9. BEER cold result

Local `scripts/phase10c1-beer-verify.ts` (public RPC):

| Metric | Value |
|--------|--------|
| Wall | **~12.5–13.3 s** (inline backfill for verify) |
| tokenIds | `[436637]` |
| Owner | `0x736D7669…7F35` |
| ticks | -887200 / 204200 |
| L | `36819258015569838458222` |
| lockState | `UNABLE_TO_DETERMINE` |
| positionDiscoveryComplete | **true** |

Production interactive cold (no inline): schedules background + stub until index warm.

---

## 10. BEER warm result

| Metric | Value |
|--------|--------|
| `discoverV3Liquidity` wall | **~6.9 s** (includes factory getPool probes on public RPC) |
| numeric id | `436637` |
| stub-only | **false** |
| positionDiscoveryComplete | **true** |
| lockAnalysisComplete | **false** |

---

## 11. BEER tokenId / owner / ticks / liquidity

| Field | Value |
|-------|--------|
| tokenId | **436637** |
| owner | **0x736D76699C26D0d966744cAe304C000d471f7F35** |
| token0 / token1 | WETH / BEER |
| fee | 10000 |
| tickLower / tickUpper | **-887200 / 204200** |
| liquidity | **36819258015569838458222** (>0) |
| zeroLiquidity / burned | false / false |

---

## 12. positionDiscoveryComplete result

**true** (after index complete + material attachment). Separated from lock analysis.

---

## 13. lockAnalysisComplete result

**false** — `V3_LOCKER_ADAPTERS=[]`; Pons ownership does not classify Locked.

---

## 14. BEER final lock state

**Unknown / `UNABLE_TO_DETERMINE` / aggregate remains incomplete for lock** — intentional Phase 10C-1 success (real discovery without lock flip).

---

## 15. Synthetic stub merge result

When real numeric positions exist for a pool, stub `v3-pool:…` is removed. Stub L=`"1"` never counted economically alongside reals. Unit-tested.

---

## 16. Multi-position pool result

Fixture coverage for `0x52e65B17…71Ca` pattern: multiple tokenIds, stable ascending order, no stop-after-first, zero-liq retained in index but excluded from attach/material agg, partial window must not claim exhaustive completeness. No false ALL_LOCKED/UNLOCKED.

---

## 17. EOA owner result

Resolved owner attached; `lockState=UNABLE_TO_DETERMINE`; `removableByEoa=null` (no new unlock semantics).

---

## 18. Contract owner result

Pons/contract owner resolved; remains Unknown; `lockerName`/`lockerAddress` null on index path (adapters empty).

---

## 19. Zero-liquidity result

Stored in index; excluded from default attach / material aggregation; not auto-unlocked.

---

## 20. Burned / nonexistent result

`ownerOf` revert → burned; not marked unlocked; optional includeBurned for history; unlockedClaim false.

---

## 21. Failure-injection results

Covered in `v3-position-index-phase10c1.test.ts`: missing/corrupt/schema/fee mismatch/missing receipt/positions+ownerOf fail/burned/creation unknown/reorg sim/duplicate+multi ids/stale generation fence. Interactive settles Unknown; no false Locked/Unlocked/ALL_LOCKED.

---

## 22. Cold performance

| Case | Wall | Notes |
|------|------|--------|
| BEER inline backfill | ~13 s | 1 Mint; known creation 20913772 |
| Interactive missing index | ≪1 s + schedule | backgrounded |

---

## 23. Warm performance

| Case | Wall | Notes |
|------|------|--------|
| Full `discoverV3Liquidity` warm | ~6.9 s | factory probes dominate on public RPC |
| Fresh index path | ownerOf/positions revalidate; Mint getLogs skipped when tip lag ≤256 |

Gate “≤3s added median” vs prior synthetic-only path: **not proven on protected candidate URL**; local full discover still ~7s end-to-end. **Contributes to not promoting.**

---

## 24. Core 7 result

Deep/LP semantic suites run: `scan-deep-*`, `deep-stall-rca`, `deep-parallel`, `phase81a-semantic-drift`, `lp-multi-version`, `lp-presentation`, `known-first`, `smart-lp-refresh`, `liquidity-coverage`, `position-value` — **PASS** (no Core 7 terminal regressions observed in these suites).

---

## 25. Top-100 result

Full Top-100 live matrix **not re-run** against protected candidate. Hard-drift gate treated as **not confirmed for promote**. Local semantic suites show no lock/score formula changes.

---

## 26. Phase 7.3 reliability

Deep settlement / retry-race / stall RCA / parallel tests **PASS**. No fencing rewrite; background v3pos cannot block interactive deep barrier.

---

## 27. Tests

| Suite | Result |
|-------|--------|
| Phase 10B `v3-position-index-phase10b` | **25/25 PASS** |
| Phase 10C1 `v3-position-index-phase10c1` | **PASS** |
| V3 materiality adapter | **PASS** |
| Deep / LP / semantic batches above | **PASS** |
| `pons-locker-adapter.test.ts` | **FAIL (pre-existing / out of scope)** — expects Pons in `LOCKER_REGISTRY` + wired `discoverV3Liquidity`; Production intentionally keeps Pons excluded |

---

## 28. Typecheck

`npm run typecheck` — **PASS**

---

## 29. Build

Local `npm run build` — **PASS** (after splitting `node:fs` out of Production import path).  
Vercel candidate build — **Ready**.

---

## 30. Analytics / admin / game smoke

Not re-run on candidate (protection). www/game aliases **not moved** — live tip smoke unchanged.

---

## 31. Deploy decision

**Do not promote www/game.**

Reasons:

1. Candidate API BEER JSON blocked by Deployment Protection (no remote confirmation of `positionDiscoveryComplete` on live KV)  
2. Warm ≤3s-added gate not confirmed on candidate  
3. Top-100 hard-drift not reconfirmed on candidate  

Local architecture + BEER discovery acceptance: **PASS**.

---

## 32. Final deploy ID

**None promoted.** Live remains `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`.  
Candidate available: `dpl_AXAFVpTY8ANf7hWqqDg14Muqur9y`.

---

## 33. Alias status

| Alias | Deployment |
|-------|------------|
| www / apex / game | still `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`…n6zq9i37h…`) |
| Project preview alias | candidate `…8kgmhygee…` |

---

## 34. Rollback target

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — still live; no rollback needed.

---

## 35. Post-promotion smoke

**N/A** — not promoted.

---

## 36. Remaining limitations

- Cold first hit needs background (or inline env) before real tokenIds appear in Production responses  
- Busy-pool full-history backfill still expensive; partial windows must stay incomplete  
- Pons adapter still excluded — BEER Lock stays Unknown by design  
- Candidate URL protection blocks automated post-deploy API gates  
- Warm end-to-end discover on public RPC still multi-second (factory probe heavy)

---

## 37. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Real discovery integrated (local) | **YES** |
| BEER positionDiscoveryComplete | **true** (local verify) |
| BEER lockAnalysisComplete | **false** |
| BEER lock | **Unknown** |
| Smart LP | **off** |
| V3_LOCKER_ADAPTERS | **[]** |
| Pons | **excluded** |
| www/game tip before | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| www/game tip after | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Candidate | `dpl_AXAFVpTY8ANf7hWqqDg14Muqur9y` |

**Phase 10C-1 success criterion (real discovery integrated safely):** **YES** locally; **not promoted** pending protected-URL / warm / Top-100 candidate gates.
