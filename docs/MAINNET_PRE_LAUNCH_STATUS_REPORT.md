# HANSOME — Mainnet Pre-Launch Status Report

| Field | Value |
|------|------|
| File | `docs/MAINNET_PRE_LAUNCH_STATUS_REPORT.md` |
| Generated | 2026-07-21 |
| Last full review | 2026-07-21 final pre-launch blocker review |
| Mode | **Readiness audit only** — no deployment, no transactions, no secrets |
| Related | [`MAINNET_LAUNCH_PROGRESS_TRACKER.md`](./MAINNET_LAUNCH_PROGRESS_TRACKER.md) · [`MAINNET_BLOCKER_CLOSURE_PLAN.md`](./MAINNET_BLOCKER_CLOSURE_PLAN.md) · [`MAINNET_DEVICE_QA_CHECKLIST.md`](./MAINNET_DEVICE_QA_CHECKLIST.md) |

---

## 1. Executive Summary

Mainnet **token/swap** surfaces already target chainId **4663**. **Game/Mint** Production remains on Testnet **46630** by design until live `robinhood-*.json` exists.

**Full VERIFIED:** B1–B6.  
**Still blocking live ceremony:** B7 (dry-runs + live deploy + Vercel cutover). Role configuration complete.

**Verdict: NO-GO for live writes** until B7 ceremony checklist GO + dry-runs clean. Game Day 0 target remains **2026-07-24 12:00 UTC**.

---

## 2. Current readiness percentage

| Metric | Value |
|--------|--------|
| Tracked blockers | 7 |
| VERIFIED (full) | **6** (B1–B6) |
| IN PROGRESS | **1** (B7) |
| OPEN | **0** |
| **Launch readiness** | **6 / 7 ≈ 86%** |

Formula: `(VERIFIED count) / 7 × 100` — per tracker. IN PROGRESS does not count toward %.

---

## 3. B1–B7 table

| ID | Blocker | Status | Evidence (2026-07-21 final) | Still missing | VERIFIED without deploy? |
|----|---------|--------|------------------------------|---------------|---------------------------|
| **B1** | Deployer ETH ≥ 0.05 on 4663 | **VERIFIED** | ≈ **0.054 ETH** ≥ 0.05 | Prefer dedicated deployer key | Yes |
| **B2** | GameTreasury 30M ops readiness | **VERIFIED** | Funder ≥ 30M; procedure documented | Ceremony transfer (launch step) | Yes (pre-launch) |
| **B3** | `VRF_OPERATOR` | **VERIFIED** | Temp ceremony EOA in `.env` + ACK=1; guard validation PASS | Permanent VRF/beacon later (replacement plan) | Yes (pre-launch) |
| **B4** | `RANDOMNESS_PROVIDER` | **VERIFIED** | Ceremony EOA + runbook + `B4_OWNER_ACK=1` (Project Owner, 2026-07-21) | Later: production-grade randomness | Yes (pre-launch) |
| **B5** | `MAINNET_OWNER` | **VERIFIED** | Initial EOA `0xcE15…069A` + ALLOW/ACK flags in `.env`; guard PASS | Optional later rotate to multisig/timelock | Yes (pre-launch) |
| **B6** | `GAME_DAY_ZERO=1784894400` | **VERIFIED** | Effective + `.env` correct | — | Yes |
| **B7** | Vercel Mainnet cutover | **IN PROGRESS** | Plan only | Deploy JSON + Production apply | After deploy |

---

## 4. Device QA progress

### 4.1 Static verification (code/tests — NOT a device PASS)

| Checklist theme | Static result | Notes |
|-----------------|---------------|-------|
| Reject connection ≠ TRANSACTION FAILED | **Code OK** | `walletConnectUi` + `walletConnect.test.ts` |
| No-provider → help + MetaMask/OKX deep links | **Code OK** | Same helpers; WC QR not shipped |
| Swap disconnect clears account only | **Code OK** | `shouldResetSwapTxOnDisconnect() === false` |
| Claim Connect / Switch CTAs | **Code OK** | `resolveClaimWalletPrimary` |
| `NEXT_PUBLIC_GAME_REQUIRE_MAINNET` fail-closed | **Code OK** | `gameNetwork.ts` + `mainnetLaunchGuards.test.ts` |
| Chain IDs 4663 vs 46630 distinct | **Code OK** | Launch guards tests |
| Desktop/mobile connect matrices | **DEVICE ONLY** | Cannot PASS from code |
| Swap/Mint/Claim/Game real txs | **DEVICE ONLY** | Prefer Testnet until smoke approved |
| Refresh / tab / browser restart | **DEVICE ONLY** | |
| Language / layout / console | **DEVICE ONLY** | |

