# HANSOME — Mainnet Roles & Operational Runbook (B3 / B4 / B5)

| Field | Value |
|------|------|
| File | `docs/MAINNET_ROLES_AND_RUNBOOK.md` |
| Purpose | Close launch blockers for **VRF_OPERATOR**, **RANDOMNESS_PROVIDER**, **MAINNET_OWNER** |
| Mode | Ops + deployment configuration — **no** Solidity redesign |
| Related | [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) · [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) |

**Hard rules**

- Never use `0x000…0001`, `0x111…`, `0xdead…`, or other placeholders in live ceremony env.
- Do **not** invent production addresses in docs or `.env` — owner fills real wallets.
- No deployment / no transactions from this document alone.

---

## Role map

| Role | Env | On-chain use | Recommended custody |
|------|-----|--------------|---------------------|
| **Deployer** | `DEPLOYER_PRIVATE_KEY` (prefer); if empty, **intentional** fallback to `TREASURY_PRIVATE_KEY` via `scripts/lib/signer.ts` | Deploys Genesis + game suite; temporary Ownable | Hot ceremony EOA (same key OK for launch) |
| **VRF_OPERATOR** | `VRF_OPERATOR` | `VRFRevealAdapter` constructor arg — **Genesis collection reveal** entropy (**≠** game day seed) | Dedicated hot/ops EOA or same as deployer *only if* documented |
| **RANDOMNESS_PROVIDER** | `RANDOMNESS_PROVIDER` | `GameRandomness.setRandomnessProvider` → daily `fulfillDaySeed` | Launch: ceremony EOA OK; later: rotate to dedicated ops key |
| **MAINNET_OWNER** | `MAINNET_OWNER` | Post-verify `transferOwnership` target for Genesis + game Ownables | **Multisig or timelock** (preferred over long-term EOA) |
| **RESERVE_MINT_TO** | `RESERVE_MINT_TO` | Receives reserved `#001`–`#010` | Founder / cold custody |

---

## B3 — VRF_OPERATOR

### Architecture

- Genesis reveal uses `VRFRevealAdapter` (Mainnet: **no** `RevealRandomnessMock` / `USE_REVEAL_MOCK=1` forbidden).
- Operator address is passed at **`deploy-genesis.ts`** deploy time (`VRFRevealAdapter(deployer, vrfOperator)`).
- This role is **independent** of `RANDOMNESS_PROVIDER` (game day seeds).

### Why `0x000…0001` appeared

- Stale **process/shell** environment from earlier dry-runs — **not** in Solidity and **not** (previously) in `contracts/.env`.
- Dry-run scripts historically treated “any non-empty string” as pass, so the placeholder was accepted incorrectly.

### Who should be production VRF_OPERATOR

- **Preferred (permanent):** a production-grade VRF or beacon provider after integration testing + security validation + explicit owner approval.
- **Approved temporary (ceremony):** ceremony deployer / Treasury EOA `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` — **owner-approved 2026-07-21** as temporary ceremony EOA only (see [`MAINNET_OWNER_INPUT_FORM.md`](./MAINNET_OWNER_INPUT_FORM.md)).
- **Do not invent** an address in-repo. Owner must supply the checksummed address.

### Owner approval (recorded)

| Item | Value |
|------|------|
| Approved address | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| `VRF_OPERATOR_OWNER_ACK` | `1` (authorized) |
| Classification | Temporary ceremony EOA — **not** permanent production VRF |
| Scope | **VRFRevealAdapter** `VRF_OPERATOR` role only |
| Deploy authorized by this approval? | **No** |
| Record | [`MAINNET_OWNER_INPUT_FORM.md`](./MAINNET_OWNER_INPUT_FORM.md) |

**Must not confuse with:** Game `RANDOMNESS_PROVIDER` (B4), Testnet `RevealRandomnessMock` (`0x76CeFc…`), or Testnet `GameRandomness` (`0x45F9FF…`).

### Replacement plan

Replace the temporary ceremony EOA with a production-grade VRF or beacon provider after integration testing, security validation, and explicit project owner approval. Prioritize replacement if the EOA key is exposed, signer access changes, fulfillment becomes unreliable, or a supported production VRF becomes available.

### Configuration step (ops — after owner approval)

1. Clear any process env: `Remove-Item Env:VRF_OPERATOR` (PowerShell) if set to a placeholder.
2. Set in **`contracts/.env`** (gitignored) — **pending** as of owner-form update:

```text
USE_REVEAL_MOCK=0
VRF_OPERATOR=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A
VRF_OPERATOR_OWNER_ACK=1
```

