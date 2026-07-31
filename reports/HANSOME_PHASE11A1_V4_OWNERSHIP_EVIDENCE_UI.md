# HANSOME — Phase 11A.1 V4 Ownership Evidence UI

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Scope** | Presentation / structured evidence only |
| **Classification / lock / score formulas** | **Unchanged** |
| **Locker adapters** | **Unchanged** |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Candidate** | `dpl_1rnyg8kyPsyAQGkvXT1sT3m2dGQs` (not promoted) |
| **Verdict** | **PASS_NOT_DEPLOYED** |

Prior phase:

- `reports/HANSOME_V4_OWNERSHIP_CLASS_DETECTION.md` (Phase 11A)

---

## 1. Implementation summary

Phase 11A already exposed `ownershipClass` (`posm_nft` | `hook_native` | `unknown`) with a one-line Scan label. Phase 11A.1 adds **why** — an optional structured evidence object and a compact Scan UI section — without changing classification, lock state, lock %, Score, or Titan behavior.

| Path | Role |
|------|------|
| `lib/hansome-score/types.ts` | `V4OwnershipEvidence` + `V4OwnershipEvidenceSource` on `LpIntelligence` |
| `lib/hansome-score/lp/v4-ownership-class.ts` | `buildV4OwnershipEvidence()` from proven detector fields only |
| `lib/hansome-score/lp/multi.ts` | Propagates `v4OwnershipEvidence` |
| `lib/hansome-score/lp/presentation.ts` | `v4OwnershipEvidenceLines()` → plain-language i18n keys |
| `components/scan/ScanClient.tsx` | Expandable **V4 Ownership Evidence** panel |
| `content/i18n/{en,zh,types}.ts` | EN + Traditional Chinese strings |

**Not changed:** `classifyV4OwnershipClass`, Titan verification, Pons/V3 adapters, lock distribution math, Score formulas, Production domain aliases.

---

## 2. Evidence schema

```ts
v4OwnershipEvidence?: {
  source:
    | "position_nft"
    | "titan_lock"
    | "airlock_owner"
    | "doppler_hook"
    | "dynamic_fee_pool"
    | "hook_posm_zero_balance"
    | "active_hook_liquidity"
    | "unknown";
  positionIds?: string[];
  poolIds?: string[];
  hookAddress?: string;
  airlockAddress?: string;
  notes?: string[]; // machine keys for i18n — never lock claims
}
```

Population rules (honesty):

1. Only proven observations from the Phase 11A detector + existing PosM rows.
2. No raw RPC dumps.
3. No invented evidence for `unknown`.
4. `no_pool_manager_inventory` → evidence `null` (section hidden).
5. Class B notes never become Locked / Permanent / lock%.
6. Class A adds `discovery_incomplete` unless `discoveryComplete === true`.

Existing tag array `ownershipClassEvidence` is retained for diagnostics; UI prefers `v4OwnershipEvidence`.

---

## 3. UI (render description)

**Section title:** V4 Ownership Evidence / V4 流動性所有權依據

| Viewport | Behavior |
|----------|----------|
| **Desktop (`md+`)** | Always visible under Liquidity — separate from “View technical details” |
| **Mobile** | `<details>` collapsed by default |

Plain language first; optional technical lines (shortened `poolId` / hook).

### Class A (HANSOME) — example

- V4 Ownership: **Position NFT**
- Evidence:
  - Position NFT `#47299`, `#357867` detected (etc.)
  - Pool matched on-chain
  - Ownership verified through `ownerOf()`
  - Titan lock ownership observed (when Titan rows present)
  - Position discovery may be incomplete…
- Lock Status: unchanged Titan/MIXED / PARTIALLY LOCKED path

### Class B (OKC / GME) — example

- V4 Ownership: **Hook Native**
- Evidence:
  - Airlock / Doppler pool detected
  - Dynamic-fee hook pool
  - No Position NFT detected for this hook
  - Active hook-owned pool liquidity observed
- Lock Status: **UNKNOWN** / incomplete — **no** Locked / Unlocked / Permanent / lock%

### Unknown

- V4 Ownership: **Unknown** (when inventory-backed evidence present)
- Evidence: ownership path could not be proven
- No false position/hook/Airlock claims

---

## 4. Test results

| Suite | Result |
|-------|--------|
| `v4-ownership-class.test.ts` (incl. Phase 11A.1 evidence cases) | **PASS** |
| `lp-presentation.test.ts` | **PASS** |
| `lp-mixed.test.ts` | **PASS** |
| `lp-multi-version.test.ts` | **PASS** |
| `pons-locker-adapter.test.ts` | **PASS** |
| Combined above | **56 passed** |
| `tsc --noEmit` | **PASS** |
| `next build` | **PASS** |

Fixture coverage:

| Token / fixture | Asserted |
|-----------------|----------|
| **HANSOME** | `posm_nft`; ≥1 `positionIds`; Titan/MIXED aggregate unchanged |
| **OKC** | `hook_native`; Doppler/Airlock + dynamic fee notes; `UNKNOWN_INCOMPLETE`; lock% unavailable |
| **GME** | Same Class B safety |
| **Unknown** | `source=unknown`; only unproven note; no false IDs; no-inventory → `null` |

---

## 5. Regression

| Check | Result |
|-------|--------|
| Ownership classification rules | Unchanged |
| Lock state / lock % formulas | Unchanged |
| Score formulas | Unchanged |
| Titan Phase 10 verification | Unchanged |
| Pons / V3 adapters | Unchanged |
| Smart LP | Off (unchanged) |
| Class B → Locked | Forbidden |
| Mobile / desktop evidence panel | Implemented (collapsed mobile / open desktop) |

---

## 6. Candidate deployment

| Field | Value |
|-------|--------|
| Method | `npx vercel deploy --prod --skip-domain --yes` |
| Candidate ID | `dpl_1rnyg8kyPsyAQGkvXT1sT3m2dGQs` |
| Candidate URL | https://hansomealpacas-ldp063bm8-the-67.vercel.app |
| Inspector | https://vercel.com/the-67/hansomealpacas/1rnyg8kyPsyAQGkvXT1sT3m2dGQs |
| Promoted www / game / apex? | **No** |

Artifacts:

- `reports/data/v4_ownership_evidence_ui_candidate.json`
- `reports/data/v4_ownership_evidence_ui_candidate_deploy.txt`

---

## 7. Production tip confirmation

| Alias | Deployment ID | Host |
|-------|---------------|------|
| `www.hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | `hansomealpacas-hp5h51664-the-67.vercel.app` |
| `hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | same |
| `game.hansomealpacas.xyz` | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` | same |

Verified via `vercel inspect` on each custom domain after candidate deploy. Tip remains Phase 10P.

---

## 8. Final verdict

**PASS_NOT_DEPLOYED**

Structured V4 ownership evidence is implemented, tested, and available on a candidate deployment only. Production www / apex / game tip unchanged. **Do not promote** unless separately approved.

---

## Parent return card

| Item | Value |
|------|--------|
| Verdict | **PASS_NOT_DEPLOYED** |
| Report | `reports/HANSOME_PHASE11A1_V4_OWNERSHIP_EVIDENCE_UI.md` |
| Candidate (not promoted) | `dpl_1rnyg8kyPsyAQGkvXT1sT3m2dGQs` |
| Production tip | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (unchanged) |
| HANSOME evidence | `posm_nft` + position IDs (e.g. `#47299`…) |
| OKC evidence | `hook_native` + Airlock/Doppler + dynamic fee; lock incomplete / no lock% |
