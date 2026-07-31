# HANSOME Scan — Latency Cost–Benefit Analysis

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | Analysis + recommendation only |
| **Code changed** | **No** |
| **Deployed** | **No** |
| **Verdict** | Spending money helps **marginally** on RPC reliability; **most cold Deep latency is engineering + Blockscout work volume**, not Vercel tier or missing Alchemy |

---

## 0. Executive recommendation

**Do not buy infrastructure expecting a multi-minute → few-second cold Deep win.** Measured cold Deep is dominated by (1) sequential Deep stages sharing one serverless wall, (2) Blockscout transfer pagination (~2–3s/page), and (3) FOX-class LP candidate explosion (~190s historical). Phases 1–4 already shipped the durable KV foundations; **Phases 5–8 (engineering, ~$0 infra)** are the highest-ROI path to the 30–60s “first useful Deep” band.

Money that *is* worth considering: **Alchemy/Chainstack free→~$20–50/mo** for production RPC reliability on LP `eth_call` paths (Robinhood Chain is supported), and optionally a **small dedicated worker (~$20–50/mo)** only after Phase 5–6 so background genesis indexing is not fight-or-die inside `maxDuration=300`. Raising timeouts / buying Enterprise Vercel does **not** solve the product problem and is explicitly forbidden by Cold/Perf V2 designs.

---

## 1. Baseline architecture (as coded + Production)

| Layer | Current reality | Evidence |
|-------|-----------------|----------|
| **Chain** | Robinhood Chain `4663` | `lib/chain.ts`, scan constants |
| **RPC** | Public `https://rpc.mainnet.chain.robinhood.com` via `NEXT_PUBLIC_RPC_URL` / `DEFAULT_RPC_URL`; viem `http` client | `.env.example`, `lib/hansome-score/rpc.ts` |
| **Explorer** | Public Blockscout API `https://robinhoodchain.blockscout.com` (`BLOCKSCOUT_BASE`) | `lib/hansome-score/constants.ts`, `blockscout.ts` |
| **Transfer Index** | KV `scan:xfer:*` + lock + recent chunks; recent-first **min(6 pages, 7d)**; background resume | Phase 2/4 production reports; `transfer-index/keys.ts` |
| **Contract Cache** | KV static ABI/source/proxy-heuristic by bytecode hash | Phase 3 production report |
| **LP / Position Cache** | KV `scan:lp:*` + in-process L1; HANSOME seeds; known-first preferred | Perf V2 design; LP discovery report |
| **Burn product** | KV `scan:burn:*` (kept; not forked) | Unified plan |
| **Snapshot / KV** | Upstash via Vercel KV (`scan:snapshot:*`, locks, RL); Production `kvConfigured=true` | Cache architecture; stall/FOX traces |
| **Deep flow** | Fast base → sequential `relationships` → `liquidity` → `creatorBurn` → score; soft budgets 45 / 180 / 120s; wall `DEEP_SCAN_MAX_EXECUTION_MS=270s` | `scan-deep.ts` |
| **Vercel** | `/api/scan` + `/api/scan/status` `maxDuration=300`; Progressive Deep via `after()` | `app/api/scan/route.ts`, Deep Reliability report |
| **Recent-first** | **Shipped** Production (`dpl_7zW2hjCJ…` lineage; later tips rebased) | Phase 4 production report |
| **Progress UI** | Honest progressive bars (not fake timers) | Progress-bars smoke |
| **Not shipped** | Phase 5 Quick LP · Phase 6 true parallel · Phase 7 warm incremental polish · Phase 8 prewarm | Unified plan; no Phase 5+ production reports |

### Soft / hard budgets (code)

| Constant | Value | Role |
|----------|------:|------|
| `maxDuration` (scan routes) | **300s** | Vercel isolate ceiling |
| `DEEP_SCAN_MAX_EXECUTION_MS` | **270s** | Per Deep attempt wall |
| Soft `relationships` | **45s** | Funding graph |
| Soft `liquidity` | **180s** | Known-first; exhaustive only if ≥200s |
| Soft `creatorBurn` | **120s** | Shared transfer paging + Creator + Burn |
| Auto retries | **2** | Fenced via `deepAttemptId` |
| Stale recover | **360s** | Zombie Deep recovery |

---

