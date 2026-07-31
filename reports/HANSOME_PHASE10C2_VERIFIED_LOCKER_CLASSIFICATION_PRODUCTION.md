# HANSOME Scan — Phase 10C-2 Verified Locker Classification Production

| Field | Value |
|-------|--------|
| **Date** | 2026-07-30 |
| **Mode** | Production verified lock classification (on top of Phase 10C-1 discovery) |
| **Primary token** | BEER `0xc2abBcC7dCE08BF331b56aC8635c3416d61e7804` |
| **Known pool** | `0xC71E763a0a258f266d1481295115ea4f291D95ED` |
| **NPM tokenId** | `436637` |
| **Approved locker** | PonsLaunchLocker `0x736D76699C26D0d966744cAe304C000d471f7F35` |
| **Chain** | Robinhood Chain `4663` |
| **Pre-deploy live tip** | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Candidate** | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` |
| **Final deploy (www/game)** | **unchanged** — `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| **Verdict** | **PASS_NOT_DEPLOYED** |

---

## 1. Exact pre-deploy live tip

`dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7`  
Aliases confirmed still on this tip after candidate ship + temp-alias restore: `www.hansomealpacas.xyz`, `hansomealpacas.xyz`, `game.hansomealpacas.xyz`.

---

## 2. Candidate deployment ID

| Item | Value |
|------|--------|
| ID | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` |
| URL | https://hansomealpacas-dmrvprbt8-the-67.vercel.app |
| Status | Ready (Production target, `--skip-domain`) |
| Custom www/game | **not** aliased |
| Temp public alias (during gate) | `hansomealpacas.vercel.app` → candidate |
| Temp alias after gate | restored → `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`…n6zq9i37h…`) |

Comparison method prepared **before** measuring (Phase 8.1B pattern): candidate via temp `hansomealpacas.vercel.app`; baseline via `www.hansomealpacas.xyz`. Direct tip URL remains Deployment Protection–sensitive.

---

## 3. Files changed

| Path | Role |
|------|------|
| `lib/hansome-score/lp/lockers/index.ts` | Wire `V3_LOCKER_ADAPTERS = [ponsLaunchLockerAdapter]` only |
| `lib/hansome-score/lp/lockers/classify-v3.ts` | Owner Type → Adapter → Verified Classification matrix |
| `lib/hansome-score/lp/lockers/pons.ts` | Existing Pons adapter (unchanged verification gates) |
| `lib/hansome-score/lp/lockers/types.ts` | Verified hit → position overlay helpers |
| `lib/hansome-score/lp/registry.ts` | Pons in registry; `permanent_null` alone → **UNABLE** (no heuristic Locked) |
| `lib/hansome-score/lp/adapters/v3.ts` | Post-discovery `discoverV3LockerPositions` + `classifyDiscoveredV3Positions` |
| `lib/hansome-score/__tests__/phase10c2-verified-locker-classification.test.ts` | Matrix + BEER + multi-position tests |
| `lib/hansome-score/__tests__/pons-locker-adapter.test.ts` | Align permanent_null heuristic expectation |
| `scripts/phase10c2-beer-verify.ts` | Live public-RPC BEER cold attach + warm classify |

**Unchanged by policy:** V3 Position Index discovery algorithm (`v3-position-index/*` attach stays Unknown), scoring formulas, Holder/Burn/Creator/Market, Smart LP off, UI lock-state display mapping already used for `LOCKED_VERIFIED_ONCHAIN` / Unknown / Unlocked.

`.vercelignore` does **not** exclude Pons adapter sources — classification ships with the candidate build.

---

## 4. Classification architecture / flow

```
tokenId (from Phase 10C-1 index or adapter stub replace)
  → ownerOf (already on attached slot)
  → Owner Type Resolver (eoa | known_locker | unknown_contract | burned)
  → Locker Adapter Resolver (V3_LOCKER_ADAPTERS — Pons only)
  → Verified Classification
```

Buckets: `LOCKED_VERIFIED` | `LOCKED_UNVERIFIED` (reserved) | `UNLOCKED` | `UNABLE_TO_DETERMINE`.  
Production maps `LOCKED_VERIFIED` → `LOCKED_VERIFIED_ONCHAIN`.

