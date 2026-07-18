# HANSOME — Game Contract Architecture v1.0

| Field | Value |
|---|---|
| Document type | Game contract architecture (**NO Solidity**) |
| Status | **DRAFT for approval** — planning only |
| Gameplay authority | **HANSOME GDS v1.1** (EN + ZH-TW) — no formula changes |
| NFT authority | `IHansomeGenesis` + `HANSOME_Contract_Architecture_v1.0` / Genesis Mint Spec |
| Companion | `HANSOME_GenesisNFT_Security_Review_v1.1.md` (NFT hardening) |

**This document defines how the Game contracts integrate with Genesis NFTs and implement GDS v1.1.**  
It does **not** invent economics, locations, abilities, or pool ratios.

---

## 1. Game overview

HANSOME is a competitive **GameFi** ecosystem on Robinhood Chain.

| Side | Role | Supply (GDS) | Identity source |
|---|---|---|---|
| **Alpaca** | Survival / location strategy | 500 | Genesis NFT `side = Alpaca` |
| **Cougar** | Hunting | 50 | Genesis NFT `side = Cougar` |

Both sides participate in the **same daily game**, settled against one shared Game Treasury and one daily emission \(R_d\).

Core loop (GDS §6):

```text
Commit → Reveal → Settlement → Claim
```

Rewards are paid **only from the Game Treasury** (no HANSOME minting in settlement — GDS **I-NO-MINT**).

---

## 2. NFT integration

### 2.1 Single collection

Game talks to **one** ERC-721: **HANSOME Genesis NFT**.

- Side detection: on-chain `side(tokenId)` — **not** tokenId ranges, **not** metadata alone.
- Participation is **per NFT** (GDS §4.3): one wallet may play many tokens; each `(tokenId, day)` is independent.

### 2.2 Read API (only)

Game contracts **read** via `IHansomeGenesis` (+ IERC721 ownership):

| Call | Use |
|---|---|
| `side(tokenId)` | Alpaca vs Cougar routing |
| `gameplayClass(tokenId)` | Alpaca ability resolution (King / Guardian / Farmer / Lucky / Runner / Common) |
| `isRevealed(tokenId)` | Gate: sale tokens unusable until NFT collection reveal is complete |
| `ownerOf(tokenId)` / operator | Authorize Commit / Reveal / Claim caller |

Also recommended: `isCollectionRevealed()` for global UX gates.

### 2.3 Hard rules

| Rule | Reason |
|---|---|
| Game **must not** modify NFT state | NFT is identity + ownership; Game is participation + rewards |
| Game **must not** trust metadata for side/class | Marketplace URI can lag or differ; on-chain identity is authority |
| Reject play if `!isRevealed(tokenId)` | Opaque sale tokens have `side == None` until collection reveal |
| Reject if `side == None` | Incomplete identity |
| Cougar: ignore gameplay class (always none / unused) | GDS §4.2 / §12.3 — uniform \(w^C=1\), no abilities |

### 2.4 Class → ability (reference only — GDS §4.1 / §12)

| Class | Settlement effect |
|---|---|
| King | Permanent hunting immunity (\(\pi_i = 0\)) |
| Guardian | Penalty rate × 0.5 |
| Farmer | Location weight × 1.20 (**normalized**) |
| Lucky | 20% chance full same-day penalty immunity |
| Runner | 30% chance escape (penalty = 0) |
| Common | No special mitigation |

---

## 3. Daily game flow

State machine (GDS §6.1):

```text
IDLE → COMMIT_OPEN → COMMIT_CLOSED → REVEAL_OPEN → REVEAL_CLOSED
    → SETTLEMENT → CLAIMABLE → (next day IDLE)
```

Normative timing recommendation (GDS §6.2; absolute hours tunable, **order immutable**):

| Phase | Relative to day start \(t_d\) |
|---|---|
| Commit | \([t_d,\ t_d+20\mathrm{h})\) |
| Reveal | \([t_d+20\mathrm{h},\ t_d+24\mathrm{h})\) |
| Settlement | From \(t_d+24\mathrm{h}\) (once) |
| Claim | After `settled[d]=true` |

### 3.1 Commit phase — responsibilities

