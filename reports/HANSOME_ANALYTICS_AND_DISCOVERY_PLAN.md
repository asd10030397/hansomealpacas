# HANSOME Analytics & Discovery — Product Plan

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Status** | Design / roadmap only — **not implemented** |
| **Scope** | Unique visitors · Scan search stats · Most Searched / Hot CA UI concepts |
| **Related** | [`HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](./HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md), [`FORUM_KV_MIGRATION.md`](./FORUM_KV_MIGRATION.md), [`docs/HANSOME_TAXONOMY_AND_EXPLORE.md`](../docs/HANSOME_TAXONOMY_AND_EXPLORE.md) |
| **Plan verdict** | **PASS** (with Score gate before any build) |

---

## 0. Do not implement until Score gate approved

**Hard gate:** Score / Data Confidence / Overall Score accuracy work continues uninterrupted.

| Forbidden now | Reason |
|---------------|--------|
| Change scoring engine / Confidence / Overall Score formulas | In-flight accuracy work |
| Deploy analytics endpoints or UI | Not approved; Score first |
| Build `/explore` beyond planning notes | Taxonomy roadmap already defers Explore |
| Mix search popularity into Score or “safer” copy | Product integrity |
| Require operator PC online for counters | Cloud-only requirement |

**Allowed now:** This plan document + optional one-line pointers in Explore/taxonomy docs.

**Priority order (locked):**

1. Score / Data Confidence accuracy  
2. Persistent analytics foundation  
3. Visitor counter  
4. Search tracking  
5. Most Searched ranking  
6. `/explore` integration  

---

## 1. Executive recommendation

Ship discovery analytics **after** the Score accuracy gate, on **existing Vercel + Upstash Redis (Vercel KV)** — no new database for MVP.

| Feature | Public surface | Core rule |
|---------|----------------|-----------|
| **Estimated Unique Visitors** | Homepage / footer **HANSOME STATS** | Dedupe by **24h hashed visitor key**; label as *estimated* |
| **Most Searched CAs** | Future `/explore` tab (separate) | Rank by **unique searchers + growth/velocity**, not raw hits |
| **Hot / Trending searches** | Same Explore family; windows **24H / 7D / All-time** | **≠** Market Trending · **≠** Score · **≠** Activity · **≠** Category · **PROMOTED never mixed** |

**Cloud-only:** All write/read paths run on Vercel serverless + KV. Operator laptop offline must not stop counters or public stats.

**Plan verdict: PASS** — infra already provisioned; privacy and anti-spam models are clear; scope stays out of Score.

---

## 2. Infrastructure inventory (facts — do not invent)

From [`HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](./HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md) and Forum KV reports:

| Layer | Status | Notes |
|-------|--------|-------|
| Next.js on **Vercel** | Live | `vercel.json` — no crons configured today |
| **Upstash Redis via Vercel KV** | Provisioned | Store `upstash-kv-apricot-nest`; `KV_REST_API_URL` / `KV_REST_API_TOKEN` |
| Packages | Present | `@vercel/kv`, `@upstash/redis` in root `package.json` |
| Forum keys | `forum:*` | Deployed KV path |
| Commit vault | `hansome:cv:v1:*` | Same Redis; isolate analytics prefix |
| Scan cache (planned) | `scan:*` | Design only — not this feature’s keys |
| **Postgres / Neon / Prisma / Drizzle** | **Not used** by Next.js app | |
| In-memory only | Insufficient | Multi-instance + redeploy lose counters |
| Settlement worker Redis | Unrelated | Do not couple analytics to Railway settlement |

### 2.1 Store choice evaluation

| Option | Fit for MVP analytics | Verdict |
|--------|----------------------|---------|
| **Existing Upstash / Vercel KV** | Counters, TTLs, sorted sets, HyperLogLog, rate-limit keys; already wired | **Recommended MVP** |
| **New Upstash DB** | Isolation vs forum/vault/scan | Unnecessary cost/ops for MVP — use prefix `analytics:*` |
| **Postgres / Neon** | Rich history, SQL aggregates, Explore joins | **Later** (when history charts / admin queries justify it) |
| **Vercel KV vs Upstash Redis client** | Same store; use existing `@vercel/kv` / Upstash REST patterns | Reuse code style from forum/vault |
| **Memory-only** | Breaks on cold start / multi-instance | **Reject** for production counters |

