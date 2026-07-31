# HANSOME — Parallel Tracks Orchestration

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Track A** | Website Analytics |
| **Track B** | Holder Explainability |
| **Track A detail** | [`HANSOME_WEBSITE_ANALYTICS_PRODUCTION.md`](./HANSOME_WEBSITE_ANALYTICS_PRODUCTION.md) |
| **Track B detail** | [`HANSOME_HOLDER_EXPLAINABILITY_TOP100_PRODUCTION.md`](./HANSOME_HOLDER_EXPLAINABILITY_TOP100_PRODUCTION.md) |

---

## TRACK A — Website Analytics

| # | Field | Value |
|---|--------|--------|
| 1 | Implementation summary | First-party pageview analytics: beacon → KV counters; UV via anonymous cookie UUID; UIP via HMAC IP hash; admin dashboard; privacy page + opt-out. Coexists with Scan analytics + `@vercel/analytics`. |
| 2 | Files changed | `lib/website-analytics/**`, `app/api/analytics/**`, `app/admin/analytics`, `app/privacy`, `WebsiteAnalyticsBeacon`, `PrivacyOptOut`, layout/footer/i18n, `.env.example`, vitest, smoke scripts/reports |
| 3 | Forbidden-file audit | **PASS** (Track A intent) — no intentional score/LP/burn/lock/holder-explainability semantic edits |
| 4 | Tests | **17 PASS** website-analytics (+ scan-analytics 10 PASS coexistence); typecheck **PASS** |
| 5 | Validation results | Dedupe / bot / preview / debounce / race NX / no raw IP / admin auth / TTL unit scenarios **PASS**; prod smoke **PASS** |
| 6 | Build | Local + Vercel cloud **PASS** |
| 7 | Deploy ID | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` |
| 8 | Alias | www / apex / game → **YES** (at Track A close; later superseded by Track B tip below) |
| 9 | Smoke | `reports/data/website_analytics_prod_smoke.json` **PASS** |
| 10 | Rollback | **NO** — target if needed `dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM` (pre–Track A tip only) |
| 11 | Remaining limitations | Estimated uniques; multi-day page UV sums; country only via Vercel edge header; secrets redacted on `env pull` |
| 12 | Final verdict | **PASS_DEPLOYED** |

### Track A required Production env

- `ANALYTICS_IP_SALT`
- `ANALYTICS_ADMIN_SECRET`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` (pre-existing)

Source: [`HANSOME_WEBSITE_ANALYTICS_PRODUCTION.md`](./HANSOME_WEBSITE_ANALYTICS_PRODUCTION.md)

---

## TRACK B — Holder Explainability

| # | Field | Value |
|---|--------|--------|
| 1 | Implementation summary | Presentation-only holder explainability: Scan tooltips for Largest / Top-10 / concentration / category labels / Unknown Wallet / Raw vs Adjusted / coverage; approved EN·ZH copy; amber Unknown tone; safe pct display. No classification or concentration math changes. |
| 2 | Files changed | `lib/hansome-score/holders/**`, `components/scan/ScanClient.tsx`, `content/i18n/{en,zh,types}.ts`, holder-presentation tests, Top-100/primary/smoke scripts, `reports/data/holder_*`, Track B + this combined report |
| 3 | Forbidden-file audit | **PASS** — labels/score/burn/lock/LP/creator/proxy/adapters/API schema and Track A analytics paths untouched; Pons still `.vercelignore` |
| 4 | Tests | Focused holder-presentation **16 PASS**; score/supply-burn/LP/lock/scan-reliability/transfer-index/contract-cache **PASS**; typecheck **PASS** |
| 5 | Validation results | Core 7 **7/7 PASS**; Top-100 **100 PASS**, semantic=0, critical/high=0 |
| 6 | Build | Local + Vercel cloud **PASS** |
| 7 | Deploy ID | `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` |
| 8 | Alias | www.hansomealpacas.xyz → **YES** (current Production tip) |
| 9 | Smoke | `reports/data/holder_explainability_prod_smoke.json` **PASS** (EN/ZH bundles, core 7, sample 20/20) |
| 10 | Rollback | **NO** — Track B-only rollback target `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` (Track A). Never roll back Track A on Track B failure beyond restoring that tip. |
| 11 | Remaining limitations | Many tokens lack exchange/bridge/protocol labels (honest Unknown); sample coverage incomplete remains Incomplete; adjusted exclusions stay existing pool/burn only |
| 12 | Final verdict | **PASS_DEPLOYED** |

Source: [`HANSOME_HOLDER_EXPLAINABILITY_TOP100_PRODUCTION.md`](./HANSOME_HOLDER_EXPLAINABILITY_TOP100_PRODUCTION.md)

---

## Combined status

| Track | Verdict | Deploy ID | Rollback tip (own) |
|-------|---------|-----------|---------------------|
| **A Website Analytics** | **PASS_DEPLOYED** | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` | `dpl_7zW2hjCJUU6AmpzzCCqg9X891PBM` |
| **B Holder Explainability** | **PASS_DEPLOYED** | `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` | `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` |

**Live Production tip (current):** `dpl_CbEECaFtoGe9ad6KGFYbAzKudsYi` (Track B, includes Track A analytics code from workspace at deploy time).

**Independence note:** Each track rolls back only to the tip that was live immediately before *its* deploy. Track B failure must restore `dpl_6i84CTgP21ewFSvXvtSYthnXZ3Tb` and must not roll past Track A.