| Responsibility | Detail |
|---|---|
| Accept commits | `commitHash = H(tokenId ‖ day ‖ locationId ‖ salt)` |
| Authorize caller | Owner or approved operator of `tokenId` |
| Enforce once | At most one Commit per `(tokenId, day)` |
| Hide strategy | Location not validated in plaintext; commit **immutable** |
| Gate identity | `isRevealed(tokenId)` and valid `side` |
| Safe mode | If \(G < G_{\mathrm{safe}}\), pause Commit (GDS §15.2) |

### 3.2 Reveal phase — responsibilities

| Responsibility | Detail |
|---|---|
| Open reveal window | Players submit `(tokenId, day, locationId, salt)` |
| Verify hash | Must match stored commit |
| Enforce location legality | Alpaca: `{0,1,2,3,4}`; Cougar: `{1,2,3,4}` only |
| Build participation sets | \(\mathcal{A}_d\), \(\mathcal{C}_d\) |
| Non-reveal | Committed but not revealed → reward 0, excluded from denominators |
| No settlement yet | Settlement only after `REVEAL_CLOSED` |

### 3.3 Settlement phase — responsibilities

| Responsibility | Detail |
|---|---|
| Run **once** | `settled[d]` latch (I-SINGLE-SETTLE) |
| Deterministic | Same inputs + day seed ⇒ same outputs |
| Pull \(R_d\) | Emission Controller; require \(G \ge R_d\) (or safe mode) |
| Split pools | 80% Alpaca / 10% Cougar Base / 10% Hunting |
| Resolve traits | King → Runner → Lucky → Guardian → Common/Farmer order |
| VRF rolls | Lucky / Runner only (GDS §16) |
| Book claimables | Per `tokenId` |
| Update Treasury | \(G \leftarrow G - R_d + P_d^{\mathrm{pen}} + R_d^{H,\mathrm{dust}} + S_d\) |
| Conservatives | I-DAY-CONSERVE, I-FARMER-NORM, I-PENALTY-TREASURY |

### 3.4 Claim phase — responsibilities

| Responsibility | Detail |
|---|---|
| Pull payments | Owner/operator claims `claimable[tokenId]` |
| No double pay | Credited day never paid twice |
| Travel with NFT | Unclaimed balances follow `tokenId` (GDS §17) |
| No re-settlement | Claims do not mutate settled allocations |

---

## 4. Player actions

### 4.1 Alpaca (survival)

| Step | Action |
|---|---|
| Choose | Pick `locationId ∈ {Home, Mountain, Grassland, Forest, River}` |
| Commit | Submit hash of `(tokenId, day, locationId, salt)` during Commit |
| Reveal | Open location + salt during Reveal; must match commit |
| Outcome | Share of Alpaca Pool after penalties; class abilities apply |

Alpaca goal: maximize same-day **net** reward under weight vs hunt risk (GDS §3.2).

### 4.2 Cougar (hunting)

| Step | Action |
|---|---|
| Choose | Pick **huntable** `locationId ∈ {Mountain, Grassland, Forest, River}` — **never Home** |
| Commit | Same hash scheme; Home commit is useless (Reveal of Home fails) |
| Reveal | Open hunting location + salt; Home ⇒ invalid for \(\mathcal{C}_d\) |
| Outcome | Base Pool share (equal among valid Cougars) + Hunting Pool if hunt succeeds |

Hunt success (GDS §11.2): location huntable **and** at least one valid Alpaca at that location (\(A_d(L) \ge 1\)).

Cougars have **no special abilities** and uniform weight \(w^C = 1\).

### 4.3 What players do **not** do

- Change commit after acceptance  
- Target a specific enemy `tokenId` (hunt is **location-based**, not peer-ID targeting)  
- Receive hunting penalties as Cougar income (penalties → Treasury)

---

## 5. Location system (GDS §5 / §12.1)

### 5.1 Location IDs

| `locationId` | Name | Alpaca | Cougar | Weight \(w(L)\) |
|---|---|---|---|---|
| 0 | Home | Yes | **No** | 1 |
| 1 | Mountain | Yes | Yes | 2 |
| 2 | Grassland | Yes | Yes | 3 |
| 3 | Forest | Yes | Yes | 5 |
| 4 | River | Yes | Yes | 8 |

Huntable set: \(\mathcal{L}^{H} = \{1,2,3,4\}\).

### 5.2 Reward weights

- \(w(L)\) enters Alpaca effective weight \(\omega_i\) (Farmer: \(m_F \cdot w(L)\), \(m_F = 1.20\)).  
- Higher weight ⇒ higher share of \(R_d^{A}\) **and** higher base hunt-risk narrative.

