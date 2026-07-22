# HANSOME — Initial Treasury Strategy (Launch Funding)

| Field | Value |
|------|------|
| File | `docs/INITIAL_TREASURY_STRATEGY.md` |
| Purpose | Distinguish **protocol design constants** from **approved launch funding** |
| Mode | Documentation only — no Solidity changes |
| Related | [`HANSOME_GDS_v1.1_en.md`](./HANSOME_GDS_v1.1_en.md) §15 · [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) · Economic model EN/ZH |

---

## Protocol design vs launch operations

| Layer | What it is | Amount / rule |
|-------|------------|---------------|
| **Protocol design** | On-chain constants in `GameTypes` / `EmissionController` / GDS §15 | \(G_0 = 300{,}000{,}000\), bands, \(G_{\mathrm{safe}} = 15{,}000{,}000\), \(R_0 = 400{,}000\)/day |
| **Launch operations** | Human ceremony / custody decisions | Fund GameTreasury with **30,000,000** HANSOME at Mainnet launch |

**Do not confuse:** \(G_0\) is a **band reference scale**. It is **not** a requirement to transfer 300M at launch.

---

## Protocol design (unchanged)

On-chain constants in `GameTypes` / `EmissionController` remain:

| Symbol | Value | Role |
|--------|------:|------|
| \(G_0\) | **300,000,000** HANSOME | Band **reference scale** (not “must fund at launch”) |
| \(R_0\) | **400,000** HANSOME/day | Top-band daily pool when \(G \ge 0.70\,G_0\) |
| \(G_{\mathrm{safe}}\) | **15,000,000** HANSOME | Below this: \(R_d = 0\), Commit paused |

| Spendable \(G\) | Daily pool \(R_d\) |
|-----------------|-------------------:|
| \(G \ge 210{,}000{,}000\) | 400,000 |
| \(G \ge 120{,}000{,}000\) | 280,000 |
| \(G \ge 60{,}000{,}000\) | 160,000 |
| \(15{,}000{,}000 \le G < 60{,}000{,}000\) | 80,000 |
| \(G < 15{,}000{,}000\) | 0 (SafeMode) |

These are **protocol design**. They are not modified for launch.

---

## Initial Treasury Funding Source

| Item | Value |
|------|------|
| **Amount** | **30,000,000** HANSOME |
| **Source wallet** | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| **Destination** | **GameTreasury** contract (after deploy) |
| **When** | Mainnet launch ceremony |
| **Nature** | **One-time** initial funding transaction (operational) |
| **On-chain hardcode** | **No** — wallet is **not** hardcoded in Solidity |

**Statement (ops):**

- **30,000,000 HANSOME** will be transferred from  
  `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`  
  to the **GameTreasury** during the Mainnet launch ceremony.
- This is an **operational launch funding** transaction.
- The wallet is an **operational funding source only** and is **not** hardcoded in Solidity or `EmissionController`.
- GameTreasury accepts ERC-20 transfers from any holder; identity of the funder is a custody/policy matter.
- **Future top-ups** may originate from the same Treasury wallet or other **approved project treasury wallets**, following the project's treasury management policy.

**Ceremony paths (either):**

1. Prefer `SKIP_TREASURY_FUND=1` on deploy if deployer ≠ funder, then ERC-20 `transfer` **30,000,000** from `0xcE15…069A` → GameTreasury before commits; or  
2. If the deployer key *is* the funder, use the deploy fund step with amount **30000000** (see env naming below).

Do **not** fund RewardDistributor — claims pull from GameTreasury only.

---

## Current launch funding (operational decision)

| Item | Value |
|------|------|
| **Launch amount** | **30,000,000** HANSOME |
| **Initial reward band** | **80,000** HANSOME/day |
| **Funding source** | See [Initial Treasury Funding Source](#initial-treasury-funding-source) |

At \(G = 30M\), emission sits in the **lowest fixed band**: \(R_d = 80{,}000\) / day.

---

## Env naming (HANSOME amount — not ETH)

The deploy / dry-run scripts historically used a misnamed variable:

| Documented name (preferred) | Meaning | Notes |
|-----------------------------|---------|-------|
| **`GAME_TREASURY_FUND_HANSOME`** | Whole `$HANSOME` units to send to GameTreasury | **Canonical name in docs / ops examples** |
| `GAME_TREASURY_FUND_ETH` | *Legacy alias still read by TypeScript deploy scripts* | **Misnomer** — value is **HANSOME**, not ETH |

**Approved launch value:** `30000000` (= 30,000,000 HANSOME).

**Until scripts are renamed (deferred — no code change in this audit):** operators must still set:

```text
GAME_TREASURY_FUND_ETH=30000000
```

…or use `SKIP_TREASURY_FUND=1` and transfer from the funding-source wallet manually. Treat `GAME_TREASURY_FUND_ETH` as “whole HANSOME fund amount” whenever reading older script help text.

---

## Initial Treasury Strategy

1. Launch begins with **30,000,000** HANSOME in GameTreasury — an **intentional operational decision**, not a change to \(G_0\).
2. At that balance, emission sits in the **lowest fixed band**: \(R_d = 80{,}000\) / day (`G_SAFE ≤ G < 0.20·G0`).
3. Treasury **may be increased later** by transferring more `$HANSOME` into GameTreasury.
4. As spendable Treasury crosses protocol thresholds **60M / 120M / 210M**, daily emission **automatically** steps up to **160k / 280k / 400k**.
5. **No contract upgrade** is required.
6. All increases occur through **additional treasury funding** (or sink inflows over time).

---

## Treasury Operations (guidelines — not on-chain rules)

These are **ops watchpoints** for humans. They are **not** encoded as smart-contract thresholds (except \(G_{\mathrm{safe}} = 15M\), which *is* on-chain).

| Spendable \(G\) (approx.) | Suggested ops action |
|---------------------------|----------------------|
| **30M** | Launch funding level — monitor claims vs inflows |
| **20M** | Review treasury status; plan top-up if runway concern |
| **17M** | Prepare additional funding (custody + transfer ready) |
| **15M** | **SafeMode threshold** (on-chain) — Commit pauses if \(G < 15M\) |

**Policy notes**

- Prefer topping up **before** approaching 15M so players are not blocked from Commit.
- Top-ups are normal ERC-20 transfers into GameTreasury; EmissionController reads `spendable()` automatically.
- Prefer sourcing top-ups from `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` or other approved project treasury wallets (ops policy).
- Do **not** fund RewardDistributor — claims pull from GameTreasury only.

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | Initial strategy (30M launch / 80k band) |
| 2026-07-21 | Funding source wallet: `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (ops only) |
| 2026-07-21 | Dedicated **Initial Treasury Funding Source** section; docs rename `GAME_TREASURY_FUND_HANSOME` (scripts still read legacy `GAME_TREASURY_FUND_ETH`) |
