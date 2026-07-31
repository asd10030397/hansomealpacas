# HANSOME Lock Distribution — Live Verify

| Field | Value |
|-------|-------|
| **Result** | **PASS** |
| **Token** | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` (HANSOME) |
| **scannedAt** | `2026-07-27T15:11:05.312Z` |
| **Artifact** | [`hansome-score-week2a-hansome.json`](hansome-score-week2a-hansome.json) |
| **Method used** | `npx tsx lib/hansome-score/_tmp-live-scan.ts` |
| **API note** | Local `:3013` / `:3012` `GET /api/scan` timed out (0 bytes / long hang). Verification used the existing one-off tsx scan path instead of production deploy. |

---

## Lock Distribution

| Field | Value |
|-------|-------|
| `available` | `true` |
| `method` | `token_amounts` (economic — not raw L, not position-count) |
| `reason` | `null` |
| `lockedUsd` | ≈ **$4639.15** |
| `lockedPct` | ≈ **28.884%** |
| `unlockedUsd` | ≈ **$11422.05** |
| `unlockedPct` | ≈ **71.116%** |
| `unknownUsd` / `unknownPct` | `0` / `0` |
| `totalPositionUsd` | ≈ **$16061.20** |
| `poolLiquidityUsd` | ≈ **$15940.62** |
| `reconciledWithPool` | `true` (ratio ≈ 1.008) |

**Checks:**

- `lockedUsd + unlockedUsd ≈ totalPositionUsd` — pass
- `lockedPct + unlockedPct ≈ 100` — pass
- `totalPositionUsd` reconciles with pool TVL (~$16k band) — pass
- UI path would show **$ · %**, not “Unavailable” — pass (`available === true`, economic method)

---

## Key positions

| Position NFT | Lock status | `valueUsd` |
|--------------|-------------|------------|
| **#47299** | LOCKED (verified on-chain / Titan) | ≈ **$4639.15** |
| **#357867** | UNLOCKED (EOA-controlled) | ≈ **$9991.25** |
| **#142938** | UNLOCKED (EOA-controlled) | ≈ **$1430.81** |

Aggregate LP: **MIXED** (presentation: PARTIALLY LOCKED) — locked + removable coexist.

---

## Verdict

**PASS** — economic `token_amounts` lock distribution available, reconciled with pool, per-position USD present when calculable. Safe to freeze Scan/Score baseline and proceed to Week 2B.