### 5.3 Hunting risk — base penalty \(\pi^{0}(L)\)

| Location | \(\pi^{0}(L)\) |
|---|---|
| Home | 0 |
| Mountain | 0.10 |
| Grassland | 0.15 |
| Forest | 0.22 |
| River | 0.30 |

### 5.4 Location modifiers (pressure)

If \(L \in \mathcal{L}^{H}\) and \(C_d(L) \ge 1\) (GDS §12.1):

\[
\pi^{\mathrm{pre}}_i = \min\left(0.90,\ \pi^{0}(L)\cdot\left(1+\frac{C_d(L)-1}{A_d(L)+1}\right)\right)
\]

If no Cougars at \(L\) or \(L = \mathrm{Home}\): \(\pi^{\mathrm{pre}}_i = 0\).

**No additional location modifiers** beyond GDS v1.1.

---

## 6. Reward system (GDS §3.4 / §10–§15)

### 6.1 Daily pool split (locked)

\[
R_d^{A} = 0.8\,R_d,\quad
R_d^{C} = 0.1\,R_d,\quad
R_d^{H} = 0.1\,R_d
\]

| Pool | Recipients |
|---|---|
| Alpaca Pool \(R_d^{A}\) | Valid Alpacas \(\mathcal{A}_d\) |
| Cougar Base \(R_d^{C}\) | Valid Cougars \(\mathcal{C}_d\) (equal split) |
| Hunting \(R_d^{H}\) | Successful hunters \(\mathcal{C}_d^{+}\) by score \(\sigma_j = A_d(\ell(j))\) |

### 6.2 Alpaca rewards (summary)

1. \(\omega_i\) from location (+ Farmer multiplier).  
2. Gross: \(r_i^{A,\mathrm{gross}} = R_d^{A} \cdot \omega_i / \Omega_d\) (normalized).  
3. Net: \(r_i^{A,\mathrm{net}} = r_i^{A,\mathrm{gross}} \cdot (1 - \pi_i)\).  
4. Penalties \(P_d^{\mathrm{pen}}\) → **Treasury**, never to Cougars.

### 6.3 Cougar rewards (summary)

1. Base: \(r_j^{C,\mathrm{base}} = R_d^{C} / |\mathcal{C}_d|\).  
2. Hunt: proportional to \(\sigma_j / \Sigma_d\) among successes.  
3. Dust \(R_d^{H,\mathrm{dust}}\) → Treasury.  
4. Total: \(r_j^{C} = r_j^{C,\mathrm{base}} + r_j^{C,\mathrm{hunt}}\).

### 6.4 Treasury interaction

| Flow | Direction |
|---|---|
| Daily draw \(R_d\) | Treasury → pools → claimables |
| Penalties + hunt dust + unallocated returns | → Treasury |
| Sinks (UPGRADE, ITEM, SHIELD, SEASON_ENTRY, TRAIT_REROLL) | Player HANSOME → Treasury |
| Emission steps | \(R_d \in \{400k, 280k, 160k, 80k\}\) by \(G/G_0\) bands; \(G_{\mathrm{safe}} = 15{,}000{,}000\) |

Design assumptions (GDS): \(R_0 = 400{,}000\), \(G_0 = 300{,}000{,}000\) HANSOME.

**No economic redesign in this architecture.**

---

## 7. Security architecture

| Concern | Requirement |
|---|---|
| **Ownership** | Commit / Reveal / Claim only by `ownerOf` or approved operator |
| **NFT identity** | On-chain `side` / `gameplayClass` / `isRevealed` only |
| **Commit/reveal** | Immutable commit; salt ≥ 128-bit entropy recommended; hash ≥ 256-bit |
| **Replay** | Key by `(tokenId, day)`; reject duplicate commit/reveal; reject post-settlement reveal |
| **Double claim** | `settled[d]` + per-token claim accounting; never credit same day twice |
| **Settlement once** | Single settle path per day |
| **Randomness** | VRF/beacon for Lucky/Runner; **not** bare blockhash; replay-verifiable per `(day, tokenId, purpose)` |
| **Reentrancy** | Guards on settle / claim / sink / withdraw |
| **Safe mode** | Pause Commit when \(G < G_{\mathrm{safe}}\) |
| **No NFT mutation** | Game never calls NFT mint/burn/URI/admin |

Mint-collection VRF (Genesis reveal) is **separate** from Game-day VRF (Lucky/Runner), though both may share an adapter pattern.

