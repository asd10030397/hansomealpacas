# Settlement gas cost analysis (batched architecture)

**Measured:** 2026-07-20T01:38:41Z (Hardhat)  
**Genesis:** 500 Alpacas + 50 Cougars = 550  
**ETH price used:** $1,872 USD  
**Caps:** `MAX_REVEAL_BATCH = 50`, `MAX_CREDIT_BATCH = 50`  
**Raw JSON:** `reports/testnet/settlement-gas-cost-analysis.json`

---

## Part 1 — Project relayer (all 550 NFTs)

| Item | Value |
|------|------:|
| revealBatch transactions | **11** (= ceil(550/50)) |
| Gas / revealBatch (avg) | **4,154,176** |
| Gas / revealBatch (peak) | **4,170,776** |
| finalizeDay gas | **7,051,351** |
| creditBatch transactions | **11** |
| Gas / creditBatch (avg) | **8,175,582** |
| Gas / creditBatch (peak) | **8,195,072** |
| **Total gas / full day** | **142,678,707** |

### ETH / USD cost (full day)

| Gas price | ETH | USD | Annual (365d) |
|----------:|----:|----:|-------------:|
| 0.01 gwei | 0.001427 | **$2.67** | $975 |
| 0.1 gwei | 0.014268 | **$26.71** | $9,749 |
| 1 gwei | 0.142679 | **$267.09** | $97,490 |
| 5 gwei | 0.713394 | **$1,335.47** | $487,448 |

### Automatic completion?

**Yes (Testnet):** vault + owner `testnetRelayerRevealBatch` + permissionless `finalizeDay` + permissionless `creditBatch` — no player interaction required to settle. Players only claim later.

**Mainnet caveat:** `testnetRelayerRevealBatch` is forbidden on chainid 4663. Production needs a Mainnet-allowed reveal path (or player reveals). `finalizeDay` / `creditBatch` remain permissionless.

---

## Part 2 — User self-service (per NFT / day)

| Tx | Gas | 0.01 gwei | 0.1 gwei | 1 gwei | 5 gwei |
|----|----:|----------:|---------:|-------:|-------:|
| Commit | 102,438 | $0.00192 | $0.0192 | $0.192 | $0.958 |
| Reveal (single) | 140,444 | $0.00263 | $0.0263 | $0.263 | $1.314 |
| Claim | 78,104 | $0.00146 | $0.0146 | $0.146 | $0.731 |
| **Full cycle** | **320,986** | **$0.00601** | **$0.0601** | **$0.601** | **$3.004** |

(ETH = gas × gwei × 1e-9; USD = ETH × 1872)

---

## Part 3 — US$1 budget → complete cycles

Cycle = Commit + Reveal + Claim = **320,986 gas**.  
`cycles = floor($1 / USD_per_cycle)`

| Gas price | USD / cycle | Cycles / $1 |
|----------:|------------:|------------:|
| 0.01 gwei | $0.006009 | **166** |
| 0.1 gwei | $0.060089 | **16** |
| 1 gwei | $0.600886 | **1** |
| 5 gwei | $3.004429 | **0** |

Hybrid (project pays reveal/settle; user pays commit+claim = 180,542 gas):

| Gas price | USD / cycle | Cycles / $1 |
|----------:|------------:|------------:|
| 0.01 gwei | $0.003380 | **295** |
| 0.1 gwei | $0.033797 | **29** |
| 1 gwei | $0.337975 | **2** |
| 5 gwei | $1.689873 | **0** |

---

## Part 4 — Recommendation

**Recommended production model: C — Hybrid**

- Project pays: chunked reveal + `finalizeDay` + `creditBatch`
- Players pay: commit + permanent claim

Reasoning from measured gas:

1. At RH-like **0.01 gwei**, full Genesis settle ≈ **$2.67/day** (~$975/year upper bound).
2. Peak tx ≈ **8.2M** — under ~12M safety budget.
3. Removes manual reveal (main missed-reward failure mode).
4. At **5 gwei**, self-service cycle ≈ **$3.00** — a $1 budget cannot finish one cycle.

Ship a Mainnet-allowed reveal relayer before Mainnet cutover; keep finalize/credit permissionless as backstop.
