# Batched settlement gas matrix

Generated: 2026-07-20T01:17:21.813Z (Hardhat local)

SettlementLib mathematics **unchanged**. Execution path:

1. `finalizeDay` — compute SettlementLib + `reserveForClaims` + emit `DaySettled` (no per-token SSTORE)
2. `creditBatch(day, ≤50)` — recompute SettlementLib in memory, credit next slice
3. Reveals capped at `MAX_REVEAL_BATCH = 50`

| N | finalizeDay | creditPeak | creditBatches | settleDay wrapper (1 tx) | batched peak tx |
|--:|--:|--:|--:|--:|--:|
| 50 | 796,038 | 1,954,120 | 1 | 2,421,580 | **1,954,120** |
| 100 | 1,410,031 | 2,551,316 | 2 | 5,285,106 | **2,551,316** |
| 250 | 3,264,070 | 4,406,266 | 5 | n/a (use batches) | **4,406,266** |
| 550 | 7,026,034 | 8,169,755 | 11 | n/a (use batches) | **8,169,755** |

**Result:** At full Genesis N=550, peak tx ≈ **8.2M gas** (under 12M safety budget). Legacy monolithic `settleDay` that credits everyone in one transaction is not Mainnet-safe; relayer must use finalize + creditBatch.

Full JSON: `reports/testnet/batched-settlement-gas.json`
