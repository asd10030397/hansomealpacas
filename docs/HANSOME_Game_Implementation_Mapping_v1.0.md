# HANSOME — Game Implementation Mapping v1.0

| Field | Value |
|---|---|
| Document type | GDS → Solidity module mapping (**NO Solidity yet**) |
| Status | **DRAFT for approval** — gate before `contracts/game/` coding |
| Gameplay authority | HANSOME GDS v1.1 — **no formula or mechanic changes** |
| Architecture | `HANSOME_Game_Contract_Architecture_v1.0.md` |
| NFT read API | `IHansomeGenesis` + IERC721 |

**Purpose:** Trace every GDS rule cluster to a concrete Solidity module/function, with inputs, outputs, and state changes — so implementation cannot drift from GDS.

---

## 0. Module legend

| Module | Path (planned) | Role |
|---|---|---|
| `HansomeGame` | `contracts/game/HansomeGame.sol` | Day FSM, commit, reveal, settle trigger |
| `SettlementLib` | `contracts/game/SettlementLib.sol` | Pure settlement math (GDS §9–§12) |
| `GameTreasury` | `contracts/game/GameTreasury.sol` (via `IGameTreasury`) | \(G\), draw \(R_d\), credit penalties/dust/sinks |
| `EmissionController` | `contracts/game/EmissionController.sol` | \(R_d\) from \(G/G_0\) bands + safe mode |
| `RewardDistributor` | `contracts/game/RewardDistributor.sol` | `claimable[tokenId]`, claim |
| `GameRandomness` | `contracts/game/GameRandomness.sol` | Day VRF seed → Lucky/Runner rolls |
| `SinkRegistry` | `contracts/game/SinkRegistry.sol` | Optional sink entry → treasury credit |
| `GameTypes` | `contracts/game/GameTypes.sol` | Enums/constants from GDS only |
| Genesis NFT | `contracts/genesis/*` | Identity only — **read, never write** |

---

## 1. Mapping table (GDS → Solidity)

### 1.1 GDS §3.4 / §21.4 — Pool split (80 / 10 / 10)

| Field | Content |
|---|---|
| **Solidity** | `SettlementLib.splitDailyPool(uint256 Rd)` → `(Ra, Rc, Rh)` |
| **Also** | Called from `HansomeGame.settleDay(day)` after emission read |
| **Inputs** | `Rd` — daily pool from `EmissionController.currentRd(G)` |
| **Outputs** | `Ra = 0.8·Rd`, `Rc = 0.1·Rd`, `Rh = 0.1·Rd` (integer-safe split; dust policy per GDS E12 → treasury) |
| **State** | None in lib; Game passes values into later steps |

---

### 1.2 GDS §4 — NFT types / ownership / participation

| Field | Content |
|---|---|
| **Solidity** | `HansomeGame._authorizePlayer(tokenId, msg.sender)` |
| **Reads** | `IHansomeGenesis.side`, `gameplayClass`, `isRevealed`; `IERC721.ownerOf` / `isApprovedForAll` / `getApproved` |
| **Inputs** | `tokenId`, `caller` |
| **Outputs** | `Side`, `GameplayClass` (Alpaca) or unused (Cougar); revert if not revealed / not owner-or-operator / `side == None` |
| **State** | None on NFT; Game may cache nothing that overrides on-chain identity |

---

### 1.3 GDS §5 — Locations

| Field | Content |
|---|---|
| **Solidity** | `GameTypes` constants + `SettlementLib.isLocationLegal(side, locationId)` |
| **Also** | Enforced in `HansomeGame.reveal(...)` |
| **Inputs** | `side`, `locationId` |
| **Outputs** | `w(L)`, legality bool; weights `{1,2,3,5,8}` for Home…River |
| **State** | None |

---

### 1.4 GDS §6 — Daily state machine

