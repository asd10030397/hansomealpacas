# HANSOME Scan — Phase 12A Full Production Readiness Audit

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Mode** | Read-only production readiness audit (no feature work, no promotion) |
| **Audited codebase** | **Workspace** `C:\hansomealpacas` (Phase 11A/11A1/11E/11FGH modules present) |
| **Workspace HEAD (git tip)** | `6667f9565736cacf761b75f542d414940973ff35` |
| **Production tip (live aliases)** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**Phase 10P — unchanged**) |
| **Latest candidates (not promoted)** | 11A1 `dpl_1rnyg8kyPsyAQGkvXT1sT3m2dGQs` · 11E `dpl_8fPcMQ8wmpDUqShVWppbmijCMEMR` · 11FGH `dpl_3rijeWsHEKxNV546Ku2MqFLPq1wS` |
| **Score / Titan lock formulas** | **Unchanged** (no edits this phase) |
| **Code changes this phase** | **NONE** |
| **Final verdict** | **NOT_READY** |

---

## 0. Audit scope & tip identity

### What was audited

| Surface | Tip / ref | Role |
|---------|-----------|------|
| **Workspace code** (primary) | Local tree incl. `lib/hansome-score/lp/{v4-ownership-class,hook-*,adapters,multi,scan*}` | Code that would be promoted if Phase 11 cutover were approved |
| **Production live** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | Phase 10P Titan/Pons Scan — **does not include** Hook Intelligence |
| **Candidate 11A1** | `dpl_1rnyg8kyPsyAQGkvXT1sT3m2dGQs` | Ownership evidence UI |
| **Candidate 11E** | `dpl_8fPcMQ8wmpDUqShVWppbmijCMEMR` | Hook Position Index |
| **Candidate 11FGH** | `dpl_3rijeWsHEKxNV546Ku2MqFLPq1wS` | Valuer + Foreign LP + Hook Lock |

**Documented explicitly:** this audit judges **workspace + candidate semantics**, not “already live on www.” Promoting would move Production tip off Phase 10P onto a new deploy of this workspace. **No promotion was performed.**

### Prior art

- `reports/HANSOME_PHASE10P_PRODUCTION_PROMOTION_LIVE_CUTOVER.md`
- `reports/HANSOME_V4_OWNERSHIP_CLASS_DETECTION.md` (11A)
- `reports/HANSOME_PHASE11A1_V4_OWNERSHIP_EVIDENCE_UI.md`
- `reports/HANSOME_PHASE11C_DOPPLER_AIRLOCK_HOOK_LOCK_VERIFICATION_RESEARCH.md`
- `reports/HANSOME_PHASE11D_HOOK_POSITION_RECONSTRUCTION_RESEARCH.md`
- `reports/HANSOME_PHASE11E_HOOK_POSITION_INDEX.md`
- `reports/HANSOME_PHASE11F_HOOK_POSITION_VALUER.md`
- `reports/HANSOME_PHASE11G_FOREIGN_LP_SEPARATOR.md`
- `reports/HANSOME_PHASE11H_HOOK_LOCK_CLASSIFIER.md`
- `reports/HANSOME_PHASE11FGH_HOOK_INTELLIGENCE_ENGINE.md`

---

## 1. Real fixtures (RH 4663)

### Primary (required)

