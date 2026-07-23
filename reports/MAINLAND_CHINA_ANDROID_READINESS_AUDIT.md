# Mainland China Android Readiness Audit

| Field | Value |
|---|---|
| Date | 2026-07-23 |
| Target | `https://game.hansomealpacas.xyz` |
| Chain | Robinhood Mainnet **4663** |
| Mode | **READ-ONLY** — no code, env, deploy, config, or blockchain changes |
| Auditor environment | Windows dev shell; HTTP probes **not** from mainland China |

---

## Executive summary

HANSOME production game is a **Next.js app on Vercel** with **direct browser → Robinhood RPC** reads/writes via wagmi/viem, **injected-wallet-only** connect (MetaMask/OKX deep links when no provider), **localStorage commit salts** on Mainnet (gasless resolve **off** on 4663), and **forum/API persistence** via same-origin `/api/game/...` (server uses Vercel KV/Upstash — never exposed to browser).

**Test APK verdict: CONDITIONAL GO** — building a **test** Capacitor/WebView APK that loads `https://game.hansomealpacas.xyz` is technically feasible and low secret risk **if the APK contains no server keys**, but **mainland gameplay readiness is unproven**. Do **not** treat CN users as supported until real-device tests pass.

**Top 5 risks (mainland)**

1. **Robinhood Mainnet RPC** (`https://rpc.mainnet.chain.robinhood.com`) — reachability/latency from CN **unknown**; all Commit/Reveal/Claim/Mint/ownership fail if blocked.
2. **Game host / Vercel CDN** — `game.hansomealpacas.xyz` must load; CN access to Vercel-backed sites is **variable / not verified from CN**.
3. **Android wallet + WebView** — no injected provider in bare WebView; users depend on MetaMask/OKX deep links; many failure modes (no wallet app, wrong chain, WebView restrictions).
4. **IPFS Pinata gateway** (`gateway.pinata.cloud`) — NFT `tokenURI` metadata/images; likely CN risk per literature; **not verified from CN**; fallbacks exist for broken images.
5. **Mainnet Commit/Reveal device binding** — salts in `localStorage`; APK WebView profile loss, reinstall, or cross-device use breaks Reveal.

---

## 1. Runtime network dependencies

Scanned: `lib/`, `hooks/`, `app/`, `context/`, `components/`, `next.config.ts`, `.env.example`, `.env.production`, live production HTML.

### Dependency table

