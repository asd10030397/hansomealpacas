# HANSOME — Creator Explainability Top-100 Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Presentation-only Creator Explainability (tooltips, Unknown≠No / Unavailable≠zero, EN/ZH i18n) + Top-100 validation |
| **Deployed** | **YES** |
| **Production deploy ID (alias tip)** | `dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` |
| **First creator ship deploy** | `dpl_CPQGL8qPzvkhezPEE5qxN5W8CZBj` |
| **Pre-deploy tip (rollback)** | `dpl_9sEw667gtjenbcbZD1gfU6ZacZtN` |
| **Mission-start tip (superseded before ship)** | `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR` → tip moved to `dpl_9sEw667…` before deploy |
| **Alias** | https://www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker in this release** | **NO** (still `.vercelignore`) |
| **Correction loops** | **1** analytics-admin env runtime redeploy after creator ship |
| **Final verdict** | **PASS_DEPLOYED** |

---

## 1. Implementation summary

Creator-related Scan fields now have info tooltips (`title` + `aria-label`, same `i` button pattern as Burn / Holder / multi-pool LP UX) using approved EN/ZH copy. UI clarifies:

| Confusion | Presentation fix |
|-----------|------------------|
| Creator ≠ current owner | Creator/Deployer + Current Owner tooltips; Current Owner shown **Unavailable** (no owner address in API — not invented) |
| Creator balance ≠ team allocation | Creator Balance / % tooltips; balance from existing holder sample only |
| Creator sold ≠ malicious dumping | Creator Sold tooltips — activity measure, not intent |
| Creator burned ≠ burn function | Creator Burned tooltip; independent of `supplyBurn.burnFunction` |
| Unavailable ≠ No / zero | Stub zeros with no indexed sample → **Unavailable**; Unknown uses amber tone |
| Deployer / owner / proxy / funding not the same | Separate fields + Proxy / Funding Wallet tooltips only where data exists |
| Creator activity ≠ beneficial ownership | Activity / coverage tooltips; forbidden certainty phrases gated in tests |

**No** changes to creator detection, transfer classification, scoring, burn, holders, proxy detection, or adapters. Analyzer file relocated to `lib/hansome-score/creator/analyze.ts` with identical exports.

---

## 2. Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/creator/analyze.ts` | Relocated from `creator.ts` (logic unchanged) |
| `lib/hansome-score/creator/presentation.ts` | **New** presentation helpers |
| `lib/hansome-score/creator/index.ts` | Re-exports analyze + presentation |
| `components/scan/ScanClient.tsx` | Creator tooltips, Unknown/Unavailable/Incomplete display |
| `content/i18n/types.ts` | Creator explainability keys |
| `content/i18n/en.ts` | Approved EN tooltip / label copy |
| `content/i18n/zh.ts` | Approved ZH tooltip / label copy |
| `lib/hansome-score/__tests__/creator-presentation.test.ts` | **New** 18 focused cases |
| `scripts/_tmp-creator-explainability-primary.mjs` | Core-7 validation |
| `scripts/_tmp-creator-explainability-top100.mjs` | Top-100 Fast+Deep consistency |
| `scripts/_tmp-prod-creator-explainability-smoke.mjs` | Post-deploy Production smoke |
| `reports/data/creator_explainability_primary_tokens.json` | Core-7 findings |
| `reports/data/robinhood_top100_creator_explainability_results.json` | Top-100 machine results |
| `reports/data/creator_explainability_prod_smoke.json` | Production smoke JSON |
| This report | Docs |

**Not modified (forbidden):** transfer-index semantics, contract-cache, proxy detection rules, holder classification, burn mechanisms/analyze, LP/lock adapters, score weights, security findings, API schema, website analytics code, game assets, admin analytics routes.

---

## 3. Forbidden-file audit

| Check | Result |
|-------|--------|
| Creator detection / sell-sink classification | **Untouched** (file move only) |
| Transfer-index / contract-cache / proxy detection | **Untouched** |
| Holder / burn / lock / LP adapters | **Untouched** |
| Score weights / security severity | **Untouched** |
| Website analytics / game assets / admin analytics code | **Untouched** (admin **env** rotated for smoke; no code change) |
| PonsLaunchLocker still vercelignored | **YES** |

---

## 4. Approved EN/ZH copy implemented

| Key | EN (approved) | ZH (approved) |
|-----|---------------|---------------|
| Creator / Deployer | The address identified from available deployment evidence… | 根據目前可取得的部署證據… |
| Creator Balance | The token balance currently held by the detected creator address… | 目前偵測到的建立者地址所持有的代幣餘額… |
| Creator Sold | Tokens detected as leaving the creator address… | 依現有分析器分類，偵測到從建立者地址移出的代幣… |
| Creator Burned | Tokens sent from the creator address to recognized burn or dead addresses… | 從建立者地址轉入已識別銷毀或死亡地址的代幣… |
| Creator Received | Tokens detected as entering the creator address after deployment… | 部署後偵測到轉入建立者地址的代幣… |
| Current Owner | The address currently exposed by an ownership mechanism… | 在可取得的情況下，透過合約所有權機制識別出的目前擁有者… |
| Proxy / Implementation | For proxy contracts, deployment and ownership evidence may come from different addresses… | 對代理合約而言，部署與所有權證據可能來自不同地址… |
| Creator Unknown | …Unknown does not mean No creator or unsafe. | …Unknown 不代表沒有建立者，也不代表不安全。 |
| Creator Incomplete | Creator activity is based on the currently indexed transfer history… | 建立者活動是根據目前已索引的轉帳歷史計算… |
| Creator Available | Creator analysis is available only when sufficient… | 只有在已取得足夠的部署身分與轉帳歷史證據時… |

