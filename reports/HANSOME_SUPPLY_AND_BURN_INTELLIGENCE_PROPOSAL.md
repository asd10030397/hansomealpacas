# HANSOME Scan — Supply & Burn Intelligence (Design Proposal)

| Field | Value |
|-------|-------|
| **Status** | **Design only** — no detection, UI, or scoring implementation in this change |
| **Date** | 2026-07-27 |
| **Scope** | HANSOME Scan (`lib/hansome-score/*`, Scan UI) on Robinhood Chain |
| **Architecture baseline** | Current **Robinhood RPC + Blockscout** path used by `scanToken` |
| **Related** | Liquidity Intelligence (`docs/HANSOME_LIQUIDITY_MULTI_VERSION_ARCHITECTURE.md`), Contract Risk (`contract-risk.ts`), Creator Behaviour (transfer pagination), Data Confidence (`confidence.ts`) |
| **Non-goals** | Do not implement burn detection, UI fields, or Score formula changes here. Do not start /explore, Just Launched, or Week 2B work. |

---

## 1. Goals

Add a **Supply & Burn Intelligence** pane (and supporting analysis model) that:

1. Detects burn-related facts as **separate capabilities** (not one vague “burned” flag).
2. Clearly distinguishes **tokens sent to known dead/burn addresses** from **`totalSupply` permanently reduced**.
3. Surfaces mechanism + privilege surfaces so users do not confuse voluntary burns with admin confiscation risk.
4. Follows Scan’s existing honesty rules: **Unknown ≠ safe**, incomplete indexes must not invent certainty, GoPlus remains **labeled supplement only**.

### Non-goals (product)

- Do **not** treat ordinary voluntary burns as a positive quality / safety signal.
- Do **not** infer burn merely because balances look “stuck,” wallets are unlabeled contracts, or holders are inactive.
- Do **not** let burn % inflate Structural Score or Overall Token Score.

---

## 2. Definitions

| Term | Meaning | Supply effect |
|------|---------|---------------|
| **Dead / burn address send** | ERC-20 tokens transferred to a **recognized** burn/dead address (allowlist). Tokens still count in `totalSupply` unless the contract separately burns. | Usually **no** `totalSupply` change |
| **Supply-reducing burn** | Contract path that destroys balance **and** decreases `totalSupply` (e.g. OZ `_burn`, custom `burn` that updates supply). | **Yes** — `totalSupply` falls |
| **Known Burned Supply (dead)** | Sum of `balanceOf` (or verified inbound transfers) to recognized burn addresses. | Inventory “out of circulation” but still in supply unless also supply-reduced |
| **Supply Reduced (verified)** | Verifiable cumulative decrease in `totalSupply` vs a trusted baseline (or sum of verified burn events that update supply). | True permanent reduction |
| **Effective / remaining supply** | Only when reliably derivable — e.g. `totalSupply − knownDeadBalances` **or** current `totalSupply` after verified supply burns — never a guess from “inaccessible” wallets | Display-only; method must be stated |
| **Holder-accessible `burn()`** | Public/external burn callable by ordinary holders (typically burns caller’s own balance). | Usually supply-reducing |
| **`burnFrom()`** | Allowance-based burn of another address’s tokens (holder-granted or privileged depending on modifiers). | Usually supply-reducing |
| **Automatic / transfer-tax burn** | On transfer/buy/sell, a fee portion is burned (to dead or via `_burn`) without a separate user burn call. | Dead and/or supply-reducing |
| **Privileged / admin burn** | Owner/role can burn or confiscate tokens from **arbitrary holders** (or force-burn without holder consent). | Contract Risk surface |

### UI principle (hard)

> **“Sent to dead address” ≠ “totalSupply permanently reduced.”**  
> Always show these as separate facts. Never collapse them into a single “Burned” percentage without labeling the mechanism.

---

## 3. Current baseline (what already exists)

