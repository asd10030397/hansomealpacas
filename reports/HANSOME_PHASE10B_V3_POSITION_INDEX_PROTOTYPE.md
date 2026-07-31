# HANSOME Scan — Phase 10B Pool-Scoped V3 Position Index Prototype Validation

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Prototype + validation ONLY |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Known pool** | `0xC71E763a0a258f266d1481295115ea4f291D95ED` |
| **Chain** | Robinhood Chain `4663` |
| **Deploy** | **NO** |
| **Verdict** | **PASS_NOT_DEPLOYED** |
| **Phase 10C recommend** | **YES** |

Artifacts:

- `lib/hansome-score/lp/v3-position-index/` (prototype modules)
- `scripts/phase10b-v3-position-index-prototype.ts`
- `lib/hansome-score/__tests__/v3-position-index-phase10b.test.ts`
- `reports/data/phase10b_beer_index.json`
- `reports/data/phase10b_multi_pool_index.json`
- `reports/data/phase10b_validation_aggregate.json`

---

## 1. Prototype architecture

Pool-scoped persistent V3 Position Index (Phase 10A Option 3), implemented as an **isolated prototype**:

1. Discover pool `Mint` logs from creation → reorg-safe head  
2. For each Mint tx: receipt → NPM `Transfer` + `IncreaseLiquidity` → candidate tokenIds  
3. Filter via `positions(tokenId)` exact `token0/token1/fee`  
4. Revalidate `ownerOf` at validation block (not last Transfer alone)  
5. Persist under namespace `scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}`  
6. Incremental sync from `lastSyncedBlock − overlap` with hash-checked checkpoints  
7. Completeness evidence + fenced `generation`

**Not imported** by Production `scan.ts` / `scan-deep.ts` / `adapters/v3.ts` / `multi.ts`.

---

## 2. Files created

| Path | Role |
|------|------|
| `lib/hansome-score/lp/v3-position-index/types.ts` | Schema + record types |
| `lib/hansome-score/lp/v3-position-index/abis.ts` | Isolated NPM/pool ABIs + event fragments |
| `lib/hansome-score/lp/v3-position-index/key.ts` | Index key builder + namespace guard |
| `lib/hansome-score/lp/v3-position-index/receipt-resolve.ts` | Pure Mint receipt → tokenId resolve |
| `lib/hansome-score/lp/v3-position-index/classify.ts` | Status / zero-liq / burned / audit owner type |
| `lib/hansome-score/lp/v3-position-index/store.ts` | In-memory + JSON store, schema/corruption rejection |
| `lib/hansome-score/lp/v3-position-index/sync.ts` | Algorithm A backfill + B incremental |
| `lib/hansome-score/lp/v3-position-index/reorg.ts` | Hash mismatch rescan + simulated reorg |
| `lib/hansome-score/lp/v3-position-index/index.ts` | Public prototype API |
| `lib/hansome-score/__tests__/v3-position-index-phase10b.test.ts` | Unit tests (25) |
| `scripts/phase10b-v3-position-index-prototype.ts` | Live validation driver |
| `scripts/phase10b-v3-position-index-prototype.mjs` | Thin `npx tsx` launcher |
| `reports/data/phase10b_*.json` | Live artifacts |
| `tsconfig.json` | Exclude `reports/data/_tmp_*.ts` from root typecheck |

**Not modified:** `discoverV3Liquidity`, `syntheticUnknownPosition`, `V3_LOCKER_ADAPTERS` (`[]`), aggregate/UI/score, Production cache keys, aliases.

---

## 3. Storage format

Isolated prototype store:

- **In-memory** Map (tests / session)  
- **Local JSON** under `reports/data/phase10b_*.json`  
- Namespace prefix **`scan:v3pos:`** — rejects `scan:xfer:` overload  

Never writes live Production Redis/KV keys.

Demonstrated: backfill, save, reload, incremental, idempotent resync, reorg overlap, corrupted-record rejection, schema-version rejection.

