# HANSOME — PR1 + PR2 + PR3 FOX Deep Fixes (Final Gate)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Token (diagnosis)** | FOX `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| **Order** | PR1 → PR2 → PR3 (not combined in one PR conceptually; sequential delivery) |
| **Deploy** | **NO — STOP for approval** |

---

## Verdicts

| PR | Report | Verdict |
|----|--------|---------|
| **PR1** Multi-pool Liquidity Presentation + Dust | `reports/HANSOME_PR1_MULTI_POOL_LIQUIDITY_PRESENTATION.md` | **PASS** |
| **PR2** Transfer Index Checkpointing | `reports/HANSOME_PR2_TRANSFER_INDEX_CHECKPOINTING.md` | **PASS** |
| **PR3** Heavy-Token Collecting UX | `reports/HANSOME_PR3_HEAVY_TOKEN_COLLECTING_UX.md` | **PASS** |

---

## Files changed (all PRs)

### PR1
- `lib/hansome-score/lp/pool-materiality.ts` *(new)*
- `lib/hansome-score/lp/adapters/v2.ts`, `v3.ts`
- `lib/hansome-score/lp/presentation.ts`
- `components/scan/ScanClient.tsx` (section aggregate)
- `lib/hansome-score/__tests__/pool-materiality.test.ts`, `lp-presentation.test.ts`

### PR2
- `lib/hansome-score/transfer-index/paging.ts` *(new)*
- `lib/hansome-score/transfer-index/keys.ts` (chunk cap 40)
- `lib/hansome-score/transfer-index/index.ts`
- `lib/hansome-score/blockscout.ts` (resume/`onPage`)
- `lib/hansome-score/scan-deep.ts` (wire + soft-fail progress)
- `lib/hansome-score/__tests__/transfer-index-checkpoint.test.ts`
- `lib/hansome-score/__tests__/scan-deep-stage-independence.test.ts`

### PR3
- `lib/hansome-score/heavy-token-ux.ts` *(new)*
- `components/scan/ScanClient.tsx` (ETA replace + progress)
- `content/i18n/en.ts`, `zh.ts`, `types.ts`
- `lib/hansome-score/__tests__/heavy-token-ux.test.ts`

---

## Before / after FOX UI mapping

### Liquidity

| Field | Before | After |
|-------|--------|-------|
| Pool cards | 2 (WETH + 1-wei USDG) → both Pool Liquidity **Unavailable** | Dust filtered → **1** material FOX/WETH card with labeled **~$96k** (or section aggregate if 2+ material) |
| Lock Status | Unknown | Unknown (unchanged — no V3 NPM) |
| Lock % / ALL_LOCKED | Not claimed | Not claimed |

### Burn / Creator (transfer index)

| Field | Before | After |
|-------|--------|-------|
| Timeout mid-page | `pagesFetched=0`, progress lost | Checkpoint meta/chunks → `pagesFetched=N` |
| Retry | Restart page 1 | Resume `nextPageParams` |
| Completeness | Risk of false done | Incomplete until genesis |
| Creator | Easy to misread as clean | Stays provisional / incomplete |

### Collecting UX

| Phase | Before | After |
|-------|--------|-------|
| Under ETA | Short estimate | Short estimate (kept) |
| Over ETA | Optimistic short ETA lingered | **Replaced** with heavy-history EN/ZH |
| Progress | Often invisible | Pages · transfers · attempt |
| Exhausted | Collecting could feel endless | Terminal unavailable + Refresh |

---

## Liquidity presentation result

- Generic inventory floor (`MIN_MATERIAL_POOL_TOKEN_BALANCE = 1000`) filters 1-wei dust.
- Labeled TVL attaches to **single** presentation pool only; multi-pool uses **section aggregate** (never even split).
- Lock Unknown preserved without Position NFT evidence.

## Transfer checkpoint timeline

1. Acquire NX lock → bump generation (fence stale writers).  
2. Resume cursor if prior incomplete pages exist.  
3. Each page → persist meta + chunk.  
4. Timeout → soft-fail publishes `pagesFetched=N` from checkpoint.  
5. Next attempt continues from cursor; Burn+Creator share one index.

## Heavy-token UX timeline

1. Show soft ETA.  
2. Past ceiling → replace with heavy-history sentence.  
3. Show checkpoint progress + retry attempt when present.  
4. Auto-retries exhausted → honest unavailable; Refresh optional.

---

## Final gate checks

| Check | Result |
|-------|--------|
| Targeted presentation / materiality / checkpoint / heavy-UX tests | **PASS** |
| Retry/fencing + stage-independence + deep reliability | **PASS** |
| LP + Burn unit suites | **PASS** |
| `tsc --noEmit` | **PASS** |
| Production `next build` | **PASS** (compile/types; clean rebuild prerender OK) |
| Scoring / Burn window / lock semantics | **Unchanged** |
| Deploy | **NOT performed** |

Top-20 live spot: not run against Production (no deploy). Unit/fixtures cover FOX-class, HANSOME, CATE/PONS/CASHCAT presentation cases.

---

## Freeze confirmation

- [x] No Score weights / formulas  
- [x] No Burn window semantics  
- [x] No LP lock classification rules  
- [x] No risk threshold changes  
- [x] No Unknown/Partial honesty weakenings  
- [x] No timeout inflation  
- [x] No FOX hardcodes / V3 NPM enumeration  
- [x] No Explore / Analytics / Just Launched / Week 2B  

**STOP — await approval. Do NOT deploy.**