3. Revalidate checksum, chainId **4663**, key control, and operator/deployer balance before any live deploy.
4. Re-run: `npx hardhat run scripts/dry-run-mainnet-deploy-plan.ts --network robinhood`  
   — `vrf_operator` must **PASS** and must **not** be `0x000…0001`.
5. Live Genesis only after go-live flags + separate ceremony authorization — not by this approval alone.

### B3 status

| State | Meaning |
|-------|---------|
| Placeholder removed from ceremony config | Done |
| Owner decision recorded | **Done** (2026-07-21) — temporary ceremony EOA |
| Values inserted into `contracts/.env` | **Done** |
| Guard validation | **PASS** (`requireMainnetVrfOperator` + unit tests) |
| Board status | **VERIFIED** (temporary; replacement plan retained; deploy not authorized) |

---

## B4 — RANDOMNESS_PROVIDER

### Production flow

1. `deploy-game.ts` deploys `GameRandomness` and calls `setRandomnessProvider(RANDOMNESS_PROVIDER)`.
2. Each day, before settle: provider calls `GameRandomness.fulfillDaySeed(day, seed)`.
3. Settlement / claim path consumes the day seed (see GDS randomness section).

### Launch configuration (temporary — ceremony EOA)

| Item | Value |
|------|------|
| **Configured address** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Nature** | **Temporary** ceremony EOA (same key material as current deployer/Treasury fallback). **Not** a placeholder. |
| **Auto-approved?** | **Yes (recorded)** — project-owner acknowledgment 2026-07-21 (below). |
| **Rotation** | Replace with decentralized / production-grade randomness when available; Ownable may `setRandomnessProvider`. |

```text
RANDOMNESS_PROVIDER=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A
B4_OWNER_ACK=1
B4_APPROVED_BY=Project Owner
B4_APPROVAL_DATE=2026-07-21
```

### Permissions

- Only the configured provider may call `fulfillDaySeed` (contract-enforced).
- Ownable on `GameRandomness` can rotate the provider later.

### Operational runbook (daily)

| Step | Action | Fail if |
|------|--------|---------|
| 1 | Confirm current day index / Commit window | Wrong day |
| 2 | Provider wallet on chainId **4663** with gas | Underfunded |
| 3 | `fulfillDaySeed(day, seed)` | Wrong provider / revert |
| 4 | Confirm `hasDaySeed(day)` | Seed missing |
| 5 | Finalize / creditBatch | — |

### Monitoring

- Day seed missing after Commit close + buffer.
- Provider ETH gas balance.
- After ownership transfer, re-read `randomnessProvider()`.

### Go-live acknowledgment (B4) — recorded

| Field | Value |
|------|------|
| **Provider address** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Provider status** | **temporary** |
| **Approval date** | 2026-07-21 |
| **Approved by** | Project Owner |
| **B4_OWNER_ACK** | `1` |
| **Replacement plan** | Replace with a decentralized or production-grade randomness provider when available. |

### Failure recovery (B4)

| Failure | Action |
|---------|--------|
| `fulfillDaySeed` reverts (wrong provider) | Confirm `randomnessProvider()` matches env; use correct key |
| Seed missing near settle | Retry fulfill; check gas; halt settle messaging until `hasDaySeed` |
| Provider key compromised | Owner rotates via `setRandomnessProvider` after Ownable control |
| Provider offline | Backup ops signer (after rotation) or founder multisig ops |

### Exact remaining action (B4)

**None for B4 board.** Continue to B7 ceremony checklist. Deploy not authorized by this acknowledgment alone.

### B4 status

**VERIFIED** — env + permissions + runbook + monitoring + recovery + owner acknowledgment recorded (temporary ceremony EOA).

---

## B5 — MAINNET_OWNER

### Recommendation

| Option | Use when |
|--------|----------|
| **Multisig** (preferred) | Production Ownable for Genesis + game suite |
| **Timelock + multisig** | Delayed admin actions |
| **EOA** | Emergency only — requires `MAINNET_OWNER_ALLOW_CEREMONY_EOA=1` + `MAINNET_OWNER_OWNER_ACK=1` if using ceremony EOA |

### Owner worksheet (recorded 2026-07-21)

| Field | Value |
|------|------|
| **Owner type** | **EOA hot wallet** (initial launch — not multisig / not timelock) |
| **MAINNET_OWNER address** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Signer count** | 1 (single EOA) |
| **Threshold** | 1-of-1 |
| **Rotation** | Ownership may be transferred to a multisig or timelock later |
| **Nature** | Operational launch decision — not permanent custody end-state |

### Configuration (effective)

```text
MAINNET_OWNER=0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A
MAINNET_OWNER_ALLOW_CEREMONY_EOA=1
MAINNET_OWNER_OWNER_ACK=1
```