---

## 4. Index key / schema

```
scan:v3pos:{chainId}:{npm}:{token0}:{token1}:{fee}
```

BEER key:

`scan:v3pos:4663:0x73991a25…e0d3:0x0bd7d308…ad73:0xc2abbcc7…7804:10000`

Record fields: `schemaVersion=1`, `semanticVersion=0.1.0-phase10b-prototype`, chain/factory/npm/pool/token0/token1/fee, `poolCreationBlock`, `firstMintBlock`, `lastSyncedBlock`, `lastSyncedBlockHash`, `reorgSafeHead`, `generation`, `exhaustiveFromBlock`/`ToBlock`, `discoveryComplete`, `completenessErrors[]`, `tokenIds[]`, `updatedAt`, optional `metrics`.

Per-tokenId: tokenId, firstSeen*, lastTransfer*, currentOwner, ownerValidated*, ownerValidationStatus, pool key fields, ticks, liquidity, positionValidated*, status, burned, zeroLiquidity, **ownerTypeAudit** (audit only), materialCandidate, inRange, source, lastError.

---

## 5. Discovery algorithm (A — backfill)

1. Confirm pool creation block  
2. Scan pool Mint from creation → `head − overlap` (default 96)  
3. Per Mint tx: receipt → NPM Transfer + IncreaseLiquidity candidates  
4. `positions(tokenId)` match exact pool key; retain **all** matches  
5. `ownerOf` + optional code-size for audit owner type  
6. Classify status (active / inactive_nonzero / zero_liquidity / burned)  
7. Persist checkpoint hash + completeness (`discoveryComplete` only if clean)

TokenId rules: do **not** assume first Transfer; match same receipt + NPM emitter + positions + IncreaseLiquidity when present.

---

## 6. Incremental algorithm (B)

1. Start at `lastSyncedBlock − overlap`  
2. Optional checkpoint hash check  
3. Scan new pool Mints; resolve new tokenIds  
4. Revalidate indexed tokenIds (`ownerOf` + `positions`)  
5. Advance `lastSyncedBlock` / hash only after successful processing  
6. Idempotent: second sync does not duplicate tokenIds  

---

## 7. Reorg algorithm

- Configurable overlap (64–128; default **96**)  
- Store block number + hash at checkpoint  
- Hash mismatch → invalidate completeness, null tip hash, rescan overlap, revalidate touched ids, fenced `generation++`  
- Pure `simulateReorgIndex` + `reconcileMintSets` for deterministic unit tests  
- Never advance tip before durable commit (caller saves after sync returns)

---

## 8. BEER result

| Field | Value |
|-------|--------|
| Pool | WETH/BEER fee **10000** |
| tokenIds | **`[436637]`** only |
| Owner | PonsLaunchLocker `0x736D7669…7F35` |
| ownerTypeAudit | `locker_pons` (not Production lock) |
| liquidity | `36819258015569838458222` (>0) |
| tickLower / tickUpper | **-887200** / **204200** |
| inRange | **true** |
| zeroLiquidity / burned | false / false |
| discoveryComplete | **true** |
| Backfill wall | **~10.2s** (1 Mint; chunked getLogs) |
| Incremental no-change | **~3.7s**, 0 new Mints, idempotent |

**BEER acceptance: PASS**

---

## 9. Multi-position pool result

| Field | Value |
|-------|--------|
| Pool | `0x52e65B17fB6E5BA00Ed806f37Afcd2DaA50271Ca` |
| Pair | WETH/USDG fee **100** |
| Window | last ~250k blocks (**BOUNDED_PARTIAL**; not full pool life) |
| Mint events in window | **95** |
| Matching tokenIds | **37** |
| Exhaustive full history | **false** (bounded window labeled) |
| Includes EOA + contract owners | yes |
| Includes zero-liq ids | yes (e.g. 482969, 483892) |
| Out-of-range nonzero | yes (e.g. 484486 `inactive_nonzero`, materialCandidate=true) |

