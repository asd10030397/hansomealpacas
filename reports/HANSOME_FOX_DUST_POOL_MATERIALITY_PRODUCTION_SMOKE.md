# HANSOME — FOX Dust Pool Materiality Production Smoke

| Field | Value |
|-------|--------|
| **Date** | 2026-07-28 |
| **Scope** | Pre-deploy gate → Production deploy of generic dust-pool materiality → FOX-only KV invalidate → fresh FOX recompute → regression smoke |
| **Approval** | `reports/HANSOME_FOX_DUST_POOL_MATERIALITY_FIX.md` |
| **Pre-deploy** | **PASS** |
| **Deployed** | **YES** |
| **Live Production deploy** | `dpl_ABjuXJTeDT8yLC1xvmCQgcxCF2cK` |
| **First materiality ship** | `dpl_E7rxJW3LYaKKugcSQS2BSegjf6br` (aliased; LP stale until invalidate — see below) |
| **Previous known-good** | `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` |
| **Production alias** | https://www.hansomealpacas.xyz |
| **Rollback** | **NO** |
| **Overall verdict** | **PASS** |

---

## Tokens

| Token | Address |
|-------|---------|
| HANSOME | `0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875` |
| FOX | `0x2103faA9D1762e27a716C61718b3aCf3Ec1F9bf1` |
| CASHCAT | `0x020bfc650a365f8bb26819deaabf3e21291018b4` |
| PONS | `0x39dbed3a2bd333467115de45665cc57f813c4571` |
| TYGR | `0x69984ad3322300039f2855f81c44dbc532efe744` |

---

## 1. Pre-deploy gate

| Check | Result |
|-------|--------|
| LP / materiality vitest (`pool-materiality`, `v3-pool-materiality-adapter`, `lp-presentation`, `lp-multi-version`, `liquidity-coverage-model`) | **PASS** — 36/36 |
| Cache vitest (`lp-discovery-cache`, `scan-cache`, `lp-known-first`, `scan-deep-reliability`) | **PASS** — 22/22 |
| Retry / fencing (`scan-deep-retry-race`) | **PASS** — 10/10 |
| `npm run typecheck` | **PASS** |
| Vercel Production build (mandatory compile gate) | **PASS** — compile + types + prerender OK |

Local `next build` not relied on (prior hang). Vercel Production build is the compile gate.

---

## 2. Deploy

| Item | Value |
|------|--------|
| Command | `npx vercel --prod --yes` |
| Live deploy ID | `dpl_ABjuXJTeDT8yLC1xvmCQgcxCF2cK` |
| Live URL | https://hansomealpacas-m5olnuzjf-the-67.vercel.app |
| Inspect | https://vercel.com/the-67/hansomealpacas/ABjuXJTeDT8yLC1xvmCQgcxCF2cK |
| Aliased | https://www.hansomealpacas.xyz |
| First ship (same fix family) | `dpl_E7rxJW3LYaKKugcSQS2BSegjf6br` |
| Logs | `reports/_tmp-vercel-deploy-fox-dust-materiality.log`, `reports/_tmp-vercel-deploy-fox-dust-materiality-2.log` |

### Intended fix files confirmed in workspace before ship

- `lib/hansome-score/lp/pool-materiality.ts` — `classifyPoolInventoryMateriality`; null → `inventory_unknown`
- `lib/hansome-score/lp/adapters/{types,v2,v3,v4}.ts`, `lp/multi.ts`
- `components/scan/ScanClient.tsx` — presentation pool count
- Tests + FOX verify helper

### Follow-on deploy note (required for live recompute)

Complete-snapshot `refresh=1` previously left `analysisStages.liquidity === "done"`, so `scan-deep` skipped LP rediscovery and kept the 2-stub payload even after the materiality code shipped. Live cutover therefore included:

1. Reset `liquidity: "analyzing"` on complete manual refresh (`scan-cache.ts`)
2. FOX-only Production invalidate route (runtime KV; local env pull only yields `[Sensitive]` placeholders)

No Score / Burn / LP lock semantic changes.

---

## 3. FOX-only cache invalidation

Executed **after** `dpl_ABjuXJTeDT8yLC1xvmCQgcxCF2cK` was Ready + aliased, via Production:

`POST /api/scan/fox-cache-invalidate` with confirm `FOX_DUST_MATERIALITY_2026_07_28`