| Token | Address | Path | Evidence |
|-------|---------|------|----------|
| **HANSOME** | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` | Class A `posm_nft` · Titan+EOA PosM | Fixture skip for Hook intel; pool `0x1165db4c…1a0d` |
| **OKC** | `0xddEB6C5415c3CCB66295b610a06e8E30155f2bA3` | Class B `hook_native` | Allowlisted; **createTx = null** → index/lock incomplete |
| **GME** | `0xc2362AfF2A2a4CC1f48cF3Dab2C4e2605eb94BA3` | Class B `hook_native` | Allowlisted; createTx known; **8** salts 0…7; live `HOOK_PRINCIPAL_LOCKED_ONCHAIN` (11FGH) |

### Additional Hook pools (≥5 requested)

| Status | Detail |
|--------|--------|
| **Allowlisted Hook Native pools in code** | **Only OKC + GME** (`HOOK_POOL_FIXTURES`, `KNOWN_HOOK_NATIVE_POOLS`) |
| **≥5 additional Hook pools** | **NOT AVAILABLE** in production allowlist / registry for RH 4663 |
| Research-only ML activity (not Class B fixtures) | e.g. poolIds `0x0a9e2907…777b`, `0x1a342620…d6cf` (PosM sender activity in `phase11d_hook_position_probe3.json`) — **not** Doppler Hook Native ownership fixtures |
| Registry extras | Rehype Doppler hook / migrators / SFL addresses exist; **lock initializer allowlist = DopplerHookInitializer only** |

**Gap (explicit):** Phase 12A cannot claim broad Hook-pool production coverage. Hook Intelligence is **fixture-scoped** to two tokens.

### Additional PosM / NFT-LP pools (≥5 requested)

| Token / sample | Address | Notes |
|----------------|---------|-------|
| HANSOME | `0x2C38…0875` | V4 PosM Class A (primary) |
| BEER | `0xc2abBcC7…7804` | V3 NPM + Pons (Phase 10 production gate) — not V4 PosM |
| PRIMARY | `0x57ffd85d…e00f` | Core7 regression surface |
| FOX | `0x2103faA9…9bf1` | Core7 |
| CASHCAT | `0x020bfc65…18b4` | Core7 |
| PONS | `0x39dbed3a…4571` | Core7 |
| TYGR | `0x69984ad3…e744` | Core7 |

**Interpretation:** ≥5 **LP regression surfaces** exist (Core7 + HANSOME + BEER). True **V4 PosM Class A** production fixtures beyond HANSOME are **thin** in the allowlisted research set; dual-path research treats HANSOME as the canonical PosM sample.

---

## 2. Architecture consistency

```
V4 detect (PosM/Titan path)
  → classify ownershipClass (A | B | unknown)   [mutually exclusive]
  → Class A: Hook modules SKIP
  → Class B: resolveHookIntelligence
        → 11E Index → 11F Valuer → 11G Foreign → 11H Lock
  → multi.ts: Class B forces UNKNOWN_INCOMPLETE + lock% unavailable
  → scan / scan-deep: USD enrich + computeEconomicLockDistribution  ⚠ overwrites lock%
  → Score: reads aggregateLockState only (Hook principal ≠ Titan credit)