Ceremony EOA as owner requires both ACK flags so `transfer-mainnet-ownership.ts` / guards accept it. Address is **not** hardcoded in Solidity; scripts read env.

```text
DRY_RUN=1 npx hardhat run scripts/transfer-mainnet-ownership.ts --network robinhood
# Live only after:
# ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=YES LIVE_MAINNET_SEND=1
```

### B5 status

**VERIFIED** — owner-approved initial EOA in `.env`; `requireMainnetOwner` PASS with ACK flags; no conflicting owner value. Deploy not authorized by this alone.

---

## Manual inputs still required from project owner

1. ~~**`VRF_OPERATOR`**~~ — **Done / B3 VERIFIED**
2. ~~**`MAINNET_OWNER`**~~ — **Done / B5 VERIFIED**
3. ~~**B4 acknowledgment**~~ — **Done / B4 VERIFIED**
4. **B7 ceremony** — dry-run zero blockers + human GO sign-off before any live write ([`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md))

---

## Deployment order (after B3/B5 addresses filled)

1. Env: `GAME_DAY_ZERO=1784894400`, `USE_REVEAL_MOCK=0`, validated `VRF_OPERATOR`, `RANDOMNESS_PROVIDER`, funder 30M, deployer ≥ 0.05 ETH.
2. Dry-runs → zero blockers.
3. Live Genesis: `ALLOW_MAINNET_DEPLOY=1 CONFIRM_MAINNET_DEPLOY=YES LIVE_MAINNET_SEND=1` + `deploy-genesis.ts`.
4. Live Game: same flags + `deploy-game.ts`.
5. `verify-mainnet-game.ts`.
6. `transfer-mainnet-ownership.ts` → `MAINNET_OWNER`.
7. GameTreasury **30M** if skipped at deploy.
8. Vercel Production cutover (B7).

---

## Emergency runbook

| Incident | Detection | Immediate action | Owner | Recovery | Escalate when |
|----------|-----------|------------------|-------|----------|---------------|
| **VRF failure** | Reveal adapter reverts / operator offline | Pause public messaging of reveal ETA; check operator gas + key | Ops / VRF_OPERATOR | Retry fulfill; if key lost, owner rotates operator if contract allows / redeploy path per architecture | >2h stuck |
| **RPC outage** | RPC errors / wrong chainId | Switch to backup Mainnet RPC; halt live scripts | Ops | Confirm chainId 4663; resume dry-run then live | Outage >30m |
| **Reveal stuck** | Collection unrevealed past window | Check VRF_OPERATOR balance + txs; inspect adapter | Ops | Retry; communicate delay | >4h |
| **Treasury gas shortage** | Deployer/provider ETH low | Stop nonessential txs; top up from funding wallet | Treasury / Ops | Fund ≥0.05 ETH deployer; re-check | Cannot settle day |
| **Ownership transfer failure** | `transferOwnership` reverts / wrong owner | Halt further admin; DRY_RUN plan again | Founder / Ops | Fix MAINNET_OWNER; retry from deployer if still owner | Deployer lost |
| **Metadata unavailable** | tokenURI / IPFS fail | Serve status page; do not change on-chain URI hastily | Ops / Product | Restore CID gateway; freeze CID once stable | >1h public mint |
| **Frontend wrong chain** | Users on 46630 or wrong contracts | Disable Production cutover / rollback Vercel env | Ops / Vercel | Restore Testnet or correct Mainnet JSON addresses | Any wrong-chain write |
| **Failed contract verification** | Blockscout verify fail | Continue ops with source in repo; retry verify | Ops | Flatten/compiler settings; publish addresses anyway | Blocking explorer trust |
| **Post-launch incident** | Exploit report / major outage | Pause messaging; assess Ownable pause paths if any; do not rush upgrades | Founder + Ops | Public post + incident log; escalate to counsel if funds at risk | User funds at risk |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | B4 **VERIFIED** — owner ack + replacement plan; B1–B6 closed; B7 checklist ready |
| 2026-07-21 | B5 **VERIFIED** — initial EOA `0xcE15…069A` + ceremony ACK flags; B4 ack still pending |
| 2026-07-21 | B3 **VERIFIED** (env + guards); B4 remaining = owner ack; B5 address still pending |
| 2026-07-21 | B3 temporary ceremony EOA owner-approved; replacement plan recorded; B3 IN PROGRESS (not VERIFIED); B4/B5 unchanged |
| 2026-07-21 | Initial roles + runbook; B4 launch provider documented; B3/B5 pending owner addresses |
| 2026-07-21 | B4 acknowledgment form; B5 owner worksheet; emergency table; fail-closed ACK flags documented |
