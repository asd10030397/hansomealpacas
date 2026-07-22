# HANSOME — Mainnet Device QA Checklist

| Field | Value |
|-------|-------|
| Purpose | Final **real-device** QA before Robinhood Chain Mainnet launch |
| Chain (Mainnet) | **Robinhood Chain Mainnet** · chainId **`4663`** |
| Chain (pre-cutover Testnet QA) | Robinhood Chain Testnet · chainId **`46630`** |
| Status | Device ceremony document — **do not deploy** from this checklist |
| Related | [`WALLET_MOBILE_CONNECT.md`](./WALLET_MOBILE_CONNECT.md) · [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md) · [`MAINNET_FINAL_LAUNCH_CHECKLIST.md`](./MAINNET_FINAL_LAUNCH_CHECKLIST.md) · [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) |

**Hard rules**

- No secrets, private keys, seed phrases, or funded wallet dumps in this file or in notes pasted into tickets.
- Prefer **Testnet (`46630`)** for full connect / mint / claim / game loops until cutover; use Mainnet (`4663`) only for final smoke when explicitly approved.
- Connection failures must show **wallet connection** UI — never Swap **TRANSACTION FAILED**.
- WalletConnect QR is **not** shipped; mobile no-provider path = help modal + MetaMask / OKX deep links only.
- At Mainnet cutover, Production must set `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` so Game / Mint cannot run on `46630`.

---

# 1. Test Environment

Record one row per device session (or duplicate this section per device).

| Field | Value |
|-------|-------|
| Date | |
| Tester | |
| Device | |
| OS version | |
| Browser | |
| Wallet | |
| Network | Robinhood Mainnet `4663` / Robinhood Testnet `46630` / other: |
| Build version | (git SHA / Vercel deployment URL — no secrets) |
| Environment | Testnet / Mainnet |

**Surfaces under test**

| Surface | URL (fill for this run) |
|---------|-------------------------|
| Marketing / Swap | |
| Game / Mint / Claim | |

---

# 2. Desktop

Mark each matrix cell **PASS** / **FAIL** / **N/A**. Failures go in Notes with steps + screenshot IDs (no secrets).

## 2.1 Chrome + MetaMask

| Check | Result |
|-------|--------|
| □ Connect Wallet | |
| □ Switch Network | |
| □ Disconnect | |
| □ Reconnect | |
| □ Reject Connection | |
| □ Reject Signature | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game Entry | |

**Result:** PASS / FAIL

**Notes:**

## 2.2 Chrome + OKX Wallet

| Check | Result |
|-------|--------|
| □ Connect Wallet | |
| □ Switch Network | |
| □ Disconnect | |
| □ Reconnect | |
| □ Reject Connection | |
| □ Reject Signature | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game Entry | |

**Result:** PASS / FAIL

**Notes:**

## 2.3 Edge + MetaMask

| Check | Result |
|-------|--------|
| □ Connect Wallet | |
| □ Switch Network | |
| □ Disconnect | |
| □ Reconnect | |
| □ Reject Connection | |
| □ Reject Signature | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game Entry | |

**Result:** PASS / FAIL

**Notes:**

## 2.4 Firefox + MetaMask (optional)

| Check | Result |
|-------|--------|
| □ Connect Wallet | |
| □ Switch Network | |
| □ Disconnect | |
| □ Reconnect | |
| □ Reject Connection | |
| □ Reject Signature | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game Entry | |

**Result:** PASS / FAIL / SKIPPED

**Notes:**

---

# 3. Android

## 3.1 Android Chrome (no wallet installed)

| Check | Result |
|-------|--------|
| □ Help Modal | |
| □ MetaMask Deep Link | |
| □ OKX Deep Link | |
| □ No "TRANSACTION FAILED" (connection path) | |
| □ No Provider crash | |

**Result:** PASS / FAIL

**Notes:**

## 3.2 Android MetaMask Browser

| Check | Result |
|-------|--------|
| □ Connect | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game | |
| □ Disconnect | |
| □ Reject Connection | |
| □ Reject Signature | |

**Result:** PASS / FAIL

**Notes:**

## 3.3 Android OKX Browser

