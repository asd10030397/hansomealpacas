# HANSOME Game — Landing Background Regression Hotfix

| Field | Value |
|-------|-------|
| Date | 2026-07-28 |
| Target | `https://game.hansomealpacas.xyz/` (+ asset parity on `www.hansomealpacas.xyz`) |
| Production tip (at investigation) | `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` (Track B holder explainability) |
| Production tip (recheck after analytics FYI) | `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` (still aliased; analytics env redeploy not tip yet) |
| Deployed this mission | **NO** |
| Final verdict | **PASS_NOT_DEPLOYED** |

### Coordination note (parent FYI)

- `ANALYTICS_ADMIN_SECRET` was added on Vercel Production; a separate agent may redeploy to pick up env.
- This mission does **not** remove or overwrite analytics env vars.
- If this mission had needed a deploy: record the live tip **immediately before** `vercel --prod` as rollback target (may already be the analytics redeploy tip). Not applicable — no deploy performed.

---

## 1. Root cause

**No active regression found.** Landing background and sprite artwork already load successfully on the current Production tip. Recheck after analytics-env FYI: same tip, same **200** asset responses.

Prior incident class (documented in [`HANSOME_GAME_LAYOUT_PRODUCTION_FIX.md`](./HANSOME_GAME_LAYOUT_PRODUCTION_FIX.md)) was bare `.vercelignore` pattern `assets` excluding `public/assets/**`. That fix is already present in git (`/assets` anchored) and on the live tip.

Checked and ruled out for current tip:

| Hypothesis | Result |
|------------|--------|
| `.vercelignore` bare `assets` excluding `public/assets` | **Not present** — committed + working tree use `/assets` only |
| Case mismatch on Linux (`Background.png` vs `background.png`) | Component paths match on-disk lowercase names; wrong-case probes correctly **404** |
| Assets missing from git / workspace | Local PNGs present, valid PNG magic (`89 50 4E 47`), expected byte lengths |
| Wrong base path / `assetPrefix` | Game HTML references `/assets/...`; middleware bypasses `/assets` |
| CDN stale 404 | Live URLs return **200** `image/png` with full byte lengths |
| www marketing hero broken | `/pixel/pasture-hero-bg.png` **200** (separate from game standoff stage) |

---

## 2. Fix

**None required.** No packaging, path, component, gameplay, or UI changes made.

Working-tree `.vercelignore` still excludes Pons adapter sources (intentional; unchanged by this mission). Uncommitted delta vs HEAD is only those Pons ignore lines — not an assets regression.

---

## 3. Files changed

| File | Change |
|------|--------|
| *(none)* | No code or config edits |

Report only: this file.

---

## 4. Asset URL checks (www + game)

Method: HTTP `HEAD` (and sample `GET`) via PowerShell `Invoke-WebRequest`; record status, `Content-Type`, `Content-Length`.

| Path | game.hansomealpacas.xyz | www.hansomealpacas.xyz |
|------|-------------------------|------------------------|
| `/assets/backgrounds/cougar-mountain-world.png` | **200** `image/png` 2304818 | **200** `image/png` 2304818 |
| `/assets/backgrounds/alpaca-ranch-lush.png` | **200** `image/png` 2498017 | **200** `image/png` 2498017 |
| `/assets/characters/cougar-hero-standoff.png` | **200** `image/png` 1389488 | **200** `image/png` 1389488 |
| `/assets/characters/alpaca-hero-ranch.png` | **200** `image/png` 836126 | **200** `image/png` 836126 |
| `/assets/ui/logo-hansome-game.svg` | **200** `image/svg+xml` 882 | **200** |
| `/assets/icons/menu-wallet.svg` | **200** `image/svg+xml` 405 | **200** |
| `/assets/ui/alpaca-fg-ledge.png` | **200** `image/png` 401025 | **200** |
| `/assets/ui/cougar-fg-ledge.png` | **200** `image/png` 210242 | **200** |

Case-sensitivity probes on game host (expected fail — confirms Linux case rules):

| URL | Status |
|-----|--------|
| `/assets/backgrounds/Cougar-Mountain-World.png` | **404** |
| `/assets/backgrounds/Background.png` | **404** |
| `/assets/backgrounds/cougar-mountain-world.PNG` | **404** |

HTML reference check:

| Host | Page | Standoff asset refs in HTML |
|------|------|-----------------------------|
| `game.hansomealpacas.xyz/` | Game title (`StandoffStage`) | **HAS** all four PNG names |
| `www.hansomealpacas.xyz/` | Marketing home (`HeroSection`) | N/A — uses `/pixel/pasture-hero-bg.png` (**200**); does not embed standoff stage |

Referenced by `components/game/title/StandoffStage.tsx` — paths match production files exactly (case-sensitive).

---

## 5. Smoke (desktop / mobile / hard refresh / incognito)

**Method (browser MCP unavailable):** HTTP status + content-type + byte length + HTML reference checks with User-Agent variants and no-cache headers (proxy for hard refresh / cold cache). Incognito approximated by fresh request without cookies + `Cache-Control: no-cache` / `Pragma: no-cache`.

| Variant | UA | Asset GET | HTML GET | HTML refs |
|---------|----|-----------|----------|-----------|
| Desktop | Chrome Windows | **200** png 2304818 | **200** | all 4 present |
| Mobile | iPhone Safari | **200** png 2304818 | **200** | all 4 present |

Cache header on background PNG: `public, max-age=31536000, immutable` (healthy static caching, not a 404 shell).

No 403/500 observed on probed background/sprite URLs.

---

## 6. Build

Not run — no code/config change and no deploy candidate. Prior tip already **Ready** in Production (`dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`).

---

## 7. Deploy ID

**N/A — not deployed.** Live tip remains:

`dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`  
URL: `https://hansomealpacas-h6ta03pup-the-67.vercel.app`

---

## 8. Alias

Unchanged (current tip already aliased):

- `game.hansomealpacas.xyz`
- `www.hansomealpacas.xyz`
- `hansomealpacas.xyz` (apex)

---

## 9. Rollback

**Not invoked.** At close of this mission the live tip (and default rollback target) was still:

`dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`

If an analytics env redeploy becomes Production tip later, that newer tip supersedes this as the rollback target for subsequent deploys. Do not reintroduce bare `assets` in `.vercelignore`; keep Pons paths vercelignored if still excluded; do not strip analytics Production env.

---

## 10. Final verdict

**PASS_NOT_DEPLOYED** — no change needed; background/sprite assets already OK on www + game; scan/analytics tip left untouched.

### Checklist

| Criterion | Status |
|-----------|--------|
| Background artwork loads (HTTP 200 + image types) | **PASS** |
| No 404/403/500 for landing stage assets | **PASS** |
| Static paths correct + case-sensitive | **PASS** |
| Verified www + game hosts | **PASS** |
| Desktop/mobile UA + no-cache smoke | **PASS** |
| No gameplay / UI redesign | **PASS** (no edits) |
| Deploy only if fix required | **N/A** — skipped intentionally |
| Pons still vercelignored | **YES** |