---

## 8. Contract modules (proposed)

```text
contracts/
  genesis/                          # existing — do not redesign here
    IHansomeGenesis.sol
    HansomeGenesisNFT.sol
    ...

  game/
    GameTypes.sol                   # DayState, LocationId, pool constants (from GDS)
    IHansomeGame.sol                # External player/system API
    IGameTreasury.sol               # Pull R_d / credit penalties / sinks / G balance
    IEmissionController.sol         # R_d from G bands + safe mode
    IRewardDistributor.sol          # claimable[tokenId] bookkeeping + claim
    IGameRandomness.sol             # Day seed / Lucky-Runner Bernoulli
    HansomeGame.sol                 # Day FSM + Commit/Reveal orchestration
    SettlementLib.sol               # Pure/deterministic settlement math (testable)
    SinkRegistry.sol                # Optional: sink entry points → treasury credit
```

| Module | Responsibility |
|---|---|
| `HansomeGame` | Day state machine; commit; reveal; trigger settle; gates |
| `SettlementLib` | GDS §9–§12 formulas; no storage; unit-testable |
| `IGameTreasury` | Hold/account \(G\); fund \(R_d\); accept penalty/dust/sink credits |
| `IEmissionController` | Compute \(R_d\); safe-mode flag |
| `IRewardDistributor` | `claimable[tokenId]`; claim; anti-double-pay |
| `IGameRandomness` | Request/fulfill day VRF seed; derive rolls |
| `GameTypes` | Enums/constants mirroring GDS (no new numbers) |

**Token contract:** existing `HansomeAlpacas` ERC-20 remains the reward asset; Game Treasury holds/allocates it per GDS (no reward minting).

---

## 9. Access control

### 9.1 Roles (logical)

| Role | Powers | Recommendation |
|---|---|---|
| **Default Admin** | Point to NFT/treasury/emission/randomness; pause (emergency) | Multisig |
| **Day Operator** (optional) | Advance phase if not fully time-driven; call `settle(day)` | Multisig or keepers + timelock for config |
| **Treasury Admin** | Initial \(G\) funding; emergency withdraw **only** of non-game funds if any | Multisig + timelock |
| **Emission Admin** | Parameter unfreeze (versioned) — **not** silent v1.1 edits | Timelock + governance process |
| **Pauser** | Pause Commit (and optionally sinks) in incident | Multisig; short delay OK |
| **Players** | Commit / Reveal / Claim / Sink | Open |

### 9.2 Emergency functions (planned)

| Function | Behavior |
|---|---|
| `pauseCommit` | Blocks new commits (safe mode or incident) |
| `pauseClaims` (optional) | Temporary; must not erase claimables |
| `unpause*` | Multisig |
| **No** admin rewrite of settled days | Settled allocations immutable |
| **No** admin reassignment of side/class | NFT-owned |

### 9.3 Multisig / timelock policy

| Action | Control |
|---|---|
| Set NFT / treasury / VRF addresses | Timelock (≥24h) + multisig |
| Emission parameter changes | **GDS version bump** + timelock (not hot-edit v1.1) |
| Pause | Multisig, faster path allowed |
| Settle | Permissionless or keeper once window open (prefer permissionless after `REVEAL_CLOSED`) |

---

## 10. Integration checklist (pre-Solidity)

- [ ] Genesis collection fully revealed (`isCollectionRevealed`) before public game launch  
- [ ] Game wired to `IHansomeGenesis` + IERC721 only  
- [ ] Day VRF provider distinct from (or carefully shared with) mint reveal adapter  
- [ ] Treasury funded; emission bands match GDS §15  
- [ ] Settlement unit tests: Farmer norm, penalty→treasury, hunt dust, E1–E15  
- [ ] Claim follows `tokenId` across transfers  
- [ ] No path mints HANSOME for rewards  

---

## 11. Explicit non-goals (this version)

- Changing 80/10/10, weights, \(\pi^{0}\), \(m_F/p_L/p_R\), or \(G_{\mathrm{safe}}\)  
- Peer-to-peer “target tokenId” hunting  
- Paying penalties to Cougars  
- Game mutating Genesis NFT art/metadata/side  
- Solidity implementation (next phase, after this doc is approved)

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial Game Contract Architecture v1.0 (planning only; GDS-faithful) |

---

**End of document — approve before any `contracts/game/` Solidity work.**
