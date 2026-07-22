# HANSOME — Mainnet Launch Progress Tracker

| Field | Value |
|------|------|
| File | `docs/MAINNET_LAUNCH_PROGRESS_TRACKER.md` |
| Purpose | Track closure of all Mainnet launch blockers |
| Mode | **Ops tracker only** — no deployment, no transactions, no secrets |
| Last board update | 2026-07-21 (B7 game-launch dry-run zero blockers; live ceremony still NO-GO) |

**Status values:** `OPEN` · `IN PROGRESS` · `READY` · `VERIFIED` · `VERIFIED WITH OWNER ACKNOWLEDGMENT PENDING`

**Related:** [`MAINNET_OWNER_INPUT_FORM.md`](./MAINNET_OWNER_INPUT_FORM.md) · [`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md) · [`MAINNET_GO_LIVE_CHECKLIST.md`](./MAINNET_GO_LIVE_CHECKLIST.md)

---

## Tracker board

| ID | Blocker | Priority | Current status | Owner | Completed date |
|----|---------|----------|----------------|-------|----------------|
| **B1** | Deployer ETH ≥ 0.05 | P0 | VERIFIED | Ops | 2026-07-21 |
| **B2** | GameTreasury 30M plan + funder ready | P0 | VERIFIED | Treasury | 2026-07-21 |
| **B3** | `VRF_OPERATOR` owner-approved real address | P0 | VERIFIED | Owner / Ops | 2026-07-21 |
| **B4** | `RANDOMNESS_PROVIDER` + runbook + owner ack | P0 | VERIFIED | Ops / Owner | 2026-07-21 |
| **B5** | `MAINNET_OWNER` (initial launch owner) | P0 | VERIFIED | Founder / Owner | 2026-07-21 |
| **B6** | `GAME_DAY_ZERO=1784894400` | P0 | VERIFIED | Product / Ops | 2026-07-21 |
| **B7** | Vercel Production cutover / launch ceremony | P1 | IN PROGRESS | Ops | |

**B4:** Temporary ceremony EOA provider `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` acknowledged (`B4_OWNER_ACK=1`, Project Owner, 2026-07-21). Replacement: decentralized / production-grade randomness when available.

**B7:** Role blockers closed. Game-launch dry-run **zero blockers** (canonical `GAME_TOKEN_ADDRESS`, GDS timing, `SKIP_TREASURY_FUND=1`). Remaining: live ceremony + Vercel cutover + human GO — see [`MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md`](./MAINNET_B7_LAUNCH_CEREMONY_CHECKLIST.md). **Does not authorize deploy.**

---

## Launch readiness

| Metric | Value |
|--------|--------|
| Count **VERIFIED** (full) | **6** (B1–B6) |
| Count **IN PROGRESS** | **1** (B7) |
| Count **OPEN** | **0** |
| **Launch readiness** | **6 / 7 ≈ 86%** (full VERIFIED only) |

**Verdict: NO-GO for live writes** until B7 ceremony dry-runs pass, go-live flags are set, and human GO sign-off is recorded. Role blockers B1–B6 are closed.

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | B7 preflight: canonical token + timing cleanup; game-launch dry-run **0 blockers**; live still **NO-GO** |
| 2026-07-21 | B4 **VERIFIED**; readiness **6/7 ≈ 86%**; B7 ceremony checklist prepared; **NO-GO** for live deploy |
| 2026-07-21 | B5 **VERIFIED** (initial EOA owner + ACK flags); readiness **5/7 ≈ 71%**; B4 still ack-pending; **NO-GO** |
| 2026-07-21 | B3 **VERIFIED** (env insert + guard validation); readiness **4/7 ≈ 57%**; B4/B5 still blocking; **NO-GO** |
| 2026-07-21 | B3 owner approval recorded (temp ceremony EOA); status **IN PROGRESS** (not VERIFIED); readiness **3/7 ≈ 43%**; **NO-GO** |
| 2026-07-21 | Fail-closed VRF/OWNER guards; LIVE_MAINNET_SEND; B4 ack-pending; readiness **3/7 ≈ 43%**; **NO-GO** |
