# Game runtime addresses & settlement (Testnet)

> **Policy:** Active runtime never silently falls back to superseded deployments.
> Set env explicitly. See `lib/game/contractAddresses.ts`.

## Canonical Robinhood Testnet suite

| Role | Address |
|------|---------|
| HansomeGame | `0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5` |
| Genesis NFT | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| RewardDistributor | `0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2` |
| GameRandomness | `0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F` |

Source: `contracts/deployments/robinhoodTestnet-game.json`

## Required env (no silent defaults)

- `NEXT_PUBLIC_HANSOME_GAME_ADDRESS`
- `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` (optional if UI reads `game.distributor()`)
- `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS` or `NEXT_PUBLIC_GENESIS_NFT_ADDRESS`
- `NEXT_PUBLIC_RANDOMNESS_ADDRESS` (optional; UI can read `game.randomness()`)
- `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE` (default on when unset)

Server gasless:

- `GAME_TESTNET_RELAYER_PRIVATE_KEY`
- `GAME_TESTNET_COMMIT_VAULT_KEY`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or Upstash equivalents)

## Settlement architecture

1. Relayer / wallet: `testnetRelayerRevealBatch` (or player `reveal`)
2. `finalizeDay(day)` → UI `battle_ready`
3. `creditBatch(day, limit)` until `creditProgress.cursor == total` → `fully_settled`
4. Battle rewards: `pendingRewardOf(tokenId, day)` (not DaySettled receipt Credited logs)

Gasless Production uses Redis/KV encrypted commit vault — not filesystem, not browser-only salt.

Wallet (non-gasless) path uses the same finalize + creditBatch loop; `settleDay` remains in ABI for tests/history only.

## Reveal evidence hierarchy (UI)

1. Revealed event cohort
2. Non-zero `locationOf` (Home `0` needs extra evidence)
3. `pendingRewardOf > 0` after finalize
4. Local secret status/location as supplemental only

Never mark `missedReveal` while evidence is still loading.