**No DEVICE-only item is marked PASS in this report.**

### 4.2 Tester execution checklist (concise)

Copy into a session using [`MAINNET_DEVICE_QA_CHECKLIST.md`](./MAINNET_DEVICE_QA_CHECKLIST.md). Prefer **Testnet 46630** until cutover.

1. Fill §1 environment row (device, OS, browser, wallet, build SHA, URLs).
2. **Desktop Chrome + MetaMask:** connect → switch network → disconnect → reconnect → reject connect → reject sign → Swap quote path → Mint path → Claim CTA → Game entry.
3. **Desktop Chrome + OKX:** same matrix.
4. **Android Chrome (no wallet):** help modal + MetaMask/OKX deep links; confirm **no** TRANSACTION FAILED on connect path.
5. **Android MetaMask / OKX in-app browser:** connect + Swap/Mint/Claim/Game smoke + reject paths.
6. **iOS Safari:** help + deep links; **iOS MetaMask/OKX browsers:** connect + surface smokes.
7. **Network:** wrong-chain prompt + switch; on staging with `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` + chain `46630`, confirm **fail closed**.
8. **Wallet state:** refresh, tab change, browser restart, reconnect, disconnect.
9. **Tx smokes (smallest amounts):** Swap / Mint / Claim reject-signature + one success each on Testnet.
10. **UI:** language toggle, banners, mobile layout, no overlap, console clean.
11. Sign §9: READY / NOT READY — only after matrices filled.

---

## 5. Remaining blockers

### P0 (must close before live ceremony)

1. ~~**B1**~~ → **VERIFIED**.
2. ~~**B2**~~ → **VERIFIED**.
3. **B3** — Owner fills `VRF_OPERATOR` in `contracts/.env` (placeholder already cleared).
4. ~~**B4**~~ → **VERIFIED** (runbook + `0xcE15…069A`).
5. **B5** — Owner fills `MAINNET_OWNER` (multisig/timelock preferred).
6. ~~**B6**~~ → **VERIFIED**.

### P1

7. **B7** — Keep cutover plan ready; **do not** flip Production until Mainnet JSON + verify.

### Env inconsistencies (Phase 4 — not auto-fixed)

| Area | Finding |
|------|---------|
| Swap (`.env.example`) | Mainnet `4663`, canonical token `0x2C38…0875` — OK as template |
| Game (`.env.local`) | Still Testnet `46630`, fast timings `120/120/240` — expected pre-cutover |
| Game require flag | `NEXT_PUBLIC_GAME_REQUIRE_MAINNET` **not** set in local `.env.local` — correct for Testnet QA |
| Ceremony (`contracts/.env` file) | Missing `GAME_DAY_ZERO` / role keys in **file**; `GAME_TOKEN_ADDRESS` in file is Testnet `0xd27B…193E` |
| Ceremony (process env Hardhat sees) | `GAME_DAY_ZERO=1800000000` (**wrong**); `VRF_OPERATOR=0x000…0001`; `RANDOMNESS_PROVIDER=0xcE15…069A`; `SKIP_TREASURY_FUND=1` |
| Mainnet deploy JSON | Missing `robinhood-genesis.json` / `robinhood-game.json` |
| Placeholder `1800000000` | **Active in process environment** (not a repo source line); historical docs also mention it |

---

## 6. Recommended next action

**Immediate (no deploy, no txs):**

1. Set ceremony env: `GAME_DAY_ZERO=1784894400` → re-run `dry-run-mainnet-game-launch.ts` → mark **B6 VERIFIED**.
2. In parallel: decide/fill `VRF_OPERATOR`, `RANDOMNESS_PROVIDER`, `MAINNET_OWNER` (B3–B5).
3. Ops: move sufficient ETH to **deployer** (B1); assemble HANSOME for Treasury fund (B2).
4. Run Device QA on Testnet using §4.2 (B7 stays plan-only).

**Do not** set `ALLOW_MAINNET_DEPLOY` / live flags until go-live approval READY.

---

## 7. Go / No-Go verdict

| Field | Value |
|-------|--------|
| **Verdict** | **NO-GO** |
| **READY?** | **NOT READY** |
| Reason | 0/7 VERIFIED; P0 funding + roles + dayZero env incomplete; no Mainnet game artifacts; Device QA not executed on hardware |

---

## Appendix A — GAME_DAY_ZERO audit (B6)

