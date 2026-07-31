# HANSOME — Holder Explainability Top-100 Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Track** | **B — Holder Explainability** |
| **Scope** | Presentation-only holder tooltips / Raw vs Adjusted concentration copy / Unknown≠No tone / EN·ZH i18n + Top-100 validation |
| **Deployed** | **YES** |
| **Production deploy ID** | `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` |
| **Previous tip (Track B rollback only)** | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` (Track A Website Analytics — do **not** roll past this into older tips on Track B failure) |
| **Alias** | https://www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker in this release** | **NO** (still `.vercelignore`) |
| **Correction loops** | **1** redeploy after Track A reclaimed Production alias |
| **Final verdict** | **PASS_DEPLOYED** |

---

## 1. Implementation summary

Holder-related Scan fields now have info tooltips (`title` + `aria-label`, same `i` button pattern as Burn / multi-pool LP UX) using approved EN/ZH conceptual meanings:

| Field | Meaning (presentation) |
|-------|------------------------|
| **Largest Holder** | Largest detected balance in current dataset — not automatically team / exchange / malicious |
| **Top 10 Holders** | Combined ten largest under displayed method; LP/burn/bridge/locker/protocol inclusion changes results |
| **Holder Concentration** | Raw vs Adjusted Top-10; denominator = total supply when available |
| **Known Burned / LP / Treasury / Team·Deployer / Exchange / Bridge / Locker / Protocol** | Evidence-based category tooltips — not beneficial-ownership certainty |
| **Unknown Wallet** | Could not be reliably classified — not unsafe / malicious / team-controlled (amber tone) |
| **Excluded From Circulating / Included In Raw** | Adjusted excludes recognized pool/burn from Top-10 set; raw does not |
| **Holder Coverage / Incomplete** | Percentages may change when more addresses are indexed |

Also:

- Raw Top 10 vs Adjusted Top 10 labels + denominator line in Overview
- Unlabeled holders render as **Unknown Wallet** with amber tone
- Safe percentage display (`formatHolderPctForDisplay`)
- **No** changes to holder classification, concentration formulas, scoring, registries, or adapters

---

## 2. Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/holders/presentation.ts` | **New** presentation helpers (tooltip keys, category mapping, pct sanitize, coverage) |
| `lib/hansome-score/holders/index.ts` | Re-exports |
| `components/scan/ScanClient.tsx` | Holder tooltips, Unknown tone, Raw/Adjusted presentation |
| `content/i18n/types.ts` | Holder explainability string keys |
| `content/i18n/en.ts` | Approved EN tooltip / label copy |
| `content/i18n/zh.ts` | Approved ZH tooltip / label copy |
| `lib/hansome-score/__tests__/holder-presentation.test.ts` | **New** 16 focused cases |
| `scripts/_tmp-holder-explainability-primary.mjs` | Core-7 validation |
| `scripts/_tmp-holder-explainability-top100.mjs` | Top-100 Fast+Deep consistency |
| `scripts/_tmp-prod-holder-explainability-smoke.mjs` | Post-deploy Production smoke |
| `reports/data/holder_explainability_primary_tokens.json` | Core-7 findings |
| `reports/data/robinhood_top100_holder_explainability_results.json` | Top-100 machine results |
| `reports/data/holder_explainability_prod_smoke.json` | Production smoke JSON |
| This report + combined orchestration report | Docs |

**Not modified (forbidden):** `labels.ts` classification rules, address registries, `score.ts` concentration math, burn/lock/LP adapters, creator/proxy, API schema, Track A `lib/website-analytics/**` / analytics API routes.

---

## 3. Forbidden-file audit

| Check | Result |
|-------|--------|
| Holder classification / registries | **Untouched** |
| Concentration / supply denominator formulas | **Untouched** |
| Score weights / security severity | **Untouched** |
| Burn / lock / liquidity / creator / proxy adapters | **Untouched** |
| Track A analytics paths | **Untouched** |
| PonsLaunchLocker still vercelignored | **YES** |

---

## 4. Tests

| Suite | Result |
|-------|--------|
| Focused holder-presentation (16) | **PASS** |
| score / supply-burn / burn-presentation | **PASS** |
| contract-cache / transfer-index* / LP presentation & multi-version / lp-mixed / position-value | **PASS** |
| scan-deep-reliability / scan-progress / scan-fast / scan-deep-stage-independence | **PASS** |
| typecheck | **PASS** |
| Local `next build` | **PASS** (after clean; earlier flaky prerender under concurrent `.next` use) |
| Vercel cloud `next build` | **PASS** |