**Required infrastructure (MVP):**

1. Existing Vercel deployment (already).  
2. Existing Upstash/KV env vars (already).  
3. New isolated key prefix `analytics:*` (no collision with `forum:*`, `hansome:cv:v1:*`, planned `scan:*`).  
4. Optional later: Vercel Cron (or scheduled route) for rank materialization every 5–15 min — **not required day-one** if ranks update on write + lazy recompute with cache TTL.  
5. **No new Postgres** until Score gate + analytics MVP prove need.

---

## 3. Cost estimate (ballpark USD / month)

Incremental cost assumes **reuse of the already-linked Upstash store**.

| Stage | Traffic assumption | Ballpark |
|-------|--------------------|----------|
| **MVP** | Low site traffic + Scan search volume; shared Free/PAYG store | **$0–10 / mo** incremental (often $0 if under free command/storage limits; ~$10 if Fixed 250MB preferred for headroom) |
| **Early growth** | Public stats + search events + Scan cache also on same Redis | **$10–40 / mo** Upstash PAYG or Fixed 1GB (~$20) |
| **Later + Postgres** | Neon free/launch tier for history | **+$0–19 / mo** Neon + Redis as above → roughly **$20–60 / mo** total analytics+history |

Notes:

- Scan snapshot caching (separate plan) will dominate Redis command volume before analytics does.  
- Analytics should use compact counters / sorted sets / short TTLs — not raw event dumps forever.  
- Figures are ballparks; monitor Upstash dashboard after ship.

---

## 4. Visitor model recommendation

### Recommendation: **24-hour unique visitors** (primary public metric)

Public label: **“Estimated Unique Visitors (24h)”**

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **24h window** | Privacy-friendly TTLs; matches “not forever inflate”; honest for NAT/VPN; cheap keys | Not lifetime reach | **Recommend** |
| **Permanent / long-term unique** | Vanity “all-time uniques” | Indefinite hash storage; carrier IP recycle false uniques/false repeats; worse privacy story | **Do not use as primary** |
| **Optional all-time estimate** | Marketing curiosity | Prefer sum of daily uniques or HyperLogLog with salt rotation — not permanent raw IP storage | Optional secondary only |

### Rationale

1. Same IP must not increment on every page hit → store `SET NX` (or equivalent) on `hash(visitor)` with **TTL ≈ 24–48h**.  
2. Permanent uniqueness requires keeping visitor keys forever → conflicts with “don’t store identifiers longer than necessary.”  
3. NAT / CGNAT / VPN / mobile carrier pools mean one IP ≠ one person and one person ≠ one IP → wording must stay **Estimated**.  
4. 24h metric is actionable for ops (“is traffic up today?”) without claiming census accuracy.

### Visitor identity (privacy-preserving)

```
visitor_key = HMAC-SHA256(secret, ip + "|" + ua_normalized + "|" + day_bucket?)
```

Rules:

- **Never** store or expose raw IP publicly.  
- Prefer **HMAC with server secret** over plain SHA of IP (prevents rainbow / offline re-identification if dump leaks).  
- Optionally fold truncated UA (browser family only) to reduce pure-IP collision under NAT — still imperfect.  
- Rotate or day-bucket salt if long retention of hashes is undesired; for 24h metric, **TTL delete is enough**.  
- Drop raw IP from logs for analytics paths; rely on edge headers only inside the write handler, then discard.

### Limitations (disclose)

- Shared office / university / CGNAT → under-count people.  
- VPN / Tor / frequent mobile IP change → over-count people.  
- Bots / scrapers may still inflate unless filtered (see §7).  
- Therefore: **Estimated Unique Visitors**, never “Users” or “Wallets.”

---

## 5. Search stats & ranking

### 5.1 What to record (per successful Scan search)

| Field | Public? | Notes |
|-------|---------|-------|
| Normalized contract address | Yes | Checksum / lowercase canonical |
| Chain id | Yes (if multi-chain later) | MVP may be fixed 4663 |
| Search hit count | Internal / optional | Not primary rank |
| Unique searchers | Yes (aggregated) | Primary rank input |
| Last searched at | Yes | ISO timestamp |
| Windows | 24h / 7d / all-time | Materialized counters |