| Field | Content |
|---|---|
| **Solidity** | `HansomeGame` phase storage + `advanceDay` / time-gated modifiers |
| **Functions** | `currentDay()`, `dayState(day)`, internal `_requireState(day, expected)` |
| **Inputs** | `block.timestamp`, configured `dayZero` / phase durations (order fixed; hours tunable) |
| **Outputs** | `DayState ∈ {Idle, CommitOpen, CommitClosed, RevealOpen, RevealClosed, Settlement, Claimable}` |
| **State** | `mapping(uint256 day => DayState)` or derived from timestamps; `uint256 public currentDay` |

---

### 1.5 GDS §7 — Commit

| Field | Content |
|---|---|
| **Solidity** | `HansomeGame.commit(uint256 tokenId, uint256 day, bytes32 commitHash)` |
| **Inputs** | `tokenId`, `day`, `commitHash = H(tokenId‖day‖locationId‖salt)` (hash computed off-chain) |
| **Guards** | CommitOpen; authorized; `isRevealed(tokenId)`; no prior commit; not safe-mode paused |
| **Outputs** | Event `Committed(tokenId, day, commitHash)` |
| **State** | `commitHash[tokenId][day]`, `committed[tokenId][day] = true` (immutable thereafter) |

---

### 1.6 GDS §8 — Reveal (player location)

| Field | Content |
|---|---|
| **Solidity** | `HansomeGame.reveal(uint256 tokenId, uint256 day, uint8 locationId, bytes32 salt)` |
| **Inputs** | `tokenId`, `day`, `locationId`, `salt` |
| **Guards** | RevealOpen; commit exists; hash matches; not already revealed; location legal for side |
| **Outputs** | Event `Revealed(tokenId, day, locationId, side)` |
| **State** | `location[tokenId][day]`, `revealed[tokenId][day] = true`; append to participation index sets for settlement |

**Cougar Home:** reveal rejected → not in \(\mathcal{C}_d\) (GDS E8).

---

### 1.7 GDS §9 — Settlement orchestration

| Field | Content |
|---|---|
| **Solidity** | `HansomeGame.settleDay(uint256 day)` |
| **Calls** | Emission → Treasury draw → `SettlementLib.settle(...)` → RewardDistributor → Treasury credits |
| **Inputs** | `day`; reads all reveals for \(d\); `Rd`; day VRF `seed_d`; NFT side/class per token |
| **Outputs** | Event `DaySettled(day, Rd, pen, huntDust)`; settlement report structs (optional off-chain) |
| **State** | `settled[day] = true` (once); claimables written; `G` updated |

---

### 1.8 GDS §10 — Alpaca rewards

| Field | Content |
|---|---|
| **Solidity** | `SettlementLib.calculateAlpacaGross(...)` + `applyPenalties(...)` |
| **Distributor** | `RewardDistributor.credit(tokenId, amount)` for nets |
| **Inputs** | \(\mathcal{A}_d\), \(\ell(i)\), `gameplayClass(i)`, `Ra`, \(\pi_i\) |
| **Outputs** | `gross[i]`, `net[i]`, `P_pen` |
| **State** | Via distributor: `claimable[tokenId] += net`; treasury `+= P_pen` |

Farmer: \(\omega_i = 1.20 · w(\ell(i))\); **I-FARMER-NORM** enforced in lib.

---

### 1.9 GDS §11 — Cougar base + hunting

| Field | Content |
|---|---|
| **Solidity** | `SettlementLib.calculateCougarBase(...)` + `SettlementLib.calculateHunt(...)` |
| **Distributor** | `RewardDistributor.credit(tokenId, base + hunt)` |
| **Inputs** | \(\mathcal{C}_d\), \(\ell(j)\), \(A_d(L)\), `Rc`, `Rh`; \(w^C = 1\) |
| **Outputs** | `base[j]`, `hunt[j]`, `RhDust`; success set \(\mathcal{C}_d^{+}\) |
| **State** | Claimables; treasury `+= RhDust` |

Hunt success: \(L \in \mathcal{L}^H \wedge A_d(L) \ge 1\); score \(\sigma_j = A_d(\ell(j))\).

---

### 1.10 GDS §12 — Trait / penalty resolution

