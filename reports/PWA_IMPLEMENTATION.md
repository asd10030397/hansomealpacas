# PWA Implementation — HANSOME Game Site

| Field | Value |
|---|---|
| Date | 2026-07-23 |
| Canonical app | `https://game.hansomealpacas.xyz` |
| Status | **Ready for review — do not deploy to Production until verification passes on your side** |

---

## Summary

Progressive Web App support was added for the **game subdomain** without changing gameplay, wallet, mint, forum, or contract logic. The marketing site (`hansomealpacas.xyz`) keeps its existing manifest; `game.hansomealpacas.xyz` receives a host-aware game manifest, dark-chrome icons, and Add to Home Screen metadata.

**No service worker** was added. All dynamic content (API, RSC, HTML, Web3 state) continues to load from the network on every visit.

---

## What Was Added

### 1. Host-aware Web App Manifest (`app/manifest.ts`)

- **Game host** (`game.hansomealpacas.xyz`, `game.localhost`, `game.local`): serves game PWA manifest via `buildGameManifest()`.
- **Marketing host**: unchanged branding manifest with added `scope` and `lang`.

Game manifest fields:

| Field | Value |
|---|---|
| `name` | HANSOME: Alpacas vs Cougars |
| `short_name` | HANSOME |
| `description` | Premium pixel-art GameFi — Choose Location, Battle Result, Claim on Robinhood Chain. |
| `start_url` | `/` (middleware rewrites → `/game` title menu) |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` / `background_color` | `#0e121c` (game chrome) |
| `lang` | `en` |
| `id` | `https://game.hansomealpacas.xyz/` |

### 2. Game PWA constants (`lib/pwa/gameManifest.ts`)

Single source of truth for game manifest fields, icon paths, and theme color.

### 3. Game layout metadata (`app/game/layout.tsx`)

- `appleWebApp.capable: true` + `statusBarStyle: black-translucent`
- `mobile-web-app-capable: yes` (Android Chrome)
- Game-specific `apple-touch-icon` at `/icons/pwa/apple-touch-icon.png`
- `manifest: /manifest.webmanifest` link on game routes

### 4. PWA icons (`public/icons/pwa/`)

Generated from existing brand asset `public/logo/logo-256.png` (HANSOME coin) on `#0e121c` background — **no new brand invented**.

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | Install icon |
| `icon-512.png` | 512×512 | Install / splash |
| `icon-512-maskable.png` | 512×512 | Maskable (62% safe zone) |
| `apple-touch-icon.png` | 180×180 | iOS Add to Home Screen |

Regenerate anytime: `npm run generate:assets`

---

## Caching Policy

| Layer | Policy |
|---|---|
| **Service worker** | **None.** No SW registered. No offline shell, no precache of HTML/RSC/API. |
| **Manifest** | Dynamic per `Host` header (`ƒ /manifest.webmanifest` in build). Always fresh from server. |
| **PWA icons** | Static files under `/icons/pwa/*`; covered by existing `next.config.ts` rule: `Cache-Control: public, max-age=31536000, immutable`. |
| **Game data / API** | Unchanged — network-only (Next.js default, no SW interception). |
| **Mint / Reveal / Web3** | Unchanged — never cached by this work. |

Rationale: game state, commits, reveals, and wallet flows must always hit live network. A minimal SW would risk stale gameplay or API responses; omitting SW is the safest default per project requirements.

---

## Add to Home Screen

### Android (Chrome / Edge)

1. Open `https://game.hansomealpacas.xyz/` in Chrome.
2. Menu (⋮) → **Install app** or **Add to Home screen**.
3. Confirm — app launches in **standalone** (no browser URL bar).

Requires HTTPS (production). Local test: `http://game.localhost:3000` with host entry.

### iOS (Safari)

1. Open `https://game.hansomealpacas.xyz/` in Safari.
2. Share button → **Add to Home Screen**.
3. Icon uses `/icons/pwa/apple-touch-icon.png`; launches full-screen via `apple-mobile-web-app-capable`.

### start_url behavior

On the game host, `start_url: /` is rewritten by `middleware.ts` to `/game` (title menu). Users land on the game home screen, not marketing `/` or dashboard.

---

## Middleware Compatibility

`middleware.ts` maps game host `/` → internal `/game`. PWA `start_url` and `scope` both use `/`, which is correct for the entire game subdomain. Static assets (`/icons/*`, manifest) bypass rewrites via the dot-path rule.

---

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run lint` | **PASS** (exit 0; pre-existing warnings only, none in PWA files) |
| `npm run build` | **PASS** (exit 0; `/manifest.webmanifest` emitted as dynamic route) |
| Asset generation | **PASS** — 4 PWA icons created under `public/icons/pwa/` |

---

## Launch-Critical Audit

**Result: PASS** — PWA changes do not touch forbidden areas.

### Files changed by this PWA work

| File | Change |
|---|---|
| `app/manifest.ts` | Host-aware game vs marketing manifest |
| `app/game/layout.tsx` | PWA / Apple Web App metadata only |
| `lib/pwa/gameManifest.ts` | **New** — game manifest builder |
| `scripts/generate-assets.mjs` | PWA icon generation step |
| `public/icons/pwa/apple-touch-icon.png` | **New** |
| `public/icons/pwa/icon-192.png` | **New** |
| `public/icons/pwa/icon-512.png` | **New** |
| `public/icons/pwa/icon-512-maskable.png` | **New** |
| `reports/PWA_IMPLEMENTATION.md` | **New** — this report |

### Forbidden areas — NOT modified by PWA work

- Genesis mint, Blind Box, Reveal, metadata pipelines
- Contracts / Solidity
- `lib/game/genesisIdentity.ts`
- Commit/Reveal gameplay, settlement worker
- Forum storage / KV
- Mainnet env vars
- Mint page logic, wallet logic, workers

> **Note:** The working tree may contain other unrelated local modifications (e.g. genesis scripts, whitelist data). Those pre-date this PWA task and were **not** part of this diff.

---

## Do Not Deploy to Production Until Verification Passes

Before deploying:

1. Re-run `npm run typecheck`, `npm run lint`, and `npm run build` on the commit you intend to ship.
2. Smoke-test on `game.hansomealpacas.xyz` preview/staging:
   - `curl -H "Host: game.hansomealpacas.xyz" https://<preview-url>/manifest.webmanifest` — confirm game manifest JSON.
   - Install to home screen on one Android + one iOS device.
   - Confirm standalone launch lands on title menu (`/`).
   - Play through Commit → Result without stale cache issues (no SW expected).
3. Confirm icons load: `/icons/pwa/icon-512.png`, `/icons/pwa/apple-touch-icon.png`.

---

## Future Options (Out of Scope)

- Optional minimal SW with network-first for `/api/**` only — **not implemented**; add only if offline shell is explicitly requested.
- iOS startup splash images (`apple-touch-startup-image`) — optional; current apple-touch-icon + `background_color` cover basic splash.
- Push notifications — not applicable for Season 1.
