# HANSOME Score — LP Discovery Performance

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | V4 / multi-version LP discovery latency · known-first revalidation · lock distribution early path |
| **Deployed** | **No** |
| **Verdict** | **PASS** |

---

## Verdict

**PASS** — Cold HANSOME no longer needs ~3 minutes of PositionManager history rediscovery to show Position NFTs and Lock Distribution. Known seeds `#47299` / `#357867` / `#142938` revalidate on-chain in ~4–5s; multi-version path ~4–12s; lock $/% + pool reconcile ~9–17s. Exhaustive discovery is deferred and completeness is labeled honestly (`knownPositionsVerified` vs `discoveryComplete`).

180s liquidity stage budget is **no longer the binding failure** for HANSOME cold Deep after this path.

---

## Root cause of ~191s

Profiled with `lib/hansome-score/_tmp-lp-discovery-profile.ts` → `reports/hansome-lp-discovery-profile.json`.

| Source | Cold ms (approx) | Role in ~191s |
|--------|-----------------:|---------------|
| **PositionManager transfer pages** (maxPages=6) | **~34s** | Fetches **276** unique NFT IDs (mostly unrelated) |
| **Sequential `readPosition` on ~276 candidates** | **~123s** extrapolated (30 IDs ≈ 13s; **0** involved HANSOME) | **Dominant cost** |
| Titan locker (27 locks, sequential) | ~13s (parallel ~2s) | Secondary; not the main hang |
| Hint-address NFT inventory | ~6s | Minor |
| Seeded candidates alone (3 IDs) | **~1.8s** | Already enough for MIXED + lock % |
| v2/v3 probes | parallel with v4 | Not the bottleneck |

**Full `detectV4LpIntelligence` before fix:** ~**218s** — still only returned the same 3 HANSOME positions.

**Mechanism:** seeds were already present, but the path always paginated recent PM transfers and then sequentially RPC-evaluated every candidate. Historical pages were re-scanned on every cold Deep; already-known IDs were not used as a fast return path.

---

## What was implemented

### Architecture

1. **Known / cached positions first** — revalidate `ownerOf` + liquidity + pool + Titan lock → emit positions + allow lock distribution.
2. **Skip exhaustive PM history** when known-first is sufficient (`exhaustiveDiscovery` default `false`).
3. **Optional exhaustive** only when soft liquidity budget ≥ 200s (current Deep budget is 180s → known-first only for HANSOME Deep).
4. **Honest completeness** — `knownPositionsVerified=true` with `discoveryComplete=false` / `exhaustiveDiscoveryComplete=false` until a full pass runs. UI can show “Verified known positions” vs “Full position discovery complete”.
5. **In-process position ID cache** (`lp/position-cache.ts`) for cheap revalidation across scans (6h TTL).
6. **Titan + position eval batched in parallel** (no more fully sequential locker / NFT reads).
7. **Deep progressive publish** — `onKnownPositions` persists priced positions mid-liquidity stage.

### Scoring

**Unchanged.** Aggregate still requires `discoveryComplete` for `ALL_LOCKED`; MIXED from locked+unlocked known positions remains valid with incomplete discovery.

---

## Cold HANSOME timings (post-fix)

Harness: `lib/hansome-score/_tmp-lp-known-first-measure.ts`  
Raw: `reports/hansome-lp-known-first-measure.json`  
Run: 2026-07-27T18:19:52Z (local Node, cold cache cleared)

| Metric | ms | Notes |
|--------|---:|-------|
| Time to first pool | **4_355** | Via known-position callback |
| Time to first known position | **4_355** | All 3 IDs in callback |
| Time to Locked/Unlocked $ + % | **8_521** | After Gecko/ETH USD + economic distribution |
| Time to exhaustive position discovery | *not run* | Deferred (`exhaustiveDiscovery=false`) |
| V4 known-first wall | **4_355** | Was ~218_000 |
| Multi-version known-first wall | **3_594** | Was ~225_000 (v2/v3 ∥ v4) |

### Positions & reconcile

