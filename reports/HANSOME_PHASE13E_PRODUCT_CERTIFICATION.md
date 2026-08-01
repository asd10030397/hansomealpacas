# HANSOME Phase 13E — Full Product Certification

| Field | Value |
|-------|--------|
| **Date** | 2026-08-01 |
| **Phase** | 13E — Full Product Certification |
| **Final verdict** | **STOPPED_WITH_RCA** |
| **Worktree** | `C:\hansomealpacas-phase13a` (13C + 13C.1 + 13D/D.1/D.2 + 13E BEER publish reliability) |
| **Latest Candidate** | `dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Candidate URL** | `https://hansomealpacas-fzas1sfs4-the-67.vercel.app` |
| **Candidate scope** | `candidate:dpl_qXzBSFonvfLidTysYuiRopWALgYR` (`isProductionAlias=false`) |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**confirmed unchanged**) |
| **Promoted www / apex / game?** | **NO** |
| **13F RC produced?** | **NO** |

Evidence:

- `reports/data/phase13e_product_cert.json`
- `reports/data/phase13e_cert_console.txt`
- `reports/data/phase13e_deploy5_out.txt`
- `scripts/phase13e-product-cert.mjs`
- `scripts/phase13e-beer-smoke.mjs`

---

## 1. Cert matrix

| Token | Cold×5 | Warm×5 | Force×5 | Result |
|-------|--------|--------|---------|--------|
| **BEER** | **5/5 PASS** | **5/5 PASS** | **5/5 PASS** | **PASS** — `#436637` / Pons `LOCKED_VERIFIED_ONCHAIN` |
| **HANSOME** | **3/5** | **5/5 PASS** | **5/5 PASS** | **FAIL** — cold#1/#2 no durable Titan positions in budget |
| **GME** | **0/5** | **0/5** | **0/5** | **FAIL** — Hook ownership evidence not product-complete on Candidate |
| **OKC** | **1/5** | **0/5** | **4/5*** | **FAIL** — Hook path incomplete / terminal without ownership proof |

\*OKC force “pass” samples are weak (failed/unknown liquidity, no positions) — gates too soft for incomplete Hook settle; **not** product-complete.

Global gates (from cert run):

| Gate | Result |
|------|--------|
| Sticky cleared shell | **PASS** (0 sticky clears across BEER/HANSOME) |
| Orphan analyzing class | **PASS** (0 cert-counted orphans after streak tolerance) |
| Zombie lease class | **PASS** (0) |
| Duplicate publish / gen regression | **N/A / clean** on BEER Locked path |

---

## 2. RCA — BEER first broken transition (RESOLVED for BEER)

### Expected chain

Known Bootstrap → Ownership Verification → Position Discovery → LP Publish → `LOCKED_VERIFIED_ONCHAIN` → Stable Runtime

### First broken transition (evidence, not guess)

**Ownership Verification → LP Publish was discarded by a too-short Known-Pons budget race under Candidate RPC latency.**

Live Candidate logs (`dpl_J8Dc…` / `dpl_Cyfv…`):

```text
[known-pons] hit ms=67584 positions=1 ids=436637
[known-pons] budget_or_abort ms=44862 budget=20000 aborted=false
[scan-deep] known-pons pre-parallel miss … — liquidity job will retry
```

Adapter **did** verify `#436637` / Pons, but `tryVerifyKnownPonsBootstrap` hard-capped `budgetMs` at **20s**, so `Promise.race` returned `null` before the hit could publish. Parallel-wave RPC contention pushed verify to 45–102s.

Earlier tips also showed Known Bootstrap then immediate `liquidity:timeout` with **no** `known-pons begin` (Ownership Verification never started inside coalesce/stage budget).

### Fix applied (publish/discovery reliability ONLY)

| Change | Purpose |
|--------|---------|
| Known-Pons **pre-parallel** verify (before relationships/creatorBurn) | Exclusive RPC; avoid sibling contention |
| Budget raised to **75s** (cap **120s**; removed erroneous **20s** hard cap) | Match Candidate RPC latency |
| Progressive stamp + `liquidity:known-pons-pre-parallel` publish | Durable Locked before later soft-fail can wipe |
| Pons adapter multicall / parallel owner+positions | Fewer round-trips |
| Multi early-settle for BEER after v3 Pons Locked | Do not await hung v2/v4 wall |

**Not changed:** Score formulas, Titan/Hook classification, lock formulas, ownership semantics, lease model, deployment isolation.

### Re-verify

After `dpl_qXzBSFonvfLidTysYuiRopWALgYR`:

```text
[known-pons] hit ms=18787 positions=1 ids=436637
[scan-deep] known-pons pre-parallel early-exit ms=18818 tid=436637
```

BEER Cold×5 / Warm×5 / Force×5 **all PASS**.

---

## 3. Why overall STOPPED_WITH_RCA

Phase 13E requires **all four tokens**. HANSOME cold incomplete + GME/OKC Hook product gates fail on Candidate. Promotion forbidden. Stress (13E.1) and RC (13F) **not** opened.

### Remaining debt

1. **HANSOME cold** — Titan Known-First not as reliable as BEER pre-parallel on first cold attempts (3/5). Consider Known-Titan pre-parallel (same reliability class; not started here to avoid Titan redesign scope creep mid-cert).
2. **GME / OKC Hook** — Candidate deep does not publish durable Hook ownership evidence within cert budgets; Hook path still times to `unknown` / empty positions.
3. **OKC gate softness** — cert script treats some failed/unknown terminals as pass; tighten before next cert.
4. **Project `*-the-67.vercel.app` alias drift** — known 12C debt; www tip unchanged.

---

## 4. Isolation confirmation

| Check | Result |
|-------|--------|
| Health scope | `candidate:dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| `isProductionAlias` | `false` |
| www tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` Ready |
| Aliases changed? | **NO** |

---

## 5. Parent return card

| Item | Value |
|------|--------|
| **Overall status** | **STOPPED_WITH_RCA** |
| **BEER first broken transition** | Ownership Verification hit discarded by 20s budget race / parallel contention (**fixed** for BEER) |
| **Cert matrix** | BEER **PASS**; HANSOME **FAIL** (cold 3/5); GME **FAIL**; OKC **FAIL** |
| **13F RC** | **NOT produced** |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` unchanged |
| **Latest Candidate** | `dpl_qXzBSFonvfLidTysYuiRopWALgYR` |
| **Promotion decision** | **HOLD / STOP before cutover** |
