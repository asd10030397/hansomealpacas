# Android WalletConnect — Production Deploy + APK Rebuild

| Field | Value |
|---|---|
| Date | 2026-07-23 |
| Production URL | `https://game.hansomealpacas.xyz` |
| Reown / WalletConnect project id (public) | `1185aef502969a8f2c34e5c62ec4b221` |
| Mode | Internal QA debug APK only — **not published to stores** |

---

## Verdicts

| Check | Result |
|---|---|
| **PRODUCTION WEB WALLETCONNECT** | **PASS** |
| **ANDROID APK READY FOR DEVICE RETEST** | **YES** |

---

## Git commits (local `main`)

| Commit | Message |
|---|---|
| `96854c7` | feat(wallet): add WalletConnect v2 for Capacitor APK and mobile browsers |
| `1b206b4` | fix(build): exclude mobile Capacitor wrapper from Next typecheck |

**Production deployment commit SHA:** `1b206b49e12e5db83bedd6c187baaa7ec8e548c7`

Deployed via `npx vercel --prod --yes` from local `main` (not pushed to remote in this session).

---

## Vercel environment

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `1185aef502969a8f2c34e5c62ec4b221` (public client id) | Production, Preview, Development |

Set with `npx vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID <env> --force`.

---

## Vercel production deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_F8KGgDbTjzTTHHPsuQ7qbodTvGpt` |
| Deployment URL | `https://hansomealpacas-280dkard5-the-67.vercel.app` |
| Aliases | `https://game.hansomealpacas.xyz`, `https://www.hansomealpacas.xyz`, … |
| Inspector | `https://vercel.com/the-67/hansomealpacas/F8KGgDbTjzTTHHPsuQ7qbodTvGpt` |
| Status | Ready (production target) |

First deploy attempt (`dpl_Dzxjd2eW8Bkj44jwW6J5NFXy7ZeF`) failed on Next typecheck of `mobile/hansome-game/capacitor.config.ts`; fixed by excluding `mobile/**` in root `tsconfig.json`, then redeployed successfully.

---

## WalletConnect initialization verification (production)

Fetched live assets from `https://game.hansomealpacas.xyz/game` after deploy:

| Check | Result |
|---|---|
| RSC payload references `WalletConnectProvider` | **Present** in `/game` HTML |
| Client bundle contains public project id | **PASS** — `1185aef502969a8f2c34e5c62ec4b221` in `/_next/static/chunks/4177-b8b548ea291e03a4.js` |
| `walletConnect` connector strings | **Present** in chunks `4177-…` and `6674-…` |
| `injected` connector id | **Present** in chunk `4177-…` (desktop MetaMask path retained) |

The project id is intentionally public (Reown frontend client id); it is baked into the Next.js client bundle via `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` at build time.

---

## Desktop MetaMask injected path (code audit)

Connector registration order in `lib/wagmi.ts`:

1. `injected()` — always registered first
2. `walletConnect({ projectId, … })` — appended when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set

Connector selection in `lib/game/walletConnect.ts`:

| Context | Path |
|---|---|
| Desktop browser + `window.ethereum` | `pickInjectedConnector` (MetaMask extension) |
| Capacitor APK WebView | `pickWalletConnectConnector` (no injected provider) |
| Mobile browser, no injection | WalletConnect when configured |

**Regression check (manual — not run in CI):**

1. Desktop Chrome/Firefox **with MetaMask extension** installed
2. Open `https://game.hansomealpacas.xyz/game`
3. Click **Connect Wallet** — should connect via **injected** path (no QR modal if extension present)
4. Confirm account address appears in header without opening WalletConnect modal

---

## Android debug APK (post-production deploy)

| Property | Value |
|---|---|
| Gradle command | `mobile/hansome-game/android/gradlew.bat assembleDebug` (JDK 21) |
| Primary build output | `mobile/hansome-game/android/app/build/outputs/apk/debug/app-debug.apk` |
| Copy (gitignored) | `artifacts/hansome-game-debug.apk` |
| Size | **4,426,622 bytes** (~4.22 MiB) |
| SHA-256 | `41743b01c873f0388e0c96cadf26eb5a7ce65242759d96d221c85ef85b7e8c9b` |
| Secret scan | **PASS** (no hits in APK, assets, www, capacitor.config.ts) |
| Store publish | **No** — sideload / internal QA only |

APK loads live production web via Capacitor `server.url` → `https://game.hansomealpacas.xyz`; WalletConnect config comes from the deployed frontend, not from the APK binary.

### Install (internal QA)

```powershell
adb install -r artifacts\hansome-game-debug.apk
```

### Device retest checklist

1. Install APK on Android device
2. Open HANSOME → loads `game.hansomealpacas.xyz`
3. Tap **Connect Wallet** → WalletConnect modal / MetaMask mobile pairing (not broken deep-link-only path)
4. Approve in MetaMask app → return to HANSOME APK → session persists

---

## Scope exclusions (unchanged)

No changes to Genesis Mint, Blind Box, Reveal, contracts, whitelist, sale times, settlement, economics, or mainnet addresses. No mainnet transactions sent.