| Dependency | Purpose | Critical? | Mainland China risk | APK impact | Recommended action |
|---|---|---|---|---|---|
| `game.hansomealpacas.xyz` (Vercel) | HTML, JS, CSS, RSC, `/api/*`, static assets, audio, PWA manifest | **CRITICAL** | **High / unknown from CN** — Vercel edge; literature suggests intermittent blocking/slowdown; probe from audit env: **200 OK** (not CN) | Same as browser; WebView loads this origin | Real CN Android test: cold load, commit flow, API latency; consider CN-friendly CDN mirror only if tests fail |
| `https://rpc.mainnet.chain.robinhood.com` | All chain reads/writes (Commit, Reveal, Claim, Mint, ownership, game state) via wagmi `http()` transport | **CRITICAL** | **High / unknown from CN** — third-party chain RPC; audit env POST `eth_chainId` → **200** `0x1237` (4663); **not verified from CN** | Identical — browser/WebView calls RPC directly (not proxied) | CN device test RPC latency + `eth_chainId`; if blocked, need **approved** same-origin RPC proxy (out of scope this audit) |
| `https://robinhoodchain.blockscout.com` | Explorer links (tx/address); server forum ownership uses RPC not explorer | **OPTIONAL** (gameplay) | **Medium / unknown from CN** — audit env: **200**; Blockscout third-party | External links open in browser | Accept degraded “view on explorer”; not blocking gameplay |
| `https://gateway.pinata.cloud/ipfs/` | Resolve `ipfs://` tokenURI → HTTPS metadata/images (placeholder pre-reveal; post-reveal when configured) | **CRITICAL** for rich NFT UX; **OPTIONAL** for core loop with fallbacks | **High / not verified from CN** — Pinata public gateway often blocked/slow in CN literature; HEAD probe: **400** (expected without CID path) | Same | CN test My NFTs / mint art load; ship self-hosted or CN-friendly gateway post-reveal; pre-reveal uses placeholder + local SVG fallbacks |
| Injected wallet (`window.ethereum`) | Sign txs, connect account | **CRITICAL** | **Medium** — requires MetaMask/OKX/etc. in WebView or in-app browser | WebView usually **no** injection → deep links | Test MetaMask + OKX flows on CN Android; document “open in wallet app” path |
| `https://metamask.app.link/dapp/...` | MetaMask mobile deep link | **CRITICAL** when no injected provider | **Medium / unknown** — audit env: **200**; app install + link handler required | Primary connect path in WebView APK | CN test with MetaMask installed / not installed |
| `https://www.okx.com/download?deeplink=...` | OKX Wallet deep link | **OPTIONAL** (second wallet) | **Medium** — OKX often used in CN crypto; audit env: **200** | Same as MetaMask path | CN test OKX Wallet path |
| WalletConnect v2 relay | QR / universal connect | **N/A — not shipped** | Would be **high** if enabled | Not in bundle | Keep off until clean integration; do not add for CN without CN relay strategy |
| Same-origin `/api/game/forum/*` | Forum read/write, likes, auth nonce | **OPTIONAL** (social) | **Low** if game host reachable — browser never hits Upstash | Same | CN test forum list + post (needs wallet + NFT) |
| Vercel KV / Upstash (`KV_REST_*`) | Server-only forum + commit vault storage | **CRITICAL** (server) | **N/A to browser** — server-side only | **Must never be in APK** | No client change |
| `/api/game/testnet-*` | Testnet gasless only | **DEVELOPMENT ONLY** on Mainnet prod (`NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=0`) | N/A in prod | N/A | Confirm prod env stays `0` |
| `/_next/static/*`, `/assets/*`, `/audio/*`, `/icons/*` | App shell, art, SFX/BGM | **CRITICAL** | **Low** if game host reachable — same origin | Bundled at runtime from web URL | CN load test |
| `next/font/google` (Press Start 2P, Noto Sans SC) | Typography | **CRITICAL** for UI | **Low at runtime** — fonts **self-hosted** at build time (`/_next/static/media/*.woff2` in live HTML); build pulls Google at deploy, not user browser | Same | No runtime `fonts.googleapis.com` in prod HTML — good for CN |
| `https://plausible.io/js/script.js` | Analytics | **OPTIONAL** | **High if enabled** — blocked likely in CN | Same | Prod: only if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` set; `.env.example` empty → likely **off** |
| `https://www.googletagmanager.com` | Google Analytics | **OPTIONAL** | **High if enabled** | Same | Keep unset for CN |
| `https://api.coingecko.com` | ETH/USD fallback (`lib/market/eth-usd.ts`) | **OPTIONAL** | **High** — not used on core game path | N/A game APK | N/A |
| `https://api.geckoterminal.com` | `/api/market` server-side | **OPTIONAL** | **High** — game nav links marketing chart externally | Low | Not required for Commit/Reveal/Claim |
| `https://www.dextools.io` | Swap/chart widgets (swap/marketing) | **OPTIONAL** | **High** | Low | Game host MARKET link → `hansomealpacas.xyz` |
| `https://hansomealpacas.xyz` / `www` | Marketing, token list, chart | **OPTIONAL** in game | **Unknown** — audit env: **200** | External tab | Non-blocking for game loop |
| `https://x.com`, `https://t.me` | Social links | **OPTIONAL** | **High** (often blocked in CN) | External | Non-blocking |
| Robinhood swap contracts (on-chain) | Swap page only | **OPTIONAL** for game | Depends on RPC | Same RPC dependency | N/A for game test APK |
| Settlement worker (Railway/separate) | Off-chain settlement automation | **DEVELOPMENT / OPS** | N/A to frontend | N/A | **Untouched** — not in client |