| Existing piece | Location | What it does today | Gap vs this proposal |
|----------------|----------|--------------------|----------------------|
| `BURN_ADDRESSES` | `lib/hansome-score/constants.ts` | `0x0…0`, `0x0…dead` only | No balance aggregation; no history; no extra dead aliases |
| Holder label `"Burn address"` | `labels.ts` + Scan UI | Labels if burn addr appears in **holders sample** | First holders page only; not a dedicated Supply pane |
| Concentration exclusion | `shouldExcludeFromConcentration` | Excludes burn + PoolManager from top-% math | Correct for concentration; **not** a burn intelligence product |
| `totalSupply` | RPC `tokenMetaAbi` (+ Blockscout fallback) | Current supply snapshot | No historical reduction tracking |
| Contract Risk | `contract-risk.ts` / `score.ts` | mint, pause, blacklist, tax authority, proxy, Ownable | **No** `burn` / `burnFrom` / privileged burn detection |
| Transfer index | `fetchTokenTransfersPaged` (default **max 40 pages**) | Creator Behaviour sell/transfer-then-sell | Same completeness limits would affect burned-over-time |
| GoPlus | `goplus.ts` (supplement) | e.g. `owner_change_balance`, taxes, mintable | No dedicated burn fields used; must not override on-chain |

**Today:** Scan can show Total Supply and may label a burn address in Top holders. It does **not** compute Known Burned Supply, Burned %, burn mechanism, automatic/privileged burn flags, or time-windowed burns.

---

## 4. Detection matrix (capability × reliability **now**)

Classifications assume **current** Robinhood RPC + Blockscout architecture (no new indexers, no archive node productization, no sell/burn simulation service).

| # | Capability | Reliability **now** | How / why |
|---|------------|----------------------|-----------|
| 1 | Tokens held at recognized burn/dead addresses (spot) | **Reliably detectable now** | RPC `balanceOf(0x0)` + `balanceOf(0xdead)` (and any future allowlisted dead addrs). Independent of holders pagination. |
| 1b | Cumulative / windowed sends **to** dead addresses | **Reliably detectable now** *only when* Blockscout token-transfer pagination is **complete** for that token; else partial + Unknown windows | Reuse / extend `fetchTokenTransfersPaged` rows with `to ∈ BURN_ADDRESSES`. Same cap as Creator Behaviour (default 40 pages). |
| 2 | Actual `totalSupply` **reduction** (historical / cumulative) | **Would remain Unknown** without extra evidence | Spot `totalSupply` is reliable; proving *how much* supply was destroyed needs Burn/`Transfer` log completeness or a trusted initial-supply baseline. RH Blockscout transfer API alone does not prove which transfers reduced supply vs mere dead sends. |
| 2b | Current `totalSupply` value | **Reliably detectable now** | Already in `readTokenViaRpc` / Blockscout token meta. |
| 3 | Holder-accessible `burn()` | **Requires source/ABI analysis** | Verified ABI/source: external/public `burn` / `burnToken` / similar **without** `onlyOwner`/`onlyRole` (or equivalent). Not implemented today. |
| 4 | `burnFrom()` present | **Requires source/ABI analysis** | ABI function `burnFrom` (and whether it is allowance-only vs admin-gated). |
| 5 | Automatic / transfer-tax burn | **Requires source/ABI analysis** | Source patterns in `_update`/`_transfer`/fee routers that route fee to dead or `_burn`. Tax *rate* often still **Unknown** without simulation (today tax bps are only set for “clean ERC20” zeros or left null). |
| 6 | Privileged / admin burn (arbitrary holders) | **Requires source/ABI analysis** | `onlyOwner`/`onlyRole` burn, force-burn, `burnFrom` without standard allowance semantics, or `owner_change_balance`-class surfaces confirmed in ABI/source. GoPlus `owner_change_balance` may **label conflict/info only** — never sole Score evidence. |

### Summary table (for handoff)

| Capability | Now |
|------------|-----|
| Dead-address balances (spot) | **Reliable (RPC)** |
| Dead-address burned 24H / 7D / all-time | **Reliable iff transfer pagination complete**; else Unknown / lower-bound only |
| Current Total Supply | **Reliable (RPC)** |
| Verified cumulative supply reduction | **Unknown** (needs events/baseline beyond current stack) |
| `burn()` / `burnFrom()` / auto-burn / privileged burn | **ABI/source required**; unverified → Unknown |
| Infer burn from “inaccessible” wallets | **Forbidden** → remains Unknown |

---

