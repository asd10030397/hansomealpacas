# Desktop MetaMask Connect Popup — Investigation

| Field | Value |
|---|---|
| Date | 2026-07-24 |
| Symptom | Click **Connect Wallet** on desktop web → no MetaMask extension popup; sometimes **"Connection cancelled in wallet."** |
| Context | MetaMask extension open/unlocked; wallet on **Ethereum mainnet**, not Robinhood **4663** |

---

## ROOT CAUSE

**Primary (code bug — fixed): `chainId: 4663` was passed to `connectAsync` for the injected MetaMask connector.**

Flow in `@wagmi/core` injected connector (`connect()`):

1. `wallet_requestPermissions` / `eth_requestAccounts` (account connect)
2. If `chainId` differs from the wallet’s current chain → **`wallet_switchEthereumChain` / `wallet_addEthereumChain` in the same call**

When MetaMask is already authorized for the site but still on **Ethereum (chain 1)**, step 1 often completes **without a visible account popup**. Step 2 immediately requests **Robinhood Chain (4663)**. If the user dismisses that network prompt (or it appears only inside the already-open MetaMask extension panel), wagmi throws `UserRejectedRequestError` → mapped to **`Connection cancelled in wallet.`** via `classifyConnectFailure()`.

The app already handles wrong network **after** connect (`wallet.wrongNetwork` + `switchToGenesisChain` on Mint / Claim / My NFTs / Swap). Bundling chain switch into connect was redundant and caused the reported UX.

**Secondary (no code bug — possible confusion):**

| Scenario | Behavior |
|---|---|
| Desktop **without** `window.ethereum` (extension disabled for site, provider conflict, etc.) | `pickConnectConnector` falls back to **WalletConnect** (Reown modal / QR), **not** the MetaMask extension popup. Dismissing that modal also yields **"Connection cancelled in wallet."** |
| MetaMask prompt behind browser window | Extension notification or panel prompt exists but is easy to miss; rejection still maps to **cancelled**. |

Desktop **with** a detected injected provider correctly selects `injected()` — WalletConnect is **not** preferred when `window.ethereum.request` exists (`shouldPreferWalletConnect` + `pickConnectConnector`).

---

## FIX

| File | Change |
|---|---|
| `lib/game/walletConnect.ts` | Add `shouldBindChainOnConnect()` — chainId only for `walletConnect` / `walletConnectLegacy`; tighten `hasInjectedEthereum()` to require EIP-1193 `request()` |
| `hooks/game/useOpenWalletConnect.ts` | Call `connectAsync({ connector })` for injected; keep `connectAsync({ connector, chainId })` for WalletConnect (Capacitor / mobile WC path unchanged) |

Capacitor APK and mobile WalletConnect sessions still bind **4663** at pairing time. Desktop MetaMask extension connect restores the account prompt first; user switches network via existing **wrong network** UI.

---

## WORKAROUND (before deploy)

1. Hard-refresh the game page (`Ctrl+Shift+R`).
2. Click the **MetaMask extension icon** — approve any pending **Connect** or **Switch network** request (prompt may be in the extension panel, not a floating popup).
3. If no prompt: MetaMask → **Connected sites** → disconnect HANSOME, retry **Connect Wallet**.
4. After connect, if header shows wrong chain, use **Switch network** (Mint / Claim / etc.) — do not expect Robinhood during the first connect click.

---

## HOW TO RETRY (after fix)

1. Deploy web app with this change.
2. Desktop Chrome/Edge/Firefox + MetaMask extension unlocked.
3. Open `https://game.hansomealpacas.xyz/game` (or local dev).
4. Click **Connect Wallet** → MetaMask **account connect** popup should appear (even while on Ethereum).
5. Approve → address shows in header.
6. If still on Ethereum, use page **Switch network** CTA to add/switch to Robinhood Chain **4663**.

---

## Evidence (code)

- `hooks/game/useOpenWalletConnect.ts` — previously `connectAsync({ connector, chainId: targetChainId })` for all connectors
- `@wagmi/core` injected `connect()` — switches chain when `chainId` param set and current chain differs (lines 170–178 in `node_modules/@wagmi/core/src/connectors/injected.ts`)
- `lib/game/walletConnect.ts` — `classifyConnectFailure()` maps `/rejected|denied|User rejected/i` → `CONNECTION_CANCELLED_MESSAGE`
- `hooks/game/useWalletUi.ts` — `wrongNetwork` + `switchToGenesisChain()` already handle post-connect chain switch

---

## Verification

| Step | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `vitest lib/game/__tests__/walletConnect.test.ts` | **PASS** (13/13) |

**Status:** **FIXED** in repo (pending deploy).
