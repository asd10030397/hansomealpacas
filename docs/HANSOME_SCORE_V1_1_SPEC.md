# HANSOME Score v1.1 — Week 1.5 Hardening Specification

| Field | Value |
|-------|-------|
| **Status** | ACTIVE for Week 1.5+ engine |
| **Version** | `1.1.0-week1.5` |
| **Date** | 2026-07-27 |
| **Supersedes (scoring engine)** | [`HANSOME_SCORE_V1_SPEC.md`](HANSOME_SCORE_V1_SPEC.md) `1.0.0-week1` |
| **Week 1 historical result** | **FROZEN** — Score **92** under v1 rules; do not rewrite or retune that report |
| **Primary test token** | HANSOME `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| **Chain** | Robinhood Chain · chainId **4663** |
| **Related** | [`reports/HANSOME_SCORE_EXTERNAL_RECONCILIATION.md`](../reports/HANSOME_SCORE_EXTERNAL_RECONCILIATION.md) |

---

## 0. Purpose of v1.1

Close adversarial gaps found in Week 1 / external reconciliation **without** retuning Score to match GeckoTerminal (~34). Preserve philosophy:

| Concept | Affects Structural Score? |
|---------|---------------------------|
| **Structural Score** (product name for this v1.1 engine — structural risk & transparency) | — |
| Overall Token Score | **Separate** composite — see [`HANSOME_OVERALL_SCORE_SPEC.md`](HANSOME_OVERALL_SCORE_SPEC.md). Does **not** change these category weights. |
| Activity | **No** (may feed Overall only) |
| HANSOME Level | **No** — branded presentation of Activity only ([`HANSOME_LEVEL_PRESENTATION.md`](HANSOME_LEVEL_PRESENTATION.md)) |
| Data Confidence / Analysis Coverage | **No** for Structural (shown beside; see §9A; small Overall input) |
| Category / Trending / Explore / Meme Story | **No** |

**Explicitly out of Structural Score:** liquidity size/slippage, raw holder count, ordinary low volume, popularity, socials.

**Product language:** UI/API should present this engine as **Structural Score**. The broader user-facing number is **Overall Token Score** (`1.0.0-overall`).

---

## 1. Category weights (v1.1)

Base = **100**. Deductions capped per category:

| Category | Max deduction | Change vs v1 |
|----------|---------------|--------------|
| **Contract risk** | **25** | **NEW** |
| Liquidity ownership / withdrawal risk | **20** | was 25 |
| Holder concentration | **20** | was 25 |
| Wallet relationship risk | **15** | same budget; stronger signals |
| Launch fairness / deployer distribution | **10** | was 15 |
| Creator behaviour | **10** | was 20; missing data no longer awards full |
| **Total** | **100** | |

---

## 2. Missing data ≠ safe

| Gap | Score effect | Data Confidence (v1.2) |
|-----|--------------|------------------------|
| Creator behaviour not indexed | Provisional **−8** (`creator_behaviour_unindexed`); category incomplete | Creator dimension **Low** (~18); weighted into aggregate |
| Contract risk not analyzable (no ABI/source) | Provisional **−10** (`contract_risk_incomplete`) | Contract dimension capped low (~35) |
| Both creator + contract incomplete | Apply deductions above, then **score ceiling 85** | Both dimensions incomplete |
| LP lock / position discovery incomplete | Deduction under liquidity ownership (see §4); never map to unlocked | Liquidity dimension **must not** be near 100% |
| Thin holders / missing deployer / meta | May block some relationship signals | Holders / Wallet dimensions reduced |

UI must show incomplete-status flags. Never imply “safe” from silence.

---

## 3. Contract risk (max 25)

Prefer **verified source + ABI + RPC**. GoPlus / third-party labels are **supplement only**, never silent override of on-chain/source evidence.

| Condition | Deduction |
|-----------|-----------|
| Mintable / mint authority present | **18** |
| Honeypot / cannot sell (confirmed) | **25** (category cap) |
| Buy/sell/transfer tax ≥ 50% | **20** |
| Tax &gt; 0 and &lt; 50% | **10** |
| Modifiable tax / fee authority | **12** |
| Pause capability | **10** |
| Blacklist / whitelist transfer gate | **12** |
| Proxy + privileged upgrade path | **15** |
| Owner / admin privilege surface (Ownable etc.) | **8** |
| Analysis incomplete | Provisional **10** (see §2) |

Clean fixed-supply ERC-20 with no privileged functions → **0**.

---

## 4. Liquidity ownership + multi-version Uniswap lock intelligence

**Principle (non-negotiable): One locked position does not mean locked liquidity.**  
Pool ≠ position. **Version ≠ locker.** Token-level aggregate must never report “fully locked” from a single Titan/locker hit, a single pool, or a **single Uniswap version** when other material removable positions exist, when other versions were not searched, or when discovery is incomplete.

**Roadmap (honest):** Robinhood Chain has **active** Uniswap v2, v3, and v4 deployments (see `reports/ROBINHOOD_UNISWAP_AND_LOCKER_AUDIT.md`). Score adapters probe all three; **full lock decode is not claimed** for v2/v3 or for non-Titan lockers. Public wording remains planned / in development until regressions confirm coverage. Architecture: `docs/HANSOME_LIQUIDITY_MULTI_VERSION_ARCHITECTURE.md`.

### 4.1 Score mapping (token-level aggregate → ownership / withdrawal only)

| Aggregate state | Score lock mapping | Deduction | Notes |
|-----------------|--------------------|-----------|-------|
| `ALL_LOCKED` | `LOCKED_VERIFIED_ONCHAIN` | **0** | Every **material** detected position verified locked **and** discovery complete |
| `MIXED` | `MIXED` | **8** | Locked + removable coexist — partial withdrawal surface |
| `ALL_UNLOCKED` | `UNLOCKED_EOA_CONTROLLED` | **20** | All material positions EOA-removable / unlocked |
| `UNKNOWN_INCOMPLETE` | `UNABLE_TO_DETERMINE` | **12** | Cannot confidently enumerate — **never** treat as unlocked **or** fully locked |
| `NONE` | `NONE` | **8** | No pool / PoolManager bal ≈ 0 |
| (position) `LOCK_DETECTED_EXPIRY_UNKNOWN` | — | **5** | When aggregate reduces to this path |
| (position) `UNSUPPORTED_LOCKER` | — | **12** | When aggregate reduces to this path |

Do **not** award liquidity-ownership **0** merely because one Position NFT is locked.  
Exact lock-distribution % weights for Score are **not finalized** until enumeration + economically meaningful % methodology are reliable — prefer disclosure + Confidence + avoid false certainty.

Liquidity **size** → WARNING / Activity only.

### 4.2 Explicit states (UI — never collapse unknown→unlocked)

**Position-level**

| State code | Display label |
|------------|---------------|
| `LOCKED_VERIFIED_ONCHAIN` | LOCKED — VERIFIED ON-CHAIN |
| `UNLOCKED_EOA_CONTROLLED` | UNLOCKED / EOA-CONTROLLED |
| `LOCK_DETECTED_EXPIRY_UNKNOWN` | LOCK DETECTED — EXPIRY UNKNOWN |
| `UNSUPPORTED_LOCKER` | UNSUPPORTED LOCKER |
| `UNABLE_TO_DETERMINE` | UNABLE TO DETERMINE |

**Token-level aggregate**

| State code | Display label |
|------------|---------------|
| `ALL_LOCKED` | ALL LOCKED — VERIFIED ON-CHAIN |
| `MIXED` | ⚠️ MIXED — LOCKED + REMOVABLE |
| `ALL_UNLOCKED` | ALL UNLOCKED / EOA-CONTROLLED |
| `UNKNOWN_INCOMPLETE` | UNKNOWN / INCOMPLETE |
| `NONE` | NO POOL / NO LP DETECTED |

### 4.3 Version adapters + locker registry (required)

**Protocol version support** (can we read v2/v3/v4 structures?) is separate from **locker support** (can we decode this locker?).

| Version | Discovery | Lock / ownership decode |
|---------|-----------|-------------------------|
| v2 | Factory `getPair` probes (partial) | LP burn/locker path **not** reliable yet → incomplete when pairs found |
| v3 | Factory `getPool` probes (partial) | NPM position/locker enumeration **incomplete** when pools found |
| v4 | PoolManager balance + PositionManager path | Titan locker **reliable**; other lockers → `UNSUPPORTED_LOCKER` |

- Orchestrator: `detectMultiVersionLpIntelligence` under `lib/hansome-score/lp/multi.ts`.
- Locker registry: Titan first; future RH lockers plug in without rewriting the scanner.
- v4 detection path: **PositionManager `ownerOf` + registry/adapters** (+ Titan `getTokenLockData`) + hint-address NFT inventory + recent PositionManager transfers + optional seeds.
- **HANSOME Position NFTs (including #47299) use the same generic path** — no HANSOME-only scoring hardcode. Seeds/hints may aid discovery completeness only.
- Transparency metadata may **label / corroborate**, never silently grant token-level `ALL_LOCKED` without on-chain checks across material positions **and** searched Uniswap versions.
- If multi-version discovery/lock analysis is incomplete → display **INCOMPLETE COVERAGE** and reduce Data Confidence liquidity dimension.

### 4.4 Display fields (when retrievable)

Separate UI panes — **not** one vague “LP safe”:

1. **Liquidity size** — PoolManager token balance (v4) + version probe context; size warning if thin  
2. **Ownership / withdrawal risk** — Score category from **aggregate**  
3. **Token aggregate lock status** — ALL LOCKED / MIXED / ALL UNLOCKED / UNKNOWN + counts  
4. **Uniswap versions detected** + pools/pairs per version + positions where applicable  
5. **Per-position** — NFT id / synthetic slot id, poolId, pair/fee, owner, lock, unlock, L, range, removable-by-EOA, evidence  
6. **Lock distribution %** — only with economically meaningful denominator; if L not comparable across ranges → “Lock percentage unavailable” + reason  
7. **Completeness / INCOMPLETE COVERAGE warning** until multi-version discovery is solid  

Also show: pools detected **vs** positions detected (never conflate); protocol support vs locker support.

---

## 5. Holder concentration (max 20)

Exclude labeled burn + PoolManager (AMM inventory). Report **raw** Top-10 (incl. pool) and **adjusted** (excl. pool/system) with exclusion list.

| Condition | Deduction |
|-----------|-----------|
| Top-1 ≥ 50% | **20** |
| Top-1 ≥ 30% | **14** |
| Top-1 ≥ 20% | **10** |
| Top-1 ≥ 10% | **6** |
| Top-1 ≥ 5% | **3** |
| Top-10 ≥ 80% | **+8** |
| Top-10 ≥ 60% | **+6** |
| Top-10 ≥ 50% | **+4** |
| Top-10 ≥ 40% | **+2** |

(Top-10 ~59% must not be zero.)

---

## 6. Wallet relationship (max 15) — probabilistic only

| Signal | Deduction | Wording |
|--------|-----------|---------|
| ≥3 top holders identical balance | **6** | Possible related wallets (probabilistic) |
| Shared funding source among ≥2 top holders | **5** | Shared funding pattern (probabilistic) |
| Deployer-funded ≥2 top holders | **5** | Deployer-funded holders (probabilistic) |
| Same-block early buys ≥3 EOAs | **4** | Same-block early buy pattern (probabilistic) |
| Deployer inside equal-balance cluster | **4** | Deployer linked to cluster (probabilistic) |

Never claim common ownership without control proof.

---

## 7. Launch fairness (max 10)

| Condition | Deduction |
|-----------|-----------|
| Deployer ≥ 20% | **10** |
| Deployer ≥ 10% | **8** |
| Deployer ≥ 5% | **4** |
| Unverified contract | **+3** (cap category) |

---

## 8. Creator behaviour (max 10)

| Condition | Deduction |
|-----------|-----------|
| Large creator sell (&gt;5% supply) | **8–10** |
| Transfer-then-sell pattern | **6–8** |
| Index unavailable | Provisional **8** + incomplete flag (not full award) |

---

## 9. Confidence (historical v1.1 — superseded for engine)

Week 1.5 used flat penalties (`100 − gaps`, floor 5%). That model could still show ~90% when creator history was missing and LP discovery was only partially verified — **misleading**.

**Superseded by §9A (Data Confidence v1.2).** Historical Week 1.5 reports that cite Confidence 90 remain frozen as written.

---

## 9A. Data Confidence / Analysis Coverage (v1.2)

| Field | Value |
|-------|-------|
| **Engine version** | `1.2.0-data-confidence` |
| **Affects Score?** | **No** (shown beside Score / Activity) |
| **Meaning** | Completeness and verifiability of underlying analysis data |
| **Does not mean** | Token quality, safety, or probability that Score is correct |

### 9A.1 Dimensions + documented weights

Weighted average of dimension scores (0–100). Weights chosen for how badly missing coverage can hide structural risk — **not** tuned to any token’s headline %.

| Dimension | Weight | Completeness principle |
|-----------|--------|------------------------|
| **Liquidity / position discovery** | **25%** | Incomplete Uniswap v2/v3/v4 discovery or lock analysis → coverage **must not** be near 100%. One Titan lock or one Uniswap version ≠ complete LP coverage. See §4 (pool ≠ position; version ≠ locker; INCOMPLETE COVERAGE → low liquidity coverage). |
| **Creator behaviour** | **22%** | Unindexed creator history is a major blind spot — dimension scores **Low** (~18), not a cosmetic −10 on the aggregate. |
| **Contract analysis** | **22%** | Missing verified ABI/source → substantially low. No honeypot **sell/swap simulation** → material incomplete flag (unknown ≠ verified). |
| **Holder data** | **16%** | Needs holders count + adequate top-holder sample for concentration math. |
| **Wallet relationship** | **15%** | Production graphs are **sampled** (top non-excluded holders) — sampled ≠ full graph; soft-caps coverage. |

Bands: **High** ≥ 75 · **Medium** 45–74 · **Low** &lt; 45 (per dimension and aggregate).

### 9A.2 Critical rules

- Critical missing information must reduce Data Confidence **substantially** (weighted dimensions — not `100 − 10`).
- If material v4 positions cannot be confidently enumerated → **Liquidity** dimension capped well below ~100% (`discoveryComplete=false`, `UNKNOWN_INCOMPLETE`, empty positions with pool inventory).
- Partial detection (e.g. one locked NFT found) ≠ complete coverage.
- API exposes `confidence.dimensions[]` with `score`, `band`, `weight`, `evidence`, `notes`, `incomplete`.

### 9A.3 Cross-link — LP principle

From §4 / Week 2A LP MIXED work: **incomplete position discovery → low liquidity coverage** in Data Confidence, independent of Score ownership deductions.

---

## 10. Third-party rules (unchanged)

- Core Score = RPC + Blockscout + self-calculated (+ verified ABI/source).
- GeckoTerminal → Activity only (labeled).
- GoPlus → labeled supplement for contract flags; never silent override.
- No AI scoring. HANSOME holdings never boost Score.

---

## 11. Change control

- Week 1 result **92** under `1.0.0-week1` remains historical.
- Live package version may be `1.3.0-overall` (Overall composite added) while **Structural category caps remain exactly as §1**.
- Further **Structural** weight changes require a Week report note + version bump.
- Data Confidence weights are documented in §9A — do not retune to make any token look better/worse.
- Overall Token Score changes live in [`HANSOME_OVERALL_SCORE_SPEC.md`](HANSOME_OVERALL_SCORE_SPEC.md) — do not edit Structural caps to “fix” Overall optics.
- **Do not retune Structural or Overall to match external composites (GT ~34).**

---

## 12. Production caching (planned)

Serving cadence for Scan (TTL, KV snapshots, Activity overlay, rate-limited refresh) is **infrastructure**, not a Score-rule change. Planned design: [`reports/HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md`](../reports/HANSOME_SCAN_PRODUCTION_CACHE_ARCHITECTURE.md). Caching must not mix Activity freshness into Score, and must preserve Last updated / Data Confidence honesty.
