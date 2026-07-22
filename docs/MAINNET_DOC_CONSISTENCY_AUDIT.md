# Mainnet documentation consistency audit (Treasury / launch)

| Field | Value |
|------|------|
| Date | 2026-07-21 (re-verified same day) |
| Scope | Docs + ops examples only — **no** Solidity, deploy, or transactions |
| Canonical ops write-up | [`INITIAL_TREASURY_STRATEGY.md`](./INITIAL_TREASURY_STRATEGY.md) |
| Result | **PASS** for documentation scope; script env rename still deferred |

---

## Verified consistent

| Topic | Status |
|-------|--------|
| Protocol \(G_0\) = **300,000,000** (band reference, unchanged) | OK across GDS §15.4, economic models, Mainnet ops docs |
| Launch funding = **30,000,000** HANSOME → initial \(R_d = 80{,}000\)/day | OK |
| Funding source `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` (ops, not Solidity) | OK in strategy, ops config, checklists, blocker/tracker, GDS note, economic models |
| One-time launch transfer; future top-ups from same or other approved wallets | OK |
| Do not fund RewardDistributor | OK |
| Protocol design vs launch operations language | OK in strategy + economic §5.3 + ops §3A |

---

## Env rename decision

| Name | Role |
|------|------|
| **`GAME_TREASURY_FUND_HANSOME`** | Preferred documentation / ops example name (whole HANSOME) |
| **`GAME_TREASURY_FUND_ETH`** | Legacy name still **read by TypeScript** deploy/dry-run scripts — **misnomer** (not ETH) |

Ceremony value remains **`30000000`**.

---

## Remaining inconsistencies (deferred — require code or product follow-up)

1. **Deploy scripts still use `GAME_TREASURY_FUND_ETH`**  
   Files: `contracts/scripts/deploy-game.ts`, `dry-run-mainnet-game-launch.ts`, `dry-run-mainnet-deploy-plan.ts`.  
   Docs say `GAME_TREASURY_FUND_HANSOME`; operators must still set the legacy env until a future script rename (accept both names).

2. **Site transparency “Treasury” address may differ**  
   Marketing / transparency UI has historically shown a different Treasury address than `0xcE15…069A`. Confirm whether public transparency should list the **GameTreasury funder** vs a separate project treasury — product decision, not a GDS constant.

3. **Older audit rows may still mention pre-decision 300M fund targets**  
   `MAINNET_PRE_LAUNCH_ENV_AUDIT.md` marks 300M as superseded; keep that historical context, do not re-approve 300M launch funding.

4. **i18n / marketing copy**  
   Spot-check `content/i18n/*` if any string still implies “treasury starts at \(G_0\)” without the launch-ops caveat (economic public docs updated this pass).

5. **Handoff status line**  
   `CURSOR_AGENT_HANDOFF.md` still reads as early “設計期” in places; unrelated to treasury math but stale relative to Mainnet ops docs.

---

## No action this pass

- No Solidity changes  
- No script renames  
- No deploy / no funding transactions  