A **searcher** = same privacy hash family as visitors (IP+UA HMAC), **not** wallet address (Scan may be used logged-out).

### 5.2 Anti-spam / uniqueness windows

| Control | Suggested default |
|---------|-------------------|
| Same `searcher_hash` + CA | Count **at most once per 30–60 minutes** toward unique searchers; raw hit may still bump a capped “hits” counter |
| Per IP overall Scan rate | Align with Scan cache plan (~1 full refresh / 2 min) — analytics write should be cheaper and also rate-limited |
| Invalid / non-address queries | Do not count |
| Self / known infra IPs | Optional denylist |
| Burst identical CA from many IPs | Velocity caps + anomaly flag (ops), not auto-ban day one |

### 5.3 Ranking formula sketch (Most Searched / Hot)

**Most Searched ≠ safer.** UI footnote mandatory.

Primary score for window `W` ∈ {24h, 7d, all}:

```
unique_W     = unique searchers in window
growth_W     = unique_W / max(unique_prev_W, 1)     // e.g. prior 24h
velocity_W   = unique_W / max(hours_in_W, 1)

rank_score_W =
    1.0 * log1p(unique_W)
  + 0.5 * log1p(max(growth_W, 0))
  + 0.3 * log1p(velocity_W)
  - spam_penalty
```

| Rule | Detail |
|------|--------|
| Rank by **unique searchers / growth / velocity** | Not raw page hits or bot loops |
| `spam_penalty` | High hits / unique ratio, scripted UA, denylisted patterns |
| **PROMOTED** | Separate labeled rail/slot only — **never** inserted into organic sorted lists |
| **≠ Market Trending** | Market Trending uses on-chain/market momentum (taxonomy doc); search popularity is discovery interest only |
| Cold start | Require minimum unique threshold (e.g. ≥3 unique in 24h) before appearing on Hot |

### 5.4 Refresh cadence

| Surface | Cadence |
|---------|---------|
| Public visitor + aggregate stats | Cache **1–5 min** |
| Trending / Most Searched ranks | Recompute or serve materialized rank **5–15 min** |

---

## 6. Data model

### 6.1 Logical minimum (names)

| Logical store | Role |
|---------------|------|
| `visitor_events` | Deduped visitor observations (or ephemeral KV keys standing in for events) |
| `scan_events` | Deduped search observations (searcher × CA × window) |
| `token_search_stats` | Per-address aggregates + last searched + rank inputs |

MVP may implement these as **KV structures** without SQL tables. Grow to Postgres with the same logical names later.

### 6.2 KV key design (MVP — recommended)

Prefix: `analytics:` (isolated).

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `analytics:visitor:seen:{yyyyMMddHH}:{visitor_hash}` | string `"1"` | 48h | Hourly bucket membership for 24h unique |
| `analytics:visitor:hll:24h` *or* per-hour counters | HLL / INCR | ~48h | Approximate or exact-ish 24h unique count |
| `analytics:stats:public` | hash/json | — | Cached public payload `{ estimatedUniqueVisitors24h, updatedAt }` |
| `analytics:scan:dedupe:{searcher_hash}:{addr}` | string | 30–60m | Same searcher+CA window |
| `analytics:scan:uniq:{window}:{addr}` | SET or HLL | window+skew | Unique searchers per CA |
| `analytics:scan:hits:{window}:{addr}` | int | window+skew | Capped hit counter (secondary) |
| `analytics:scan:last:{addr}` | string ISO | long | Last searched |
| `analytics:scan:meta:{addr}` | hash | long | Aggregates snapshot |
| `analytics:rank:{window}` | ZSET score→addr | — | Materialized Most Searched |
| `analytics:rl:ip:{visitor_hash}` | int/ttl | minutes | Write rate limit |
| `analytics:meta` | object | — | Schema version |

**Simpler MVP variant:** skip per-event persistence entirely — only dedupe keys + aggregate counters + one public stats JSON + rank ZSETs.

### 6.3 SQL sketch (optional later — Neon/Postgres)

