# HANSOME Score — Cold Scan V2 Design (First-Time / Cold Latency)

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Design + benchmark only — **first-time / cold** Deep useful latency |
| **Code changed** | **No** |
| **Deployed** | **No** |
| **Related (do not merge)** | Performance V2 (repeat-scan / indexing / prewarm) — see §9 |
| **Benchmark tokens** | FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` · HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Recommendation** | **PASS** |

---

## 0. Goal & non-goals

**Goal:** Reduce **first-time useful Deep results** (Lock Distribution and/or Creator / Burn history with honest coverage) from **multiple minutes** toward **30–60 seconds** where Blockscout / RPC allow, without raising timeouts.

**Useful Deep** (this doc) = progressive publish of at least one of:

1. Lock Distribution with verified positions (`knownPositionsVerified` or equivalent quick-discovery MIXED/locked evidence), **or**
2. Creator behaviour + Burn P2/P3 over a **recent transfer tier** (status `incomplete` / windows partial — never claimed complete).

**Non-goals / locked constraints:**

- Do **not** change scoring formulas, LP semantics, Burn semantics, risk thresholds, or Unknown/Partial honesty.
- Do **not** solve by increasing `maxDuration` / stage budgets / soft deadlines.
- Do **not** hardcode token-specific LP results (HANSOME seeds may remain as *hints*; FOX and others must use generic discovery).
- Do **not** touch Analytics MVP.
- Do **not** implement or deploy in this turn.

---

## 1. Current baseline (code + prior reports + read-only Production)

### 1.1 Orchestration today

`enrichScanDeep` (`lib/hansome-score/scan-deep.ts`) runs **sequentially**:

1. Relationships (soft ≤45s)  
2. Liquidity known-first (soft ≤180s; exhaustive only if budget ≥200s — effectively **off** on default Deep)  
3. CreatorBurn shared transfer crawl (soft ≤120s, `maxPages` default **40**)  
4. Score finalize  

Stage soft-fails are independent (LP orch fix), but **wall clock is still the sum** of stages that run. Jobs are **not** truly parallel.

### 1.2 First-useful-result latency (today)

| Path | HANSOME | FOX | Source |
|------|--------:|----:|--------|
| Fast TTFR (provisional screen) | ~8–17s | ~similar band when cold | Public Beta / Deep Reliability smokes |
| Full cold monolithic complete | **~298s** | n/a (heavier) | `HANSOME_SCAN_LATENCY_AUDIT.md` |
| Staged LP discovery (old exhaustive) | **~191s** | would exceed | Latency audit |
| Creator transfer pagination (≤40 pages) | **~106s** | routinely soft-fails | Latency audit · FOX diagnosis |
| Local known-first → Lock Dist | **~8.5–17s** | n/a (no seeds) | `HANSOME_LP_DISCOVERY_PERFORMANCE.md` |
| **Production** Lock Dist first appear (post LP orch) | **~218s** | **not observed** (timeout / unavailable) | `HANSOME_PRODUCTION_LP_ORCHESTRATION_SMOKE.md` · FOX diagnosis |
| Creator/Burn Deep useful (full index) | often **partial** inside 120s | **partial**, `pagesFetched=0` on timeout | Prod smokes · live status 2026-07-28 |

**Summary — first useful Deep today:**

| Token | First useful Deep (honest) | Notes |
|-------|---------------------------:|-------|
| **HANSOME** | **~3–4 min** to Lock Dist on Production (~218s); Creator/Burn often still incomplete | Sequential rel → liq; known-first local ≪ Production wall |
| **FOX** | **Often none within one Deep attempt** for Lock Dist / Creator/Burn history | ~114k transfers; no position seeds; budgets exhausted → honest `partial` |

Live read-only Production polls (2026-07-28, no refresh): FOX terminal-ish `partial` with liquidity marked done but Lock Dist unavailable / creator `incomplete` pages=0; HANSOME observed mid-Deep with Lock Dist still unavailable at ~38s snapshot age — consistent with sequential stage start, not a 30–60s useful Deep path.

### 1.3 Current cold request count (estimate from code paths)

Blockscout page size observed: **50** rows/page (FOX/HANSOME transfers). Allowlisted dead RPC reads: **2**.

| Phase | Approx outbound requests | Breakdown |
|-------|-------------------------:|-----------|
| **Fast cold** | **~16–20** | BS: token, counters, holders, address, verified, smart-contract, creation-tx (~7); Gecko (1); RPC: bytecode + name/symbol/decimals/supply/poolManagerBalance (+ optional deployer) (~6–7); dead `balanceOf` ×2 |
| **Deep relationships** | **~13** | Native funder × up to 12 holder samples + **1** early-transfers page |
| **Deep liquidity (HANSOME known-first)** | **~25–50** | Gecko + ETH/USD; Titan batch; seed position revalidate (~3 NFTs × ~3–4 RPC); pricing |
| **Deep liquidity (FOX / no seeds, exhaustive attempt)** | **~800–900+** | PM transfers ≤6 pages (~276 IDs historically) + `readPosition`-class RPC × candidates + Titan/hints — **dominant**; often truncated by 180s budget |
| **Deep creatorBurn** | **≤40** | Token transfer pages (shared by Creator + Burn analyzers — **not** double-fetched inside the stage) |
| **HANSOME cold Fast+Deep (known-first)** | **~95–125** | Fast + rel + known-first LP + ≤40 transfer pages |
| **FOX cold Fast+Deep (attempt)** | **~200–900+** | Same Fast/rel/creator pages + LP candidate explosion; typically **does not finish** useful LP/creator |

### 1.4 Current duplicated requests

| Duplicate | Where | Impact |
|-----------|-------|--------|
| **Gecko activity/liquidity** | Fast wave + Deep liquidity | Extra ~0.5–2s + rate-limit pressure |
| **Token transfers page 1** | Relationships `fetchEarlyTokenTransfers` + CreatorBurn `fetchTokenTransfersPaged` page 1 | Same newest page fetched twice |
| **ABI / source / verification** | Every Fast cold via Blockscout smart-contract | No durable static-contract cache across scans/isolates |
| **Position candidate rediscovery** | Exhaustive / PM history on cold isolates | In-process `position-cache` dies with serverless isolate → FOX/HANSOME re-pay discovery |
| **Full Fast wave on monolithic refresh** | `scanToken` path (manual full refresh cold) | Historical; progressive `enrichScanDeep` already skips redoing Fast when Fast base exists |

Creator + Burn **already share** one transfer fetch inside `creatorBurn` — keep that; extend sharing to Relationships and any wallet analysis.

---

## 2. Design pillars (propose only)

### 2.1 Recent-first transfer indexing

**Do not** require up to 40 pages before publishing Creator / Burn UI.

| Tier | Fetch | Publish | Completeness claim |
|------|-------|---------|-------------------|
| **Recent (cold first useful)** | Newest-first, bounded window (§3) | Creator + Burn P2 short windows + observed signals | `paginationComplete=false`; creator `available=false` / `status=incomplete`; burn windows `incomplete`/`unknown` as today |
| **Full historical (async)** | Continue paging toward genesis (existing `maxPages` / multi-pass / Performance V2 incremental) | Upgrade Analysis Coverage; may flip creator `indexed` only when genesis exhausted | Only then may claim complete index |

Reuse existing `stopAtOrBeforeTimestampMs` in `fetchTokenTransfersPaged` for time-bounded recent tier; page cap remains the hard bound.

### 2.2 One shared transfer dataset

Single in-Deep (and ideally KV-backed) **transfer index handle** per token+chain:

- Relationships early-buy clustering consumes **page 1 / recent slice** of the same dataset (no separate early-transfers GET).
- Creator + Burn analyzers already share — keep.
- Compatible wallet analysis (future) reads the same rows.
- Full-history continuation **appends** to the same index (newest→oldest), never restarts from page 1 unless refresh policy says so.

### 2.3 Quick LP discovery before exhaustive

Generic order (no FOX result hardcoding):

1. **Revalidate known/cached position IDs** (seeds + durable position-ID cache — see Performance V2 for cross-isolate durability).  
2. **Titan locker** harvest for token + hint addresses (deployer, top holders).  
3. **Hint-address PositionManager NFT inventory** (bounded owners).  
4. **Recent PM transfers** — small page budget (e.g. 2–3 pages, not 6) → evaluate **only** candidates; stop early when `knownFirstSufficient` analogue fires (seeds satisfied **or** material LOCKED + UNLOCKED MIXED).  
5. Publish Lock Dist with `discoveryComplete=false` / `exhaustiveDiscoveryComplete=false`.  
6. **Exhaustive** PM history + wide candidate eval **asynchronously afterward** (does not block first Lock Dist).

HANSOME seeds remain optional accelerators; FOX must succeed via steps 2–4 when on-chain evidence exists.

### 2.4 Independent parallel Deep jobs

Run as **true concurrent** tasks after Fast base exists:

| Job | Inputs | Publishes |
|-----|--------|-----------|
| **Liquidity** | pool hints, Titan, PM recent, position cache | Lock Dist / positions |
| **CreatorBurn** | shared transfer index (recent→full) | Creator + Burn stages |
| **Relationships** | holders + shared recent transfers + funders | Relationship signals |
| **Score** | triggered on each progressive publish + final settle | Provisional → updated Structural/Overall **using existing formulas only** |

One stage must **not** await another’s completion (already soft-fail independent; Cold V2 makes them **wall-clock parallel**). Snapshot writes need generation/attempt fencing (already directionally required by retry-race work).

### 2.5 Recent → Full historical tiers (coverage honesty)

| UI / confidence | Recent tier done | Full history done |
|-----------------|------------------|-------------------|
| Creator Score path | Stay provisional (`available=false`) | May clear provisional −8 only if fully indexed (unchanged rules) |
| Burn P2 24h/7d | May become `complete` for window **if** window start ≥ oldest recent row | All-time / older windows stay incomplete until full |
| Burn P3 / all-time | Incomplete until genesis | Complete only on full pagination |
| Analysis Coverage / Data Confidence | Reflect partial coverage | Improve as tiers finish |
| LP | Verified-known / quick-discovery ≠ full discovery | Exhaustive may raise completeness later |

**Lack of full history must never be presented as complete.**

### 2.6 Static contract analysis cache

Cache separately from scan snapshot (key: `chainId + address + bytecodeHash` or Blockscout verified hash):

- ABI, source presence, verification flag, derived capability/mechanism flags used by Fast contract risk + burn mechanism detection.
- Reuse across cold Fast and any Deep touch.
- Invalidate on bytecode change / verification status change.
- Does **not** alter risk thresholds — only avoids re-fetch/re-parse.

---

## 3. Proposed recent-window size

| Parameter | Proposal | Rationale |
|-----------|----------|-----------|
| **Page cap (Recent tier)** | **6 pages** | 6 × 50 = **~300 transfers**; ~**16s** at ~2.65s/page (from ~106s/40 pages) |
| **Time bound (optional AND)** | **7 days** newest-first stop (`stopAtOrBeforeTimestampMs`) | Caps noise on hyper-active tokens; FOX page1 alone was ~1h of flow at poll time |
| **Hard max pages Recent** | **6** (time stop may end earlier) | Predictable cold budget |
| **Full-history continuation** | Existing up to 40/request **or** multi-pass async (prefer Performance V2 incremental) | Do not raise single-request timeout |

**Chosen default for implementation approval:**  
**Recent window = min(6 Blockscout pages, 7-day newest-first cursor), ~300 transfers max.**

FOX note: 6 pages ≪ 114k history — Creator dump-at-launch may be **outside** recent window → must remain `incomplete` / provisional Score until full tier (correctness, not a bug).

---

## 4. Proposed LP quick-discovery strategy

```
parallel:
  A) revalidate cached/seed position IDs
  B) Titan locks for token + hints
  C) hint owner NFT inventories (≤8–12 owners)
  D) PM recent transfers maxPages=2..3 → filter token involvement → batched readPosition