## 5. Data sources

| Source | Use for Supply & Burn | Authority |
|--------|----------------------|-----------|
| **Robinhood RPC** | `totalSupply`, `balanceOf(dead)`, decimals | Primary for spot supply + known-dead inventory |
| **Blockscout token meta / holders** | Corroborate supply; optional holder labels | Secondary; holders endpoint is **first page** today |
| **Blockscout token transfers (paged)** | Dead-address inflow windows; optional method hints | Completeness-gated (same as Creator Behaviour) |
| **Blockscout verified ABI + primary source** | Mechanism flags: `burn`, `burnFrom`, auto-burn, privileged burn | Required for mechanism / privilege; incomplete → Unknown |
| **GoPlus** | Labeled supplement only (e.g. conflict notes) | Never silent override of ABI/source/RPC |

### Completeness limits (already affect Creator Behaviour / Data Confidence)

These **also** bound Supply & Burn Intelligence:

| Limit | Effect |
|-------|--------|
| Transfer pagination `maxPages` (default **40**) | High-activity tokens → incomplete index → no trustworthy all-time / 24H / 7D burned totals |
| Fetch failures | Partial rows; mark windows Unknown; do not invent zeros-as-safe |
| Holders API first page only | Burn addr may be absent from Top holders UI even if `balanceOf` > 0 — prefer RPC for Known Burned |
| Unverified / missing ABI | Mechanism + privileged burn = Unknown; Contract Risk already provisional |
| Multi-token / fee-receiver contracts | Transfers to non-allowlisted “burner” contracts ≠ known burn |
| Dead send vs `_burn` indistinguishability in raw transfers | A transfer `to=0x0` may be mint/burn accounting depending on token; do not treat every `to=0x0` transfer as supply reduction without ABI semantics |
| No archive snapshot service | Cannot reconstruct past `totalSupply` series from RPC alone |
| LP “burned to dead” (v2) | Separate Liquidity Intelligence path — **out of scope** for token Supply & Burn (see LP audit: classic LP-burn heuristics not reliable yet) |

---

## 6. Proposed analysis model (types — design only)

Conceptual fields (not implemented):

```ts
type BurnAddressBalance = {
  address: string;
  label: "burn_dead"; // allowlisted only
  balanceRaw: string;
  balanceFormatted: string | null;
  percentOfTotalSupply: number | null; // vs current totalSupply
};

type SupplyBurnWindow = {
  window: "24h" | "7d" | "all";
  burnedToDeadRaw: string | null;      // null = Unknown
  supplyReducedRaw: string | null;     // null = Unknown (expected often)
  completeness: "complete" | "partial_lower_bound" | "unknown";
  note: string;
};

type BurnMechanism =
  | "none_detected"
  | "dead_address_only"
  | "supply_reducing_burn"
  | "holder_burn"
  | "burn_from"
  | "automatic_transfer_burn"
  | "privileged_burn"
  | "mixed"
  | "unknown";

type SupplyBurnIntelligence = {
  totalSupplyRaw: string | null;
  totalSupplyFormatted: string | null;
  knownBurnedSupplyRaw: string | null;       // sum of allowlisted dead balances
  knownBurnedSupplyFormatted: string | null;
  burnedPctOfTotalSupply: number | null;     // known dead / totalSupply
  effectiveRemainingSupplyRaw: string | null;
  effectiveRemainingMethod:
    | "total_minus_known_dead"
    | "current_total_supply_only"
    | "unavailable";
  burnMechanism: BurnMechanism;
  automaticBurn: "yes" | "no" | "unknown";
  privilegedBurn: "yes" | "no" | "unknown";
  holderBurnCallable: "yes" | "no" | "unknown";
  burnFromPresent: "yes" | "no" | "unknown";
  supplyReductionVerified: "yes" | "no" | "unknown";
  windows: SupplyBurnWindow[];
  findings: Array<{ code: string; severity: string; message: string; source: string }>;
  dataCompletenessNotes: string[];
};
```

### Inference rules (must ship with any future implementation)