Did **not** stop after first position.

---

## 10. EOA-owned result

| tokenId | Owner | codeSize | Type |
|---------|-------|----------|------|
| **488806** | `0xC017Df7046E875727885EA58D74EDaFf1dEA11FD` | 0 | **eoa** |

Also present in multi-pool index. L>0, WETH/USDG fee 100.

---

## 11. Locker-owned result

| tokenId | Owner | Audit type | Production lock |
|---------|-------|------------|-----------------|
| **436637** | PonsLaunchLocker | `locker_pons` | **Not wired** (`V3_LOCKER_ADAPTERS=[]`) |

No Production Locked/Unlocked classification performed.

---

## 12. Transferred-position result

BEER mint tx `0x264c978c…15be`: mint → helper → Pons in same tx.  
Prototype `ownerOf` at tip = **Pons** (`provesLatestOwnerOf=true`). Current owner from `ownerOf`, not last Transfer alone.

---

## 13. Zero-liquidity result

| tokenId | L | material |
|---------|---|----------|
| **488802** | `0` | **false** |
| Multi samples (e.g. 482969) | `0` | **false** |

Stored with `zeroLiquidity=true`; not material; not auto-unlocked.

---

## 14. Burned / nonexistent result

| Sample | Result |
|--------|--------|
| tokenId `999999999999` | `ownerOf` reverts `ERC721: owner query for nonexistent token` |
| Classification | `burned_or_nonexistent`; **unlockedClaim=false** |
| Label | **fixture-only** (nonexistent id; real burn not required) |

---

## 15. Busy-pool benchmark

Same as multi pool `0x52e65B17…71Ca` (WETH/USDG 100):

| Metric | Value |
|--------|--------|
| Mint events | 95 |
| Receipts | 95 |
| Candidates | 102 |
| Valid matching | 37 |
| Proto rpcCalls (sync metrics) | 287 |
| Wall | **~97s** |

Observational only — no premature optimization.

---

## 16. Completeness proof

`discoveryComplete=true` only when:

- pool creation known  
- scan from ≤ first possible Mint  
- log ranges completed (no recorded gaps)  
- all Mint receipts resolved  
- candidates checked  
- owner resolution terminal or ok  
- reorg-safe checkpoint hash set  
- `completenessErrors` empty  

BEER: all met → **true**.  
Partial start-after-creation → **false** (unit tested).  
Missing receipt / positions error → **false**.

---

## 17. RPC / API costs

| Run | Session RPC (approx) | Notes |
|-----|----------------------|-------|
| Full validation | **362** | public `rpc.mainnet.chain.robinhood.com` |
| BEER backfill (proto metrics) | 8 (+ getLogs chunks in port) | 1 Mint life |
| BEER incremental | 8 | overlap ~198 blocks |
| Multi bounded backfill | 287 | 95 Mints |
| Blockscout | **0** this run | unused |

No secrets printed (host only).

---

## 18. Initial backfill timings

| Pool | Blocks | Mints | Wall |
|------|--------|-------|------|
| BEER full life | 20913772→22609172 | 1 | **10170 ms** |
| WETH/USDG100 bounded | 22359410→22609364 | 95 | **97221 ms** |

---

## 19. Incremental timings

| Case | Wall | Mints | Notes |
|------|------|-------|-------|
| BEER no-change | **3738 ms** | 0 | revalidate 1 id; idempotent |

---

## 20. Idempotency result

Second incremental sync on BEER: `tokenIds` unchanged `[436637]`, `discoveryComplete` remains true. Unit tests cover duplicate Mint + overlapping replay. **PASS**

---

## 21. Reorg simulation result

Unit: remove Mint / add replacement Mint / reconcile sets — **PASS**.  
Live: simulate surviving BEER 436637 in overlap — no spurious add/remove — **PASS**.

---

## 22. On-chain comparison

BEER index vs direct `positions(436637)` + `ownerOf` + pool Mint count:

| Check | Result |
|-------|--------|
| tokenId set | match `[436637]` |
| owner | match Pons |
| ticks / L | match |
| Mint count | 1 |

---

## 23. Mismatches

**None** recorded in `phase10b_validation_aggregate.json` (`mismatches: []`).

---

## 24. Tests

`npx vitest run lib/hansome-score/__tests__/v3-position-index-phase10b.test.ts`

**25/25 PASS**, covering:

- Mint → one / multiple tokenIds  
- unrelated Transfer / wrong pool ignored  
- mint then same-tx transfer  
- owner changed after mint  
- zero-liquidity / burned / ownerOf+positions transient / missing receipt  
- duplicate Mint / overlapping sync / idempotent replay  
- reorg remove/add / schema+corrupt / multi / empty exhaustive / partial incomplete  
- namespace isolation  

---

## 25. Typecheck

`npm run typecheck` — **PASS**  
(Excluded Phase 10A `reports/data/_tmp_*.ts` diagnostics from root tsconfig.)

---

## 26. Build

`npm run build` — **PASS** (after clean `.next`; prior flaky webpack prerender not caused by prototype imports).  
Production scan routes unchanged; prototype not on Production import path.

---

## 27. Production change confirmation

| Item | Status |
|------|--------|
| `discoverV3Liquidity` | untouched |
| `syntheticUnknownPosition` | untouched |
| `V3_LOCKER_ADAPTERS` | still `[]` |
| UI / score / lock semantics | untouched |
| Production cache keys / env / aliases | untouched |
| Deploy | **NO** |
| Live tip (last documented Phase 8.1B) | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — **not redeployed this phase** |
| Production BEER classification | remains **Unknown** / synthetic stub |

---

## 28. Recommended Phase 10C scope

Recommend **Phase 10C — Production-ready pool-scoped V3 index integration design + guarded wiring plan** (still separate from deploy), only after review:

1. Durable KV store for `scan:v3pos:*` (separate from ERC-20 transfer-index)  
2. Wire read path: factory `getPool` → load index → `ownerOf`/`positions`/amounts → honest Unknown until complete  
3. Background backfill/incremental job with reorg overlap + generation fence  
4. Keep Pons adapter **policy-gated** (optional acceleration, not substitute for index)  
5. Completeness gates before any lock % / aggregate upgrade  
6. Bounded busy-pool cost controls (chunking, concurrency caps)  
7. Semantic regression vs current Unknown for BEER until intentionally flipped  

**Do not** enable Smart LP or ship lock reclassification in 10C without explicit approval.

---

## 29. Deploy decision

| Item | Decision |
|------|----------|
| Deploy Production | **NO** |
| Wire Pons | **NO** |
| Enable Smart LP | **NO** |
| Change UI / scores / lock | **NO** |
| Alias change | **NO** |

---

## 30. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| BEER acceptance | **PASS** |
| Multi-position | **PASS** (`0x52e65B17…71Ca`, **37** tokenIds, bounded window) |
| Reorg sim | **PASS** |
| Incremental idempotent | **PASS** |
| Production scan | **untouched** |
| Phase 10C | **YES** (all gate conditions met) |

### Architecture decision gate

| Condition | Met? |
|-----------|------|
| BEER exact reconstruction | YES |
| Multi-position pool | YES |
| Owner transfer handling | YES |
| Zero-liquidity handling | YES |
| Burned/nonexistent handling | YES |
| Completeness rules | YES |
| Reorg simulation | YES |
| Incremental idempotent | YES |
| No NPM-global enumeration dependency | YES |
| No false Locked/Unlocked | YES |
| Prototype storage/schema viable | YES |
| Estimated Production cost bounded | YES (pool-scoped O(Mint events)) |

**Ask parent/user?** No — pool Mint receipts reliably resolve NPM tokenIds on RH for BEER and the busy WETH/USDG sample.

---

**PASS_NOT_DEPLOYED**