publish when:
  sufficient MIXED/locked evidence OR ≥1 material locked + unlockable set
  OR (HANSOME) all seeds verified
else:
  keep analyzing / honest unavailable; continue exhaustive async
never:
  mark discoveryComplete=true from quick path alone
```

Target quick-path wall (local evidence): **~10–25s** when evidence exists; FOX may miss if positions are old and outside recent PM pages — exhaustive async then required (honest incomplete Lock Dist meanwhile).

---

## 5. Which stages can run truly in parallel

| Stage | Parallel with | Shared deps | Notes |
|-------|---------------|-------------|-------|
| **Liquidity** | CreatorBurn, Relationships | Fast overview (holders, deployer, poolManagerBalance) | No transfer-index dependency |
| **CreatorBurn** | Liquidity, Relationships | Shared transfer index writer (single owner task) | One fetcher; analyzers pure |
| **Relationships** | Liquidity; CreatorBurn after recent slice available | Prefer await **first page** of shared index (~2–3s) then proceed with funders in parallel | Do not wait for full history |
| **Score finalize** | — | Barrier on “attempt end” or incremental recompute after each publish | Formulas unchanged |
| **Static contract cache** | Entire Fast | None | Off Deep critical path once Fast done |
| **Full-history transfer continuation** | After Recent publish; ∥ exhaustive LP | Append-only index | Background / next isolate nudge |

**Cannot falsely parallelize:** two writers paginating the same token transfers without a single coordinator (would duplicate pages). Use one transfer-index job + fan-out readers.

---

## 6. Expected cold latency — incremental stack

Assumptions: Production-class Blockscout/RPC; no timeout increases; Fast already returned (~12–17s) and is **out of scope** for “Deep first useful” except as prerequisite.

| Step | Optimization | HANSOME first useful Deep | FOX first useful Deep | Dominant remaining cost |
|-----:|--------------|--------------------------:|----------------------:|-------------------------|
| **0** | Today (sequential) | **~180–220s** Lock Dist; Creator/Burn often partial | **Often none** in attempt | Sum of stages + 40-page crawl / LP miss |
| **1** | True parallel Deep jobs | Lock Dist **~15–40s** (known-first); Creator still ~100s+ if 40 pages | Rel/LP/Creator race; Creator still ~120s soft-fail | Transfer pages + FOX LP |
| **2** | + Recent-first transfers (6p / 7d) | Creator/Burn recent **~15–25s** ∥ Lock Dist → bundle **~20–40s** | Creator/Burn recent **~20–35s**; Lock Dist still weak | FOX LP discovery |
| **3** | + Shared transfer dataset (drop early-transfer dup, single index) | **~18–35s** | **~18–35s** for history UI | Small win (~1 page + coordination) |
| **4** | + LP quick-discovery (Titan/hints/PM 2–3p before exhaustive) | **~15–30s** Lock Dist (stable) | Lock Dist **~30–60s** *if* quick path finds MIXED/locked; else Lock Dist may stay incomplete past 60s while history UI is useful | Exhaustive async |
| **5** | + Static contract cache | Negligible on Deep useful; Fast **−1–3s** on repeat cold bytecode | Same | Fast-only |

### Full-stack expected (steps 1–5)

| Token | Expected cold **first useful Deep** | What user sees | Full complete / high coverage |
|-------|------------------------------------:|----------------|-------------------------------|
| **HANSOME** | **~25–45 s** | Lock Dist + recent Creator/Burn (incomplete coverage labeled) | Full transfer index + exhaustive LP later (async); may remain multi-minute |
| **FOX** | **~40–60 s** for Creator/Burn recent tier; Lock Dist **~45–60 s** when quick LP hits, else **history-first useful ~40–60s** with Lock Dist still Incomplete | Honest Partial/Incomplete on missing LP | Full history ≫60s (114k transfers) — **out of band**; Coverage rises asynchronously |

Upstream caveat: if Blockscout transfer RTT ≫3s/page or RPC stalls, 30–60s may slip — design still beats multi-minute sequential 40-page + exhaustive LP, without raising timeouts.

---

## 7. Correctness risks (top)

1. **Recent-window false negatives on creator dumps** — launch-era sells outside 6 pages / 7d must **not** set `available=true` or clear provisional creator deduction.  
2. **Burn all-time / P3 undercount** — recent tier must keep all-time / supply-reduction as Incomplete/Unknown until full index.  
3. **LP quick path understates locked %** — missing old locked NFTs → publish only with `discoveryComplete=false`; never ALL_LOCKED from quick path alone (existing aggregate rules).  
4. **Parallel snapshot races** — concurrent stage publishes can clobber retry/generation (known Deep retry-race class); require attempt fencing / monotonic merge.  
5. **Premature “complete” UX** — progress N/7 or copy must not treat recent-tier Creator/Burn or quick LP as full Deep complete.  
6. **Shared index cursor bugs** — double-count or gaps when merging recent→full; append-only + page fingerprint required.

---

## 8. PASS / REVISE recommendation

### **PASS**

Design meets the approved Cold Scan V2 intent:

- Targets 30–60s **first useful** Deep without timeout inflation.  
- Preserves Unknown/Partial / incomplete coverage semantics.  
- Avoids token-specific result hardcoding.  
- Separates cold path from repeat-scan Performance V2.  
- Incremental stack is measurable on FOX + HANSOME.

**Implementation gate (when coding is approved):** land parallel jobs + recent-first + shared index **before** relying on FOX Lock Dist in the 60s band; keep exhaustive/full-history strictly async; add fencing tests for concurrent publishes.

**REVISE only if** product later demands creator `available=true` from recent windows or ALL_LOCKED from quick LP — that would violate locked semantics and should be rejected.

---

## 9. Relation to Performance V2 (brief — do not merge)

| Concern | **Cold Scan V2** (this doc) | **Performance V2** (repeat / index / prewarm) |
|---------|----------------------------|-----------------------------------------------|
| Primary user | First visit / empty durable index | Revisit, Refresh, cross-isolate warm |
| Transfer strategy | Recent tier → async full | Incremental resume from stored cursor; prewarm popular CAs |
| LP | Quick discovery → async exhaustive | Durable position-ID cache + revalidate-first |
| Contract ABI | Populate static cache on first Fast | Hit static cache (near-zero) |
| Shared assets | Transfer index schema + static contract cache keys should be **one design** | Consumed heavily on repeat path |

Cross-reference: [`HANSOME_DEEP_SCAN_PERFORMANCE_V2_DESIGN.md`](HANSOME_DEEP_SCAN_PERFORMANCE_V2_DESIGN.md) (also **PASS**, design-only). **Cold V2** owns first-visit recent→publish latency; **Performance V2** owns durable transfer/position indexes, retry reuse, and prewarm. Shared schemas (transfer index cursor, KV position IDs, static contract cache) should stay aligned — this doc does not repeat Performance V2’s full incremental/prewarm design.

---

## 10. Evidence index

| Artifact | Use |
|----------|-----|
| `reports/HANSOME_SCAN_LATENCY_AUDIT.md` | Cold ~298s; LP ~191s; creator ~106s |
| `reports/HANSOME_LP_DISCOVERY_PERFORMANCE.md` | Known-first ~4–17s local; PM 6 pages / 276 IDs waste |
| `reports/HANSOME_PRODUCTION_LP_ORCHESTRATION_SMOKE.md` | Prod Lock Dist ~218s HANSOME |
| `reports/HANSOME_FOX_DEEP_RUNTIME_DIAGNOSIS.md` | FOX scale, 40-page fail, no seeds |
| `reports/HANSOME_DEEP_SCAN_RELIABILITY.md` | Budgets / progressive Deep |
| `lib/hansome-score/scan-deep.ts` | Sequential stage order |
| `lib/hansome-score/blockscout.ts` | `maxPages` 40; page API; PM recent |
| Live Production status (read-only) | 2026-07-28 FOX/HANSOME stage honesty check |

---

## 11. Confirmations

- [x] Design + benchmark only  
- [x] **No code changes**  
- [x] **No deploy**  
- [x] Scoring / LP / Burn / Unknown-Partial semantics unchanged in proposal  
- [x] Analytics MVP untouched  
- [x] Separate from Performance V2; no full duplication  

### Deliverable checklist

| Required section | Status |
|------------------|:------:|
| Current cold request count | ✓ §1.3 |
| Current duplicated requests | ✓ §1.4 |
| First-useful-result latency | ✓ §1.2 |
| Proposed recent-window size | ✓ §3 (**6 pages ∩ 7 days**) |
| Proposed LP quick-discovery strategy | ✓ §4 |
| Stages truly in parallel | ✓ §5 |
| Expected cold latency per optimization | ✓ §6 |
| Correctness risks | ✓ §7 |
| PASS / REVISE | ✓ §8 **PASS** |