1. **Allowlist only** for dead addresses — start with existing `BURN_ADDRESSES`; expand only via explicit curated list (e.g. common `0x…dead` variants), never heuristic “looks burned.”
2. **Known Burned Supply** = Σ RPC balances of allowlisted addresses (not “all zero-activity contracts”).
3. **Burned %** = Known Burned Supply / current Total Supply when both known; else Unknown.
4. **Effective remaining** = `totalSupply − knownBurned` **only** when presenting dead-inventory view; label clearly that this is **not** the same as supply-reduced circulating math used by every market API.
5. **Supply reduction verified = yes** only with event/baseline proof — not because dead balance is large.
6. **Automatic burn / privileged burn** = yes/no only from verified ABI/source (or future simulation); else Unknown.
7. GoPlus may add `info` findings on conflict; never set `privilegedBurn=yes` from GoPlus alone.

---

## 7. Proposed UI fields

Place under Scan overview (near Total Supply / concentration), as a dedicated **Supply & Burn** block — not folded into Contract Risk status alone.

| Field | Display | Notes |
|-------|---------|-------|
| **Total Supply** | Formatted + raw tooltip | Existing |
| **Known Burned Supply** | Formatted amount at allowlisted dead addresses | Explicit subtitle: “Held at known burn/dead addresses” |
| **Burned %** | % of current Total Supply | Based on Known Burned only unless supply-reduction verified |
| **Effective / remaining supply** | Shown only when method is reliable | Footnote method: e.g. “Total − known dead balances” |
| **Burn mechanism** | Enum / short chips | e.g. Dead-address sends · Supply-reducing · Automatic · Privileged · Unknown |
| **Automatic burn** | Yes / No / Unknown | |
| **Privileged burn** | Yes / No / Unknown | Link/tooltip → Contract Risk if Yes |
| **Holder `burn()`** | Yes / No / Unknown | Optional secondary row |
| **`burnFrom()`** | Yes / No / Unknown | Optional secondary row |
| **Supply permanently reduced?** | Yes / No / Unknown | Separate from Known Burned |
| **Burned 24H / 7D / All-time** | Show only if transfer completeness allows | Else “Unknown — transfer index incomplete” (same honesty as Creator Behaviour) |

### Copy / UX requirements

- Side-by-side or stacked contrast:
  - **Dead-address inventory** vs **Supply reduced on-chain**
- If Known Burned > 0 but supply reduction Unknown/No → helper text:  
  “These tokens were sent to a dead address; `totalSupply` may be unchanged.”
- If privileged burn = Yes → warning styling aligned with Contract Risk (not a green “deflationary” badge).
- Never show a green “Bullish burn” / score boost affordance.

---

## 8. Scoring policy (critical — explicit)

| Rule | Policy |
|------|--------|
| Ordinary voluntary burn (holder `burn`, dead sends, community burns) | **Must NOT increase** Structural Score or Overall Token Score |
| High Burned % / deflation narrative | **Display-only** — no positive deduction reversal, no Overall bonus |
| Concentration exclusion of burn addresses | **Keep** (already correct) — this avoids punishing “fake whales,” not a reward for burning |
| Privileged ability to burn / confiscate from arbitrary holders | Evaluate under **Contract Risk** (deduction / risk flag), similar severity band to blacklist / owner privilege — exact points TBD in a future Score change request |
| Automatic tax burn | Treat as **tax / fee mechanism** disclosure; if modifiable or confiscatory, Contract Risk — **not** a Structural reward |
| Missing burn data | Unknown → no credit; may slightly lower Data Confidence **coverage** if we add a burn dimension later — still **not** a quality penalty framed as “didn’t burn” |

### Overall Score

Burn popularity / burned % must **not** become an Overall component. Overall already separates structure, depth, adoption, activity, maturity, confidence — burn vanity metrics stay out.

### Data Confidence (future, optional)

If implemented later, a small **supply/burn coverage** note may reflect: dead balances read? ABI mechanism analyzed? transfer windows complete?  
That measures **analysis coverage**, not “good token burned a lot.”

---

## 9. Unknown policy