## 2. What currently makes scans slow?

### 2.1 Measured / reported numbers (do not invent precision)

| Path | Observed | Source | Confidence |
|------|----------|--------|------------|
| Fast warm (memory) | **~0–50 ms** | Latency audit | **HIGH** |
| Fast warm (Production HTTP) | **~300–360 ms** | Progress-bars smoke | **HIGH** |
| Fast cold | **~6–15 s** typical | Cold V2 / latency probes | **MEDIUM–HIGH** |
| Isolated RPC meta | **~0.9 s** | Latency audit probes | **MEDIUM** |
| Isolated Blockscout token/holders | **~2.3 / ~3.3 s** | Latency audit | **MEDIUM** |
| Relationships / funding graph | **~5.5 s** | Latency audit staged | **HIGH** |
| Creator transfer pagination (HANSOME ≤40p) | **~106 s / 22 pages** ≈ **~2.65 s/page** | Latency audit | **HIGH** |
| LP exhaustive rediscovery (pre known-first) | **~191–218 s** (~123s sequential `readPosition` × ~276 IDs) | LP discovery profile | **HIGH** |
| Full cold monolithic HANSOME | **~298–314 s** | Latency audit | **HIGH** |
| Production Lock Dist first appear (HANSOME, post orch smoke) | **~218 s** | LP orchestration smoke | **MEDIUM** (contention / sequential stage order) |
| FOX transfers / full genesis pages | **~113–114k** / **~2,276 pages** @50/page | FOX diagnosis / Perf V2 | **HIGH** |
| FOX creatorBurn under 120s | Often soft-fail; **`pagesFetched=0`** on failed attempts | FOX runtime + sections diagnosis | **HIGH** |
| FOX Lock Dist | Often **unavailable** (no seeds; exhaustive gated off at 180s) | FOX runtime | **HIGH** |
| NBD `0x57ff…de00f` stall-progress watch | Refresh→complete **~4.6 s**; creator **5 pages / 250 transfers**, `paginationComplete=false`, `lockAvail=false`; **no stall windows** | `reports/data/stall_progress_prod_trace.json` | **MEDIUM** (warm/stale + recent-first; not a cold FOX-class meter) |

### 2.2 Approximate share of **cold Deep wall** (HANSOME-class, pre–recent-first sequential model)

Derived from latency audit staged breakdown (~314s total). Treat as **order-of-magnitude percentages**, not a Production SLO.

| Bucket | Approx share | Notes |
|--------|-------------:|-------|
| **LP / liquidity discovery (historical exhaustive)** | **~55–65%** | Was ~191s; HANSOME known-first now << this locally; FOX still hits this class |
| **Blockscout transfer pagination (Creator/Burn)** | **~30–35%** | ~106s / 22 pages HANSOME; FOX capped at 40 pages / soft-timeout |
| **Relationships + Blockscout Fast wave** | **~3–5%** | ~5–12s combined |
| **RPC token meta / dead balances** | **&lt;1–2%** | ~0.5–1s |
| **Gecko / score CPU** | **&lt;1%** | |
| **Serverless cold start** | **Not measured as dominant** | Warm Fast already sub-second; Deep is work-bound |
| **Waiting / retries** | **Variable, high on FOX** | Auto-retry re-pays Blockscout/RPC when stages `partial` |
| **Cache misses (cross-isolate)** | **High when LP IDs / xfer index absent** | Phases 1–4 reduce this; Phase 5–8 unfinished |

**FOX-class cold Deep (useful result):** often **no** Lock Dist / Creator-Burn history inside one attempt → wall is “budget exhaustion + retries,” not a clean completion time. Confidence **HIGH** on classification; **LOW** on a single average ms number.

### 2.3 Post Phase 1–4 reality check

| Shipped | Latency effect |
|---------|----------------|
| **P1 LP KV** | Warm Lock Dist can avoid rediscovery across isolates when IDs known |
| **P2 Transfer-index** | Resume / reuse; `reuse_hit ⇒ rpcPagesThisCall=0` (unit/smoke) |
| **P3 Contract cache** | Warm Fast avoids Blockscout smart-contract GET; **no claimed e2e %** |
| **P4 Recent-first** | First Creator/Burn publish after **≤6 pages ∩ 7d** with honest Incomplete; historical continues / background |