| Key | `kv.del` result |
|-----|-----------------|
| `scan:snapshot:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | **1** (deleted) |
| `scan:meta:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | **1** (deleted) |
| `scan:lock:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | **0** (absent) |
| `scan:lp:4663:0x2103faa9d1762e27a716c61718b3acf3ec1f9bf1` | **1** (deleted) |

| Guarantee | Result |
|-----------|--------|
| Global KV flush | **NO** |
| `scan:xfer:*` deleted | **NO** (untouched) |
| Burn / Creator transfer checkpoint | **Preserved** — FOX post-recompute `burnPages=40`, `creatorPages=17` |

Artifact: `reports/_tmp-fox-kv-invalidate-result.json`

Local CLI note: `vercel env pull` / env API return encrypted integration-store placeholders only; runtime invalidate on Production was required.

---

## 4. Fresh FOX recompute

| Metric | Result |
|--------|--------|
| Factory-discovered | **2** |
| Material | **1** |
| Dust | **1** |
| Inventory unknown | **0** |
| Presentation cards / material stubs | **1** |
| Visible pool | **FOX/WETH** `0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685` |
| USDG 1-wei as normal Pool card | **NO** — omitted |
| Section / market liquidity USD | **~$90.0k** live (`90047.4586`) — band moved vs earlier ~$95–97k capture; single-card path (not dual Unavailable) |
| Aggregate lock | **`UNKNOWN_INCOMPLETE` / Unknown** |
| False `ALL_LOCKED` | **NO** |
| Overall score | **73** (unchanged band) |
| Analysis | **complete** after deep |

v3 detail (post-fix):

```text
v3: 2 discovered pool(s) via factory.getPool (material=1, dust=1, inventory_unknown=0) — position NFT/locker analysis incomplete for material/unknown.
```

Positions: one synthetic stub `v3-pool:0x9C49F21aDDa14AF527BC56C2a8fAb854F6248685:10000` only.

Watch artifacts: `reports/_tmp-fox-recompute-watch2.log`, `reports/_tmp-fox-recompute-watch4.log`, `reports/_tmp-prod-fox-dust-materiality-smoke.json`

---

## 5. Regression smoke

| Token | Fast / status | Notes |
|-------|---------------|--------|
| **HANSOME** | OK | Overall **51**; LP `#47299` / `#357867` / `#142938` present; Lock Dist **~28.9%**; aggregate **MIXED**; transfer pages intact (34) |
| **FOX** | OK | Deep complete; materiality counts as above; checkpoint pages progressed (creator 17 / burn 40) |
| **CASHCAT** | OK | Complete; no false ALL_LOCKED; Scan OK |
| **PONS** | OK | Deep progressing; multi-material positions present; no even-split regression signal; no false ALL_LOCKED |
| **TYGR** | OK | Deep progressing; Scan not broken; no false ALL_LOCKED |

| Check | Result |
|-------|--------|
| Multi-material no even USD split | **PASS** (HANSOME MIXED + Lock Dist intact; no PR1 honesty regression on FOX single card) |
| `inventory_unknown` not given material card prominence | **PASS** (FOX inventory_unknown=0; null-bypass fixed in code) |
| Score / Burn / LP lock semantics | **Unchanged** |
| Secrets in home / scan / API | **None** |

---

## 6. Rollback decision

| Trigger | Observed | Action |
|---------|----------|--------|
| FOX material cards still 2 after fresh recompute | **No** — cards **1** | Leave live |
| FOX/WETH disappears | Transient during cold deep before LP finished; **restored** (WETH present) | Leave live |
| Material pools incorrectly hidden | **No** | Leave live |
| HANSOME LP regresses | **No** — all three targets + Lock Dist | Leave live |
| Lock classification unexpected change | FOX still Unknown; HANSOME still MIXED | Leave live |
| Build / Production smoke fails | **No** | Leave live |

**Rollback: NO.** Production left on `dpl_ABjuXJTeDT8yLC1xvmCQgcxCF2cK`.

Rollback target if needed later: `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck`.

---

## Summary for parent

| Field | Value |
|-------|--------|
| **PASS/FAIL** | **PASS** |
| **Deploy** | **YES** — live `dpl_ABjuXJTeDT8yLC1xvmCQgcxCF2cK` (prior ship `dpl_E7rxJW3LYaKKugcSQS2BSegjf6br`) |
| **Previous known-good** | `dpl_3eoWjGAAY2vr6KPv3KgtqY83zAck` |
| **Cache keys** | 4 FOX keys targeted; snapshot/meta/lp deleted (`1`); lock absent (`0`); no global flush; no `scan:xfer:*` |
| **FOX counts** | discovered **2** / material **1** / dust **1** / inventory_unknown **0** / presentation **1** (FOX/ETH) |
| **Rollback** | **NO** |
| **Report** | `reports/HANSOME_FOX_DUST_POOL_MATERIALITY_PRODUCTION_SMOKE.md` |
