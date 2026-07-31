# HANSOME — Production Deployment Readiness

| Field | Value |
|-------|-------|
| **Date** | 2026-07-28 |
| **Scope** | HANSOME Score Scan Public Beta (cache MVP + Supply&Burn P0–P3 + Fast/Deep Scan) |
| **Deployed** | **No** |

---

## READY TO DEPLOY: YES

**Caveats (non-blocking if operator verifies before click):**

1. Vercel Production must have **KV / Upstash** configured (`KV_REST_API_URL` + `KV_REST_API_TOKEN` or Upstash aliases).
2. Cold **deep** analysis still takes **minutes** (LP + creator pagination) — UX is non-blocking via Fast Scan + polling; do not expect deep &lt;15s.
3. Fast Scan TTFR measured **~12.4s** (ASTEROID) / **~17s** (HANSOME local) — within/near 5–15s; network variance applies.
4. Deploy only after **explicit user approval**.

---

## Gate results

| Check | Result |
|-------|--------|
| `npm run test:scoring` | **PASS** — 407/407 |
| `npm run build` | **PASS** — exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | **PASS** — zero errors (`lib/**/_tmp-*.ts` excluded) |
| P2/P3 validation | **PASS** — [`HANSOME_SUPPLY_AND_BURN_P2P3_VALIDATION.md`](HANSOME_SUPPLY_AND_BURN_P2P3_VALIDATION.md) |
| Public Beta GO/NO-GO | **GO** — [`HANSOME_PUBLIC_BETA_GO_NO_GO.md`](HANSOME_PUBLIC_BETA_GO_NO_GO.md) |

---

## Frozen feature regression (P2/P3 + Fast/Deep)

| Feature | Status |
|---------|--------|
| Overall Token Score / Structural / HANSOME Level / Analysis Coverage | Unchanged formulas; Fast path marks **provisional** until deep |
| Liquidity V2–V4 + Locked/Unlocked | Deep-only; Fast shows Pending / Unknown — honest |
| Creator Behaviour | Deep-only; provisional Score path until indexed |
| Holders / wallet relationships | Holders sample in Fast; relationships deep |
| Supply & Burn P0/P1 | Fast includes dead inventory + mechanisms |
| Supply & Burn P2/P3 | Deep / `scan:burn:*`; Incomplete → Unknown/Incomplete |
| Scan cache / same-CA dedupe | Preserved + fast/deep coalescing |

**Confirm:** burns never boost Structural/Overall; admin burn Contract Risk unchanged.

---

## Latency (cite)

| Metric | Value |
|--------|------:|
| Fast Scan TTFR (ASTEROID) | **12,390 ms** |
| Fast Scan TTFR (HANSOME) | **~17,263 ms** |
| Cached revisit | **0 ms** (memory) |
| Concurrent 5 first-touch same CA | **~24.8 s** wall (1 fast + 4 inflight) |
| Concurrent 10 / 25 after warm | **0 ms** |
| P2/P3 CPU on shared transfers | **~11–12 ms** |
| Deep completion | **minutes** (async; not on critical HTTP path) |

`/api/scan` **maxDuration = 60** (Fast). Deep continues via Next.js `after()` + inflight coalesce.

---

## Incomplete / Unknown honesty

- Burn windows incomplete → UI **Unknown / Incomplete** (never partial-as-full)
- Fast LP / creator / relationships → Pending / analyzing / provisional scores
- Unknown never silently becomes No

---

## Production KV / Upstash

| Key | Required |
|-----|----------|
| `KV_REST_API_URL` **or** `UPSTASH_REDIS_REST_URL` | **Yes** for multi-instance cache |
| `KV_REST_API_TOKEN` **or** `UPSTASH_REDIS_REST_TOKEN` | **Yes** |

Prefixes: `scan:snapshot:*`, `scan:meta:*`, `scan:lock:*`, `scan:rl:*`, `scan:burn:*` — isolated from forum/vault.

Without KV: in-process memory still works on a single instance but **not** durable across serverless isolates.

---

## Vercel function duration

| Route | maxDuration |
|-------|-------------|
| `/api/scan` | **60** (Fast Scan response) |
| `/api/scan/status` | **60** |
| Deep work | `after()` — subject to Vercel plan limits; coalesced per CA |

---

## Env checklist (no secret values)

Must be set on **Vercel Production** (see `.env.example`):

| Var | Notes |
|-----|-------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Scan cache |
| `NEXT_PUBLIC_RPC_URL` | Public RPC (client/server) |
| `NEXT_PUBLIC_EXPLORER` | Blockscout base |
| `NEXT_PUBLIC_CHAIN_ID` | 4663 |
| `NEXT_PUBLIC_CONTRACT` / game addresses | Existing site config |
| Server-only game/settlement secrets | Unrelated to Scan; do not expose to client |

**Client-safe:** only `NEXT_PUBLIC_*`. KV tokens must **never** be `NEXT_PUBLIC_`.

---

## Public Beta labeling

Scan UI eyebrow: **PUBLIC BETA · OVERALL + STRUCTURAL**; subtitle notes Public Beta (en/zh).

---

## Production smoke plan (post-deploy — do not run deploy here)

1. **HANSOME CA** — open `/scan/<HANSOME>`; expect Fast or cache; stages complete if warm; Overall/Structural present; Last Updated visible.
2. **Previously cached CA** — revisit within 15m; expect memory/KV hit &lt;2s; `cache.hit=true`.
3. **Completely new CA** — paste unused address; expect usable screen in ~15s with **Provisional** + “Deep analysis in progress…”; poll until complete (may take minutes).
4. **Invalid CA** — expect 400 / error UI, no hang.
5. **Concurrent same-CA** — open 5 tabs same new CA nearly together; expect one Fast + coalesced deep (no stampede of full scans).

---

## Temp / debug scripts

- `lib/hansome-score/_tmp-*.ts` excluded from root `tsconfig.json` (not in production typecheck/build graph as app routes).
- Not imported by `app/` production routes.

---

## Blocking issues

**None remaining after remediations** (Fast Scan shipped; tests/build/tsc green).

Operator pre-flight: confirm KV on Vercel Prod, then await user deploy approval.

---

## Confirmations

- [x] Not deployed
- [x] READY TO DEPLOY: **YES** (with caveats above)
- [x] P2/P3: **PASS**
- [x] Fast Scan non-blocking cold UX