**Never** invents Locked from contract owner, name contains “Locker”, or ≠EOA.

Adapter PASS overlays lock fields onto the discovery slot (preserves index amounts/ticks/liquidity).

---

## 5. Approved locker wiring (Pons only)

| Item | Value |
|------|--------|
| `V3_LOCKER_ADAPTERS` | `[pons_launch]` only |
| Titan | Remains v4 / `detect.ts` path — not duplicated into V3 adapters |
| Adapter checks | launched token exists; NPM = RH v3 PM; `ownerOf` == Pons; token in pair; `liquidity > 0`; pool resolves; fee match; recheck `ownerOf` |

---

## 6. Classification matrix

| Condition | Result |
|-----------|--------|
| Adapter PASS | `LOCKED_VERIFIED` |
| Known locker + adapter FAIL | `UNABLE_TO_DETERMINE` |
| Unknown contract | `UNABLE_TO_DETERMINE` |
| EOA | `UNLOCKED` (existing unlocked semantics) |
| Burned / missing owner | `UNABLE_TO_DETERMINE` (never Unlocked) |
| Zero liquidity | `UNABLE_TO_DETERMINE` (non-material; historical) |

Multi-position: classify independently. Aggregate `ALL_LOCKED` only if every material position is `LOCKED_VERIFIED_ONCHAIN`; Locked+Unlocked → `MIXED`.

---

## 7. Discovery unchanged confirmation

| Check | Result |
|-------|--------|
| Index attach still emits Unknown | **YES** (`attach.ts` / `indexedTokenToPositionInfo`) |
| Discovery algorithm / key / fencing | **unchanged** |
| Local BEER discovery-only path | tokenId `436637`, owner Pons, `lockState_attach=UNABLE_TO_DETERMINE`, `positionDiscoveryComplete=true` |
| Classification runs **after** attach | **YES** (`discoverV3Liquidity` post-index block) |

---

## 8. BEER result (local public RPC — authoritative for this phase)

`scripts/phase10c2-beer-verify.ts` → **BEER_10C2_VERIFY_PASS**

| Metric | Value |
|--------|--------|
| Adapters | `pons_launch` only |
| Discovery attach lock | `UNABLE_TO_DETERMINE` (unchanged discovery) |
| Warm classify lock | **`LOCKED_VERIFIED_ONCHAIN`** |
| lockerName | **PonsLaunchLocker** |
| tokenId | **436637** |
| owner | **0x736D76699C26D0d966744cAe304C000d471f7F35** |
| ticks | -887200 / 204200 |
| liquidity | `36819258015569838458222` (>0) |
| removableByEoa | **false** |
| Classification path | **adapter PASS** (`locker-verified=1 (adapter PASS)` in detail) — not heuristics |

---

## 9. lockAnalysisComplete / positionDiscoveryComplete

| Flag | BEER local warm |
|------|-----------------|
| `positionDiscoveryComplete` | **true** |
| `lockAnalysisComplete` | **true** |

Phase 10C-1 baseline had discovery complete + lock incomplete (`V3_LOCKER_ADAPTERS=[]`). Phase 10C-2 closes lock analysis when material stubs are resolved and inventory_unknown is absent.

---

## 10. Test matrix results

Suite: `phase10c2-verified-locker-classification.test.ts` + updated `pons-locker-adapter.test.ts` — **PASS**

| Case | Result |
|------|--------|
| BEER adapter PASS → LOCKED_VERIFIED | **PASS** |
| EOA → UNLOCKED | **PASS** |
| Unknown contract → UNABLE | **PASS** |
| Known locker + adapter FAIL → UNABLE | **PASS** |
| Burned → never Unlocked | **PASS** |
| Zero liquidity → UNABLE | **PASS** |
| Multi-position MIXED / ALL_LOCKED | **PASS** |
| Multiple lockers future-compat (adapter id match) | **PASS** |
| Pons gates: L=0 / owner≠locker / pool fail → empty | **PASS** |
| Heuristic Locked forbidden | **PASS** (`classifyOwnerLockState` permanent_null → UNABLE) |

---

