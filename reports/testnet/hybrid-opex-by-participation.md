# Hybrid operating cost by participation

**Measured:** Hardhat 2026-07-20  
**Model:** Project pays `revealBatch` + `finalizeDay` + `creditBatch`; users pay commit + claim  
**ETH:** $1,872  
**Raw JSON:** `reports/testnet/hybrid-opex-by-participation.json`

Live Robinhood Testnet `eth_gasPrice` probed at **0.01 gwei** (`0x989680` wei).

---

## Project gas by participation

| NFTs | revealBatch txs | creditBatch txs | Total gas | Peak creditBatch |
|-----:|----------------:|----------------:|----------:|-----------------:|
| 50 | 1 | 1 | 6,940,209 | 1.95M |
| 100 | 2 | 2 | 14,864,745 | 2.56M |
| 250 | 5 | 5 | 46,079,226 | 4.42M |
| 400 | 8 | 8 | 88,656,288 | 6.30M |
| 550 | 11 | 11 | 142,678,719 | 8.20M |

(+ 1 `finalizeDay` each day; included in total gas)

---

## Monthly USD (30 days)

| NFTs | 0.01 gwei | 0.05 gwei | 0.1 gwei | 0.2 gwei | 1 gwei |
|-----:|----------:|----------:|---------:|---------:|-------:|
| 50 | $3.90 | $19.49 | $38.98 | $77.95 | $390 |
| 100 | $8.35 | $41.74 | $83.48 | $167 | $835 |
| 250 | $25.88 | $129 | $259 | $518 | $2,588 |
| 400 | $49.79 | $249 | $498 | $996 | $4,979 |
| 550 | $80.13 | $401 | $801 | $1,603 | $8,013 |

## Yearly USD (365 days)

| NFTs | 0.01 gwei | 0.05 gwei | 0.1 gwei | 0.2 gwei | 1 gwei |
|-----:|----------:|----------:|---------:|---------:|-------:|
| 50 | $47 | $237 | $474 | $948 | $4,742 |
| 100 | $102 | $508 | $1,016 | $2,031 | $10,157 |
| 250 | $315 | $1,574 | $3,149 | $6,297 | $31,485 |
| 400 | $606 | $3,029 | $6,058 | $12,115 | $60,577 |
| 550 | $975 | $4,874 | $9,749 | $19,498 | $97,490 |

---

## Robinhood Mainnet

- Docs: fee = **L2 execution + L1 data** (calldata), bundled.
- Testnet live gas price today: **0.01 gwei**.
- **0.01 gwei is not a safe long-term Mainnet planning assumption** — use as floor only. L1 data fee on large `revealBatch` txs can dominate.
- **Budget L2-equivalent: 0.1–0.2 gwei**, stress **1 gwei**, keep 1.5–2× buffer for L1 data.

---

## Recommended operating budget

| Item | Amount | Assumption |
|------|-------:|------------|
| **Safe monthly** | **$750 – $1,000** | ~250 NFTs/day @ 0.2 gwei + L1 buffer |
| **Safe yearly** | **$9,000 – $12,000** | Same steady case |
| Peak-month reserve | $2,000 – $8,000 | Full 550 @ 0.2–1 gwei |
| Launch month | $85 – $170 | ~100 NFTs @ 0.1–0.2 gwei |

**Hybrid remains the recommended production architecture.**