| Check | Result |
|-------|--------|
| □ Connect | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game | |
| □ Disconnect | |
| □ Reject Connection | |
| □ Reject Signature | |

**Result:** PASS / FAIL

**Notes:**

---

# 4. iOS

## 4.1 Safari

| Check | Result |
|-------|--------|
| □ Help Modal | |
| □ Deep Links (MetaMask / OKX) | |

**Result:** PASS / FAIL

**Notes:**

## 4.2 MetaMask Browser

| Check | Result |
|-------|--------|
| □ Connect | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game | |

**Result:** PASS / FAIL

**Notes:**

## 4.3 OKX Browser

| Check | Result |
|-------|--------|
| □ Connect | |
| □ Swap | |
| □ Mint | |
| □ Claim | |
| □ Game | |

**Result:** PASS / FAIL

**Notes:**

---

# 5. Network Verification

| Check | Result |
|-------|--------|
| □ Correct chain shown (UI / wallet prompt matches env) | |
| □ Wrong-chain prompt | |
| □ Switch Network works | |
| □ Production cannot use Testnet when `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` | |

**How to confirm the require-Mainnet guard (ops / staging only)**

- With `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` and `NEXT_PUBLIC_GAME_CHAIN_ID=46630`, app startup must **fail closed** (see cutover docs).
- With the flag unset / `0`, Testnet development and pre-cutover Testnet Production remain valid.
- Do not paste env values that contain secrets; record only public chain / flag outcome.

**Result:** PASS / FAIL

**Notes:**

---

# 6. Wallet State

| Check | Result |
|-------|--------|
| □ Page refresh | |
| □ Tab change | |
| □ Browser restart | |
| □ Wallet reconnect | |
| □ Disconnect | |

**Result:** PASS / FAIL

**Notes:**

---

# 7. Transactions

Use smallest safe amounts on the active environment. Prefer Testnet until Mainnet smoke is approved. Record tx hashes only if needed for triage — never private keys.

## 7.1 Swap

| Check | Result |
|-------|--------|
| □ Quote | |
| □ Approve | |
| □ Swap | |
| □ Reject Signature | |

**Result:** PASS / FAIL

**Notes:**

## 7.2 Mint

| Check | Result |
|-------|--------|
| □ Mint | |
| □ Reject Signature | |

**Result:** PASS / FAIL

**Notes:**

## 7.3 Claim

| Check | Result |
|-------|--------|
| □ Claim | |
| □ Reject Signature | |

**Result:** PASS / FAIL

**Notes:**

---

# 8. UI

| Check | Result |
|-------|--------|
| □ Language toggle responsive | |
| □ Wallet banners (connection ≠ transaction failure) | |
| □ Mobile layout | |
| □ No overlapping elements | |
| □ No console errors | |

**Result:** PASS / FAIL

**Notes:**

---

# 9. Final Sign-off

| Field | Value |
|-------|-------|
| Overall Result | PASS / FAIL |
| Remaining Issues | |
| Risk Level | Low / Medium / High |
| Approved By | |
| Approved Date | |

**Launch Recommendation:**

- READY
- NOT READY

**Blockers to READY (if any):**

1.
2.
3.

---

## Appendix — Pass criteria (quick reference)

| Area | Pass means |
|------|------------|
| Reject connection | Localized wallet-connection message; Game / Mint / Swap do not fail silently; Swap does not show TRANSACTION FAILED |
| No provider (mobile browser) | Help modal + MetaMask / OKX deep links; no crash |
| Disconnect (Swap) | Clears wagmi account only; does not break quote / routing |
| Claim disconnected | Clear Connect Wallet CTA |
| Claim wrong chain | Actionable Switch Network CTA |
| Chain guard | `NEXT_PUBLIC_GAME_REQUIRE_MAINNET=1` refuses Game/Mint on `46630` |

When this checklist is **READY**, proceed to [`MAINNET_GO_LIVE_APPROVAL.md`](./MAINNET_GO_LIVE_APPROVAL.md) and cutover steps in [`MAINNET_VERCEL_CUTOVER.md`](./MAINNET_VERCEL_CUTOVER.md).