### Classification summary

- **CRITICAL (gameplay):** game host, Robinhood RPC, wallet signing path, same-origin game assets.
- **OPTIONAL:** forum, explorer, analytics, market APIs, social, IPFS (with UI fallbacks pre/post reveal).
- **DEVELOPMENT ONLY:** testnet gasless routes, testnet RPC when `46630`, settlement worker, contract scripts.

---

## 2. Mainland China risk (per dependency)

Legend: **A** = code/config evidence · **B** = probe from this audit environment · **C** = unknown / needs real mainland device

| Dependency | A: Code evidence | B: Audit probe | C: CN device |
|---|---|---|---|
| Vercel game host | `middleware.ts` game host; `Server: Vercel` on live HTML | `GET game.hansomealpacas.xyz` → **200**; `X-Vercel-Id: hkg1::iad1::...` | **Required** — first-load time, TLS, intermittent blocks |
| Robinhood RPC | `lib/wagmi.ts` → `http(NEXT_PUBLIC_GAME_RPC_URL \|\| DEFAULT_RPC_URL)`; `.env.production` / `.env.example` → `https://rpc.mainnet.chain.robinhood.com`; **no app proxy** | POST `eth_chainId` → **200** `0x1237` | **Required** — wallet connect + readContract + sendTransaction |
| Pinata IPFS | `lib/game/genesisIdentity.ts` default `NEXT_PUBLIC_IPFS_GATEWAY` → `gateway.pinata.cloud` | HEAD gateway root → **400** (no path) | **Required** — My NFTs image/metadata after mint |
| Google Fonts CDN | `app/layout.tsx` uses `next/font/google` | Live HTML: **no** `fonts.googleapis.com`; preloads `/_next/static/media/*.woff2` | Lower priority — runtime CDN not used |
| WalletConnect | `lib/wagmi.ts`: injected only; `docs/WALLET_MOBILE_CONNECT.md`: QR **not shipped** | N/A | N/A unless added later |
| Upstash/Vercel KV | `lib/game/forum/storageConfig.ts`, server vault — env server-only | Browser never contacts Upstash | N/A (server-side) |
| MetaMask / OKX links | `lib/game/walletConnect.ts`, `WalletHelpModal.tsx` | HEAD **200** both | **Required** — deep link opens wallet, return to WebView |
| Plausible / GA | `components/Analytics.tsx`; env empty in `.env.example` | plausible.io **200** if enabled | Low impact on gameplay |

**Literature note (not verified from CN):** Google services, many Western analytics/CDN domains, and public IPFS gateways are commonly restricted or slow on mainland networks. This audit does **not** claim CN reachability without device evidence.

---

## 3. Robinhood RPC (production)