```sql
-- Only if/when KV aggregates become painful to query historically.

CREATE TABLE visitor_events (
  id              bigserial PRIMARY KEY,
  visitor_hash    bytea NOT NULL,
  day_utc         date NOT NULL,
  hour_utc        timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_hash, day_utc)  -- or hour grain if preferred
);

CREATE TABLE scan_events (
  id              bigserial PRIMARY KEY,
  chain_id        int NOT NULL,
  address         citext NOT NULL,
  searcher_hash   bytea NOT NULL,
  window_bucket   timestamptz NOT NULL, -- floored to hour
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, address, searcher_hash, window_bucket)
);

CREATE TABLE token_search_stats (
  chain_id        int NOT NULL,
  address         citext NOT NULL,
  unique_24h      int NOT NULL DEFAULT 0,
  unique_7d       int NOT NULL DEFAULT 0,
  unique_all      int NOT NULL DEFAULT 0,
  hits_24h        int NOT NULL DEFAULT 0,
  last_searched_at timestamptz,
  rank_score_24h  double precision,
  rank_score_7d   double precision,
  rank_score_all  double precision,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, address)
);

-- No raw IP columns. Ever.
```

---

## 7. Anti-bot / anti-manipulation (basics)

| Control | MVP |
|---------|-----|
| Rate limit writes per visitor hash | Yes |
| Same IP/hash + CA cooldown | Yes (30–60m unique credit) |
| Ignore obvious bot UAs / HEAD / health probes | Yes |
| Do not count failed / invalid address lookups | Yes |
| Rank by unique searchers, not hits | Yes |
| Minimum unique threshold for Hot list | Yes |
| CAPTCHA / Proof-of-work | Later if abused |
| Wallet-signed search | Out of scope (Scan is public) |
| PROMOTED rail isolation | Product rule — forever |
| Manual denylist of addresses / hashes | Ops escape hatch |
| Anomaly alerts (optional) | Spike in hits/unique ratio |

**Product copy rule:** Popularity is curiosity, not safety. Never imply Most Searched ⇒ safer / audited / endorsed.

---

## 8. Privacy approach & disclosure

### 8.1 Approach summary

- Hash/HMAC identifiers; **never publish IPs**.  
- Retain dedupe keys only as long as the metric window needs (≈24–48h for visitors; window+skew for search uniques).  
- Aggregates (counts, ranks, last searched address) are non-personal.  
- Cloud processing on Vercel + Upstash only.

### 8.2 Public disclosure copy (EN)

> **Estimated Unique Visitors**  
> We estimate unique visitors using short-lived, irreversible identifiers derived from connection metadata (for example, a keyed hash of IP and basic browser information). We do not publish IP addresses. Because many people can share one network address (offices, mobile carriers, VPNs) and one person can appear under many addresses, these figures are **estimates**, not exact people counts. Deduplication uses a rolling window (typically 24 hours) so the same visitor does not inflate the counter on every page view. Search-popularity lists reflect interest in contract lookups on HANSOME Scan; they are **not** a safety rating and are separate from HANSOME Score, Activity, Market Trending, and Category.

**ZH:** Provide Traditional Chinese equivalent in a later copy pass (same meaning; keep “估計／約略不重複訪客” tone). Do not block eng on ZH.

### 8.3 Internal retention

| Data | Retention |
|------|-----------|
| Raw IP in analytics path | Memory only during request; not stored |
| `visitor_hash` keys | TTL ~48h |
| Search dedupe keys | TTL 30–60m (plus window sets up to 7d/all-time aggregates without raw events) |
| Aggregated public stats | Indefinite (counts only) |
| Server logs | Follow existing ops log policy; avoid logging full IP+UA+address together when possible |

---

## 9. UI placement plan (concepts only)

### 9.1 Homepage / footer — HANSOME STATS

- Small **HANSOME STATS** strip or footer cluster.  
- Show **Estimated Unique Visitors (24h)** (+ optional “as of” timestamp).  
- Refresh client fetch every **1–5 min** from cached API.  
- No IP, no charts required for MVP.  
- Do not dominate hero; keep brand/game composition intact.

### 9.2 `/explore` tabs (future — after Score + analytics foundation)

Hard separation (extends taxonomy doc):

