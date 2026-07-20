# Settlement Latency Investigation (Testnet)

| Field | Value |
|------|------|
| Date | 2026-07-20 |
| Scope | Gasless resolve pipeline latency — **no performance changes yet** |
| Instrumentation | Server-only `[settlement-timing]` JSON logs |
| Contracts / Reveal duration | Unchanged |

---

## Executive root cause

The long **PENDING** UX is **not** primarily “settlement math is slow.”

It is dominated by:

1. **UI conflation** — one generic pending/preparing state covers seed wait, reveals, finalize, **and** post-finalize credit batches.
2. **Single long HTTP resolve** — one `POST /api/game/testnet-resolve` already runs **many sequential txs** (`waitForTransactionReceipt` each), including **up to 32 `creditBatch` loops after `finalizeDay`**, and the client only learns stages when the HTTP response returns.
3. Therefore **battle can be ready on-chain (`isFinalized`) while the browser still shows PENDING** until credits finish (or the serverless request times out and retries).
4. Secondary amplifiers: **~0.4s RPC round-trips**, **~6–8s between sequential txs** (observed on a real day), **1.5s client poll gaps** when a request returns early, **client single-flight** (one day at a time), **mobile timer throttling** (detection only), possible **Vercel maxDuration** cutting mid-credit.

**Slowest stage for “Pending until I see battle”:** waiting for the resolve HTTP call to return after `finalizeDay`, while it continues sequential `creditBatch` work — *or* waiting in pre-finalize polls if seed/reveal/finalize cannot run yet.

---

## Architecture (current)

```
Browser poll (1.5s when pending)
        ↓
POST /api/game/testnet-resolve  settle=true
        ↓
isSettled? → exit
        ↓
seed (0–1 tx) → wait receipt
        ↓
revealBatch × ⌈N/50⌉ (only if dayState == REVEAL_OPEN) → wait each receipt
        ↓
finalizeDay (0–1 tx) → wait receipt   ← battle-ready on-chain
        ↓
creditBatch × ⌈N/50⌉ (up to 32 loops) → wait each receipt  ← still same HTTP
        ↓
JSON response → client updates stage
```

**Important:** One resolver invocation **already** processes multiple stages/batches. It is **not** “one transaction per API poll” when `settle=true` and the day is eligible. Poll gaps matter mainly when the call returns early (cannot finalize yet) or after a timeout/error.

---

## Transaction counts (batch size 50)

| NFTs | seed | revealBatch | finalizeDay | creditBatch | **Total txs** |
|------|------|-------------|-------------|-------------|---------------|
| 50 | 1 | 1 | 1 | 1 | **4** |
| 100 | 1 | 2 | 1 | 2 | **6** |
| 250 | 1 | 5 | 1 | 5 | **12** |
| 550 | 1 | 11 | 1 | 11 | **24** |

Gas peaks (Hardhat report `batched-settlement-gas.json`): reveal ~4.1M @50; credit peak ~8.2M @550 — **do not raise batch size without new gas simulation**.

---

## Real Testnet day timeline (special-trait QA, day 24, N≈7)

On-chain block timestamps (Robinhood Testnet RPC), same day as `reports/testnet/special-trait-qa-report.json`:

| Stage | Start (UTC) | End (UTC) | Duration | Transactions | Retries | Result |
|------|-------------|-----------|----------|--------------|---------|--------|
| fulfillDaySeed | 15:45:09 | 15:45:09 | ~block time | 1 | 0 | success |
| revealBatch | 15:45:15 | 15:45:15 | **+6s** from seed | 1 | 0 | success |
| settleDay* | 15:45:23 | 15:45:23 | **+8s** from reveal | 1 | 0 | success |
| **Seed → settle wall** | 15:45:09 | 15:45:23 | **~14s** | 3 | 0 | battle settled path |

\*Report predates split `finalizeDay`/`creditBatch` naming; gas ~366k suggests a compact settle path for small N.

**Retries:** 0 observed on these txs.  
**API polls / serverless:** not recorded in that QA artifact (pre-instrumentation).  
**Implication:** For small N, **chain work to settle is ~10–20s**, not 2+ minutes. Multi-minute PENDING is therefore mostly **orchestration + UI stage blindness + credit tail inside one HTTP**, not “each NFT takes forever.”

---

## Modeled wall time (sequential receipts)

Assume ~5–10s per tx confirmation (matches ~6–8s deltas above) and one POST doing all txs:

| N | Txs | @5s/tx | @10s/tx |
|---|-----|--------|---------|
| 50 | 4 | ~20s | ~40s |
| 100 | 6 | ~30s | ~60s |
| 250 | 12 | ~60s | ~120s |
| 550 | 24 | ~120s | ~240s |

Of which **post-finalize credits** alone:

| N | credit txs | @5s | @10s |
|---|------------|-----|------|
| 50 | 1 | 5s | 10s |
| 250 | 5 | 25s | 50s |
| 550 | 11 | 55s | 110s |

If UI waits for HTTP end = fully credited, Pending ≈ **entire table**, even though **battle-ready ≈ seed+reveal+finalize only** (roughly half or less).

---

## RPC latency (live probe, 2026-07-20)

Public Testnet RPC `rpc.testnet.chain.robinhood.com` (5 samples):

| Call | min | p50 | max | avg |
|------|-----|-----|-----|-----|
| eth_blockNumber | ~0ms* | ~0ms* | 888ms | 178ms |
| eth_getBalance | 373ms | 380ms | 387ms | 380ms |
| eth_call isSettled | 376ms | 380ms | 389ms | 382ms |

