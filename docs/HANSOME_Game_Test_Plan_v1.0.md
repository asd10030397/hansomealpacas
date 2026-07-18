# HANSOME — Game Test Plan v1.0

| Field | Value |
|---|---|
| Document type | Pre-implementation test plan for `contracts/game/` |
| Status | **DRAFT for approval** — gate before Solidity coding |
| Gameplay authority | HANSOME GDS v1.1 — **no formula or mechanic changes** |
| Architecture | `HANSOME_Game_Contract_Architecture_v1.0.md` |
| Mapping | `HANSOME_Game_Implementation_Mapping_v1.0.md` |
| NFT fixture | Mock / existing Genesis interfaces (`IHansomeGenesis` + IERC721) |

**Purpose:** Define the mandatory test suite that implementation must satisfy. Tests assert GDS v1.1 behavior only — no new mechanics, no balance tweaks.

**Convention:** Each test ID maps to a GDS section, invariant, or edge case. Failures are implementation bugs unless GDS is formally version-bumped.

---

## 0. Test harness assumptions

| Item | Requirement |
|---|---|
| Framework | Hardhat (same as Genesis suite) |
| Time | `evm_increaseTime` / warp for FSM windows |
| Randomness | `GameRandomness` mock with deterministic seed injection |
| NFT | Fixture minting Alpacas (classes) + Cougars; `side` / `gameplayClass` / `isRevealed` settable |
| Token | Mock ERC-20 HANSOME funded into `GameTreasury` |
| Precision | All money asserts use integer exactness or documented dust → treasury |

Suggested file layout (when coding begins):

```text
contracts/test/game/
  SettlementLib.unit.ts
  EmissionController.unit.ts
  GameTreasury.unit.ts
  RewardDistributor.unit.ts
  GameRandomness.unit.ts
  HansomeGame.fsm.ts
  HansomeGame.integration.ts
  Invariants.economic.ts
  Edges.gds.ts
```

---

## 1. Unit tests

Pure / module-local. Prefer `SettlementLib` and controllers without full day orchestration where possible.

### 1.1 Location weights & legality (`GameTypes` / `SettlementLib`)

| ID | Case | Assert |
|---|---|---|
| U-LOC-01 | Weights Home…River | `w = {1,2,3,5,8}` exactly |
| U-LOC-02 | Alpaca legal at all five locations | Accept |
| U-LOC-03 | Cougar illegal at Home | Reject / not in \(\mathcal{C}_d\) (E8) |
| U-LOC-04 | Cougar legal at Mountain…River | Accept |
| U-LOC-05 | Hunt location set | \(\mathcal{L}^H = \mathcal{L}\setminus\{\mathrm{Home}\}\) |

### 1.2 Reward pools 80 / 10 / 10 (`SettlementLib.splitDailyPool`)

| ID | Case | Assert |
|---|---|---|
| U-POOL-01 | Nominal `Rd` | `Ra + Rc + Rh + dust = Rd`; targets 80% / 10% / 10% |
| U-POOL-02 | `Rd` not divisible by 10 | Remainder (dust) → treasury bucket, never to players |
| U-POOL-03 | `Rd = 0` | All pools 0 (E15 path) |
| U-POOL-04 | Large `Rd` | No overflow; ratios preserved |

### 1.3 Alpaca gross / Farmer normalization (`SettlementLib`)

| ID | Case | Assert |
|---|---|---|
| U-ALP-01 | Single Common at weight `w` | Receives entire `Ra` gross |
| U-ALP-02 | Two Commons same location | Equal split of `Ra` |
| U-ALP-03 | Mixed weights 1 vs 8 | Proportional to `w(L)` |
| U-ALP-04 | Farmer alone (E6) | Gross = entire `Ra` (**I-FARMER-NORM**) |
| U-ALP-05 | Farmer + Common same `w` | Farmer share = \(1.2/(1+1.2)\); sum gross = `Ra` |
| U-ALP-06 | Farmer + multi locations | \(\sum r^{A,\mathrm{gross}} = Ra\) always when \(\Omega_d > 0\) |
| U-ALP-07 | Empty \(\mathcal{A}_d\) | No alpaca credits; `Ra` marked for treasury (E1) |

### 1.4 Penalty / trait order (`SettlementLib.resolvePenalty`)