```

| Check | Result |
|-------|--------|
| Module boundaries (11E/F/G/H separate objects) | **PASS** |
| Hook lock enum ≠ Titan `LOCKED_VERIFIED` | **PASS** |
| Class A skip Hook path | **PASS** |
| Class B never merges into Titan lock credit for Score | **PASS** (Score uses `UNABLE_TO_DETERMINE`) |
| End-to-end Class B “no lock%” invariant | **FAIL** — see §10 / Critical #1 |
| Presentation Hook≠Titan mutual exclusion | **PARTIAL FAIL** — see Critical #2 |

---

## 3. Audit areas (evidence)

### 3.1 Ownership Detection — **PASS** (with encoded limits)

| Check | Verdict | Evidence |
|-------|---------|----------|
| A / B / unknown mutually exclusive | **PASS** | `classifyV4OwnershipClass` single return (`v4-ownership-class.ts`) |
| No PoolManager-inventory ownership | **PASS** | Inventory alone → `unknown`; notes encode honesty |
| Class B predicates | **PASS** | Doppler + dynamic fee + hook PosM NFT `0` + active pool L |
| Impossible “Class B Locked (Titan)” at ownership layer | **PASS** | `applyV4OwnershipClassToIntelligence` → `UNKNOWN_INCOMPLETE` |

**Limitation:** Class B preferred even if PosM dust rows exist in `positions[]` — aggregate class exclusive; position rows may remain.

### 3.2 Position Discovery — **PASS** gates / **FAIL** dust leakage

| Path | Isolation | Notes |
|------|-----------|-------|
| V3 NFT + Titan/Pons | Namespace `v3-*` / NPM | Phase 10 production-proven (BEER) |
| V4 PosM | `positions[]` ERC-721 | Class A primary |
| V4 Hook Index | Separate `hookPositionIndex` KV `scan:v4hook:{scope}:…` | Not merged into PosM rows |

| Check | Verdict |
|-------|---------|
| Class A skips Hook Index | **PASS** |
| Hook keys not duplicated into PosM ownership slots | **PASS** |
| Class B still runs PosM/Titan detect before class apply | **LIMITATION** — dust can retain `LOCKED_VERIFIED_ONCHAIN` at position layer |

### 3.3 Valuation (11F) — **PASS**

| Check | Verdict | Evidence |
|-------|---------|----------|
| Per-position StateView L (not pool `getLiquidity` as total) | **PASS** | `hook-position-valuer/value.ts` |
| Shared `amountsForLiquidity` with PosM path | **PASS** | `position-value.ts` |
| No PoolManager ERC-20 for TVL | **PASS** | Tests assert no PM balance need |
| Price failure → incomplete USD, retain amounts | **PASS** | GME 11FGH: amounts complete, USD incomplete |

### 3.4 Foreign LP (11G) — **PASS** (incomplete-by-design)

| Check | Verdict |
|-------|---------|
| Buckets `hookOwned` / `foreignPosm` / `foreignOther` sum | **PASS** |
| Share only if reconstruction complete | **PASS** |
| Foreign never counted as hook principal for 11H | **PASS** |
| Exhaustive foreign discovery | **NOT claimed** — `indexForeign: false` → `foreign_backfill_skipped` |

### 3.5 Hook Lock (11H) — **PASS** (+ allowlist limit)

All `HookPrincipalLockState` values covered in classifier + UI mapping:

`HOOK_PRINCIPAL_LOCKED_ONCHAIN` · `HOOK_TIMED_LOCK` · `HOOK_PERMANENT_LOCK` · `HOOK_UNLOCKABLE` · `HOOK_MIGRATION_PENDING` · `HOOK_EXITED` · `HOOK_GRADUATED_INCOMPLETE` · `UNKNOWN_INCOMPLETE`

| Check | Verdict |
|-------|---------|
| 11C predicates for Locked+NoOp+PosM0+complete | **PASS** (GME live) |
| Initialized+NoOp → UNLOCKABLE (not locked) | **PASS** |
| Graduated → incomplete (no false locked) | **PASS** |
| Never maps to Titan `LOCKED_VERIFIED` | **PASS** |
| Rehype ownership vs initializer allowlist mismatch | **LIMITATION** → Class B possible with lock `UNKNOWN_INCOMPLETE` |

### 3.6 Titan Lock — **PASS** modules / **FAIL** edges

| Check | Verdict |
|-------|---------|
| Titan adapters / Pons / Phase 10 semantics untouched by Hook modules | **PASS** |
| Score does not grant Titan credit from Hook principal lock | **PASS** |
| `legacyStatus(aggregate)` uses pre–Class-B-force aggregate | **FAIL** — `multi.ts:654` |
| UI pool Lock Status from position locks ignores `ownershipClass` | **FAIL** — `presentation.ts:279-295` + `ScanClient` |

### 3.7 Score — **PASS** formulas / **FAIL** lock% rehydration

| Check | Verdict |
|-------|---------|
| Hook fields not read by `computeStructuralScore` | **PASS** |
| Class B → intended `UNABLE_TO_DETERMINE` LP unknown path | **PASS** |
| Hook modules do not alter Holder / Risk / Ownership formulas | **PASS** |
| `scan.ts` / `scan-deep.ts` recompute `lockDistribution` without Class B guard | **FAIL** — Critical #1 |

### 3.8 Cache — **PASS** design / **HIGH** gaps

| Control | Verdict |
|---------|---------|
| Deployment-scoped keys | **PASS** (`HANSOME_SCAN_DEPLOYMENT_SCOPE`) |
| Generation fencing (in-process expected gen) | **PASS** with limits |
| Incomplete≠complete publish guard | **PASS** |
| Reorg hash check + rollback + gen bump | **PASS** on background path |
| Interactive resolve reorg parity | **FAIL (HIGH)** — interactive may skip hash check |
| Cross-instance KV CAS | **FAIL (HIGH)** — fence reads memory/testKv, not Redis CAS |
| Fence failure ignored by caller | **MEDIUM** |

### 3.9 RPC — **PASS** degrade / **MEDIUM** gaps

| Control | Verdict |
|---------|---------|
| Adaptive `getLogs` chunk shrink/retry | **PASS** |
| Client-side ModifyLiquidity FP reject | **PASS** |
| StateView/price fail → incomplete, non-blocking | **PASS** |
| Hook intel failure non-blocking on Scan | **PASS** |
| Stubborn span skip can drop logs | **MEDIUM** (completeness usually blocks complete) |
| Hook client RPC timeout missing | **MEDIUM** |
| OKC createTx null in fixture | **HIGH** product completeness |

### 3.10 API — **PASS** wiring / **MEDIUM** orphans

| Check | Verdict |
|-------|---------|
| `LpIntelligence` fields wired through multi | **PASS** |
| GET sets `X-Scan-Deployment-Scope` | **PASS** |
| POST missing scope header | **MEDIUM** |
| Public fields not all rendered in UI | **MEDIUM** (documented orphans OK if honesty preserved) |

### 3.11 UI — **PARTIAL**

| Check | Verdict |
|-------|---------|
| Separate Hook Native intelligence block (not Titan label) | **PASS** on single-pool path |
| Hook UI on multi-pool / empty aggregate layouts | **FAIL (HIGH)** — block gated on `single` |
| Near-duplicate Hook position rows | **MEDIUM** |
| Side-by-side Unknown Lock Status + Hook Principal Locked | **MEDIUM** (by design; UX risk) |
| Hard UI assert: hook_native ⇒ hide Titan lock% bar | **MISSING** (relies on data `available:false`) |

### 3.12 Regression — **PASS** (unit/build)

| Suite / gate | Result |
|--------------|--------|
| Phase 11A / 11A1 `v4-ownership-class.test.ts` | **PASS** |
| Phase 11E `hook-position-index-phase11e.test.ts` | **PASS** |
| Phase 11F `hook-position-valuer-phase11f.test.ts` | **PASS** |
| Phase 11G `hook-foreign-lp-phase11g.test.ts` | **PASS** |
| Phase 11H `hook-lock-classifier-phase11h.test.ts` | **PASS** |
| Phase 10C-2 verified locker | **PASS** |
| Phase 10C-4 isolated cache publish | **PASS** |
| Phase 10C-5 terminal contract | **PASS** |
| Phase 10C-1 / 10B V3 index | **PASS** |
| Phase 10C-3 soft-wall / budget | **PASS** |
| LP presentation / mixed / multi / Pons / position-value / score | **PASS** |
| scan-cache / contract-cache / phase81a drift | **PASS** |
| Combined vitest (this audit) | **296 passed** (14+6+3 files; no failures) |
| `tsc --noEmit` | **PASS** |
| `next build` | **PASS** |
| Phase 11C research assertions (Locked+NoOp ⇒ principal locked; fees≠principal; PM≠ownership) | **Encoded in 11H + tests — PASS** |
| Live www promotion soak of 11FGH | **NOT RUN** (out of scope; tip unchanged) |

Artifacts: `reports/data/phase12a_regression_vitest.txt`, `phase12a_regression_phase10_extra.txt`, `phase12a_tsc.txt`, `phase12a_next_build.txt`.

---

## 4. Critical & high findings (blockers)

### CRITICAL

1. **Class B `lockDistribution` overwritten after multi clears it**  
   - `multi.ts` correctly sets `lockDistribution.available = false` for `hook_native`.  
   - `scan.ts:377-380` and `scan-deep.ts:1252-1255` unconditionally assign `computeEconomicLockDistribution(...)`.  
   - If any material PosM dust is USD-valued and reconciles to Gecko TVL, UI can show a lock% bar for Hook Native tokens — violating Phase 11A/11FGH honesty.  
   - Pure Class B with zero valued PosM usually stays `available:false`, but the **Class B reason string and invariant guard are lost**.  
   - **Prefer NOT_READY** over silent hotfix in this audit phase.

### HIGH

2. **Class B + PosM dust → UI Lock Status can show Titan LOCKED** while ownership label is Hook Native (`presentation.ts` `poolLockStatus` + `ScanClient`).  
3. **`legacyStatus(aggregate)` ignores Class B force** (`multi.ts:654`) → `overview.lpLockStatus` can disagree with Score/`aggregateState`.  
4. **Interactive Hook index path may skip reorg hash check** (`production.ts`) → stale post-reorg serve risk.  
5. **KV generation fence is not Redis CAS** — multi-instance last-write-wins.  
6. **Hook intelligence UI only on single-pool card path** — multi-pool layouts omit Hook Native block.  
7. **OKC createTx still null** despite research hashes — production Hook coverage for OKC remains partial forever until wired.  
8. **Hook allowlist = 2 pools** — cannot claim RH-wide Hook Intelligence readiness.

---

## 5. Performance

| Path | Observation (from Phase 11 reports + code) |
|------|--------------------------------------------|
| GME create receipt + tip catch-up | ~7s interactive-class budget (11E) |
| OKC without create | Fail-fast partial (~0.3s) |
| Valuer | Bounded concurrency (4) StateView reads; reuses index cache |
| Scan coupling | Hook intel non-blocking; Class A skip |
| Production Scan (Phase 10P) | BEER cold/warm/forced gates previously PASS — not re-run as live cutover this phase |

**No performance blocker unique to Phase 12A** beyond existing public-RPC limits.

---

## 6. Safety

| Invariant | Status |
|-----------|--------|
| PoolManager ERC-20 ≠ ownership / TVL / lock% | **Held** in classifiers/valuer |
| `getLiquidity` ≠ total Hook L | **Held** |
| Hook Locked ≠ Titan Locked (Score credit) | **Held** |
| Fee beneficiaries / collectFees ≠ principal | **Held** (11C/11H) |
| Partial never published as complete (index) | **Held** |
| Class B never Score-credited as Locked | **Held** |
| Class B never shows lock% | **BROKEN under dust+reconcile** (Critical #1) |
| Generation fencing / deployment scope | **Mostly held**; interactive reorg + KV CAS gaps |

---

## 7. Known limitations (EVERY one explicit)

1. **Production tip is still Phase 10P** — Hook Intelligence **not** live on www/apex/game.  
2. **Hook pool allowlist = OKC + GME only** — non-allowlisted Class B skips index/valuer/lock.  
3. **OKC createTx/createBlock missing** in fixtures → perpetual `SUCCESS_PARTIAL` / `UNKNOWN_INCOMPLETE`.  
4. **Foreign discovery off by default** → no pool share / no exhaustive foreign completeness.  
5. **GME foreign discovery incomplete** even when principal lock completes (by design).  
6. **USD prices may be incomplete** while raw amounts complete (GME 11FGH).  
7. **Class B + coexisting V3 Titan LP** forced to token-level `UNKNOWN_INCOMPLETE` (coverage-safe, product-harsh).  
8. **PosM dust may coexist under Class B** — aggregate incomplete, but position-level Titan states can remain.  
9. **Rehype / non-initializer Doppler hooks** may classify ownership Class B without classifiable principal lock.  
10. **Graduated pools** → `HOOK_GRADUATED_INCOMPLETE` (no false locked).  
11. **SFL timed/permanent paths** implemented but not proven on OKC/GME samples.  
12. **Interactive reorg check** weaker than background sync.  
13. **KV fence not cross-instance CAS**; fence failures ignored by callers.  
14. **Hook RPC clients lack explicit timeout** (ownership probe has 12s).  
15. **POST `/api/scan` omits deployment-scope response header** (GET has it).  
16. **UI Hook block single-pool only**; some API summary fields orphaned in UI.  
17. **Side-by-side badges:** Lock Status Unknown vs Hook Principal Locked — intentional separation, UX confusion risk.  
18. **Smart LP remains off**; adapters remain Pons-only for V3 verified lock.  
19. **≥5 additional Hook Native fixtures unavailable** on RH allowlist.  
20. **V4 PosM Class A corpus beyond HANSOME is thin** for dual-path soak.  
21. **Workspace git tree is dirty / ahead** relative to clean deploy hygiene — any promote must be a deliberate clean deploy, not ad-hoc.  
22. **No live Production-scope soak** of 11FGH candidate under `HANSOME_SCAN_DEPLOYMENT_SCOPE=production` in this audit.

---

## 8. Remaining technical debt

| Priority | Debt |
|----------|------|
| P0 | Guard `computeEconomicLockDistribution` assignment with `ownershipClass !== "hook_native"` (scan + scan-deep); restore Class B reason |
| P0 | Class B presentation: force pool Lock Status / `legacyStatus` through Class B aggregate; hide Titan lock% bar |
| P1 | Wire validated OKC createTx into `HOOK_POOL_FIXTURES` |
| P1 | Interactive reorg parity + honor fence failures |
| P1 | Render Hook Native block for all `hook_native` layouts |
| P2 | Expand Hook allowlist with ≥5 additional RH pools once createTx/poolIds proven |
| P2 | Optional foreign backfill with budget + completeness honesty |
| P2 | Redis CAS / cross-isolate lock for Hook index KV |
| P2 | RPC timeouts on Hook clients; POST scope header parity |
| P3 | Deduplicate Hook UI rows; unused i18n keys |

---

## 9. Risk assessment

| Risk | Likelihood | Impact | Notes |
|------|------------|--------|-------|
| False lock% on Hook Native after promote | Medium (needs PosM dust + reconcile) | **High** (honesty) | Critical #1 |
| User reads Titan “Locked” on Hook Native UI | Medium | **High** | Critical #2 / badges |
| Stale Hook index after reorg | Low–Medium | Medium | Interactive path |
| Cache cross-talk candidate↔production | Low | High | Scope keys exist; Phase 10P proven |
| Incomplete OKC shown as complete | Low | High | Completeness gates hold |
| Score formula drift | Low | High | No Hook Score wiring found |
| Promote without soak | High if rushed | High | Candidates never production-aliased |

---

## 10. Production readiness by layer

| Layer | Workspace readiness | Live Production (10P) |
|-------|---------------------|------------------------|
| Phase 10 Titan / Pons / BEER | **Ready** (regression PASS) | **Already promoted** |
| Phase 11A/A1 ownership class + evidence | **Ready with limitations** | Not on tip |
| Phase 11E index | **Ready with limitations** (GME yes / OKC no / allowlist 2) | Not on tip |
| Phase 11F/G/H intelligence | **Not ready to promote** until P0 honesty fixes | Not on tip |
| End-to-end Phase 11 cutover | **NOT_READY** | N/A |

---

## 11. Deployment recommendation

| Item | Decision |
|------|----------|
| Promote www / apex / game to workspace / 11FGH candidate? | **NO** |
| Keep Production tip `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`? | **YES** |
| Minimal safe next step | Fix Critical #1 + High presentation/legacyStatus; re-candidate; soak BEER+HANSOME+GME+OKC under `candidate:{dpl}` then production-scope tip; **then** Phase 12B promote gate |
| Auto-fix in this audit? | **No** (per STRICT); defects documented as NOT_READY |

---

## 12. Final verdict

# **NOT_READY**

**Rationale (concise):** Core Hook classifiers, valuation math, foreign separation, Titan/Score formula isolation, and Phase 10/11 unit regressions are sound. Production promotion of the Phase 11 stack is blocked by (1) Class B lock% rehydration in `scan`/`scan-deep`, (2) presentation/`legacyStatus` Titan leakage for Hook Native, (3) fixture/allowlist incompleteness (OKC + only two Hook pools), and (4) cache interactive-reorg / KV fencing gaps. Live Production remains correctly on Phase 10P tip `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`.

---

## Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **NOT_READY** |
| **Report** | `reports/HANSOME_PHASE12A_FULL_PRODUCTION_AUDIT.md` |
| **Audited** | Workspace (+ candidates 11A1/11E/11FGH semantics); Production tip unchanged |
| **Promote?** | **NO** |
| **Top 5 blockers / limitations** | See below |

### Top 5 blockers / limitations

1. **CRITICAL:** `scan.ts` / `scan-deep.ts` overwrite Class B `lockDistribution` (can revive lock% / wipe Class B reason).  
2. **HIGH:** Class B UI / `legacyStatus` can surface Titan LOCKED from PosM dust while ownership is Hook Native.  
3. **HIGH:** Hook Intelligence allowlist = OKC+GME only; OKC createTx missing → incomplete coverage.  
4. **HIGH:** Interactive index reorg + non-CAS KV fencing gaps.  
5. **HIGH:** Hook Native UI block missing on multi-pool layouts; no Production-scope soak of 11FGH.