\*Likely cached client path on some samples.

**Takeaway:** Each read ≈ **0.35–0.4s**. Reveal precheck does **N parallel `locationOf`** (OK). Writes still serialize: nonce read + submit + receipt.

---

## Answers to required questions

### 1. Main cause of long PENDING?

**Primary:** Frontend/server orchestration treating the whole resolve HTTP (including **creditBatch tail**) as one pending unit, plus **no battle-ready vs crediting distinction**.

**Strong secondary:** Sequential `waitForTransactionReceipt` per tx (6–10s each × many batches at high N).

**Contributors:** 1.5s poll gaps on early returns; RPC ~0.4s; single-flight day lock; possible Vercel timeout mid-credit → extra polls; mobile timer throttle (UI detection only).

**Not primary:** Contract economics; batch size 50 (gas-bound); “must wait for seed for minutes” on the reconstructed day (~0s once called).

### 2. Tx counts?

See table above (4 / 6 / 12 / 24 for 50 / 100 / 250 / 550).

### 3. Observed stage table?

See real day table (seed→reveal→settle ~14s for N≈7). Full per-stage instrumentation is now live for the **next** resolve — grep server logs for `[settlement-timing]`.

### 4. Does finalize happen quickly while credits remain?

**Yes (by design).** `isFinalized` / UI `"completed"` can mean battle-ready while `isSettled` is still false.  
**UI must split:** Preparing → Battle ready → Crediting (background) → Fully settled.  
Do **not** use one generic Pending for all.

### 5. One tx per API poll?

**No** when eligible: one POST runs seed + all reveals + finalize + many credits.  
**Yes effectively for UX updates:** client sees one stage update per POST completion.  
**Safe multi-step:** already implemented; next optimization is **return after battle-ready** (or stream progress), not “add more steps.”

### 6. Do 1.5s polls add delay?

**Yes when** a POST returns without finishing (too early / error / timeout).  
**No additive gap inside** a single long POST (gaps are receipt waits, not 1.5s).  
Reducing poll to 500ms helps early-return cases only.

### 7. Vercel cold start / lifecycle?

**Plausible interrupt** if `maxDuration` < wall time of sequential credits (esp. N≥250). Cold start adds ~0.5–2s once — not 2 minutes. **Timeout mid-credit** forces another poll (+1.5s + cold path). Needs production log confirmation via new instrumentation (`pollGapMs`, `resolve_complete`).

### 8. Sequential receipts — parallelize?

Receipt waits **must stay sequential per nonce** for the same relayer. Parallelizing **independent reads** is already partly done. Cannot parallelize multiple writes from one EOA without nonce chaos.

### 9. Batch sizes too small?

Smaller batches → more txs → more receipt waits. Raising size needs gas re-sim (credit peak already ~8.2M @50 for N=550). **Do not increase yet.**

### Mobile

Affects **UI detection** (timer throttle when backgrounded), not on-chain settlement speed. Settlement continues if another client/tab/server keeps polling; a backgrounded phone may delay the next POST.

---

## Instrumentation added (no perf changes)

| File | What |
|------|------|
| `lib/game/server/settlementTimingLog.ts` | Structured trace; redacts key-shaped hex |
| `lib/game/server/testnetRelayerWrite.ts` | Logs lock wait, submit, hash, receipt, retries |
| `app/api/game/testnet-resolve/route.ts` | Stage / skip / battle_ready / fully_settled / pollGapMs |

**How to capture a full day:** run local or Vercel logs during one Battle; filter `[settlement-timing]`. Fields include `battleReadyMs`, `fullySettledMs`, per-tx `receiptMs`, `pollGapMs`.

---

## Recommended fixes (ranked) — **not implemented**

| Rank | Option | Impact | Risk | Notes |
|------|--------|--------|------|------|
| 1 | **E + A** Separate battle-ready vs fully-settled UI; stop calling it all “Pending” | **Highest UX** | Low | Matches finalize vs credit |
| 2 | **C′** Return HTTP after `finalizeDay` (battle-ready); continue credits on next polls or background | **High latency UX** | Medium | Must keep credits progressing |
| 3 | **B** Faster poll (e.g. 500ms) only while `!finalized` | Medium | Low | Helps early-return waits |
| 4 | **F/G** Persistent worker / cron / dedicated relayer | High at scale | Medium–High | Best for Mainnet N=550 |
| 5 | **H** Paid/low-latency RPC | Medium | Low | Cuts ~0.4s reads; not the main 2min |
| 6 | **D** Larger batches after gas sim | Medium at high N | High | Only after measurement |
| 7 | **C** “More steps per call” | Low | — | Already multi-step; problem is **not returning at battle-ready** |

**Do not:** extend Reveal; change SettlementLib economics; raise batches blindly.

---

## Next measurement step (operator)

1. Keep server running with current instrumentation.  
2. Play one Testnet day through Battle.  
3. Collect `[settlement-timing]` lines for that `day` / `requestId`.  
4. Fill the Stage\|Start\|End table from logs (`battle_ready` vs `fully_settled` delta = credit tail).  
5. Only then approve perf PRs (likely: UI stages + return-after-finalize).

---

## Confirmation

- No contract economics changed.  
- Reveal duration not extended.  
- No automatic deploy.  
- No performance behavior changes beyond **logging**.  
- Auto-nav presentation fix remains separate and approved.