| Situation | UI / model |
|-----------|------------|
| Unverified contract | Automatic burn / privileged burn / burn() / burnFrom → **Unknown**; spot dead balances + totalSupply still OK if RPC works |
| Transfer pagination incomplete | 24H / 7D / All-time → **Unknown** or explicitly **partial lower bound** (never present as all-time fact) |
| Transfer to unlabeled contract with no outbound | **Not** burned — do not count |
| `totalSupply` unchanged + large dead balance | Known Burned yes; Supply reduced **No/Unknown** (usually No if we can only see spot supply and no burn events) |
| ABI has `burn` but modifiers unclear | Prefer **Unknown** or conservative privileged=Unknown until modifier parse is solid |
| GoPlus says dangerous, ABI clean | Info conflict only |
| GoPlus silent, ABI shows `onlyOwner burn(address,uint256)` | Privileged burn **Yes** from ABI/source |

---

## 10. Phased implementation order (when coding is requested)

Do **not** start these phases until explicitly asked. Suggested order minimizes false certainty:

| Phase | Work | Unlocks |
|-------|------|---------|
| **P0** | RPC `balanceOf` for allowlisted dead addresses; Known Burned Supply + Burned % + copy distinguishing dead vs supply-reduced; wire Total Supply (existing) | Reliable spot inventory UI |
| **P1** | ABI/source detectors: `burn`, `burnFrom`, privileged burn, automatic transfer burn → Yes/No/Unknown; feed privileged burn into Contract Risk design (scoring numbers gated) | Mechanism + risk surface |
| **P2** | From transfer index (when `paginationComplete`): Burned 24H / 7D / All-time **to dead addresses**; incomplete → Unknown | Time windows |
| **P3** | Supply-reduction verification (Burn events / semantic `Transfer` to 0x0 with supply accounting) — only if RH logs/API make this trustworthy | “Permanently reduced” Yes |
| **P4** | Data Confidence coverage hooks + i18n polish; still **no** Score reward for voluntary burn | Honesty / coverage |

**Week 2B / Explore / Just Launched:** out of scope; this module must not block those tracks.

---

## 11. Open questions

1. **Dead-address allowlist expansion** — Keep only `0x0` + `0xdead`, or add common aliases (`0x…dEaD`, null address variants)? Who owns curation?
2. **Effective supply definition** — Market APIs often use circulating ≠ `totalSupply − dead`. Do we show both “Scan effective (minus known dead)” and avoid claiming CoinGecko circulating parity?
3. **Privileged burn deduction weight** — Align with blacklist (12) vs owner (8) vs mint (18)? Needs a dedicated Score change approval (Structural caps frozen unless explicitly reopened).
4. **`burnFrom` with standard ERC20 allowance** — Is holder-granted `burnFrom` “privileged=no” always, or Unknown until we prove no admin bypass?
5. **Transfer `to=0x0` semantics** — Some tokens use `Transfer(user, 0, amount)` for burns that reduce supply; others for dead sends. How strict is event+ABI coupling before P3?
6. **Multi-dead aggregation vs Top holders** — Should Known Burned always prefer RPC over summing holder rows?
7. **Reflect / rebase tokens** — Supply math may break burned %; default to Unknown for non-standard ERC20?
8. **Caching** — Spot dead balances are cheap; transfer windows share Creator Behaviour cost — align with production cache architecture TTL for creator transfers?

---

## 12. Acceptance criteria (for a future implementation PR)

- [ ] Six capabilities detected/reported separately (dead send, supply reduction, `burn()`, `burnFrom()`, auto burn, privileged burn).
- [ ] UI copy distinguishes dead-address inventory vs permanent `totalSupply` reduction.
- [ ] Proposed fields present with Yes/No/Unknown where required.
- [ ] 24H/7D/All-time only when transfer completeness allows.
- [ ] Unit tests: voluntary burn does **not** raise Structural/Overall; privileged burn maps to Contract Risk path; no inference from unlabeled inaccessible wallets.
- [ ] GoPlus remains labeled supplement only.
- [ ] Data Confidence / Creator pagination limits documented in UI notes when windows are Unknown.

---

## 13. Explicit non-implementation statement

This document is a **design proposal only**. It does **not** change:

- `lib/hansome-score/*` runtime behavior  
- Scan UI components  
- Structural / Overall / Data Confidence formulas  
- `BURN_ADDRESSES` set (beyond describing current use)  

No code was implemented for Supply & Burn Intelligence in the change that introduced this report.