### Configuration (from code + `.env.example` / `.env.production`)

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_GAME_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_GAME_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` (swap) |
| `NEXT_PUBLIC_GAME_REQUIRE_MAINNET` | `1` |
| Server override | `GAME_RPC_URL` (optional, server routes only) |

### Routing

| Layer | Behavior |
|---|---|
| Client wagmi | Direct `http()` to `NEXT_PUBLIC_GAME_RPC_URL` or `DEFAULT_RPC_URL` — **not proxied** through `game.hansomealpacas.xyz` |
| Server (forum ownership, API routes) | `resolveGameRpcUrl()` → same Mainnet URL; fail-closed guards in `lib/game/gameNetwork.ts` |
| Fallbacks | Mainnet mode: **no** Testnet RPC fallback; empty env → hardcoded `DEFAULT_RPC_URL` |
| Proxy | **None** in frontend |

### Failure modes by flow (Mainnet, gasless off)

| Flow | RPC dependency | If RPC down / blocked |
|---|---|---|
| **Commit** | `readContract` + wallet `writeContract` | Cannot read day/state or submit commit tx |
| **Reveal** | Same + localStorage salt (`lib/game/commitSecret.ts`) | Cannot reveal on-chain; salts still local but useless without chain |
| **Claim** | `readContract` (claimable) + wallet write | Cannot show or claim rewards |
| **Ownership / My NFTs** | `ownerOf`, `tokenURI`, batch reads | Empty/error inventory |
| **Mint** | Genesis contract reads + mint tx | Mint UI fails |
| **Game state** | `useGameState` / `useReadContract` | Dashboard/commit timers broken |
| **Forum write** | Server uses RPC for `ownerOf` verification | Posts rejected if server cannot reach RPC |

Gasless Mainnet: **`NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=0`** and `isTestnetGaslessFeatureEnabled()` returns false when `GAME_CHAIN_ID !== 46630` — production uses **wallet-signed** Reveal/Settle path, not `/api/game/testnet-resolve`.

---

## 4. Wallet Android

### Current implementation

| Mechanism | Status |
|---|---|
| wagmi connector | **`injected()` only** (`lib/wagmi.ts`) |
| WalletConnect QR | **Not shipped** (documented in `docs/WALLET_MOBILE_CONNECT.md`) |
| MetaMask deep link | `https://metamask.app.link/dapp/{host}{path}` |
| OKX deep link | `https://www.okx.com/download?deeplink=...` |
| Help modal | `WalletHelpModal` — no `window.open`; uses `<a href>` buttons |

### Capacitor / WebView implications

| Scenario | Expected behavior |
|---|---|
| Capacitor WebView → `game.hansomealpacas.xyz` | No `window.ethereum` unless wallet injects into WebView (rare) → connect opens **help modal** → user taps MetaMask/OKX |
| MetaMask in-app browser | Injected provider works — **best path** |
| No MetaMask/OKX installed | `NO_WALLET_CONNECT_MESSAGE` — gameplay blocked |
| No Google Play / GMS | MetaMask/OKX may still sideload; **no GMS required by HANSOME code** |
| No Chrome | System WebView still loads site; wallet deep links depend on installed apps |
| WC relay down | **N/A** — WC not enabled |
| Wrong chain | wagmi `connectAsync({ chainId: 4663 })`; user must switch in wallet |
| WebView `localStorage` cleared | **Commit secrets lost** — Reveal fails on Mainnet (no server vault on 4663) |

### Break scenarios to test on CN Android

1. Fresh WebView APK → Connect → MetaMask → return → sign Commit.
2. Same flow with OKX only (no MetaMask).
3. No wallet apps installed.
4. Wallet on wrong chain (e.g. Ethereum mainnet).
5. User commits in WebView, clears app data, attempts Reveal.
6. Deep link from WebView while MetaMask already open.

---

## 5. IPFS

### Pre-reveal (Mainnet blind box — current production posture)

| Item | Behavior |
|---|---|
| `NEXT_PUBLIC_GENESIS_METADATA_CID` | **Must not be set** pre-reveal (`.env.example`, `lib/game/genesisIdentity.ts`) |
| `metadataUrlForToken()` on 4663 | Returns **`null`** unless `NEXT_PUBLIC_GENESIS_IMMEDIATE_NFT_REVEAL=1` |
| On-chain `tokenURI` | Placeholder package (public placeholder CID in ops scripts — **not** rotation/private metadata) |
| Client fetch | `useOwnedGenesisNfts` → `ipfsToHttps(chainUri)` only; **blocks** tokenId-indexed reveal package on Mainnet |
| User sees if gateway down | Local fallbacks: `/assets/characters/alpaca-placeholder.svg`, hero PNGs (`lib/game/nftDisplay.ts`) |

### Post-reveal (future)

| Item | Behavior |
|---|---|
| Env | Ops sets `NEXT_PUBLIC_GENESIS_METADATA_CID` + optional `NEXT_PUBLIC_IPFS_GATEWAY` |
| Fetch | `{gateway}/{cid}/{tokenId}.json` |
| Gateway down | Broken/missing images; identity may fall back to on-chain + placeholders |

