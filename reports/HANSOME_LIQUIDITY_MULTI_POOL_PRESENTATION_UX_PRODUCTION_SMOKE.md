# HANSOME — Multi-Pool Liquidity Presentation UX Production Smoke

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Production deploy of presentation-only multi-pool Liquidity copy/tooltip UX |
| **Approval** | `reports/HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX.md` |
| **USD materiality threshold** | **NOT implemented** (design-only: `HANSOME_LIQUIDITY_PRESENTATION_USD_MATERIALITY_DESIGN.md`) |
| **Vercel Production build** | **PASS** |
| **Deployed** | **YES** |
| **Production deploy ID (live tip)** | `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` |
| **Previous known-good (rollback target)** | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |
| **Production alias** | https://www.hansomealpacas.xyz — **YES** |
| **PonsLaunchLocker in this release** | **NO** |
| **lp-presentation tests** | **PASS** (10/10) |
| **Rollback** | **NO** |
| **Overall verdict** | **PASS** |

---

## 1. Production deploy ID

`dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH`

| Item | Value |
|------|--------|
| URL | https://hansomealpacas-eiskakrgp-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/BEd8o1bTyPmFzzfGUkEih9LbeanH |
| Command | `npx vercel --prod --yes` |
| Log | `reports/_tmp-vercel-deploy-multi-pool-ux.log` |
| Rollback target | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |

---

## 2. Alias confirmation

| Check | Result |
|-------|--------|
| `www.hansomealpacas.xyz` → live tip | **YES** (`vercel inspect` → `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH`) |
| Also aliased | `hansomealpacas.xyz`, `game.hansomealpacas.xyz`, project `.vercel.app` |

---

## 3. Vercel build result

| Gate | Result |
|------|--------|
| Upload / cloud `next build` | **PASS** |
| Compile | **PASS** (~16.7s) |
| Lint / typecheck (cloud) | **PASS** (existing img/hooks warnings only) |
| Prerender static pages | **PASS** (40/40) |
| Alias cutover | After READY |

---

## 4. Pre-deploy gates

| Gate | Result |
|------|--------|
| Approved EN/ZH copy + tooltip wired in `ScanClient` / i18n | **PASS** |
| `isPerPoolLiquidityAttributionWithheld` present (presentation-only) | **PASS** |
| `vitest` `lp-presentation.test.ts` | **PASS** (10/10) |
| Scoring / lock detection / liquidity calc / materiality / adapters | **Not modified for this ship** |
| USD materiality threshold | **Not implemented** (design-only stays design-only) |
| PonsLaunchLocker | **Excluded** — `V3_LOCKER_ADAPTERS=[]`; `LOCKER_REGISTRY` Titan only; `pons.ts` + pons tests + Pons adapter report in `.vercelignore` |

---

## 5. Smoke results

Artifacts:

- `reports/_tmp-prod-multi-pool-ux-smoke.json`
- `reports/_tmp-prod-multi-pool-ux-smoke.log`
- `scripts/_tmp-prod-multi-pool-ux-smoke.mjs`

### Bundle / ship controls

| Check | Result |
|-------|--------|
| EN copy in Production JS | **PASS** (`Included in Total Liquidity` + subtitle + tooltip fragment) |
| ZH copy in Production JS | **PASS** (`已包含於總流動性` + subtitle + tooltip fragment) |
| Active Pons adapter markers in Production JS | **ABSENT** |

### Per-token

| Token | Address | Fast/API | UX observation | Verdict |
|-------|---------|----------|----------------|---------|
| **HANSOME** | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | OK · Overall **53** · agg **MIXED** | **1** presentation pool; per-pool USD **≈$15,477**; Total Liquidity banner path unchanged (single-pool sum) | **PASS** |
| **FOX** | `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` | OK · Overall **73** · agg **UNKNOWN_INCOMPLETE** | **1** presentation pool (dust collapsed); per-pool USD **≈$90,079**; Unknown lock unchanged | **PASS** |
| **GME** | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` | OK · Overall **70** · complete | **2** pools; total **≈$469,877** known; per-pool **null** → **Included in Total Liquidity** path; Lock Unknown/incomplete unchanged | **PASS** |
| **CASHCAT** | `0x020bfc650a365f8bb26819deaabf3e21291018b4` | OK · Overall **85** | Multi (**8**) + labeled total → withheld path; no false `ALL_LOCKED` | **PASS** |
| **PONS** | `0x39dbed3a2bd333467115de45665cc57f813c4571` | OK · Overall **82** (token scan, not Pons locker adapter) | Multi (**7**) + labeled total → withheld path; no false `ALL_LOCKED`; Pons locker adapter **not** activated | **PASS** |

### UX checklist

| Check | Result |
|-------|--------|
| Single-pool cards still display per-pool USD | **PASS** (HANSOME, FOX) |
| Multi-pool + total known → Included in Total + subtitle + tooltip copy live | **PASS** (bundle + GME/CASHCAT/PONS presentation path) |
| Unknown lock behavior unchanged | **PASS** |
| Total Liquidity banner still surfaces known aggregate | **PASS** (GME/CASHCAT/PONS totals known; cards not even-split) |
| No LP presentation regressions observed | **PASS** |
| No scoring / lock / calc / materiality / adapter changes in this ship | **Confirmed** |

---

## 6. Rollback decision

| Item | Value |
|------|--------|
| Rollback | **NO** |
| Reason | Build **PASS**; lp-presentation tests **PASS**; Production smoke **PASS**; alias healthy |
| Target if needed | `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9` |

Production left on `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` after smoke **PASS**.

---

## 7. Return summary

| # | Item | Value |
|---|------|--------|
| 1 | Production deploy ID | `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` |
| 2 | Alias | **YES** |
| 3 | Build | **PASS** |
| 4 | lp-presentation tests | **PASS** |
| 5 | Smoke | **PASS** (HANSOME / FOX / GME / CASHCAT / PONS) |
| 6 | Rollback | **NO** (target would be `dpl_29CxyDDbzvLYK8gtm6y4T4U7hGQ9`) |
| 7 | Scoring / lock / calc / materiality / adapters | **No changes** for this presentation ship |
| 8 | Report path | `reports/HANSOME_LIQUIDITY_MULTI_POOL_PRESENTATION_UX_PRODUCTION_SMOKE.md` |
