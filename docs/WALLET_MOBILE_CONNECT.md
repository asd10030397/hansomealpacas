# HANSOME — Mobile wallet connect (current + future)

| Field | Value |
|-------|-------|
| Status | Current support documented; WalletConnect QR **not** shipped |
| Surfaces | Game / Mint / Claim / Swap |
| Last updated | 2026-07-21 |

## Current support (shipped)

Regular mobile browsers (Android Chrome, iOS Safari, in-app browsers) use:

1. **Injected provider** when the page is opened inside MetaMask / OKX / similar in-app browsers.
2. **Deep links** from the in-page help modal when no injected provider is detected:
   - MetaMask dapp link
   - OKX Wallet dapp link

Connect flow is shared via `openWalletConnect()` + provider preflight (`lib/game/walletConnect.ts`). Connection failures use a **connection** banner / help modal — never the Swap “TRANSACTION FAILED” path.

## Not shipped: WalletConnect QR

WalletConnect (WalletConnect v2 / wagmi `walletConnect` connector) is **intentionally not** wired for production.

- Prior attempts hit optional-dependency / Next.js production-build failures when importing the wagmi connectors barrel.
- Do **not** introduce a partial or broken WalletConnect connector.
- Treat QR-based WalletConnect as a **separate future task** once a clean integration is verified against `next build` with no optional peer dependency gaps.

## Future task checklist (WalletConnect QR)

- [ ] Add WalletConnect project id via public env (no secrets in client beyond the public project id)
- [ ] Register connector without breaking the wagmi/connectors import graph for Next production builds
- [ ] Keep injected + deep-link path as fallback when WalletConnect is unavailable
- [ ] QA: iOS Safari QR, Android Chrome QR, reject/cancel UX, wrong-chain switch
- [ ] Confirm Swap / Game / Mint / Claim all share the same connect helper

## Related

- Cutover chain lock: `NEXT_PUBLIC_GAME_REQUIRE_MAINNET` in `docs/MAINNET_VERCEL_CUTOVER.md`
- Shared helpers: `lib/game/walletConnect.ts`, `hooks/game/useOpenWalletConnect.ts`
