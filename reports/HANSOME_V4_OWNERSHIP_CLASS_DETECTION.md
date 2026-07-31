# HANSOME — V4 Ownership Class Detection (Phase 11A)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-31 |
| **Chain** | Robinhood Chain `4663` |
| **Scope** | Ownership class detection only |
| **Score / lock formulas** | **Unchanged** |
| **Doppler lock adapter** | **Not implemented** |
| **Smart LP** | Off (unchanged) |
| **Production tip** | `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (**unchanged**) |
| **Candidate** | `dpl_C9gtJFZXJp7jomYW87neCfANTowK` (not promoted) |
| **Verdict** | **PASS_NOT_DEPLOYED** |

Canonical research:

- `reports/HANSOME_V4_LP_OWNERSHIP_LOCK_VERIFICATION_RESEARCH.md` (dual path)
- `reports/HANSOME_V4_LIQUIDITY_OWNERSHIP_LOCK_RESEARCH.md` (secondary)

---

## 1. Ownership detection

### Classes

| Class | `ownershipClass` | Meaning | Lock verification |
|-------|------------------|---------|-------------------|
| **A** | `posm_nft` | PositionManager ERC-721 path (Titan / EOA `ownerOf`) | Existing logic continues |
| **B** | `hook_native` | Airlock / DopplerHook / dynamic-fee hook-owned PoolManager liquidity | **Unsupported** — never Locked |
| — | `unknown` | Inventory without proven Class A or B | Incomplete |

### Detection rules (strict)

1. **Never** infer ownership from PoolManager ERC-20 balance alone.
2. **Class B** requires a **resolved** Doppler/dynamic-fee pool (`hooks ∈ Doppler registry`, `fee = 0x800000`) **and** hook `balanceOf(PosM) == 0`, typically with Airlock `token.owner()`.
3. **Class A** when material PosM NFT positions exist and Class B is not proven.
4. Class B always sets:
   - `aggregateState = UNKNOWN_INCOMPLETE`
   - `lockAnalysisComplete = false`
   - lock % unavailable
   - **no** Locked claim

### Implementation surface

| Path | Role |
|------|------|
| `lib/hansome-score/lp/v4-ownership-class.ts` | Classifier + RPC detector + apply helper |
| `lib/hansome-score/lp/adapters/v4.ts` | Runs detector after PosM path; wires `ownershipClass` |
| `lib/hansome-score/lp/multi.ts` | Propagates Class B incomplete / no lock% into multi-version aggregate |
| `lib/hansome-score/types.ts` | `V4OwnershipClass` + `LpIntelligence.ownershipClass` |
| Scan UI + i18n | Minimal “V4 Ownership” row — lock labels unchanged |

### Live RPC smoke (2026-07-31)

| Token | Address | `ownershipClass` | Notes |
|-------|---------|------------------|-------|
| **HANSOME** | `0x2C38…0875` | **`posm_nft`** | PosM seeds; not Airlock; no Doppler book |
| **OKC** | `0xddEB…2bA3` | **`hook_native`** | Airlock owner; Doppler pool `0xd307…35cf`; hook PosM NFT bal `0`; active L > 0 |
| **GME** | `0xc236…BA3` | **`hook_native`** | Airlock owner; Doppler pool `0x3623…11c2`; hook PosM NFT bal `0`; active L > 0 |

---

## 2. Regression

| Check | Result |
|-------|--------|
| Unit/integration tests (`v4-ownership-class`, Pons, LP presentation/mixed/multi) | **52 passed** |
| Typecheck | **PASS** |
| `next build` | **PASS** |
| Pons adapter / V3 path | **Unchanged** (no new locker adapters; Pons remains V3 NPM) |
| Lock scoring / Score formulas | **Unchanged** |
| Class B → Locked | **Forbidden / not claimed** |
| Class B lock% | **Not calculated** |
| Smart LP | **Off** |

---

## 3. UI examples

Lock status labels/semantics are unchanged (`LOCKED` / `UNLOCKED` / `PARTIALLY LOCKED` / `UNKNOWN`).

New presentation-only field:

| Field | Values |
|-------|--------|
| **V4 Ownership** | **Position NFT** (`posm_nft`) or **Hook Native** (`hook_native`) |

Examples:

- HANSOME: Lock Status may still show MIXED / PARTIALLY LOCKED from Titan+EOA PosM rows; **V4 Ownership = Position NFT**.
- OKC / GME: Lock Status stays **UNKNOWN** (incomplete); **V4 Ownership = Hook Native** — never shown as Locked from Class B.

i18n: `scan.v4Ownership` / `v4OwnershipPosmNft` / `v4OwnershipHookNative` (en + zh).

---

## 4. Production impact

| Item | Impact |
|------|--------|
| www / game / apex tip | **Still** `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` (Phase 10P) |
| Score category weights / lock % math | None |
| New locker adapters | None |
| Doppler lock verification | None (explicitly out of scope) |
| API payload | Adds optional `lpIntelligence.ownershipClass` (+ evidence tags) |

---

## 5. Candidate deployment

| Field | Value |
|-------|--------|
| Method | `npx vercel deploy --prod --skip-domain --yes` |
| Candidate ID | `dpl_C9gtJFZXJp7jomYW87neCfANTowK` |
| Candidate URL | https://hansomealpacas-c8hjg5tnb-the-67.vercel.app |
| Promoted www/game? | **No** |
| Tip confirmation | `www.hansomealpacas.xyz`, `hansomealpacas.xyz`, `game.hansomealpacas.xyz` → `hansomealpacas-hp5h51664-the-67.vercel.app` (= `dpl_995JvbHVDTsv4mSP77rJqeas8GEA`) |

Artifacts:

- `reports/data/v4_ownership_class_candidate.json`
- `reports/data/v4_ownership_class_candidate_deploy.txt`

---

## 6. Final verdict

**PASS_NOT_DEPLOYED**

Ownership class detection is implemented and validated (HANSOME = `posm_nft`, OKC/GME = `hook_native`). Production tip unchanged. Candidate available for validation only — **do not promote** unless separately approved.

---

## Parent return card

| Item | Value |
|------|--------|
| Verdict | **PASS_NOT_DEPLOYED** |
| Report | `reports/HANSOME_V4_OWNERSHIP_CLASS_DETECTION.md` |
| Candidate (not promoted) | `dpl_C9gtJFZXJp7jomYW87neCfANTowK` |
| HANSOME `ownershipClass` | `posm_nft` |
| OKC `ownershipClass` | `hook_native` |
| GME `ownershipClass` | `hook_native` |
| Tip unchanged | **Yes** — `dpl_995JvbHVDTsv4mSP77rJqeas8GEA` |