| ID | Case | Assert |
|---|---|---|
| U-TRAIT-01 | Base \(\pi^0(L)\): Home 0 … River 0.30 | Matches GDS §12.1 table |
| U-TRAIT-02 | \(C_d(L)=0\) or Home | \(\pi^{\mathrm{pre}}=0\) |
| U-TRAIT-03 | King any location | \(\pi=0\) first; stop (**E7**) |
| U-TRAIT-04 | Runner success (`p_R` roll = 1) | \(\pi=0\) |
| U-TRAIT-05 | Runner fail → Lucky success | \(\pi=0\) |
| U-TRAIT-06 | Both fail → Guardian | \(\pi = 0.5 \cdot \pi^{\mathrm{pre}}\) |
| U-TRAIT-07 | Common / Farmer | \(\pi = \pi^{\mathrm{pre}}\) |
| U-TRAIT-08 | Order fixed | King → pre → Runner → Lucky → Guardian → default (**I-TRAIT-ORDER**) |
| U-TRAIT-09 | Cougar | No trait path; \(w^C=1\) only |

### 1.5 Net alpaca + penalty accounting

| ID | Case | Assert |
|---|---|---|
| U-NET-01 | `net = gross * (1 - π)` | Integer policy documented |
| U-NET-02 | Sum nets + `P_pen` (+ dust) = `Ra` | Conservation within alpaca pool |
| U-NET-03 | `P_pen` destination | Treasury only (**I-PENALTY-TREASURY**); never added to `Rc`/`Rh` |

### 1.6 Cougar base + hunting (`calculateCougarBase` / `calculateHunt`)

| ID | Case | Assert |
|---|---|---|
| U-COG-01 | Equal base | `Rc / |C_d|` each when `|C_d| > 0` |
| U-COG-02 | Empty \(\mathcal{C}_d\) | `Rc+Rh` → treasury (E2) |
| U-COG-03 | Hunt success | \(L \in \mathcal{L}^H \wedge A_d(L) \ge 1\) |
| U-COG-04 | Hunt fail (no alpacas at L) | No hunt share; contributes to dust |
| U-COG-05 | Score \(\sigma_j = A_d(\ell(j))\) | Proportional hunt among \(\mathcal{C}_d^{+}\) |
| U-COG-06 | All hunts fail (E3) | `Rh` → treasury; base still pays |
| U-COG-07 | All alpacas Home (E4) | Same as E3 for hunt |
| U-COG-08 | `w^C = 1` | No rarity / ability modifiers |

### 1.7 Emission controller

| ID | Case | Assert |
|---|---|---|
| U-EM-01 | Bands vs \(G/G_0\) | `Rd ∈ {400k, 280k, 160k, 80k}` per GDS §15 |
| U-EM-02 | Safe mode | `G < G_safe` (15M) → safe flag true |
| U-EM-03 | Constants | \(G_0=300M\), \(R_0=400k\) — no silent edits |

### 1.8 Treasury unit

| ID | Case | Assert |
|---|---|---|
| U-TRE-01 | `draw(Rd)` | Decreases `G` by `Rd` when funded |
| U-TRE-02 | `credit` | Increases `G` (penalties, dust, sinks) |
| U-TRE-03 | Overdraw | Revert (**I-TREASURY-NONNEG** / E10) |
| U-TRE-04 | No reward mint | Balance change equals transfers only (**I-NO-MINT**) |

### 1.9 RewardDistributor unit

| ID | Case | Assert |
|---|---|---|
| U-DIST-01 | `credit` increases `claimable[tokenId]` | Exact |
| U-DIST-02 | Double credit same settlement day | Prevented (settle once → credit once) |
| U-DIST-03 | Claim zeroes pending | Transfer = previous claimable |
| U-DIST-04 | Claim with zero | No-op or revert (pick one; document) |

### 1.10 Randomness unit

| ID | Case | Assert |
|---|---|---|
| U-RNG-01 | Same `(day, tokenId, purpose, seed)` → same bool | Deterministic |
| U-RNG-02 | Different purpose (Runner vs Lucky) | Independent draws |
| U-RNG-03 | Unfulfilled seed | Settlement reverts / blocked |

---

## 2. Integration tests

Full Commit → Reveal → Settle → Claim path with fixtures.

### 2.1 Commit / Reveal FSM