**Audit constraint honored:** No fetch of unrevealed rotation/private metadata.

---

## 6. Forum / KV

### Browser → API surface

All forum client calls use **relative same-origin** paths:

- `GET/POST /api/game/forum/threads`
- `GET/POST/PATCH/DELETE /api/game/forum/threads/[threadId]/...`
- `GET /api/game/forum/auth/nonce`
- `POST /api/game/forum/likes`

Sources: `hooks/game/useForumPost.ts`, `useForumLike.ts`, `useForumDelete.ts`, `app/game/forum/*.tsx`, `lib/game/forum/unread.ts`.

**Confirmed:** Browser does **not** call Upstash or `KV_REST_*` URLs directly.

### Server

- `lib/game/forum/storageConfig.ts` → KV when `KV_REST_API_URL` + token set.
- Forum writes verify NFT ownership via server RPC (`lib/game/forum/ownership.ts`).

Live probe: `GET https://game.hansomealpacas.xyz/api/game/forum/threads?board=tactics` → **200** `{"ok":true,...}`.

---

## 7. Capacitor feasibility

| Requirement | Assessment |
|---|---|
| No Play Store / Firebase / Maps / TWA | **Compatible** — no Play/Firebase/Maps in codebase; TWA not required |
| Website as source of truth | **Matches** — APK can load `https://game.hansomealpacas.xyz` (same as PWA intent in `lib/pwa/gameManifest.ts`) |
| Existing PWA | Manifest + icons on game host; **no service worker** (`reports/PWA_IMPLEMENTATION.md`) |
| Capacitor in repo | **None** — no `capacitor.config.*`; greenfield wrapper |
| Recommended architecture | **Simple WebView shell** → production URL; optional custom URL scheme for return from wallet |
| Offline | **Not supported** — by design (no SW, all RPC/API network-bound) |
| vs native WebView APK risks | Same CN dependencies as Chrome; plus WebView storage + deep-link friction |

**Feasibility verdict:** **Feasible for test APK** as URL loader; **not** a CN connectivity fix.

---

## 8. APK security — must NEVER ship in client

From `.env.example` and server modules — **server-only / never `NEXT_PUBLIC_*`:**

| Secret / material | Why |
|---|---|
| `GAME_MAINNET_RELAYER_PRIVATE_KEY` | Signs relayer txs |
| `GAME_TESTNET_RELAYER_PRIVATE_KEY` | Testnet relayer |
| `GAME_MAINNET_COMMIT_VAULT_KEY` | Encrypts commit salts |
| `GAME_TESTNET_COMMIT_VAULT_KEY` | Testnet vault |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | Forum + vault Redis write |
| `KV_REST_API_READ_ONLY_TOKEN` | KV read |
| `PINATA_JWT` | IPFS publish scripts |
| `VERCEL_OIDC_TOKEN` / deploy tokens | Infra |
| Any private key / mnemonic | Obvious |
| `NEXT_PUBLIC_GENESIS_METADATA_CID` pre-reveal | Leaks reveal package into bundle |

**Safe in APK (public by design):** `NEXT_PUBLIC_*` contract addresses, RPC URL, chain ID, explorer URL.

**Confirm:** Current wagmi stack embeds RPC URL in JS bundle — expected; **no** relayer/vault keys in client graph (`testnetRelayerStatus.ts` is `server-only`).

---

## 9. Launch systems — untouched (audit only)

This audit performed **no** changes to:

- Vercel production env or deployments  
- Mainnet contract config / timelock / reveal ops  
- Settlement worker / Railway  
- Blind-box / rotation metadata  
- Forum writes or KV data  
- APK build or Capacitor scaffolding  
- Git-tracked source (read-only inspection + this report)

---

## 10. Live production HTML check (read-only GET)

**URL:** `https://game.hansomealpacas.xyz` · **Status:** 200 · **Server:** Vercel