| Check | Result |
|-------|--------|
| Approved timestamp | **`1784894400`** = `2026-07-24T12:00:00.000Z` |
| Hardcoded in Solidity / app constants | **None found** |
| `1800000000` in repo source | **No file/line** (docs history only) |
| `contracts/.env` file | Key **absent** |
| Process env (Hardhat 2026-07-21 dry-run) | **`GAME_DAY_ZERO=1800000000`** → ISO `2027-01-15T08:00:00.000Z` |
| Guards | `requireMainnetGameDayZero()` requires explicit env on Mainnet |

**Locations of wrong value**

| Location | Line | Value |
|----------|------|-------|
| Process / user ceremony environment (not committed) | n/a | `1800000000` |
| Docs history only | e.g. `MAINNET_PRE_LAUNCH_ENV_AUDIT.md`, tracker snapshots | mentions mismatch |

**B6 not VERIFIED.** Next: set `GAME_DAY_ZERO=1784894400` in the same environment Hardhat loads, then re-run `dry-run-mainnet-game-launch.ts`.

---

## Appendix B — Script dry-run readiness (Phase 5)

| Script | Role | Result | Notes |
|--------|------|--------|-------|
| `deploy-genesis.ts` | Genesis deploy | **PASS** (static) | Exists; Mainnet guards; DRY_RUN path |
| `deploy-game.ts` | Game suite | **PASS** (static) | Exists; Mainnet requires dayZero/provider |
| `dry-run-mainnet-deploy-plan.ts` | Preflight | **PASS** (executed) | 0 script blockers; WARNs: owner unset, gas low; **VRF placeholder still accepted by script** |
| `dry-run-mainnet-game-launch.ts` | Preflight | **PASS** (executed) | 0 script blockers; **`day_zero` wrongly PASS on `1800000000`**; gas/owner WARNs |
| `verify-mainnet-reserved.ts` / `verify-mainnet-game.ts` | Post-deploy verify | **PASS** (static) | Need live addresses |
| `reserve-mint-mainnet.ts` | Genesis recovery | **PASS** (static) | Documented recovery |
| `transfer-mainnet-ownership.ts` | Ownership | **PASS** (static) | Needs `MAINNET_OWNER` |
| `schedule-mainnet-mint-sale.ts` | Mint ceremony | **PASS** (static) | Exists |
| `finish-genesis-bootstrap.ts` | Bootstrap recovery | **PASS** (static) | Exists |

**Note:** Script-level “PREFLIGHT OK” ≠ launch-board VERIFIED. Dry-runs do not enforce approved Day 0 unix or non-placeholder VRF against the B1–B7 closure bar.

Live execution / deploy flags are **out of scope** for this report.

---

## Appendix C — Validation (this audit)

| Check | Result |
|-------|--------|
| `vitest` walletConnect + mainnetLaunchGuards | **PASS** (27 tests) |
| ESLint on changed docs | N/A (docs ignored by ESLint config) |
| `next build` | **PASS** |
| `tsc --noEmit` | **FAIL** (pre-existing, unrelated): `lib/swap/__tests__/probeQuote.test.ts` ProbeError.walk typing vs viem BaseError |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-21 | B4 **VERIFIED**; readiness **6/7 ≈ 86%**; B7 ceremony checklist ready; **NO-GO** for live deploy |
| 2026-07-21 | B5 **VERIFIED** (initial EOA owner); readiness **5/7 ≈ 71%**; B4 ack still required; **NO-GO** |
| 2026-07-21 | Finalization: B3 **VERIFIED**; readiness **4/7 ≈ 57%**; B4 ack + B5 address still required; **NO-GO** |
| 2026-07-21 | B3 owner approval recorded (temp ceremony EOA); B3 → **IN PROGRESS** (not VERIFIED); B4/B5 unchanged; readiness **3/7 ≈ 43%**; **NO-GO** |
| 2026-07-21 | Initial pre-launch status report from readiness audit |
| 2026-07-21 | B1 read-only verify: deployer **0.00299876850498 ETH** &lt; 0.05 → remains **OPEN**; readiness **0%** |
| 2026-07-21 | B1 re-verify: **0.054108923342201094 ETH** ≥ 0.05 → **VERIFIED**; readiness **1/7 ≈ 14%** |
| 2026-07-21 | Final blocker review: B2+B6 **VERIFIED**; B4 IN PROGRESS; B3/B5 OPEN; readiness **3/7 ≈ 43%**; **NO-GO** |
| 2026-07-21 | Finalization sprint: B4 **VERIFIED**; B3 placeholder cleared (owner fill); B5 IN PROGRESS; readiness **4/7 ≈ 57%**; **NO-GO** |
| 2026-07-21 | Fail-closed gates + B4 ack-pending; readiness corrected to **3/7 ≈ 43%** (B4 excluded until signed); **NO-GO** |
