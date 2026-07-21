# HANSOME — Mainnet Launch Progress Tracker

| Field | Value |
|------|------|
| File | `docs/MAINNET_LAUNCH_PROGRESS_TRACKER.md` |
| Purpose | Track closure of all Mainnet launch blockers |
| Baseline | [`MAINNET_PRE_LAUNCH_ENV_AUDIT.md`](./MAINNET_PRE_LAUNCH_ENV_AUDIT.md) · [`MAINNET_BLOCKER_CLOSURE_PLAN.md`](./MAINNET_BLOCKER_CLOSURE_PLAN.md) |
| Mode | **Ops tracker only** — no deployment, no transactions, no secrets |
| Last board update | 2026-07-21 |

**Status values:** `OPEN` · `IN PROGRESS` · `READY` · `VERIFIED`

**Related:** [`MAINNET_OPERATIONS_CONFIG.md`](./MAINNET_OPERATIONS_CONFIG.md) · [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md)

**Hard rules:** Do not paste private keys or secret values. Prefer redacted address prefixes in notes.

---

## Tracker board

| ID | Blocker | Priority | Current status | Owner | Verification method | Completed date |
|----|---------|----------|----------------|-------|---------------------|----------------|
| **B1** | ETH gas funding — deployer ≥ **0.05 ETH** on chainId **4663** (audit ~0.004 ETH) | P0 | OPEN | Ops / Deployer | Explorer balance **or** dry-run `deployer_gas` pass | |
| **B2** | Treasury HANSOME funding — funder holds approved amount (recommended **300,000,000**; audit ~13.4M) for GameTreasury | P0 | OPEN | Treasury | Read-only `balanceOf(funder)` + game-launch dry-run `treasury_funding` pass | |
| **B3** | `VRF_OPERATOR` — real address (not `0x000…0001`); custody + runbook | P0 | OPEN | Ops | Genesis / deploy-plan dry-run `vrf_operator` pass; go-live sign-off | |
| **B4** | `RANDOMNESS_PROVIDER` — role confirmed (day-seed fulfiller); address + runbook | P0 | OPEN | Ops | Game-launch dry-run `randomness_provider` pass; ops config confirmed | |
| **B5** | `MAINNET_OWNER` — multisig / timelock set; signers + threshold documented | P0 | OPEN | Founder / Ops | Env set; dry-run `ownership_plan` pass; go-live security sign-off | |
| **B6** | `GAME_DAY_ZERO` — set to approved **`1784894400`** (2026-07-24 12:00 UTC); clear mismatch | P0 | OPEN | Product / Ops | Env equals approved unix; dry-run `day_zero` shows correct ISO | |
| **B7** | Vercel Production Mainnet cutover preparation — plan + post-deploy env (no Testnet / no `46630`) | P1 | OPEN | Ops / Vercel admin | Cutover checklist signed; after deploy, Production matches Mainnet JSON | |

### Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must close before any live Mainnet ceremony |
| **P1** | Must be prepared before ceremony; Production cutover only **after** live `robinhood-*.json` + verify |

### How to move status

| From → To | When |
|-----------|------|
| OPEN → IN PROGRESS | Owner actively funding / confirming / configuring |
| IN PROGRESS → READY | Required action done on ops side; awaiting verification pass |
| READY → VERIFIED | Verification method executed and recorded (date filled) |

---

## Snapshot notes (from audit 2026-07-20 — update when status changes)

| ID | Audit snapshot |
|----|----------------|
| B1 | Deployer ETH ~0.00398 |
| B2 | Funder HANSOME ~13.37M; `SKIP_TREASURY_FUND=1` |
| B3 | Placeholder `0x000…0001` |
| B4 | Address set (`0xcE15…069A`) but role not formally confirmed |
| B5 | Unset |
| B6 | Env `1800000000` ≠ approved `1784894400` |
| B7 | Dashboard not verified; cutover blocked until live deploy JSON |

---

## Launch readiness percentage

| Metric | Value |
|--------|--------|
| Tracked blockers | **7** (B1–B7) |
| Count **VERIFIED** | **0** |
| Count **READY** (not yet verified) | **0** |
| Count **IN PROGRESS** | **0** |
| Count **OPEN** | **7** |
| **Launch readiness** | **0 / 7 = 0%** |

### Formula

```text
Launch readiness % = (number of blockers with status VERIFIED) / 7 × 100
```

Optional stretch (not used for GO): treat READY as half-credit only in ops discussion — **GO requires VERIFIED on all P0 (B1–B6)** and B7 at least READY (cutover plan) before ceremony, with B7 VERIFIED before Production cutover.

### Readiness gates

| Gate | Rule |
|------|------|
| Ceremony dry-runs | B1–B6 = **VERIFIED** |
| Live deploy flags | Plus [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) = READY |
| Vercel Production cutover | B7 = **VERIFIED** after contracts exist |
| **Overall GO** | Readiness **100%** (7/7 VERIFIED) **or** explicit written waiver for B7 timing only |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | Initial tracker — all blockers OPEN; readiness 0% |
