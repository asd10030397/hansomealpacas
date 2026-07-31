# HANSOME — Burn Explainability Top-100 Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Presentation-only Burn Explainability (tooltips, Unknown≠No tone, EN/ZH i18n) + guarded Top-100 validation |
| **Primary example** | `0x0339f5459fc690ac85f1782e15782a151b4a9e1b` (WALLET) |
| **Deployed** | **YES** |
| **Production deploy ID** | `dpl_38ZyALv1m91mkm4F6axjkjN1wGey` |
| **Previous known-good (rollback)** | `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` |
| **Alias** | https://www.hansomealpacas.xyz → **YES** |
| **PonsLaunchLocker in this release** | **NO** (still `.vercelignore`) |
| **Correction loops** | **0** |
| **Final verdict** | **PASS_DEPLOYED** |

---

## 1. Implementation summary

Burn-related Scan fields now have info tooltips (native `title` + `aria-label`, same `i` button pattern as multi-pool LP UX) explaining:

| Field | Meaning (presentation) |
|-------|------------------------|
| **Known Burned** | Observed on-chain inventory at recognized burn/dead addresses — does **not** require a contract burn function |
| **Burn Function** | Contract capability (`burn()` / `burnFrom()`) — independent of inventory |
| **Automatic Burn** | Appears able to auto-burn during transfers/ops |
| **Admin Burn** | Privileged role appears able to burn from another address / reduce supply |

Also:

- **Unknown** rendered with amber tone (`text-amber-900`) so it is visually distinct from **No**
- Burned % display sanitized via `formatBurnedPctForDisplay` (no NaN / Infinity / negative)
- **No** changes to burn classification, dead-address registry, supply math, scoring, lock, liquidity, or adapters

Main confusion resolved in copy: **Known Burned > 0 while Burn Function = No is VALID**.

---

## 2. Files changed

| File | Change |
|------|--------|
| `lib/hansome-score/supply-burn/presentation.ts` | **New** presentation helpers (tooltip key list, tones, pct/remaining gates) |
| `lib/hansome-score/supply-burn/index.ts` | Re-export presentation helpers |
| `components/scan/ScanClient.tsx` | Burn field tooltips + Unknown tone + safe pct display |
| `content/i18n/types.ts` | Four tooltip string keys |
| `content/i18n/en.ts` | Approved EN tooltip copy |
| `content/i18n/zh.ts` | Approved ZH tooltip copy |
| `lib/hansome-score/__tests__/burn-presentation.test.ts` | **New** 10 focused cases |
| `scripts/_tmp-freeze-burn-top100-corpus.mjs` | Freeze Top-100 corpus |
| `scripts/_tmp-burn-explainability-top100.mjs` | Top-100 Fast+Deep consistency runner |
| `scripts/_tmp-burn-explainability-example-scan.mjs` | Example-token probe |
| `scripts/_tmp-prod-burn-explainability-smoke.mjs` | Post-deploy Production smoke |
| `reports/data/robinhood_top100_burn_explainability_corpus.json` | Frozen corpus |
| `reports/data/robinhood_top100_burn_explainability_corpus.md` | Corpus index |
| `reports/data/robinhood_top100_burn_explainability_results.json` | Top-100 machine results |
| `reports/data/burn_explainability_example_token.json` | Example findings |
| `reports/data/burn_explainability_prod_smoke.json` | Production smoke JSON |

**Not modified:** `mechanisms.ts`, `analyze.ts`, `dead-inventory.ts`, `score.ts`, `contract-risk.ts`, lock adapters, LP materiality, holder/creator classification.

---

## 3. Example-token findings

| Item | Value |
|------|--------|
| Address | `0x0339f5459fc690ac85f1782e15782a151b4a9e1b` |
| Name / Symbol | Robinhood Wallet / **WALLET** |
| Total supply | 1,000,000,000 |
| Known Burned | **54,811,140.81** (~**5.48%**) |
| Supply excluding known burns | **945,188,859.19** |
| Recognized burn addresses | `0x0…0` (0), `0x…dEaD` (full known burned) |
| Burn Function | **No** |
| Automatic Burn | **No** |
| Admin Burn | **No** |
| Burn mechanism | `dead_address_only` |
| Proxy | **false** (verified) |
| Coverage / uncertainty | Activity windows incomplete (P2 index) → Unknown/Incomplete for 24h/7d/30d/all; inventory + mechanisms complete |
| Independent state | **Known Burned > 0 + Burn Function = No** → **VALID / understandable** |
| Permanently unrecoverable claim | **Not claimed** (policy: observed dead inventory ≠ verified totalSupply reduction) |

Artifact: `reports/data/burn_explainability_example_token.json`

---

## 4. Top-100 source and frozen corpus path

| Item | Value |
|------|--------|
| Preferred source order | Existing indexed RH ranking → GeckoTerminal → DexScreener → internal discovery |
| Used | `reports/ROBINHOOD_TOP100_COMPAT_SET.json` (prior trusted project artifact; GeckoTerminal + DexScreener REST enrichment; no new undocumented scrape) |
| Upstream method | `playwright_cloudflare_blocked_plus_geckoterminal_trending_new_pools` |
| Upstream timestamp | 2026-07-27T23:48:20.168Z |
| Frozen corpus | `reports/data/robinhood_top100_burn_explainability_corpus.json` |
| Markdown index | `reports/data/robinhood_top100_burn_explainability_corpus.md` |
| Frozen at | 2026-07-28T12:33:35.081Z |
| Ranking metric | Prior compat-set rank (liquidity/volume enriched), renumbered after dedupe |
| Exclusions / duplicates | **0** |