**Still open (engineering):** sequential stage order (P6), FOX Lock Dist without seeds (P5), warm head-only path polish (P7), popular-token prewarm (P8).

---

## 3. Engineering vs pay-for-infra bottlenecks

| Bottleneck | Type | Money fix? |
|------------|------|------------|
| Sequential Deep stages (rel → liq → creatorBurn) | **Engineering (P6)** | No — worker alone still sequential unless jobs parallelized |
| Blockscout ~2–3s/page × N pages | **Upstream + work volume** | Paying RPC does **not** speed Blockscout; own indexer (D/E) or fewer pages (P4 done / P7/P8) |
| FOX ~2,276 pages for genesis | **Product honesty + data volume** | Money cannot make genesis fit in 120s; async index + Incomplete UI required |
| Exhaustive PM + 276× `readPosition` | **Engineering + some RPC** | Quick LP (P5) + LP KV; premium RPC may shave RPC RTT only |
| Retry re-fetching same pages | **Engineering (P2/P7 fencing)** | Already partially shipped; finish resume/prewarm |
| Public RPC rate limits / stalls | **Infra (A)** | Yes — Alchemy/QuickNode/Chainstack/Tenderly support RH |
| Vercel `maxDuration` / Hobby 10–60s | **Infra (already addressed)** | Pro + `maxDuration=300` already required; more duration ≠ product fix |
| Cold start | **Minor** | Fluid/Pro helps some; not Deep’s multi-minute cause |
| Snapshot cache miss | **Engineering + existing KV** | Already on Upstash; prewarm (P8) amplifies |

---

## 4. Option evaluations

### A — Upgrade RPC (Alchemy / Tenderly / QuickNode / Chainstack)

| | |
|--|--|
| **RH support** | **Supported.** Robinhood docs recommend Alchemy; also list QuickNode, Blockdaemon, dRPC, Validation Cloud. Chainstack docs cover chainId 4663. Tenderly gateway endpoints exist for Robinhood Chain (mainnet/testnet). **Option A is not blocked by chain support.** |
| **Current use** | Public Robinhood RPC only (env example + code default). |
| **Monthly cost** | Alchemy free **30M CU/mo**; PAYG ~**$0.45/M CU** above free → practical Scan band **$0–50/mo** at current traffic, **$50–200/mo** if LP exhaustive / indexer bots scale. Chainstack/QuickNode entry often **~$49–99** node tiers (provider-dependent). |
| **Latency reduction** | Helps **RPC-bound** work: token meta, `readPosition`/`ownerOf`/`slot0`, Titan reads. Historical LP profile: **~123s** of ~191s was sequential RPC — better RTT/throughput could cut a **fraction** (guess **10–30% of that RPC slice** if rate-limited today), **not** the Blockscout ~106s creator path. |
| **Deep vs Fast** | Fast: small (RPC already ~1s). Deep LP: **medium** when exhaustive/quick eval runs many `eth_call`s. Deep Creator/Burn: **low / none** (Blockscout HTTP). |
| **Confidence** | Cost **MEDIUM**; latency % **LOW–MEDIUM** (no A/B Production RPC benchmark in repo). |

### B — Better Vercel plan

| | |
|--|--|
| **Current** | Production already needs Pro-class `maxDuration=300` (Hobby insufficient historically when limit was 60s — Deep Reliability report). |
| **Cost** | Pro **~$20/user/mo** + usage credit; Enterprise / add-ons much higher. Extended duration Pro: up to **800s** GA / **1800s** beta. |
| **Latency impact** | Cold start / Fluid concurrency: **minor** vs Blockscout/LP work. Raising `maxDuration` to 800–1800s would let one isolate crawl longer — **explicitly rejected** as the fix in Cold/Perf V2 (“no timeout inflation”). |
| **Reliability** | Longer isolates may reduce mid-crawl kills but increase cost and still leave FOX incomplete after 40 pages. |
| **Confidence** | **HIGH** that B alone does not deliver 30–60s useful Deep. |

### C — Dedicated Worker for Deep Scan

