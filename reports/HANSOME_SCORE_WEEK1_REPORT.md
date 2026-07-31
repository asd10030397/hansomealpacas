# HANSOME Score — Week 1 Report

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Spec** | [`docs/HANSOME_SCORE_V1_SPEC.md`](../docs/HANSOME_SCORE_V1_SPEC.md) `1.0.0-week1` |
| **Taxonomy / Explore plan** | [`docs/HANSOME_TAXONOMY_AND_EXPLORE.md`](../docs/HANSOME_TAXONOMY_AND_EXPLORE.md) — **Week 2–4 only** |
| **Mode** | Local prototype — **no production deploy**, no git push |
| **Primary token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` · chainId **4663** |
| **Historical freeze** | Week 1 Score **92** is frozen under v1 rules. Live scoring moved to v1.1 — see [`HANSOME_SCORE_V1_1_SPEC.md`](../docs/HANSOME_SCORE_V1_1_SPEC.md) and [`HANSOME_SCORE_WEEK1_5_HARDENING.md`](HANSOME_SCORE_WEEK1_5_HARDENING.md). Do not rewrite this report’s arithmetic. |

---

## What works

- Frozen Score v1 spec: Score / Activity / Confidence separated; liquidity size vs ownership split; no AI scoring; HANSOME holdings never boost Score.
- Taxonomy + Explore + Trending documented as **future** — **`/explore` not built in Week 1**.
- End-to-end `/scan` prototype:
  - `app/scan/page.tsx` — paste CA (prefill HANSOME), scan button, mobile-first results
  - `app/scan/[address]/page.tsx` — shareable server-rendered result route
  - `app/api/scan/route.ts` — GET/POST server-side fetch + score
  - `lib/hansome-score/*` — pure TS engine + Blockscout/RPC fetchers
- Live HANSOME scan returns real on-chain numbers with explainable deductions.
- Unit tests: `lib/hansome-score/__tests__/score.test.ts` (7 passed).
- Light footer link: **Score Scan** → `/scan` (GameFi untouched).

---

## Live HANSOME scan (verified against RPC + Blockscout)

**Scanned at:** ~2026-07-27T12:22Z (re-check after rule refine ~12:23Z)

| Field | Value |
|-------|-------|
| **HANSOME Score** | **92** / 100 |
| **Activity** | **Low** (source: `geckoterminal`) |
| **Confidence** | **90%** (−10 creator behaviour not indexed) |
| Name / symbol | Hansome Alpacas / HANSOME |
| Decimals | 18 |
| totalSupply | **1,000,000,000** |
| Holders (Blockscout) | **92** |
| Transfers (counters) | **1091** |
| Deployer | `0xfEff679d14f7D1a2F343095680430e4c96dE691F` |
| Creation tx | `0x4bea41a20de1adc9eae1ecd48050f20b182228cf35d18c093e73c0def64aadff` |
| Contract verified | **true** |
| Token age | ~**15.8 days** |
| PoolManager balance | ~**114,191,367** HANSOME |
| Pool id | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |
| LP lock | **locked** (TitanLocker Position NFT #47299 → 2027-07-15) |
| GT volume 24h | ~**$51** (Activity only) |
| GT txs 24h | **3** (Activity only) |

### Deductions (Score 100 → 92)

| Points | Category | Code | Reason |
|--------|----------|------|--------|
| **−8** | wallet_relationship | `equal_balance_cluster` | 18 top holders share identical balances (probabilistic) |

- Liquidity ownership: **0** (locked LP evidence)
- Holder concentration: **0** (PoolManager excluded; top non-pool holder ~6%)
- Launch fairness: **0** (deployer share low; verified)
- Creator behaviour: **0** (unavailable — Confidence only)

### Sample UI output (no screenshots captured)

Three cards on `/scan` / `/scan/0x2C38…`:

1. **Score 92** — “Structural risk & transparency — not popularity.”
2. **Activity Low** — Source: geckoterminal
3. **Confidence 90%** — data completeness / maturity note

Below: Overview (supply, holders, deployer, PoolManager bal, LP lock detail), Deductions list, Risk flags (`lp_locked`, `possible_related_wallets`, `creator_behaviour_unavailable`), Top holders sample with labels, Data sources, Disclaimers.

### Sample JSON shape (`GET /api/scan?address=0x2C38…`)

```json
{
  "version": "1.0.0-week1",
  "score": { "score": 92, "base": 100, "deductions": [{ "points": 8, "code": "equal_balance_cluster" }] },
  "activity": { "level": "Low", "source": "geckoterminal", "volume24hUsd": 51.43, "transactions24h": 3 },
  "confidence": { "percent": 90 },
  "overview": {
    "symbol": "HANSOME",
    "totalSupplyFormatted": "1000000000",
    "holdersCount": 92,
    "deployer": "0xfEff679d14f7D1a2F343095680430e4c96dE691F",
    "lpLockStatus": "locked",
    "poolManagerBalanceFormatted": "114191367.508…"
  }
}
```

---

## What data retrieved successfully

| Source | Data |
|--------|------|
| Robinhood RPC | name, symbol, decimals, totalSupply, PoolManager `balanceOf`, deployer `balanceOf` |
| Blockscout `/api/v2/tokens/{addr}` | metadata + holders_count |
| Blockscout `/api/v2/tokens/{addr}/counters` | holders + transfers |
| Blockscout `/api/v2/tokens/{addr}/holders` | top ~50 holder rows |
| Blockscout `/api/v2/addresses/{addr}` | creator + creation tx |
| Blockscout smart-contracts | verified ≈ true |
| Blockscout tx timestamp | token age |
| `content/transparency.ts` | official labels + HANSOME LP lock metadata |
| GeckoTerminal | Activity vol/txs only (labeled; does **not** affect Score) |

---

## What failed / unreliable

| Item | Notes |
|------|-------|
| Creator sell/transfer indexing | **Not built** — Confidence −10; no Score deduction invented |
| Arbitrary-token LP lock detection | Week 1 only knows HANSOME lock via transparency; others → `unknown` (−10 Score ownership + Confidence) |
| Holder list completeness | Blockscout returns a page (~50); fine for Week 1 sample |
| Activity without GT | Falls back to counters; 24h velocity weak |
| Equal-balance heuristic | Flags many ops/buyer wallets with identical 18M balances — intentional probabilistic wording, not “same owner” |
| Screenshots | Not captured in this session — UI described + live JSON above |

---

## Actual RPC / API requirements

| Requirement | Value |
|-------------|-------|
| RPC | `https://rpc.mainnet.chain.robinhood.com` (or `NEXT_PUBLIC_RPC_URL`) |
| Explorer API | `https://robinhoodchain.blockscout.com/api/v2/...` |
| Optional Activity | `https://api.geckoterminal.com/api/v2/networks/robinhood/...` |
| Env | No new secrets required for Week 1 read-only scan |
| Runtime | Node.js Next route (`runtime = "nodejs"`) |

---

## How to run locally

```bash
npm run dev
# open http://localhost:3000/scan
# or http://localhost:3000/scan/0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875

# unit tests
npx vitest run --config vitest.config.ts lib/hansome-score/__tests__/score.test.ts

# CLI live scan (optional)
npx tsx -e "import { scanToken } from './lib/hansome-score/scan.ts'; scanToken('0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875').then(r=>console.log(r.score.score, r.activity.level, r.confidence.percent))"
```

**Do not deploy to production. Do not push to trigger prod.**

---

## Taxonomy / Explore (Week 2–4 plan — not Week 1)

From [`docs/HANSOME_TAXONOMY_AND_EXPLORE.md`](../docs/HANSOME_TAXONOMY_AND_EXPLORE.md):

| Window | Work |
|--------|------|
| Week 1 | `/scan` only ← **this report** |
| Week 2–3 | Category/tag metadata storage; project-submit + HANSOME manual verify; **no LLM** |
| Week 3–4 | `/explore` **if** scanner stable |
| Later | Trending v1 (relative momentum); paid = labeled **Promoted** only |

**Score ≠ Activity ≠ Trending ≠ Category.** Category must never affect HANSOME Score.

---

## Recommendations before Week 2

1. Index creator sells/transfers (Blockscout token transfers) for creator-behaviour category.
2. Generic LP lock detection (Position NFT ownership + known locker ABIs) beyond HANSOME hardcode.
3. Persist scan snapshots for Confidence/history (optional Redis/KV).
4. Start taxonomy config/DB schema + manual verify workflow (no Explore UI yet).
5. Soften or document equal-balance clusters when labeled as known project inventory (still probabilistic; do not auto-whitelist into Score boost).
6. Keep third-party feeds Activity-only with source labels.
7. Add Playwright smoke for `/scan` + `/api/scan` once local UX signed off.

---

## Files added / touched (Week 1)

- `docs/HANSOME_SCORE_V1_SPEC.md`
- `docs/HANSOME_TAXONOMY_AND_EXPLORE.md`
- `lib/hansome-score/**`
- `app/api/scan/route.ts`
- `app/scan/page.tsx`
- `app/scan/[address]/page.tsx`
- `components/scan/ScanClient.tsx`
- `sections/FooterSection.tsx` + i18n `footer.scan`
- `vitest.config.ts` (include hansome-score tests)
- `reports/HANSOME_SCORE_WEEK1_REPORT.md` (this file)