---

## 5. Number scanned

**100** / 100 corpus tokens (Fast + Deep status polls per documented retry policy).

---

## 6. PASS / WARN / FAIL counts

| Verdict | Count |
|---------|------:|
| PASS | **100** |
| WARN | **0** |
| FAIL | **0** |
| Critical/high consistency failures | **0** |

Notable distribution (informational):

- Known Burned > 0 + Burn Function = No: **42** tokens (accepted)
- Burn Function = unknown: **25**
- Burn Function = yes: **9**

Results: `reports/data/robinhood_top100_burn_explainability_results.json`

---

## 7. Automatic correction loops performed

**0** (no Top-100 consistency/presentation failures; no forbidden-semantic blockers).

Unit-test note (pre-gate, not a correction loop): case #4 assertion tightened so Automatic Burn may remain Unknown when transfer auto-burn path is unclear — presentation-test only.

---

## 8. Every correction made

None required for validation gates.

---

## 9. Confirmation forbidden semantics untouched

| Surface | Touched? |
|---------|----------|
| Scoring weights | **No** |
| Burn-address registry | **No** |
| Burn amount calc / supply math | **No** |
| Bytecode classification semantics | **No** |
| Proxy resolution semantics | **No** |
| Holder categories / lock detection | **No** |
| Liquidity materiality / adapters | **No** |
| Creator classification / security severity | **No** |
| On-chain writes | **No** |
| PonsLaunchLocker Production | **Excluded** (`.vercelignore`) |

---

## 10. Test results

| Suite | Result |
|-------|--------|
| `burn-presentation.test.ts` (10 cases) | **PASS** |
| `supply-burn.test.ts` | **PASS** |
| `lp-presentation.test.ts` | **PASS** |
| Critical regressions (`scan-cache`, `scan-deep-reliability`, `analysis-progress`, `score`) | **PASS** (64) |
| `tsc --noEmit` | **PASS** |

Required cases covered:

1. Known Burned > 0 + Burn Function = No  
2. Known Burned = 0 + Burn Function = Yes  
3. Known Burned > 0 + Burn Function = Yes  
4. Proxy implementation resolved  
5. Proxy implementation unresolved → Unknown ≠ No  
6. Automatic Burn Unknown  
7. Admin Burn Unknown  
8. Burn amount = total supply  
9. Invalid/missing total supply  
10. EN/ZH tooltip keys complete  

---

## 11. Production build result

| Gate | Result |
|------|--------|
| Local `next build` | **PASS** (40/40 static pages; after clean `.next`) |
| Vercel cloud `next build` | **PASS** (~18s compile) |
| Lint | Existing img/hooks warnings only |

---

## 12. Production deploy ID

`dpl_38ZyALv1m91mkm4F6axjkjN1wGey`

| Item | Value |
|------|--------|
| URL | https://hansomealpacas-l3q2f13bm-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/38ZyALv1m91mkm4F6axjkjN1wGey |
| Command | `npx vercel --prod --yes` |
| Log | `reports/_tmp-vercel-deploy-burn-explainability.log` |
| Rollback target | `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH` |

---

## 13. Alias confirmation

| Check | Result |
|-------|--------|
| `www.hansomealpacas.xyz` → live tip | **YES** (`dpl_38ZyALv1m91mkm4F6axjkjN1wGey`) |
| Deploy output | `Aliased https://www.hansomealpacas.xyz` |

---

## 14. Production smoke results

Artifacts:

- `reports/data/burn_explainability_prod_smoke.json`
- `reports/_tmp-prod-burn-explainability-smoke.log`
- `scripts/_tmp-prod-burn-explainability-smoke.mjs`

| Check | Result |
|-------|--------|
| EN tooltip strings in Production bundle | **PASS** (4/4) |
| ZH tooltip strings in Production bundle | **PASS** (4/4) |
| EXAMPLE WALLET Known Burned > 0 + Burn Function = No | **PASS** |
| HANSOME / FOX / GME / CASHCAT / PONS / TYGR | **PASS** |
| Deterministic Top-100 sample ≥20 | **PASS** (20/20) |
| Secrets exposed | **None** |
| False ALL_LOCKED | **None observed** |
| Overall smoke verdict | **PASS** |

---

## 15. Rollback result

**NO** — smoke passed; live tip retained.

Rollback target if needed later: `dpl_BEd8o1bTyPmFzzfGUkEih9LbeanH`.

---

## 16. Remaining unsupported cases

- Burn **activity** windows (24h/7d/30d/all) remain Unknown/Incomplete when transfer index incomplete (honest Unknown — non-blocking).
- Unverified / unresolved proxy or missing ABI+source → mechanism fields stay **Unknown** (not No) — expected.
- Dead-address inventory alone never claimed as permanent totalSupply reduction.
- Elastic/rebasing tokens: hard Known Burned ≤ totalSupply gate skipped only if marked unsupported (none required in this corpus).

---

## 17. Final verdict

**PASS_DEPLOYED**

All deployment gates passed; presentation-only Burn Explainability is live on Production with Top-100 validation clean and no forbidden semantic changes.