| | |
|--|--|
| **Hosting** | Small always-on or queue worker (e.g. Railway sidecar pattern already used for **settlement**, not Scan — cache architecture). Rough **$5–50/mo** hobby/small; **$50–150/mo** if always-on + Redis. |
| **Improvement** | **Reliability / completeness:** genesis backfill, LP exhaustive, multi-pass index without dying at 270–300s. **First useful latency:** only if paired with P5/P6 progressive publish — worker alone does not publish Lock Dist faster. Perf V2 lists external worker as **option C later**. |
| **Progress / UX** | Better for “Collecting → Incomplete → Complete” honesty; less orphaned `deepInflight`. |
| **Confidence** | Reliability **MEDIUM–HIGH**; cold TTFR **MEDIUM** (depends on engineering). |

### D — Self-hosted Transfer Index

| | |
|--|--|
| **Note** | **Partially already exists** as KV transfer-index (P2/P4). “Self-hosted” here means a continuous indexer (Postgres/ClickHouse/Redis) fed by Blockscout/RPC logs, not only on-demand Deep paging. |
| **Complexity** | **High** — cursor integrity, reorgs, storage caps (repo forbids full ~113k raw blobs in Redis v1), fencing with `deepAttemptId`. |
| **Monthly** | **$20–100** small DB+worker; **$100–300** if multi-token continuous index. |
| **Scan reduction** | Warm/repeat Creator-Burn → **head refresh ≤5 pages** (design target). Cold first visit still pays initial index unless prewarmed. |
| **Scalability** | Good for Top-N hot tokens; poor if every new CA must be fully indexed interactively. |
| **Confidence** | Architecture **HIGH**; cost/latency **MEDIUM**. |

### E — Own Explorer / DB (transfers, holders, creator, liquidity meta)

| | |
|--|--|
| **Scope** | Replace or shadow Blockscout for Scan inputs + optional holder/creator/liquidity meta. |
| **Monthly + maint** | Node/archive (**$50–300+** RH RPC archive) + indexer DB (**$50–200**) + ops time; full explorer UX **$300–1000+/mo** equivalent effort. |
| **Latency** | Could cut Blockscout RTT and enable SQL-range queries (creator window without 40 sequential pages). Largest **infra** upside for FOX-class — also largest **build risk**. |
| **When** | Only if Scan volume / multi-product use justifies owning RH index data. |
| **Confidence** | Cost **MEDIUM**; delivery risk **HIGH**. |

### F — Caching improvements (P5–P8 remaining)

| | |
|--|--|
| **Infra cost** | **~$0–20/mo** incremental on existing Upstash (already provisioned). |
| **Effort** | Engineering phases already designed; **no score/LP/burn formula changes**. |
| **Expected (design targets, not Production-proven e2e %)** | After P5+P6: cold first useful Deep **~25–60s** when evidence exists; after P7: warm **~10–30s**; P8: hot tokens often warm on arrival. |
| **Confidence** | Direction **HIGH** (design + Phase 4 smoke); exact ms **MEDIUM** (upstream RTT caveat). |

---

## 5. Ranked ROI table

Baselines for “before” are **scenario-dependent**. Use two columns:

- **Cold useful Deep (HANSOME-like):** historically multi-minute; post P4 recent-first, Creator/Burn *partial publish* can be much earlier, but Lock Dist still gated by sequential liquidity + discovery.
- **Cold useful Deep (FOX-like):** often **none** in one attempt for Lock Dist / history.

| Rank | Option | Monthly USD | One-time effort | Expected avg before → after (useful Deep) | Improvement | Confidence |
|-----:|--------|------------:|-----------------|-------------------------------------------|-------------|------------|
| **1** | **F — P5 Quick LP + P6 Parallel + P7 Resume** | **$0–20** | **M–L** eng (designed) | HANSOME useful **~2–4 min → ~25–60s**; FOX useful **often none → history ~20–60s / Lock Dist ~30–60s if quick hit** | **~50–80%** wall when targets land | **MEDIUM–HIGH** |
| **2** | **F — P8 Prewarm** (after P5–7) | **$0–30** (cron + KV) | **M** eng | Hot tokens: cold → **warm 10–30s** band | **Large for Top-N**; **0 for novel CA** | **MEDIUM** |
| **3** | **A — Premium RPC (Alchemy free→PAYG)** | **$0–50** typical | **S** (env swap + optional failover) | RPC slice only; Deep Creator **unchanged**; LP eval **maybe −10–40s** if public RPC was stalling exhaustive path | **~0–15%** overall cold Deep typical | **LOW–MEDIUM** |
| **4** | **C — Dedicated Deep worker** | **$20–50** | **M** eng + ops | Completeness/reliability ↑; cold TTFR ↑ only with P5/P6 progressive jobs | Reliability **HIGH**; latency **MEDIUM** | **MEDIUM** |
| **5** | **D — Stronger self-hosted transfer index** | **$50–200** | **L** | Warm Creator/Burn → head-only; cold novel still indexes | Warm **~60–90%** page reduction (design); cold novel **low** | **MEDIUM** |
| **6** | **B — Vercel beyond current Pro / longer maxDuration** | **+$0–300+** | **S** | Negligible TTFR; longer crawls possible (anti-pattern) | **~0–5%** product latency | **HIGH** (low ROI) |
| **7** | **E — Own explorer/DB** | **$300–1000+** | **XL** | Potential FOX history queries without 40-page wall | **High upside, high risk** | **LOW** on schedule |

