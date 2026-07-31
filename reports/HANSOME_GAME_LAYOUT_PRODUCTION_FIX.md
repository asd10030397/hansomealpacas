# HANSOME Game Layout Production Fix

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Target | https://game.hansomealpacas.xyz/ |
| Vercel project | `the-67/hansomealpacas` (shared with www; game is domain alias) |
| Result | **PASS** |
| Deployed | **YES** |

---

## Verdict

Production game homepage layout broke because **all `/assets/*` static files were omitted from Vercel CLI deploys**. Missing hero/background PNGs and menu SVGs caused broken-image icons, empty dark side panels, and a visually “compressed” centered column (CSS full-bleed stage remained full-width; decorations failed to paint).

Narrow fix: correct `.vercelignore` so `public/assets` is included again, then redeploy.

---

## Root cause

Local uncommitted `.vercelignore` expansion (used by recent `npx vercel --prod` uploads) contained a bare pattern:

```text
assets
```

In gitignore / `.vercelignore` matching, bare `assets` matches **any** path segment named `assets`, including:

- `public/assets/**` (required Next.js static game art) ← **excluded by mistake**
- `/assets/**` (root Capacitor staging folder) ← intended exclude

### Evidence (pre-fix)

| URL | Status | Content-Type |
|-----|--------|--------------|
| `https://game.hansomealpacas.xyz/assets/backgrounds/cougar-mountain-world.png` | **404** | `text/html` |
| `https://game.hansomealpacas.xyz/assets/backgrounds/alpaca-ranch-lush.png` | **404** | `text/html` |
| `https://game.hansomealpacas.xyz/assets/characters/cougar-hero-standoff.png` | **404** | `text/html` |
| `https://game.hansomealpacas.xyz/assets/characters/alpaca-hero-ranch.png` | **404** | `text/html` |
| `https://game.hansomealpacas.xyz/assets/ui/logo-hansome-game.svg` | **404** | `text/html` |
| `https://game.hansomealpacas.xyz/assets/icons/menu-wallet.svg` | **404** | `text/html` |

Local workspace still had all 73 tracked files under `public/assets` (~52.7 MB). Pattern simulation:

```text
pattern "assets"  → IGNORE public/assets/foo.png
pattern "/assets" → KEEP   public/assets/foo.png
                  → IGNORE assets/capacitor.config.json
```

### Not the cause

- No redesign / CSS max-width regression in `title-standoff.css` (stage is `position: absolute; inset: 0`; worlds are `width: 50%`).
- Not `basePath` / `assetPrefix` (none set in `next.config.ts`).
- Not case-sensitivity path typos (URLs match on-disk names).
- Middleware correctly bypasses `/assets` on the game host.

Secondary visual symptom (narrow center + dark sides) was **missing full-bleed stage images**, not a new layout container.

---

## Fix

**File changed:** `.vercelignore` only

```diff
- assets
+ # Root Capacitor/staging folder only — do NOT use bare "assets"
+ # (that gitignore-style pattern also excludes public/assets and breaks the game UI).
+ /assets
```

No game logic, wallet, contracts, minting, scoring, Scan, Analytics, or www homepage code changes.

---

## Deploy

| Field | Value |
|-------|-------|
| Command | `npx vercel --prod --yes` |
| Deployment ID | `dpl_GPqJGtbxy1ySTo5Av5WNCLX67sUj` |
| Deployment URL | https://hansomealpacas-a9qicm0fw-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/GPqJGtbxy1ySTo5Av5WNCLX67sUj |
| Aliases | `game.hansomealpacas.xyz`, `www.hansomealpacas.xyz`, apex |
| Build | Next.js 15.5.20 — compiled successfully; typecheck during build OK |

### Local verification before deploy

| Check | Result |
|-------|--------|
| `npx tsc --noEmit -p tsconfig.json` | **PASS** (exit 0) |
| Ignore simulation after fix | `public/assets/**` KEEP; root `/assets` IGNORE |

---

## Post-deploy smoke (PASS)

### Asset HTTP

| URL | Status | Content-Type | Length |
|-----|--------|--------------|--------|
| `/assets/backgrounds/cougar-mountain-world.png` | 200 | `image/png` | 2304818 |
| `/assets/backgrounds/alpaca-ranch-lush.png` | 200 | `image/png` | 2498017 |
| `/assets/characters/cougar-hero-standoff.png` | 200 | `image/png` | 1389488 |
| `/assets/characters/alpaca-hero-ranch.png` | 200 | `image/png` | 836126 |
| `/assets/ui/logo-hansome-game.svg` | 200 | `image/svg+xml` | 882 |
| menu icons (`wallet/mint/explore/season/download`) | 200 | `image/svg+xml` | OK |

Host: `https://game.hansomealpacas.xyz` (all **PASS**).

### Playwright viewport checks

Script: `scripts/_tmp-game-layout-smoke.mjs`  
Screenshots: `reports/_tmp-game-layout/{desktop-1440,tablet-768,mobile-390}.png`  
JSON: `reports/_tmp-game-layout/smoke.json`

| Viewport | Stage width | Broken images | Failed `/assets` | Notes |
|----------|-------------|-----------------|------------------|-------|
| Desktop 1440×900 | **1440** (full bleed) | 0 | 0 | Heroes + corner labels visible |
| Tablet 768×1024 | **768** | 0 | 0 | OK |
| Mobile 390×844 | **390** | 0 | 0 | Centered menu; art still paints |

### Navigation / CTAs

| Control | Result |
|---------|--------|
| Mint | `href=/mint` |
| Enter Game | `href=/commit` (phase-aware; current phase → commit) |
| Season | `href=/season` |
| Download APP | Present (chooser control) |
| Wallet button | `[data-wallet-entry="home-cta"]` count = 1 |
| Secrets in HTML | No private-key / `sk_live` patterns |

---

## PASS / FAIL checklist

| Criterion | Status |
|-----------|--------|
| No broken images on game homepage | **PASS** |
| No 404 asset requests for stage/menu art | **PASS** |
| Full-width desktop stage (not narrow column) | **PASS** |
| Left/right decorative heroes + corner labels | **PASS** |
| Tablet / mobile usable | **PASS** |
| Nav + wallet + Mint / Enter / Season / Download destinations retained | **PASS** |
| No secrets exposed | **PASS** |
| Narrow fix only (no redesign / game logic) | **PASS** |

**Overall: PASS**

---

## Follow-ups (non-blocking)

1. **Commit `.vercelignore`** so future CLI deploys cannot reintroduce bare `assets`.
2. Keep size-limit excludes (`reports`, `contracts`, `mobile`, …) but never use unanchored names that collide with `public/*`.
3. Raw `*.vercel.app` deployment URL may still return HTML for static probes under deployment protection; validate via production aliases (`game.` / `www.`).