---

## 5. Validation results

### Primary set (7/7 PASS)

Artifact: `reports/data/holder_explainability_primary_tokens.json`

| Token | Supply | Holders | Largest category | Top10 raw / adj | Denominator | Unknown in sample |
|-------|--------|--------:|------------------|----------------:|-------------|------------------:|
| HANSOME | 1e9 | 92 | lp_pool (~11.8%) | 45.4 / 35.4 | total_supply | 18 |
| FOX | 1e9 | 3094 | unknown_wallet (~7.5%) | 26.7 / 23.7 | total_supply | 19 |
| GME | 1e11 | 13527 | unknown_wallet (~15.0%) | 35.6 / 29.3 | total_supply | 19 |
| CASHCAT | (see JSON) | — | — | — | total_supply | — |
| PONS | (see JSON) | — | — | — | total_supply | — |
| TYGR | (see JSON) | — | — | — | total_supply | — |
| WALLET | 1e9 | 4925 | unknown_wallet (~6.5%) | 25.6 / 21.3 | total_supply | 19 |

Method (existing analyzer): Raw = sum of ten largest detected balances / total supply; Adjusted = same after excluding recognized pool/burn labels from the Top-10 set.

### Top-100 (frozen Robinhood corpus)

| Item | Value |
|------|--------|
| Corpus | `reports/data/robinhood_top100_burn_explainability_corpus.json` |
| Results | `reports/data/robinhood_top100_holder_explainability_results.json` |
| Scanned | **100** / 100 |
| PASS / WARN / FAIL | **100 / 0 / 0** |
| Semantic regressions | **0** |
| Critical/high explainability failures | **0** |

---

## 6. Build

| Gate | Result |
|------|--------|
| Local production build | **PASS** |
| Vercel cloud build | **PASS** (~1m) |
| Lint | Existing img/hooks warnings only |

---

## 7. Deploy ID

`dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`

| Item | Value |
|------|--------|
| URL | https://hansomealpacas-h6ta03pup-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/CbEECaFtoGe9ad6KGFYbAzKudsYi |
| Command | `npx vercel --prod --yes` |
| Log | `reports/_tmp-vercel-deploy-holder-explainability-2.log` |
| Prior Track B attempt (superseded by Track A then this tip) | `dpl_8k6QVu7ahTE8HYvroxh86UsvG5kf` |

---

## 8. Alias confirmation

| Check | Result |
|-------|--------|
| `www.hansomealpacas.xyz` → Track B tip | **YES** (`dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi`) |
| Deploy output | `Aliased https://www.hansomealpacas.xyz` |

---

## 9. Production smoke

Artifact: `reports/data/holder_explainability_prod_smoke.json`

| Check | Result |
|-------|--------|
| EN tooltip strings in Production bundle | **PASS** (4/4) |
| ZH tooltip strings in Production bundle | **PASS** (4/4) |
| Core 7 (HANSOME/FOX/GME/CASHCAT/PONS/TYGR/WALLET) | **PASS** |
| Deterministic Top-100 sample ≥20 | **PASS** (20/20) |
| Secrets exposed | **None** |
| False ALL_LOCKED | **None observed** |
| Unknown described as team without evidence | **None** |
| Overall smoke verdict | **PASS** |

---

## 10. Rollback

**NO** — smoke passed; live tip retained.

Track B-only rollback target if needed later: `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` (Track A). Do **not** roll back Track A independently of Track B failure policy.

---

## 11. Remaining limitations

- Exchange / Bridge / Protocol tooltips are available for presentation mapping when labels match; many tokens have no such labels today (honest Unknown Wallet).
- Holder sample remains Blockscout top holders — incomplete coverage stays Incomplete, not “complete concentration”.
- Adjusted exclusion categories remain existing pool/burn semantics only (no new exclusions invented).
- Category labels remain evidence-based — not verified beneficial ownership.

---

## 12. Final verdict

**PASS_DEPLOYED**

Presentation-only Holder Explainability is live on Production; Top-100 semantic regressions = 0; core-7 and smoke PASS; Track A tip preserved as Track B-only rollback target.
