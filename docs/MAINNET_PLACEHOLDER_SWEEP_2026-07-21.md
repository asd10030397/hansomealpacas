# Placeholder / stale-address sweep (2026-07-21)

Scope: `contracts/`, frontend (`lib/`, `content/`, `app/`), `docs/`, `.env.example`, Vercel cutover docs.  
No Mainnet deploy / no txs in this pass.

## Classification

### Blocking (must be clear before live ceremony)

| Finding | Location | Action |
|---------|----------|--------|
| ~~`VRF_OPERATOR` empty~~ | `contracts/.env` | **Cleared** — B3 VERIFIED (temp ceremony EOA + ACK) |
| ~~`MAINNET_OWNER` empty~~ | `contracts/.env` | **Cleared** — B5 VERIFIED (initial EOA + ALLOW/ACK) |
| ~~B4 temporary provider unsigned~~ | Owner Input Form | **Cleared** — B4 VERIFIED (`B4_OWNER_ACK=1`) |

### Historical documentation only (safe)

| Finding | Location |
|---------|----------|
| Mentions of past placeholder `0x000…0001` as audit history | `docs/MAINNET_*` status/tracker notes |
| Pre-reveal NFT “placeholder URI” (product meaning, not role address) | GDS / Genesis docs |
| Forbidden-list entries of `0x000…0001` / zero | `contracts/scripts/lib/mainnet-game-guards.ts` (intentional deny-list) |

### Test-only and safe

| Finding | Location |
|---------|----------|
| `46630` / Testnet suite addresses in vitest | `lib/game/__tests__/*` |
| `localhost:3002` QA base URLs | `contracts/scripts/qa-*.ts` |
| `USE_REVEAL_MOCK=1` default in `.env.example` for **Testnet** section | `contracts/.env.example` (Mainnet section requires `0`) |
| Zero bytes32 / zero recipient in validate-env / QA | Test helpers |

### Needs owner confirmation

| Finding | Location |
|---------|----------|
| Temporary `RANDOMNESS_PROVIDER` / `RESERVE_MINT_TO` = `0xcE15…069A` | Ceremony env — acknowledge in runbook |
| Transparency “Treasury” vs GameTreasury funder `0xcE15…069A` | Product / transparency page |
| Production Vercel still on Testnet until cutover | Expected until B7 |

## Live ceremony env (post-sprint expectation)

- No process `VRF_OPERATOR=0x000…0001`
- `USE_REVEAL_MOCK=0` for Mainnet
- Scripts fail-closed on placeholders / missing live flags

---

## Consistency audit — `0x000…0001` and related placeholders (2026-07-21)

### Exact `0x0000000000000000000000000000000000000001`

| Location | Role | Action taken |
|----------|------|--------------|
| `contracts/scripts/lib/mainnet-game-guards.ts` | Deny-list (intentional) | **Keep** |
| `contracts/test/mainnetGuards.unit.ts` | Negative tests | **Keep** |
| `lib/game/__tests__/testnetRelayerWrite.test.ts` | Test fixture | **Keep** |
| `lib/swap/probeQuote.ts` | Swap quote probe account (not ceremony role) | **Keep** (out of scope) |
| `docs/MAINNET_OWNER_INPUT_FORM.md` | Forbidden-value note | **Keep** (docs) |
| Historical audit docs mentioning past env value | History | **Keep** as history |

### Related placeholders (not ceremony `VRF_OPERATOR`)

| Pattern | Locations | Action |
|---------|-----------|--------|
| `0x1111…1111` / `0xdead…` | Guard deny-list; unit/frontend tests | Keep (deny / test) |
| Historical `_OWNER_FILLS_` mentions | Older ops notes | Superseded — B5 address configured |
| `PLACEHOLDER_URI` / NFT `OP_PLACEHOLDER` | Genesis metadata pre-reveal | Product meaning — **not** role address; Solidity untouched |
| `whitelistProofs.MAINNET.json` warning `PLACEHOLDER` | Merkle proofs not generated | Separate Mainnet mint prep item |
| ~~Empty `MAINNET_OWNER=`~~ | `contracts/.env` | **Cleared** — B5 VERIFIED |

**Ceremony config result:** live `.env` no longer uses `0x000…0001` for `VRF_OPERATOR`. No Solidity changes.
