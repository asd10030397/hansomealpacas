# HANSOME Liquidity Intelligence — Multi-Version Architecture

| Field | Value |
|-------|-------|
| Status | **In development** — not public “full v2–v4” |
| Chain | Robinhood 4663 |
| Audit | `reports/ROBINHOOD_UNISWAP_AND_LOCKER_AUDIT.md` |

## Principles

1. **Pool ≠ position.** One Position NFT / LP holding ≠ token liquidity.
2. **Version ≠ locker.** Reading Uniswap v2/v3/v4 structures ≠ decoding every locker.
3. **One version ≠ all chain liquidity.** Never claim “All liquidity locked” from v4 alone when v2/v3 were not searched, or when other versions have undecoded pools.
4. **Incomplete > false certainty.** Prefer `UNKNOWN_INCOMPLETE` + lower Data Confidence.

## Adapter interface

```
lib/hansome-score/lp/
  deployments.ts          # RH Uniswap + quote addresses + protocol support flags
  adapters/
    types.ts              # VersionDiscoveryResult, ProtocolSupportStatus
    v2.ts                 # Factory getPair probes + optional synthetic unknown slots
    v3.ts                 # Factory getPool probes (fee × quote)
    v4.ts                 # Thin wrapper around detectV4LpIntelligence
  multi.ts                # Orchestrates adapters → token aggregate
  aggregate.ts            # Position-level aggregate (shared)
  detect.ts               # Existing v4 path (kept; used by v4 adapter)
  registry.ts / titan.ts  # Locker registry (Titan only today)
```

### `ProtocolSupportStatus`

| Status | Meaning |
|--------|---------|
| `supported` | Structure + lock path reliable for common cases |
| `partial` | Discovery and/or lock decode incomplete |
| `planned` | Stub / not wired |
| `unsupported` | No deployment or deliberately not read |

Current RH defaults (post-audit): **v2 partial · v3 partial · v4 partial** (v4 lock decode Titan-only).

### Token aggregate

States: `ALL_LOCKED` | `MIXED` | `ALL_UNLOCKED` | `UNKNOWN_INCOMPLETE` | `NONE`

`ALL_LOCKED` requires:

- Every material position/slot across **all searched versions** verified locked, and
- Multi-version discovery + lock analysis marked complete.

Single-version lock alone → never `ALL_LOCKED` at token level when other versions are unsearched or incomplete.

## Confidence

`scoreLiquidityCoverage` reduces when:

- Position discovery incomplete (existing), or
- `uniswapVersions.coverageComplete === false`, or
- Any version reports pools with incomplete lock analysis.

## Public wording

Soft: versions **probed**, coverage **incomplete** where applicable. Do not claim full v2–v4 until regression suite confirms.
