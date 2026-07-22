# Game runtime addresses & settlement

> **Policy:** Active runtime never silently falls back to superseded deployments.
> Set env explicitly. See `lib/game/contractAddresses.ts`.
>
> Vercel cutover runbook: [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md).

## Canonical Robinhood Mainnet (live — B7 ceremony)

| Role | Address | Status |
|------|---------|--------|
| $HANSOME token | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | Live (`NEXT_PUBLIC_CONTRACT`) |
| HansomeGame | `0xb8dad421881171f4485523d109C94dc650ecB7Eb` | Live |
| Genesis NFT | `0x6eBb78FDB40CF6f6b8B33a235eF321AD15107cb0` | Live |
| GameTreasury | `0x96EB6d545ce877115e83273293eC22bC8d2336CF` | Live (on-chain link; no frontend env) |
| EmissionController | `0x69e6933afb5656967C51E2f295ba40359d3A7312` | Live (on-chain link; no frontend env) |
| RewardDistributor | `0x0f9683287F91698B84Da4A3A90366a75EaF93520` | Live |
| GameRandomness | `0x134f3CE4006a04C2C5DaD0E654d1C4228dd15791` | Live |
| SinkRegistry | `0x41E6c8314A6664a1c8d9093a5DEc5F50F399e423` | Live (on-chain link; no frontend env) |
| VRFRevealAdapter | `0xeb4Ed2A22974A348a48583658daea3C080e05900` | Live (Genesis randomnessProvider) |

Chain: `4663` · RPC `https://rpc.mainnet.chain.robinhood.com` · Explorer `https://robinhoodchain.blockscout.com`

Source: `contracts/deployments/robinhood-game.json` + `robinhood-genesis.json`

### Frontend env names (Production)

| Ops name | Env variable consumed by app |
|----------|------------------------------|
| CHAIN_ID (game) | `NEXT_PUBLIC_GAME_CHAIN_ID=4663` (+ `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1`) |
| GENESIS_NFT | `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS` or `NEXT_PUBLIC_GENESIS_NFT_ADDRESS` |
| HANSOME_GAME | `NEXT_PUBLIC_HANSOME_GAME_ADDRESS` |
| HANSOME_TOKEN | `NEXT_PUBLIC_CONTRACT` (swap/token; defaults to canonical if unset) |
| REWARD_DISTRIBUTOR | `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` |
| GAME_RANDOMNESS | `NEXT_PUBLIC_RANDOMNESS_ADDRESS` |
| GAME_TREASURY / EMISSION / SINK | **Not read from env** — resolved on-chain via game suite |

## Canonical Robinhood Testnet suite (Preview / local QA only)

| Role | Address |
|------|---------|
| HansomeGame | `0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5` |
| Genesis NFT | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| RewardDistributor | `0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2` |
| GameRandomness | `0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F` |

Source: `contracts/deployments/robinhoodTestnet-game.json`

**Do not** set these on Vercel Production after Mainnet cutover.

## Required env (no silent defaults)

- `NEXT_PUBLIC_HANSOME_GAME_ADDRESS`
- `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` (required in Mainnet mode)
- `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS` or `NEXT_PUBLIC_GENESIS_NFT_ADDRESS`
- `NEXT_PUBLIC_RANDOMNESS_ADDRESS` (required in Mainnet mode)
- `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=0` on Mainnet until gasless Mainnet is approved

Server gasless (Testnet / Preview):

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