| Check | Finding |
|---|---|
| Script sources | All `/_next/static/chunks/*.js` — **same origin** |
| Styles | `/_next/static/css/*.css` — same origin |
| Font links | Preload `/_next/static/media/*.woff2` — **self-hosted**; **no** runtime `fonts.googleapis.com` |
| Images (hero) | `/assets/backgrounds/*`, `/assets/characters/*` — same origin |
| Manifest | `link rel="manifest" href="/manifest.webmanifest"` (game layout) |
| CSP connect-src | No CSP header exposing connect-src on HTML response; `next.config.ts` CSP only on SVG image optimizer |
| Wallet UI | “CONNECT WALLET” / “INJECTED · ROBINHOOD” on home CTA |
| Chain badge | “ROBINHOOD CHAIN” (Mainnet UX) |

---

## Section verdicts

| Area | Verdict |
|---|---|
| **Website** | **CONDITIONAL** — loads in audit env; CN reachability **unverified** |
| **RPC** | **CONDITIONAL** — correct direct Mainnet URL; CN reachability **unverified** |
| **Wallet** | **CONDITIONAL** — injected + deep links only; WebView APK adds friction |
| **IPFS** | **CONDITIONAL** — Pinata default gateway; fallbacks exist; CN **unverified** |
| **Forum** | **PASS** (architecture) — same-origin API; server KV hidden |
| **Capacitor feasibility** | **PASS** (engineering) — simple WebView wrapper viable; **not** CN-validated |

---

## Final verdict: test APK

### **CONDITIONAL GO**

**GO** to build a **test-only** Android APK (WebView → `https://game.hansomealpacas.xyz`) for internal QA, provided:

1. APK contains **zero** server secrets (only loads remote HTTPS app).
2. Team expects **failures** until mainland tests complete.
3. No Play Store submission or CN user marketing until tests pass.
4. PWA “Add to Home Screen” remains a zero-build alternative for non-CN QA.

**NO-GO** for claiming **mainland-ready gameplay** or public CN distribution without the test matrix below.

---

## Tests requiring REAL mainland China Android phone + network

1. Cold open `https://game.hansomealpacas.xyz` (Chrome + test APK WebView) — time-to-interactive, TLS errors, blank screen.
2. JSON-RPC: wallet or DevTools proxy — `eth_chainId` to `https://rpc.mainnet.chain.robinhood.com`.
3. Connect wallet: MetaMask deep link round-trip from WebView APK.
4. Connect wallet: OKX deep link round-trip.
5. Connect with **no** wallet apps installed — error UX acceptable?
6. Switch to Robinhood chain 4663 in wallet — Commit one NFT (test wallet).
7. Same device Reveal after Commit — localStorage persistence in WebView.
8. Claim rewards tx after settlement window (or test on prior day).
9. Mint page load + one mint tx (if sale active).
10. My NFTs — placeholder/metadata image load via Pinata gateway.
11. Forum read list + one signed post (NFT-gated).
12. Game BGM/SFX from `/audio/*` (same origin).
13. Background app → foreground — wallet still connected?
14. Airplane mode / flaky network — error messages not silent failures.
15. Optional: MARKET external link to `hansomealpacas.xyz` (non-critical).

---

## References (code)

- RPC / wagmi: `lib/wagmi.ts`, `lib/game/gameNetwork.ts`, `lib/chain.ts`
- Wallet: `lib/game/walletConnect.ts`, `hooks/game/useOpenWalletConnect.ts`, `docs/WALLET_MOBILE_CONNECT.md`
- IPFS / blind box: `lib/game/genesisIdentity.ts`, `lib/game/genesisNftReveal.ts`, `hooks/game/useOwnedGenesisNfts.ts`
- Forum: `lib/game/forum/storageConfig.ts`, `hooks/game/useForumPost.ts`
- PWA: `lib/pwa/gameManifest.ts`, `reports/PWA_IMPLEMENTATION.md`
- Production env pattern: `.env.example`, `.env.production`

---

*End of audit.*