| ID | Case | Assert |
|---|---|---|
| I-FSM-01 | Happy path phases | CommitOpen → commit → RevealOpen → reveal → settle → claimable |
| I-FSM-02 | Commit outside CommitOpen | Revert |
| I-FSM-03 | Reveal outside RevealOpen | Revert |
| I-FSM-04 | Commit hash immutable | Second commit same `(tokenId, day)` reverts (E13) |
| I-FSM-05 | Wrong salt / location on reveal | Revert; no location written |
| I-FSM-06 | Duplicate reveal | Revert |
| I-FSM-07 | Settle before RevealClosed | Revert |
| I-FSM-08 | Double settle same day | Revert (**I-SINGLE-SETTLE**) |
| I-FSM-09 | Reveal after settle | Revert (E14) |
| I-FSM-10 | Safe mode blocks commit | Revert while `G < G_safe` (E11); sinks may still run |
| I-FSM-11 | Day advance | New day independent commits; old day settled immutable |

### 2.2 Settlement orchestration

| ID | Case | Assert |
|---|---|---|
| I-SET-01 | Mixed alpacas + cougars one day | Credits match lib oracle for same inputs |
| I-SET-02 | Emission → draw → split → allocate → credit treasury | Order and balances end-to-end |
| I-SET-03 | Events | `DaySettled` / credits emit with expected `Rd`, pen, dust |
| I-SET-04 | Non-reveal excluded | Commit-only token: reward 0; not in denominators (E9) |
| I-SET-05 | Permissionless settle | Any caller after window; same result |

### 2.3 NFT ownership & identity checks

| ID | Case | Assert |
|---|---|---|
| I-NFT-01 | Non-owner commit | Revert |
| I-NFT-02 | Approved operator commit/reveal/claim | Success |
| I-NFT-03 | Unrevealed NFT | Commit rejected |
| I-NFT-04 | Side from chain | Alpaca cannot use cougar-only paths; class from `gameplayClass` |
| I-NFT-05 | Game never mutates NFT | After settle: same `ownerOf`, `side`, `tokenURI` / reveal flags |
| I-NFT-06 | Transfer mid-day | New owner can reveal/claim if rules allow; claimable follows `tokenId` |

### 2.4 Claim security

| ID | Case | Assert |
|---|---|---|
| I-CLM-01 | Owner claims | Receives exact claimable; pending → 0 |
| I-CLM-02 | Non-owner / non-operator claim | Revert |
| I-CLM-03 | Double claim | Second claim pays 0 / reverts; no double pay |
| I-CLM-04 | Claim after NFT transfer | New owner claims remaining; old owner cannot |
| I-CLM-05 | Reentrancy on claim | Guarded; no double transfer |
| I-CLM-06 | Claim before settle | No pending for that day |

### 2.5 Treasury interaction (integrated)

| ID | Case | Assert |
|---|---|---|
| I-TRE-01 | Day settle: `G_after = G_before - Rd + pen + dust + unallocated` | Exact |
| I-TRE-02 | Sink credit increases `G` | Player balance decreases by amount |
| I-TRE-03 | Penalties never increase cougar claimables | Compare cougar totals with/without alpaca penalties |

### 2.6 Ability + hunting integration

| ID | Case | Assert |
|---|---|---|
| I-ABL-01 | King at River with cougars | Net = gross; still in \(\Omega_d\) |
| I-ABL-02 | Guardian vs Common same loc | Guardian net higher when both would take penalty |
| I-ABL-03 | Runner/Lucky with fixed mock rolls | Match expected π path |
| I-ABL-04 | Farmer congestion | Gross shares normalized; no over-emission |
| I-HNT-01 | One cougar, alpacas at Forest | Hunt share > 0 iff success predicate |
| I-HNT-02 | Two cougars same L, different \(A_d\) via splits | Proportional to \(\sigma\) |
| I-HNT-03 | Cougar at empty hunt L | Base only; dust absorbs Rh share |

---

## 3. Edge case tests (GDS §19)

Every row must have at least one automated test.

| ID | GDS | Assert |
|---|---|---|
| E-01 | E1 No Alpacas | `Ra` → treasury; cougars may receive base/hunt as applicable |
| E-02 | E2 No Cougars | `Rc+Rh` → treasury; alpacas settle normally |
| E-03 | E3 All hunts fail | `Rh` → treasury; base pays |
| E-04 | E4 All Alpacas Home | No hunt success; Rh → treasury |
| E-05 | E5 Congestion | Per-head gross shrinks; settlement still conserves |
| E-06 | E6 Sole Farmer | Entire `Ra` gross to Farmer |
| E-07 | E7 King at River | \(\pi=0\); weight still counted |
| E-08 | E8 Cougar Home | Reveal fails; not in \(\mathcal{C}_d\) |
| E-09 | E9 Commit w/o Reveal | Reward 0; excluded from sets |
| E-10 | E10 `G < Rd` above safe | Settlement refused |
| E-11 | E11 Safe mode | Commit paused; resume when \(G \ge G_{\mathrm{safe}}\) |
| E-12 | E12 Integer dust | Dust → treasury; sum of player credits + credits ≤ `Rd` with dust closing gap |
| E-13 | E13 Duplicate commit | Revert |
| E-14 | E14 Reveal after settle | Revert |
| E-15 | E15 `Rd = 0` | No allocation; day may advance |

