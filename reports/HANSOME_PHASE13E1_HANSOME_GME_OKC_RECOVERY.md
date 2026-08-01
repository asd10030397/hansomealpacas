# HANSOME Phase 13E.1 — HANSOME Cold / GME Hook Native / OKC Honest Terminal Recovery

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13E.1 — Product recovery (not stress) |
| **Final verdict** | **READY_FOR_STRESS_CERTIFICATION** |
| **Worktree** | `C:\hansomealpacas-phase13a` |
| **Candidate** | `dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| **Candidate URL** | `https://hansomealpacas-lg3uppz12-the-67.vercel.app` |
| **Candidate scope** | `candidate:dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` (`isProductionAlias=false`) |
| **Prior 13E tip (baseline)** | `dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **Stress (13E.1 stress / 13E stress) run?** | **NO** — product matrix required first |
| **13F RC produced?** | **NO** |

Evidence:

- `reports/data/phase13e1_product_cert.json` — **VERDICT PASS**
- `reports/data/phase13e1_cert_console3.txt`
- `reports/data/phase13e1_deploy6_out.txt` (Candidate tip)
- `scripts/phase13e1-product-cert.mjs`
- `lib/hansome-score/lp/known-bootstrap-resolver.ts` (`tryVerifyKnownTitanBootstrap` / `tryVerifyKnownHookBootstrap` / publish protection)
- `lib/hansome-score/__tests__/phase13e1-known-titan-hook.test.ts` (tests 1–12)

---

## 1. Cert matrix (final Candidate)

| Token | Cold | Warm | Force | Result |
|-------|------|------|-------|--------|
| **BEER** | **3/3** | **3/3** | **3/3** | **PASS** — `#436637` / Pons `LOCKED_VERIFIED_ONCHAIN` |
| **HANSOME** | **10/10** | **5/5** | **5/5** | **PASS** — PosM/Titan `#47299` durable |
| **GME** | **5/5** | **5/5** | **5/5** | **PASS** — `hook_native`, salts 0–7, no Titan false lock |
| **OKC** | **5/5** | **5/5** | **5/5** | **PASS** — `hook_native` + `UNKNOWN_INCOMPLETE` honest |

