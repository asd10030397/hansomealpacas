# HANSOME LP Accuracy Fix — One Locked Position ≠ Locked Liquidity

| Field | Value |
|-------|-------|
| **Date** | 2026-07-27 |
| **Token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **PoolId** | `0x1165db4c55ea3c2c4881453937164906923c7c37a575286c1db81f19ead81a0d` |
| **Live scan** | [`hansome-score-week2a-hansome.json`](hansome-score-week2a-hansome.json) |
| **Fixture** | [`lib/hansome-score/__fixtures__/hansome-lp-positions.json`](../lib/hansome-score/__fixtures__/hansome-lp-positions.json) |
| **LP accuracy verdict** | **PASS** |

---

## Principle

**One locked position does not mean locked liquidity.**  
Pool ≠ position. Token-level aggregate must never show “LOCKED — VERIFIED ON-CHAIN” / ALL LOCKED from a single Titan hit when other material removable positions exist, or when discovery is incomplete.

---

## Bug (pre-fix)

UI/aggregate reported **LOCKED — VERIFIED ON-CHAIN** based primarily on Titan Position NFT **#47299**, implying all liquidity was locked. At least two additional EOA-held positions on the same pool were missed or not reflected in the aggregate.

---

## On-chain evidence (Robinhood 4663)

| Position NFT | Owner | Type | Lock | Removable by EOA | L (raw) | Range (ticks) | In-range (at probe) |
|--------------|-------|------|------|------------------|---------|---------------|---------------------|
| **#47299** | `0x4a50761042e321F214b6B6c2920F9eA1C5533828` | Titan child locker | `LOCKED_VERIFIED_ONCHAIN` | **false** | `80044131519596909069874` | [195680, 210680) | false |
| **#357867** | `0x0bd54aeE53E9603375C27940d74e7c0923573b2a` | Liquidity Wallet (EOA) | `UNLOCKED_EOA_CONTROLLED` | **true** | `253124762623789048371827` | [174810, 177620) | **true** |
| **#142938** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Treasury (EOA) | `UNLOCKED_EOA_CONTROLLED` | **true** | `88947533310769517656200` | [194740, 197750) | false |

All three involve HANSOME/ETH fee **500**, same `poolId`.

**Second (primary unlocked) position:** **#357867** — official Liquidity Wallet, EOA-removable, currently **in range**.  
**Additional unlocked:** **#142938** — Treasury EOA, out of range, still material L &gt; 0.

Evidence sources: `PositionManager.ownerOf` + `getPoolAndPositionInfo` + `getPositionLiquidity`; #47299 also `TitanLockerManagerV2.getTokenLockData`. Discovery via Titan + seeded candidates + official-wallet NFT inventory.

---

## Aggregate (post-fix live scan)

| Field | Value |
|-------|-------|
| **aggregateState** | **MIXED** |
| **Display** | ⚠️ MIXED — LOCKED + REMOVABLE |
| **Counts** | detected **3** · locked **1** · unlocked **2** · unknown **0** |
| **Pools vs positions** | 1 pool · 3 positions |
| **discoveryComplete** | true (required seeds + locked+removable found) |
| **Lock distribution %** | **Unavailable** — L not economically comparable across different concentrated ranges |
| **Score LP ownership** | **−8** (`lp_mixed`) — not 0 |

---

## What changed

- Token-level aggregates: `ALL_LOCKED` · `MIXED` · `ALL_UNLOCKED` · `UNKNOWN_INCOMPLETE` · `NONE`
- Single locked + incomplete discovery → **UNKNOWN / INCOMPLETE**, never ALL LOCKED
- Per-position fields: poolId, pair/fee, owner, lock, L, range, removable, evidence
- Prominent Scan UI: aggregate banner, counts, pools vs positions, lock-% unavailable reason, completeness warning
- Regression fixture **fails** if only #47299 is found
- Spec + litepaper wording updated with the principle
- Score uses aggregate MIXED (−8), not silent 0 from one lock

---

## LP accuracy gate

| Check | Status |
|-------|--------|
| HANSOME shows MIXED | **PASS** |
| #357867 + #142938 discovered | **PASS** |
| No false “fully locked” | **PASS** |
| Lock % honest (unavailable + reason) | **PASS** |
| Unit tests (`lp-mixed`, week2a, score) | **45/45 PASS** |
| Explore / deploy | Not started / not done |

### Verdict: **PASS** (LP accuracy)