---

## 4. Economic invariant tests

Cross-cutting properties; run after settlement fixtures (fuzz optional later).

| ID | Invariant | Assert |
|---|---|---|
| INV-01 | **I-DAY-CONSERVE** | Player nets (A+C) + `P_pen` + hunt dust + unallocated = `Rd` |
| INV-02 | **I-FARMER-NORM** | \(\sum r^{A,\mathrm{gross}} = Ra\) when \(\Omega_d > 0\) |
| INV-03 | **I-PENALTY-TREASURY** | `P_pen` credited only to treasury; cougar total independent of `P_pen` |
| INV-04 | **I-SINGLE-SETTLE** | Second `settleDay(d)` reverts |
| INV-05 | **I-NO-MINT** | HANSOME `totalSupply` unchanged across settle/claim/sink |
| INV-06 | **I-TREASURY-NONNEG** | `G ≥ 0` after every op |
| INV-07 | **I-REWARDS-FROM-G** | Draw never exceeds available `G` outside defined failure |
| INV-08 | **I-SUPPLY** | No game path increases total supply |
| INV-09 | Pool independence | Changing only alpaca penalties does not change `Rc`/`Rh` split sizes |
| INV-10 | Claim conserves | Sum of all claims over life ≤ sum of all credits |
| INV-11 | Split ratio | Over many `Rd` values, `Ra:Rc:Rh` ≈ 8:1:1 modulo dust |
| INV-12 | Location weight fidelity | Replacing location L→L' changes shares exactly by weight table |

**Optional hardening (post-MVP, still no rule changes):**

- Stateless fuzz of `SettlementLib` with random participation sets (bounded N ≤ 20).
- Invariant: cougar hunt sum ≤ `Rh`; equality when all hunts succeed and no dust.

---

## 5. Coverage matrix (requirements checklist)

| Required theme | Primary test IDs |
|---|---|
| Commit / Reveal FSM | I-FSM-01…11, E-13, E-14 |
| Settlement | I-SET-01…05, U-ALP/U-COG/U-POOL, INV-01/04 |
| Alpaca abilities | U-TRAIT-*, I-ABL-*, E-06, E-07 |
| Cougar hunting | U-COG-*, I-HNT-*, E-03, E-04 |
| Location weights | U-LOC-*, INV-12 |
| Reward pools 80/10/10 | U-POOL-*, INV-09, INV-11 |
| Treasury interaction | U-TRE-*, I-TRE-*, INV-06/07 |
| Claim security | I-CLM-*, U-DIST-* |
| NFT ownership checks | I-NFT-01…06 |

---

## 6. Definition of done (implementation gate)

`contracts/game/` may be considered complete for review only when:

1. All **Unit** (§1), **Integration** (§2), **Edge** (§3), and **Invariant** (§4) IDs above are implemented or explicitly deferred with written rationale (deferrals need approval).  
2. Suite is green under `npx hardhat test` (game + existing Genesis).  
3. No test encodes a formula that contradicts GDS v1.1.  
4. No production path mints HANSOME or writes Genesis NFT gameplay identity.

---

## 7. Explicit non-goals

| Out of scope | Reason |
|---|---|
| New locations / seasons / guilds | GDS §20 — needs version bump |
| Changing \(m_F, p_L, p_R, \pi^0, 80/10/10\) | Locked |
| USD / price oracles in formulas | GDS non-goal |
| Mainnet VRF live tests | Use mocks; staging separately |
| Frontend / UI e2e | Separate plan |

---

## 8. Approval gate

Solidity under `contracts/game/` begins only after this test plan is approved.

Implementers should name tests after IDs where practical, e.g. `test_INV_01_dayConserve`, `test_E08_cougarHomeReveal`.

---

## Change Log

| Date | Notes |
|---|---|
| 2026-07-17 | Initial Game Test Plan v1.0 |

---

**End — approve before `contracts/game/` Solidity.**