| Field | Content |
|---|---|
| **Solidity** | `SettlementLib.resolvePenalty(tokenId, locationId, Ad, Cd, class, seed_d)` |
| **Randomness** | `GameRandomness.bernoulli(seed_d, tokenId, purpose)` for Runner/Lucky |
| **Inputs** | Location; \(A_d(L)\), \(C_d(L)\); class; rolls \(p_R=0.30\), \(p_L=0.20\) |
| **Outputs** | \(\pi_i \in [0,1]\) |
| **State** | None in lib; order fixed: King → pre → Runner → Lucky → Guardian → Common/Farmer |

---

### 1.11 GDS §13 — Treasury accounting

| Field | Content |
|---|---|
| **Solidity** | `GameTreasury.draw(Rd)`, `GameTreasury.credit(amount)`, `GameTreasury.balance()` |
| **Inputs** | `Rd`, penalty sum, hunt dust, sink credits |
| **Outputs** | Updated \(G\); revert if draw would violate non-negativity outside safe mode |
| **State** | `uint256 G` (HANSOME balance / accounting); transfer ERC-20 as designed |

---

### 1.12 GDS §14 — Sinks

| Field | Content |
|---|---|
| **Solidity** | `SinkRegistry.sink(SinkId id, uint256 amount)` (or per-sink stubs) |
| **Inputs** | `id ∈ {UPGRADE, ITEM, SHIELD, SEASON_ENTRY, TRAIT_REROLL}`, `amount`, payer |
| **Outputs** | Event `Sunk(id, payer, amount)` |
| **State** | Pull HANSOME from player → `GameTreasury.credit(amount)`; prices **not** frozen in GDS v1.1 (ops table later) |

---

### 1.13 GDS §15 — Emission controller

| Field | Content |
|---|---|
| **Solidity** | `EmissionController.currentRd(uint256 G)` + `isSafeMode(G)` |
| **Inputs** | `G`, constants \(G_0=3e8\), \(G_{\mathrm{safe}}=15e6\), step table |
| **Outputs** | `Rd ∈ {400k, 280k, 160k, 80k}` HANSOME (wei-scaled in impl); or safe-mode signal |
| **State** | Immutable/config constants; **no hot-edit of GDS bands without version bump** |

Safe mode: `HansomeGame` rejects `commit` while `isSafeMode`.

---

### 1.14 GDS §16 — Randomness (Lucky / Runner)

| Field | Content |
|---|---|
| **Solidity** | `GameRandomness.requestDaySeed(day)` / `fulfillDaySeed(day, word)` |
| **Also** | `GameRandomness.roll(day, tokenId, purpose) → bool` |
| **Inputs** | VRF/beacon word; `day`, `tokenId`, `purpose ∈ {Runner, Lucky}` |
| **Outputs** | \(\rho_i^R\), \(\rho_i^L\); day seed stored |
| **State** | `seed[day]`; request ids; **not** player-biasable pre-settlement |

---

### 1.15 GDS §17 — Claim

| Field | Content |
|---|---|
| **Solidity** | `RewardDistributor.claim(uint256 tokenId)` / `claimMany(uint256[] tokenIds)` |
| **Inputs** | `tokenId`(s); caller must be owner/operator |
| **Outputs** | ERC-20 transfer of pending claimable; Event `Claimed` |
| **State** | `claimable[tokenId] → 0` (or decrease); **balances travel with NFT** (no wallet-locked ledger) |

---

### 1.16 GDS §9.3 — Conservation invariants (checks)

| Field | Content |
|---|---|
| **Solidity** | `SettlementLib.assertConservation(...)` called at end of `settleDay` |
| **Inputs** | Sum nets, cougar totals, `P_pen`, `RhDust`, `Rd` |
| **Outputs** | Revert if `sum ≠ Rd` (within integer dust policy) |
| **State** | None if pass; day unsettled if revert (no partial settle) |

---

### 1.17 GDS §19 — Edge cases (selected → handlers)