| Check | Result |
|-------|--------|
| `#47299` Locked | **Found** |
| `#357867` Unlocked | **Found** |
| `#142938` Unlocked | **Found** |
| Aggregate | **MIXED** |
| `knownPositionsVerified` | **true** |
| `discoveryComplete` / `exhaustiveDiscoveryComplete` | **false** (honest) |
| Lock dist available | **true** — locked ~28.9% / unlocked ~71.1% |
| Reconciled with pool liquidity | **true** (positions ≈ $16.1k vs pool ≈ $16.0k) |

---

## Budget still an issue?

| Question | Answer |
|----------|--------|
| Is 180s liquidity budget below HANSOME cold **after** known-first? | **No** — known-first + lock % finishes in **&lt;20s** |
| Was 180s below cold **before**? | **Yes** — exhaustive path ~191–218s timed out Deep liquidity |
| Should we raise 180s? | **Not required** for HANSOME; only raise if product wants same-request exhaustive PM history (needs ≥~220s alone) |

---

## Before / after

| Path | Before | After |
|------|-------:|------:|
| V4 cold (HANSOME) | ~218s | **~4–5s** known-first |
| Multi-version cold | ~191–225s | **~4–12s** |
| Lock distribution on Deep | Often timed out (“Temporarily unavailable”) | **~9–17s** with known positions |
| Completeness claim | Could mark complete after seeds+MIXED even after wasteful PM scan | Known verified ≠ full discovery |

---

## Files changed

- `lib/hansome-score/lp/detect.ts` — known-first / exhaustive phases, `onKnownPositions`
- `lib/hansome-score/lp/titan.ts` — batched parallel Titan reads; targeted NFT lookup
- `lib/hansome-score/lp/position-cache.ts` — *(new)* cached Position NFT IDs
- `lib/hansome-score/lp/multi.ts` — forward known/exhaustive flags
- `lib/hansome-score/scan-deep.ts` — known-first default; progressive liquidity publish
- `lib/hansome-score/scan-fast.ts` — pending LP fields
- `lib/hansome-score/types.ts` — `knownPositionsVerified`, `exhaustiveDiscoveryComplete`
- `lib/hansome-score/__tests__/lp-known-first.test.ts` — *(new)*
- `content/i18n/en.ts` / `zh.ts` / `types.ts` — verified-known / full-discovery labels
- `components/scan/ScanClient.tsx` — liquidity-only wording (minimal; Deep progress UI owned elsewhere)
- `lib/hansome-score/_tmp-lp-discovery-profile.ts` / `_tmp-lp-known-first-measure.ts` — measure harnesses
- `reports/hansome-lp-discovery-profile.json` / `hansome-lp-known-first-measure.json`
- `reports/HANSOME_LP_DISCOVERY_PERFORMANCE.md` — *(this file)*

---

## Tests

| Suite | Result |
|-------|--------|
| `lp-known-first` / `lp-mixed` / `lp-multi-version` | **PASS** (15) |
| Cold known-first measure | **PASS** |

---

## Deployed?

**No.** User did not request deploy. Production still on prior path until a deploy includes these changes.

---

## Residual / follow-ups

1. Tokens **without** seeds/cache still take the exhaustive PM path (~3 min) unless inventory is found another way.
2. True background exhaustive after Deep finalize (separate job) not shipped — same-request exhaustive only if liquidity soft budget ≥ 200s.
3. Position cache is in-process only; add KV if multi-instance warm ID sets are needed.

---

## Addendum — Production blockage + orchestration fix (2026-07-28)

**Production smoke** (`HANSOME_PRODUCTION_DEEP_UI_LP_FASTPATH_SMOKE.md`) was **GO WITH CAVEATS**: Progressive Deep UI shipped, but Lock Dist / positions never appeared because Deep aborted on **creatorBurn timeout** before liquidity.

| Item | Detail |
|------|--------|
| Root cause | `scan-deep.ts` early `return` after `creatorBurn:timeout` (also relationships timeout) |
| Fix | Independent stage soft-fail; order **relationships → liquidity → creatorBurn**; honest partial finalize |
| Local proof | Known-first still finds `#47299` / `#357867` / `#142938`; Lock Dist ~28.9% / ~71.1% reconciled; creatorBurn timeout no longer blocks LP (`hansome-deep-orchestration-independence.json` **PASS**) |
| Deployed? | **No** — awaiting Production deploy approval |