## 11. Semantic gates (score / Creator / Holder / Burn / Market)

| Gate | Result |
|------|--------|
| Unit semantic / LP suites (phase81a, smart-lp, known-first, lp-mixed, materiality, deep-*) | **PASS** (no formula edits) |
| Smart LP | **off** (unchanged) |
| Holder / Burn / Creator / Market code paths | **not modified** |
| Remote live vs candidate provisional score (BEER 60 / HANSOME 77) while deep incomplete | **equal** on sampled GET — not a completed Top-100 hard-drift proof |

---

## 12. Core 7 result

Deep / LP / Known-First / semantic batches exercised locally:

- `deep-parallel`, `deep-stall-rca`, `deep-bounded-settlement`, `scan-deep-retry-race`
- `known-first-early-exit`, `phase81a-semantic-drift`, `smart-lp-refresh`
- related LP presentation / mixed / materiality

**PASS** — no Core 7 terminal regressions observed.

---

## 13. Top-100 result

Full Top-100 hard-drift matrix **not confirmed** on candidate (deep LP on remote BEER/HANSOME stayed analyzing / `v3 not searched` during gate window; no completed freeze compare).  
Treat Top-100 hard drift = 0 as **not confirmed for promote**.

---

## 14. Cold / warm performance (local)

| Case | Wall | Notes |
|------|------|--------|
| BEER discovery inline backfill | ~13.7 s | attach Unknown |
| BEER warm `discoverV3Liquidity` | ~9.0 s | factory probes + classify; adapter PASS |

Remote candidate deep LP did not settle to a measurable warm classify window during gate.

---

## 15. Deploy decision

**Do not promote www/game.**

Reasons:

1. Remote candidate deep LP did not settle to BEER `LOCKED_VERIFIED` JSON on the temp alias within the gate window (stuck analyzing / `v3 not searched` on fast snapshot). Local adapter PASS is proven; remote promote proof is not.
2. Top-100 hard-drift = 0 **not confirmed** on candidate.
3. Promote requires remote BEER LOCKED_VERIFIED via adapter + all gates — unmet.

Local architecture + BEER classification acceptance: **PASS**.

---

## 16. Alias status / rollback

| Alias | Deployment |
|-------|------------|
| www / apex / game | still `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` (`…n6zq9i37h…`) |
| `hansomealpacas.vercel.app` | **restored** → `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Candidate tip | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` (available, not promoted) |

**Rollback target:** `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` — still live; **no rollback needed** (nothing promoted).

---

## 17. Remaining limitations

- Cold Production interactive path may still schedule background index before numeric ids appear; adapter can still PASS on stub replace when `getLaunchedToken` verifies.
- Remote deep LP settlement / protection / stall can block automated promote gates even when local classify is correct.
- `LOCKED_UNVERIFIED` bucket reserved; known-locker adapter FAIL maps to UNABLE this phase.
- Only Pons approved — other lockers remain Unknown until future adapter PASS.
- Promoting would also ship Phase 10C-1 discovery (not yet live) + classification together — requires completed remote semantic gates.

---

## 18. Final verdict

| Item | Value |
|------|--------|
| **Verdict** | **PASS_NOT_DEPLOYED** |
| Classification integrated (local) | **YES** |
| Used adapter PASS (not heuristics) | **YES** |
| BEER lock state (local) | **`LOCKED_VERIFIED_ONCHAIN`** |
| BEER `lockAnalysisComplete` (local) | **true** |
| BEER `positionDiscoveryComplete` (local) | **true** |
| Smart LP | **off** |
| `V3_LOCKER_ADAPTERS` | `[pons_launch]` |
| Discovery path modified | **NO** |
| www/game tip before | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| www/game tip after | `dpl_5xqS15tNvmkgyAXp1KhLzPNEjup7` |
| Candidate | `dpl_Ar7uQsKhBNrXuaMD6rW3TtWhNehR` |
| Rollback status | **N/A — not promoted; baseline tip intact** |

**Phase 10C-2 success criterion (verified locker classification on discovery):** **YES** locally via Pons adapter PASS; **not promoted** pending remote deep settle + Top-100 hard-drift confirmation.