| Edge | Solidity handling |
|---|---|
| E1 No Alpacas | `Ra` → treasury; Cougars may still settle |
| E2 No Cougars | `Rc+Rh` → treasury |
| E3 All hunts fail | `Rh` → dust/treasury; Base still pays |
| E8 Cougar Home | `reveal` reverts / not in \(\mathcal{C}_d\) |
| E9 Commit w/o reveal | Excluded from sets |
| E11 Safe mode | `commit` paused |
| E12 Integer dust | Remainder → treasury |
| E13 Duplicate commit | Revert |
| E14 Reveal after settle | Revert |

---

## 2. End-to-end call sequence (one day)

```text
[CommitOpen]
  Player → HansomeGame.commit(tokenId, day, hash)
           ↳ reads IHansomeGenesis + IERC721

[RevealOpen]
  Player → HansomeGame.reveal(tokenId, day, locationId, salt)

[RevealClosed]
  Keeper/anyone → HansomeGame.settleDay(day)
       ↳ EmissionController.currentRd(G)
       ↳ GameTreasury.draw(Rd)
       ↳ GameRandomness ensures seed[day]
       ↳ SettlementLib.splitDailyPool
       ↳ SettlementLib (alpaca gross → penalties → cougar base → hunt)
       ↳ RewardDistributor.credit(...)
       ↳ GameTreasury.credit(pen + dust + unallocated)
       ↳ settled[day] = true

[Claimable]
  Player → RewardDistributor.claim(tokenId)
```

---

## 3. Input / output / state summary matrix

| GDS theme | Primary function | Key inputs | Key outputs | State writes |
|---|---|---|---|---|
| Pools 80/10/10 | `SettlementLib.splitDailyPool` | `Rd` | `Ra,Rc,Rh` | — |
| NFT identity | `HansomeGame._authorizePlayer` | `tokenId`, caller | side, class | — |
| Locations | `reveal` + lib legality | side, `locationId` | `w(L)`, ok/fail | `location[t][d]` |
| Day FSM | `HansomeGame` views/guards | time, day | phase | phase/day cursor |
| Commit | `HansomeGame.commit` | hash, token, day | event | `commitHash`, flags |
| Reveal | `HansomeGame.reveal` | loc, salt | event | `location`, flags, sets |
| Settlement | `HansomeGame.settleDay` | day, reveals, seed | events | `settled`, claimables, `G` |
| Alpaca $ | `SettlementLib` + `credit` | A-set, class, Ra | nets, pen | claimable, `G` |
| Cougar $ | `calculateCougarBase` / `calculateHunt` | C-set, Ad, Rc, Rh | base, hunt, dust | claimable, `G` |
| Traits | `resolvePenalty` | loc, Ad, Cd, class, rolls | π | — |
| Treasury | `GameTreasury.*` | Rd, credits | `G` | `G`, ERC-20 |
| Sinks | `SinkRegistry.sink` | id, amount | event | `G` ↑ |
| Emission | `EmissionController.currentRd` | `G` | `Rd`, safe flag | — |
| VRF | `GameRandomness.*` | day, token, purpose | seed, bool rolls | `seed[day]` |
| Claim | `RewardDistributor.claim` | tokenId | transfer | claimable ↓ |

---

## 4. Explicit non-mappings (out of scope)

| Topic | Why |
|---|---|
| Genesis mint / NFT reveal shuffle | NFT architecture — not Game |
| Marketplace metadata | Display only |
| New locations / seasons / guilds | GDS §20 future; needs version bump |
| Changing 80/10/10 or \(\pi^{0}\) | Forbidden without GDS upgrade |

---

## 5. Approval gate

Implementation of `contracts/game/**` may begin only after this mapping is approved.

Checklist for implementers:

- [ ] Every settlement number cited from GDS §10–§12 / §21.4  
- [ ] No new mechanics  
- [ ] NFT written only via existing Genesis contracts (Game is read-only)  
- [ ] Unit tests named after GDS invariants (I-FARMER-NORM, I-PENALTY-TREASURY, I-DAY-CONSERVE, E1–E15)

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial implementation mapping v1.0 |

---

**End — approve before Solidity under `contracts/game/`.**
