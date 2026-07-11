# UGLY Pool History

## Project
- Token: Ugly Deer (UGLY)
- Chain: Robinhood Chain Mainnet
- Chain ID: 4663

---

# Attempt #1 (Failed)

Date: 2026-07-11

## Pool
- Fee: 3000 (0.3%)
- Position ID: 39500
- Pool ID: `0x25d3614484fc23f4176097e78158f461f6bb324db9594837e83396a5f3d8e983`

## Root Cause

Custom `encodeSqrtRatioX96()` implementation incorrectly shifted by **96 bits** instead of **192 bits**.

Result:

- Wrong sqrtPriceX96
- Wrong initial tick
- Only 1 wei UGLY deposited
- Pool unusable
- No trading route

## Resolution

- Removed liquidity
- Burned Position NFT #39500
- Recovered approximately 0.08 ETH
- Pool remains on-chain with zero liquidity

Create Tx:

`0x52c4f107de8ea6b36ad20bd65d0d141bf0dceab24046888cc588e48ed24ea1b0`

Remove Tx:

`0xddde6616dfd04005485123cc9329e427089b56861a52424af2970f5c782ff973`

---

# Attempt #2 (Production Pool)

Status: ✅ SUCCESS

Date: 2026-07-11

## Pool Parameters

| Parameter | Value |
|-----------|-------|
| Fee Tier | 500 (0.05%) |
| Target Price | 1 ETH = 359,402,000 UGLY |
| Initial ETH | 0.08 |
| Initial UGLY | 28,752,160 |
| Pool ID | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |
| Position NFT | 39790 |
| Owner | Treasury Wallet (`0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A`) |

---

## On-chain Verification

| Check | Result |
|-------|--------|
| Pool initialized | ✅ |
| sqrtPriceX96 | `1501999639780730386804896713227225` |
| Tick | 197009 |
| Liquidity | `1695046562062393200190` |
| Pool ETH | ≈ 0.079972319646772372 ETH |
| Pool UGLY | ≈ 28,752,160 UGLY |

---

## Deployment Transaction

| Field | Value |
|-------|-------|
| Transaction Hash | `0x6393e2f662229ce14cd9b8149542218b00a4433085cae33fcc2eca507279e328` |
| Explorer | https://robinhoodchain.blockscout.com/tx/0x6393e2f662229ce14cd9b8149542218b00a4433085cae33fcc2eca507279e328 |
| Gas Used | 401,648 |
| Gas Cost | 0.000021450413088 ETH |

---

## Swap Verification

Verified via Universal Router staticCall on 2026-07-11.

| Direction | Input | Quote (amountOut) | staticCall |
|-----------|-------|-----------------|------------|
| ETH → UGLY | 0.001 ETH | ≈ 355,251 UGLY | ✅ PASS |
| UGLY → ETH | 100,000 UGLY | ≈ 0.000277 ETH | ✅ PASS |

Script: `contracts/scripts/verify-v4-swaps.ts`

**Pool is swappable.**

Full report: [UGLY Swap Verification](./UGLY_SWAP_VERIFICATION.md)

---

## Lessons Learned

- Never implement `encodeSqrtRatioX96()` manually.
- Use the official Uniswap v3 SDK implementation.
- Always execute DRY_RUN before broadcasting.
- Verify liquidity using on-chain StateView after deployment.
- Verify swaps via Universal Router staticCall before announcing trading is live.

---

## Current Production Pool

| Field | Value |
|-------|-------|
| Status | 🟢 ACTIVE |
| Pool Fee | 0.05% |
| Pool ID | `0x7b0294d1917fb2b47417582f84b57850266c43bf77bcdc80ad39da0d94045056` |
| Position NFT | 39790 |
| Owner | Treasury Wallet |

**Notes**

This is the official production liquidity pool for UGLY.

All future liquidity additions or removals should use Position #39790.

Do not reuse fee tier 3000 for this token pair — Attempt #1 left a permanently initialized but empty pool on-chain at that tier.

---

## Key Contracts (Robinhood 4663)

| Contract | Address |
|----------|---------|
| UGLY Token | `0xbeE686CF9b2A4771c3eb6C000a23939DFFe1c00c` |
| PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| PositionManager | `0x58daec3116aae6D93017bAAea7749052E8a04fA7` |
| StateView | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| Universal Router | `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
