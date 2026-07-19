# Candidate A Hunt Penalty — Implementation Cutover

| Field | Value |
|-------|--------|
| Status | Implemented + Testnet HansomeGame redeployed |
| Testnet HansomeGame | `0x20B85Dbb124EA69119dDe3D467e92a6a244A51C0` |
| Previous game | `0x1F41a223b883520b61743FEF7a2a8541cfABf8D4` |
| Ladder | **0 / 15 / 25 / 35 / 45** (Home → River) |
| Previous | 0 / 10 / 15 / 22 / 30 |
| Pools | Unchanged **80 / 10 / 10** |
| Date | 2026-07-20 |

## Before / after

| Location | Before π₀ | After π₀ (Candidate A) | bps |
|----------|-----------|------------------------|-----|
| Home | 0% | 0% | 0 |
| Mountain | 10% | **15%** | 1500 |
| Grassland | 15% | **25%** | 2500 |
| Forest | 22% | **35%** | 3500 |
| River | 30% | **45%** | 4500 |

## Unchanged

- Rd emission schedule  
- Pool split Ra/Rc/Rh  
- Hunt success logic  
- Genesis supply / traits  
- Settlement flow / Treasury accounting rules (penalties still → Treasury)

## Validation artifacts

- Hardhat: `SettlementLib.unit.ts` (U-TRAIT-01)  
- Offline: `scripts/validate-candidate-a-10k.mjs` → `reports/economics/candidate-a-10k-validation.json`

## Docs / UI synced

- GDS EN + ZH-TW π₀ tables  
- `data/game/locations.ts` pressure %  
- Player Guide location blurbs  
- LocationCard badge: `HUNT π₀ N%`  
- Frontend `settlementActivation` PI0_BPS  
- Economics canvas + prior review notes