| Gate | Result |
|------|--------|
| Unit tests 1–12 (`phase13e1-known-titan-hook`) + bootstrap/deep-parallel/13C suites | **PASS** (60/60 in suite run) |
| `tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |
| Candidate isolated (`isProductionAlias=false`) | **PASS** |
| Production tip unchanged | **PASS** (`dpl_995Jvb…`) |
| Sticky clears / orphan / zombie (cert globals) | **PASS** (0) |

---

## 2. RCA — first broken transitions (resolved)

### 2.1 HANSOME cold

**Expected:** Known-Titan seeds → on-chain verify → durable PosM/Titan publish → cold stable.

**First broken transition (13E baseline):**  
**Ownership Verification → LP Publish** under cold Candidate RPC — Known-Titan path was not as reliable as Known-Pons pre-parallel; late timeout / incomplete rediscovery could erase PosM IDs / Titan body (cold **3/5**).

**Fix (discovery/publish reliability ONLY):**

| Change | Purpose |
|--------|---------|
| `tryVerifyKnownTitanBootstrap` + **pre-parallel** exclusive budget (75s, cap 120s) | Mirror BEER Known-Pons reliability |
| Advisory `poolManagerBalance=1n` when Cold Fast not yet stamped | Avoid detect early-exit on `bal==0` without inventing lock |
| `preferVerifiedLpAgainstIncomplete` Class A path | Late empty/timeout must not erase useful PosM/Titan body |
| Known-First durable publish persist cap | Survive Candidate KV latency |

**Not changed:** Titan lock semantics, Score formulas, UI scoring.

### 2.2 GME Hook live path

**Expected:** Known-Hook fixture (createTx / poolId / DopplerHook / salts 0–7) → publish Class B evidence without waiting for foreign exhaustive.

**First broken transition (13E baseline):**  
**Hook fixture / allowlist → durable product publish** — Candidate deep timed to empty/unknown before Hook intel published; product gate saw `0/15`.

**Secondary cert-only breakage (mid 13E.1):**  
Gate `falseLocked` matched Doppler **PoolStatus** string `"Locked"` (lifecycle enum) while `aggregateLockState !== LOCKED_VERIFIED_ONCHAIN`. That is **not** a Titan lock claim.

**Fix:**

| Change | Purpose |
|--------|---------|
| `tryVerifyKnownHookBootstrap` + pre-parallel | Publish fixture Hook intel immediately |
| `applyFixtureBootstrap` salts 0–7, `indexForeign: false` | No foreign exhaustive wait |
| Publish protection: Hook Native wins over empty/timeout | Shared never-downgrade |
| Cert `falseLocked` narrowed to product false claims | Ignore Doppler PoolStatus `"Locked"` |

**Live Candidate spot:** `ownershipClass=hook_native`, `hookOwnedCount=8`, `aggregateState=UNKNOWN_INCOMPLETE`, `lockDistribution.available=false`.

### 2.3 OKC honest terminal

**Expected:** Allowlisted Hook pool with unknown createTx → bounded partial / `UNKNOWN_INCOMPLETE` with reason — never invent Titan Locked.

**First broken transition (13E baseline):**  
**Honest Class B terminal → product-visible evidence** — incomplete Hook settle without durable `hook_native` / reason; soft gates accepted empty terminals.

**Fix:** Known-Hook bootstrap always publishes OKC allowlist evidence with explicit `create_tx_unknown` + `UNKNOWN_INCOMPLETE` completeness warning; cert accepts honest incomplete.

**Live Candidate spot:** `hook_native` + `UNKNOWN_INCOMPLETE` + warning mentioning createTx unknown / foreign not claimed.

---

## 3. Shared publish protection

`preferVerifiedLpAgainstIncomplete` now retains:

1. Verified `LOCKED_VERIFIED_ONCHAIN` slots (BEER / HANSOME)
2. Class B Hook Native evidence over empty/timeout rediscovery
3. Useful Class A PosM/Titan bodies (IDs not erased by late timeout)

Wired through `deep-parallel` merge + `scan-cache` stale-generation salvage. Deployment isolation / lease model / Score formulas untouched.

---

## 4. Isolation confirmation

| Check | Result |
|-------|--------|
| Deploy | `npx vercel deploy --prod --skip-domain --yes` → `dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| Health scope | `candidate:dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| `isProductionAlias` | `false` |
| www tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` Ready — **unchanged** |
| Aliases changed? | **NO** |

---

## 5. Parent return card

| Item | Value |
|------|--------|
| **Verdict** | **READY_FOR_STRESS_CERTIFICATION** |
| **Report** | `reports/HANSOME_PHASE13E1_HANSOME_GME_OKC_RECOVERY.md` |
| **Candidate** | `dpl_J6nrnMphTW7Uxj6d8ZbF9k8uPz6N` |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` unchanged |
| **Cert numbers** | HANSOME cold **10/10** / warm **5/5** / force **5/5**; GME **15/15**; OKC **15/15** honest; BEER **9/9**; tests/tsc/build **PASS** |
| **First broken transitions** | HANSOME: Known-Titan verify→publish under cold RPC (**fixed**); GME: Hook fixture→durable publish + Doppler `"Locked"` cert false-positive (**fixed**); OKC: honest Class B terminal not durable (**fixed**) |
| **Stress / promote** | **HOLD** — do not promote; stress may open next |

---

## 6. Resume notes (canceled prior agent)

Prior Phase 13E.1 run was canceled mid-cert on Candidate `dpl_J6nr…` after HANSOME cold **10/10** and GME failing only `noFalseLocked`. This resume:

1. Did **not** restart Known-Titan / Known-Hook implementation from zero
2. Narrowed cert false-lock heuristic
3. Stabilized deep-parallel overlap unit test under Known-First mocks
4. Re-ran full product matrix → **PASS** → **READY_FOR_STRESS_CERTIFICATION**