---

## 6. Budget roadmaps

Assumes Production already has **Vercel Pro-class** + **Upstash KV** (required for Scan). Figures are **ranges**.

| Budget / mo | Buy | Do **not** buy | Expected speed / reliability | Worth it? |
|-------------|-----|----------------|------------------------------|-----------|
| **$0** | Ship **P5 → P6 → P7** on existing KV; Alchemy **free** tier RPC swap (optional) | Enterprise explorer; timeout inflation | Best path to 30–60s useful Deep design band; FOX still Incomplete until async genesis | **Yes — primary plan** |
| **$20** | Alchemy free/PAYG if CU exceeds free; or leave $20 in Vercel credit | Longer `maxDuration` as “speed” | Slightly more reliable RPC; little Creator/Burn change | **Marginal**; still do P5–6 |
| **$50** | Alchemy/Chainstack paid tier **or** small Deep worker + free Alchemy | Own Blockscout clone | Worker helps background index; speed still eng-bound | **Maybe** worker **after** P5–6 |
| **$100** | Paid RPC + small worker **or** modest Postgres transfer index for Top-N | Full custom explorer UI | Warm Top-N strong; novel CA still cold | **Conditional** on traffic |
| **$300** | Continuous Top-N indexer (D) + paid RPC + worker | Premature full E | FOX-class warm/prewarm approaches design band | **Only if** Scan is core product growth |
| **$1000** | Near-E: archive node + indexer DB + worker fleet | Paying for Vercel Enterprise hoping for Scan speed | Can own transfer/holder latency | **Only with** clear multi-product ROI |

---

## 7. Robinhood Chain provider constraint (Option A)

| Provider | RH Mainnet support (as of research 2026-07-28) |
|----------|-----------------------------------------------|
| **Alchemy** | **Yes** — Robinhood-recommended; `robinhood-mainnet.g.alchemy.com` |
| **QuickNode** | **Yes** — documented RH chain product |
| **Chainstack** | **Yes** — chainId 4663 docs |
| **Tenderly** | **Yes** — gateway URLs / actions network entries observed |
| **Public Robinhood RPC** | **Yes** — what Scan uses today; rate-limited, not recommended for production by RH docs |

**Conclusion:** Option A is **available**, not constrained by missing providers. The constraint is **ROI**: Scan’s Deep wall is mostly **Blockscout pagination + discovery algorithm**, not lack of an Alchemy URL.

---

## 8. What money cannot fix

1. **Need for honest Incomplete** until genesis / exhaustive rules — paying more does not make a 6-page recent tier “complete Creator.”
2. **FOX-scale history volume** (~2,276 Blockscout pages) — cannot finish in one Soft 120s budget without changing product semantics (forbidden) or async multi-pass (engineering).
3. **Sequential stage orchestration** — more CPU/RAM on Vercel does not parallelize `relationships → liquidity → creatorBurn` until Phase 6.
4. **Blockscout page RTT** — premium **RPC** does not accelerate explorer HTTP; only fewer pages, parallel fetch (careful with rate limits), or owning an index.
5. **Timeout inflation as a strategy** — forbidden by Cold/Perf V2; longer Pro durations are a reliability escape hatch, not a latency product.
6. **Score / LP / Burn / risk formula “speedups”** — out of scope; must not be purchased as shortcuts.