Production bundle confirmed (EN + ZH strings present in Scan chunks).

---

## 5. Core 7 validation

Artifact: `reports/data/creator_explainability_primary_tokens.json` — **7/7 PASS**

| Token | Creator | Proxy | Sold % | Completeness | Burn fn | Score |
|-------|---------|-------|--------|--------------|---------|------:|
| HANSOME | known | false | 0 (incomplete) | incomplete / 1992 xfers | no | 75 |
| FOX | known | false | 0 (incomplete) | incomplete | no | 77 |
| GME | known | — | — | — | — | — |
| CASHCAT | known | — | — | — | — | — |
| PONS | known | — | — | — | — | — |
| TYGR | known | — | — | — | — | — |
| WALLET | known | — | — | — | no | — |

Full per-token rows (deployer, creation tx, balance availability, received=Unavailable, score/category) in the JSON artifact. Tooltips confirmed in EN/ZH production bundle. Analyzer numbers unchanged by presentation layer.

---

## 6. Top-100 validation

| Item | Value |
|------|--------|
| Corpus | `reports/data/robinhood_top100_burn_explainability_corpus.json` |
| Results | `reports/data/robinhood_top100_creator_explainability_results.json` |
| PASS | **100 / 100** |
| FAIL | 0 |
| Semantic regressions | **0** |
| Critical/high explainability failures | **0** |

Checklist covered: no NaN/Infinity sold %, no negative balances, unavailable≠zero presentation gate, unknown≠No, creator burned ≠ burn-function, deployer not claimed as current owner, proxy type stable, incomplete remains incomplete, address normalization unchanged, no new evidence kinds, scores/findings shape unchanged.

---

## 7. Semantic regression count

**0**

---

## 8. Tests

| Suite | Result |
|-------|--------|
| Focused creator-presentation (**18**) | **PASS** |
| Creator analyzer (via week2a / analyze imports) | **PASS** |
| transfer-index (+ recent-first / reuse / checkpoint) | **PASS** |
| contract-cache | **PASS** |
| score / supply-burn / burn-presentation / holder-presentation | **PASS** |
| LP presentation / multi-version / discovery-cache / known-first / mixed | **PASS** |
| scan-deep-reliability / stage-independence / scan-progress / scan-fast | **PASS** |
| analysis-progress (+ view) | **PASS** |
| Pons locker adapter | **Expected FAIL** (adapter vercelignored / inactive) — not a ship blocker |

---

## 9. Typecheck

**PASS** (`npm run typecheck`)

---

## 10. Production build

**PASS** (local `next build` + Vercel cloud build)

---

## 11. Pre-deploy tip

`dpl_9sEw667gtjenbcbZD1gfU6ZacZtN`

(Mission start recorded `dpl_F6jv17x1Lx4YQW6yvFTxPLbriveR`; tip had already moved before ship — rollback uses the tip recorded immediately before deploy.)

---

## 12. Deploy ID

| Stage | ID |
|-------|-----|
| Creator explainability Production ship | `dpl_CPQGL8qPzvkhezPEE5qxN5W8CZBj` |
| Analytics-admin runtime env follow-up (same tree) | `dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` (**current alias tip**) |

---

## 13. Alias

https://www.hansomealpacas.xyz → `dpl_ALheJcWYzF2hNkQhhVYHgdDDdp7b` (**YES**)

Also aliased: game.hansomealpacas.xyz / hansomealpacas.xyz / hansomealpacas.vercel.app

---

## 14. Production smoke

**PASS** (`reports/data/creator_explainability_prod_smoke.json`)

- Creator EN/ZH tooltip copy live in Scan chunks
- Core 7 PASS
- ≥20 Top-100 sample PASS (20/20)
- Creator Burned remains separate from Burn Function (WALLET burnFunction=no)
- Unknown / Unavailable / Incomplete presentation helpers gated in unit tests

---

## 15. Analytics smoke

**PASS** after admin-secret env rotate + one runtime redeploy  
(`reports/data/website_analytics_prod_smoke.json`)

- Public pages / visit / bot exclusion / opt-out / unauthorized dashboard: PASS
- Admin login + authorized stats: PASS
- No website-analytics **code** changes

---

## 16. Game visual smoke

**PASS** (`npm run test:visual:game-landing`)

- Game landing heroes + landscapes visible; screenshot diff 0.00%
- WWW marketing hero PASS

---

## 17. Rollback target

**`dpl_9sEw667gtjenbcbZD1gfU6ZacZtN`**

Do **not** roll back past Analytics / Holder Explainability / game visual-test additions.

---

## 18. Remaining limitations

- **Current Owner** address is not in the Scan API — UI shows **Unavailable** with tooltip (does not invent Ownable `owner()`).
- **Creator Received** is not a first-class analyzer field — UI shows **Unavailable** (no invented inbound totals).
- **Creator Burned** is presentation-only from existing evidence recipients that match recognized burn/dead addresses; may be incomplete vs full history.
- **Creator Balance** only when deployer appears in the current top-holders sample.
- Proxy shows Yes/No/Unknown from existing `contractRisk.isProxy`; implementation deployer / proxy admin addresses are not invented when absent.
- Heavy tokens often remain **Incomplete** on transfer pagination (pre-existing analyzer/index limits).

---

## 19. Final verdict

**PASS_DEPLOYED**