| Tab / rail | Meaning |
|------------|---------|
| **Most Searched** | Organic scan interest (this plan) |
| **Hot (24H / 7D / All-time)** | Velocity-weighted search interest |
| **Market Trending** | On-chain/market momentum (existing Explore roadmap) |
| **Category** | Taxonomy labels |
| **PROMOTED** | Paid/labeled only — never inside organic Most Searched |

Each Most Searched row (concept): address (truncated + copy), unique searchers, last searched, optional 24h growth — **no Score as a popularity proxy**. Score/Activity/Confidence remain separate chips if Explore shows them.

### 9.3 `/scan` instrumentation (no UX redesign now)

- On accepted Scan query, fire server-side analytics write (deduped).  
- Do not block Scan response on analytics failure (best-effort).  
- Do not show “#3 most searched” on Score card in MVP (avoids safety confusion).

---

## 10. API sketch (future implementation)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/analytics/visit` (or middleware on key pages) | Record visitor (rate-limited, hashed) |
| Existing `/api/scan` | Side-effect: record search stats after validation |
| `GET /api/analytics/stats` | Public aggregates; `Cache-Control` / KV cache 1–5 min |
| `GET /api/analytics/most-searched?window=24h\|7d\|all` | Ranked list; cache 5–15 min |

All cloud-only; no PC feeder.

---

## 11. Roadmap phases & eng-days (rough)

| Phase | Work | Eng-days | Depends on |
|-------|------|----------|------------|
| **0. Score gate** | Accuracy / Confidence / Overall Score — **current work** | *(ongoing — not counted here)* | — |
| **1. Persistent analytics foundation** | `analytics:*` helpers, HMAC secret env, public stats cache shape, failure isolation | **1–2** | Score gate approved |
| **2. Visitor counter** | Visit ingest + 24h dedupe + footer/stats read API | **1–2** | Phase 1 |
| **3. Search tracking** | Scan side-effect + dedupe window + `token_search_stats` aggregates | **2–3** | Phase 1 |
| **4. Most Searched ranking** | Formula + ZSET materialization + window params + footnotes | **1–2** | Phase 3 |
| **5. `/explore` integration** | Tabs: Most Searched vs Market Trending; Hot windows; PROMOTED isolation | **3–5** | Phase 4 + Explore readiness |

**Total after Score gate (to Explore tabs):** roughly **8–14 eng-days**.

Do **not** parallelize Phase 2–5 ahead of Score accuracy without explicit user approval.

---

## 12. Explicit answers (pre-implementation checklist)

| Question | Answer |
|----------|--------|
| **Required infrastructure** | Existing Vercel + existing Upstash/KV; new `analytics:*` keys; optional Cron later; **no** new DB for MVP |
| **Database schema** | Logical `visitor_events` / `scan_events` / `token_search_stats`; MVP = KV (§6.2); SQL (§6.3) later |
| **Privacy approach** | HMAC visitor/searcher keys; no public IPs; short TTL; “Estimated Unique Visitors”; EN disclosure §8.2 |
| **Anti-bot logic** | Rate limits, searcher+CA cooldown, bot UA filter, unique-based rank, min threshold, PROMOTED isolation (§7) |
| **Estimated development time** | **8–14 eng-days** after Score gate (see §11) |
| **Estimated monthly cost** | MVP **$0–10**; growth **$10–40**; later +Postgres **~$20–60** total ballpark (§3) |

---

## 13. Alignment with Scan cache plan

[`HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](./HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md) already states Postgres is **later** for history/Explore/analytics and that Scan must be cloud-only on existing KV.

This plan:

- Reuses that inventory.  
- Uses a **separate** `analytics:*` prefix from planned `scan:*` snapshots.  
- Does **not** require Scan cache to ship first, but Phase 3 (search tracking) should not destabilize `/api/scan` latency (async / best-effort writes).

---

## 14. Plan verdict

| Criterion | Result |
|-----------|--------|
| Honors Score-first priority | Yes |
| Cloud-only / no PC dependency | Yes |
| Privacy-credible visitor model | Yes — 24h estimated uniques |
| Search anti-spam + unique ranking | Yes |
| Most Searched ≠ Market Trending ≠ Score | Yes |
| Infra matches existing repo | Yes — Upstash/KV |
| Implementation started? | **No** |

**Recommendation for this plan document: PASS**

Implement only after explicit Score gate approval and in the priority order in §0.