---

## 9. Incorporating NBD stall-progress partial (`0x57ff…de00f`)

Artifact: `reports/data/stall_progress_prod_trace.json` (2026-07-28).

| Observation | Implication for cost–benefit |
|-------------|------------------------------|
| Refresh completed in **~4.6s** with KV hit | Warm/stale path is already fast; **not** an infra latency crisis for this CA |
| Creator/Burn **5 pages / 250 transfers**, `paginationComplete=false` | Recent-first / Incomplete honesty working; money won’t “finish” genesis in that window |
| `lockAvail=false`, `knownVerified=false` | Lock Dist still discovery-bound (P5 territory), not RPC plan tier |
| `stallWindows=[]`, hypothesis `sparse_milestone_publishes` | UX progress density ≠ spend; Phase 6 progressive publish is the fix |
| Verdict hint `STATIC_OR_SPARSE_PROGRESS` | Do **not** interpret as “buy faster servers” |

Confidence that this trace generalizes to FOX cold: **LOW** (different token class / warm cache).

---

## 10. Final recommendation

1. **Spend engineering on Phases 5–6 next** (Quick LP + true parallel Deep). Highest ROI toward the locked 30–60s useful-Deep goal without formula changes.
2. **Optionally point `NEXT_PUBLIC_RPC_URL` at Alchemy free (or Chainstack/QuickNode)** for production reliability — expect reliability & modest LP RPC gains, **not** Creator/Burn transformation. Measure before/after FOX Lock Dist / HANSOME known-first under Production concurrency.
3. **Defer dedicated worker / self-hosted indexer / own explorer** until P5–7 land and Production volume shows background genesis failing for product-critical tokens.
4. **Do not** buy Vercel duration / Enterprise hoping Scan feels fast; **do not** raise soft budgets as the strategy.

**Bottom line:** At current architecture, **money alone cannot meaningfully replace the remaining Cold Perf V2 engineering**. A small RPC spend is reasonable hygiene; the latency cliff is still Blockscout work + LP discovery + sequential Deep jobs.

---

## 11. Evidence index

| Artifact | Use |
|----------|-----|
| `reports/HANSOME_SCAN_LATENCY_AUDIT.md` | Cold ~298s; LP ~191s; Creator ~106s; warm ~0ms |
| `reports/HANSOME_DEEP_SCAN_PERFORMANCE_V2_DESIGN.md` | Budgets, FOX math, job options A/B/C |
| `reports/HANSOME_COLD_SCAN_V2_DESIGN.md` | Recent-first / quick LP / parallel pillars |
| `reports/HANSOME_COLD_PERF_V2_UNIFIED_IMPLEMENTATION_PLAN.md` | P1–P8 order + latency stack |
| `reports/HANSOME_COLD_PERF_V2_PHASE2_PHASE3_STAGED_PRODUCTION.md` | P2/P3 shipped |
| `reports/HANSOME_COLD_PERF_V2_PHASE4_RECENT_FIRST_PRODUCTION.md` | P4 shipped |
| `reports/HANSOME_FOX_DEEP_RUNTIME_DIAGNOSIS.md` | FOX multi-minute Collecting / retries |
| `reports/HANSOME_FOX_DEEP_SECTIONS_DIAGNOSIS.md` | ~2.0–2.3s/page; 40 pages ≪ genesis |
| `reports/HANSOME_LP_DISCOVERY_PERFORMANCE.md` | ~123s RPC vs ~34s PM pages |
| `reports/HANSOME_DEEP_SCAN_RELIABILITY.md` | `maxDuration=300` necessity |
| `reports/HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md` | Vercel + Upstash; worker isolation |
| `reports/data/stall_progress_prod_trace.json` | NBD partial production watch |
| `lib/hansome-score/scan-deep.ts` | Soft budgets / 270s wall |
| `app/api/scan/route.ts` | `maxDuration = 300` |
| `.env.example` / `lib/hansome-score/rpc.ts` | Public RH RPC + Blockscout |

---

## Confirmations

- [x] Analysis only — **no implementation**
- [x] **No deploy**
- [x] Estimates ranges + confidence; no invented precise ms where data thin
- [x] Robinhood provider support checked for Option A
- [x] Money-cannot-fix list explicit
