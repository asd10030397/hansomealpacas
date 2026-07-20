# Mainnet Vercel cutover (game.hansomealpacas.xyz)

| Field | Value |
|------|------|
| Status | **Prepare only** — do not cut over until Mainnet contracts are deployed + dry-run clean |
| Site | Production on Vercel (`VERCEL_ENV=production`) |
| Chains | Game Testnet `46630` (current) → Game Mainnet `4663` (cutover) |
| Related | [`MAINNET_DEPLOYMENT_CHECKLIST.md`](./MAINNET_DEPLOYMENT_CHECKLIST.md), [`GAME_RUNTIME_ADDRESSES.md`](./GAME_RUNTIME_ADDRESSES.md) |

**Hard rules**

- Do **not** deploy / promote until Mainnet addresses exist in `contracts/deployments/robinhood-*.json`.
- Do **not** paste secrets into chat, git, or this doc.
- Do **not** copy Testnet private keys or vault keys onto Mainnet env names.
- Explorer public var in code is `NEXT_PUBLIC_GAME_EXPLORER` (alias `NEXT_PUBLIC_BLOCK_EXPLORER_URL` also accepted).

---

## 1. Current Testnet variables (Production today)

### Public (`NEXT_PUBLIC_*`)

| Variable | Current / expected Testnet value |
|----------|----------------------------------|
| `NEXT_PUBLIC_GAME_CHAIN_ID` | `46630` |
| `NEXT_PUBLIC_GAME_RPC_URL` | `https://rpc.testnet.chain.robinhood.com` |
| `NEXT_PUBLIC_GAME_EXPLORER` | `https://explorer.testnet.chain.robinhood.com` |
| `NEXT_PUBLIC_HANSOME_GAME_ADDRESS` | `0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5` |
| `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS` or `NEXT_PUBLIC_GENESIS_NFT_ADDRESS` | `0x43c1d6aF194A796EC612F2bAC04085a409A1347C` |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` | `0x7Fb2437542041AbaC22E0A88dF2e0A9c3346e1d2` |
| `NEXT_PUBLIC_RANDOMNESS_ADDRESS` | `0x45F9FFaC891e06E83a5A315E4fE1B55E5b6b438F` |
| `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE` | `1` (or unset = on) |
| `NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC` / `REVEAL` / `DAY` | Fast QA `120` / `120` / `240` (Testnet only) |

### Server-only (never `NEXT_PUBLIC_*`)

| Variable | Purpose |
|----------|---------|
| `GAME_TESTNET_RELAYER_PRIVATE_KEY` | Gasless reveal / settle relayer (Testnet hot wallet) |
| `GAME_TESTNET_COMMIT_VAULT_KEY` | AES key for encrypted commit salts |
| `GAME_TESTNET_COMMIT_VAULT_DRIVER` | Optional; Production must use Redis/KV |
| `KV_REST_API_URL` | Vercel KV / Upstash |
| `KV_REST_API_TOKEN` | Vercel KV / Upstash |
| `GAME_RPC_URL` | Optional server RPC override |

Swap / token Mainnet vars (`NEXT_PUBLIC_CHAIN_ID=4663`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CONTRACT`, etc.) already target Robinhood Mainnet and are **not** part of the game cutover.

---

## 2. Required Mainnet variables (after contract deploy)

### Public — set / replace on Vercel Production

| Variable | Mainnet value |
|----------|---------------|
| `NEXT_PUBLIC_GAME_CHAIN_ID` | `4663` |
| `NEXT_PUBLIC_GAME_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` |
| `NEXT_PUBLIC_GAME_EXPLORER` | `https://robinhoodchain.blockscout.com` |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | Optional alias of explorer (same URL) |
| `NEXT_PUBLIC_HANSOME_GAME_ADDRESS` | From `deployments/robinhood-game.json` → `address` |
| `NEXT_PUBLIC_GENESIS_NFT_ADDRESS` (or `NEXT_PUBLIC_HANSOME_GENESIS_ADDRESS`) | From `deployments/robinhood-genesis.json` |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS` | From `robinhood-game.json` → `distributor` |
| `NEXT_PUBLIC_RANDOMNESS_ADDRESS` | From `robinhood-game.json` → `randomness` |
| `NEXT_PUBLIC_GAME_COMMIT_DURATION_SEC` | `72000` (or **remove** and rely on GDS defaults) |
| `NEXT_PUBLIC_GAME_REVEAL_DURATION_SEC` | `14400` |
| `NEXT_PUBLIC_GAME_DAY_LENGTH_SEC` | `86400` |

Startup fails closed if Mainnet chainId is set with missing/invalid addresses or with **canonical Testnet suite** addresses.

### Server-only — manual Vercel entry (encrypted)

| Variable | Notes |
|----------|-------|
| `GAME_MAINNET_RELAYER_PRIVATE_KEY` | **New dedicated** Mainnet hot wallet only. Do not reuse Testnet relayer / treasury / owner. Gasless Mainnet is still gated in code (`testnetRelayer*` + onlyOwner risk) — set only when Mainnet gasless is deliberately enabled. |
| `GAME_MAINNET_COMMIT_VAULT_KEY` | **New** 32-byte key (64 hex). Do **not** copy `GAME_TESTNET_COMMIT_VAULT_KEY`. |
| `KV_REST_API_URL` | Keep / confirm Production KV (same project OK if namespace/prefix isolates; prefer dedicated if policy requires) |
| `KV_REST_API_TOKEN` | Keep / confirm |
| `GAME_RPC_URL` | Optional server-only Mainnet RPC |

---

## 3. Variables that must be removed (or set off) on Mainnet Production

| Variable | Action |
|----------|--------|
| `NEXT_PUBLIC_GAME_CHAIN_ID=46630` | Replace with `4663` |
| Testnet game / genesis / distributor / randomness addresses | Replace with Mainnet addresses — never leave Testnet suite |
| `NEXT_PUBLIC_GAME_RPC_URL` pointing at `*.testnet.*` | Replace with Mainnet RPC |
| `NEXT_PUBLIC_GAME_EXPLORER` pointing at testnet explorer | Replace with Blockscout Mainnet |
| `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=1` | Set `0` / `false` until Mainnet gasless is approved (APIs refuse non-46630 anyway) |
| `NEXT_PUBLIC_THANSOME_ADDRESS` | Remove from Production |
| Fast timing `120`/`120`/`240` | Remove or set GDS `72000`/`14400`/`86400` |
| `GAME_TESTNET_COMMIT_VAULT_DRIVER=memory` | Must not exist on Production |
| `GAME_TESTNET_COMMIT_VAULT_ALLOW_MEMORY` | Remove |

---

## 4. Variables that must **never** be copied from Testnet

| Do not copy | Why |
|-------------|-----|
| `GAME_TESTNET_RELAYER_PRIVATE_KEY` → `GAME_MAINNET_RELAYER_PRIVATE_KEY` | Role split / hot-wallet compromise blast radius |
| `GAME_TESTNET_COMMIT_VAULT_KEY` → `GAME_MAINNET_COMMIT_VAULT_KEY` | Would decrypt/collide with Testnet vault records |
| Canonical Testnet contract addresses as Mainnet `NEXT_PUBLIC_*` | Startup now **throws** |
| Testnet RPC / explorer URLs with `NEXT_PUBLIC_GAME_CHAIN_ID=4663` | Startup now **throws** |
| tHANSOME address / fund scripts | Wrong token |
| Testnet WL merkle / sale bootstrap params | Wrong sale ceremony |
| Combined Testnet EOA used as Mainnet owner/relayer/treasury | See role-split checklist |

---

## 5. Variables that require **manual** Vercel entry

Cannot be safely synced by `sync-game-env` from Testnet:

1. `GAME_MAINNET_RELAYER_PRIVATE_KEY`
2. `GAME_MAINNET_COMMIT_VAULT_KEY`
3. `KV_REST_API_URL` / `KV_REST_API_TOKEN` (confirm in dashboard; rotate if policy requires)
4. All Mainnet `NEXT_PUBLIC_*` contract addresses (paste from Mainnet deploy JSON after ceremony)
5. Decision flags: `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=0` until approved

Use Vercel → Project → Settings → Environment Variables → **Production** only (or Preview if testing cutover on a Preview deployment first).

---

## 6. Code guarantees (verified in repo)

| Check | Status |
|-------|--------|
| No dynamic `process.env[key]` for game `NEXT_PUBLIC_*` addresses | Static `switch` in `contractAddresses.ts` / `gameNetwork.ts` |
| Browser bundle must not include relayer/vault keys | `server-only` modules + no `NEXT_PUBLIC_` on secrets |
| Mainnet mode never falls back to Testnet RPC | `resolveGameRpcUrl()` → Mainnet default |
| No Testnet suite addresses as Mainnet defaults | Env-only resolve + deny list |
| `46630` cannot be active game chain when mode is Mainnet | `NEXT_PUBLIC_GAME_CHAIN_ID` must be `4663`; network assert rejects testnet RPC/explorer |

---

## 7. Cutover checklist

### A. Before touching Vercel

- [ ] Mainnet contracts deployed + verified (see deployment checklist)
- [ ] `contracts/deployments/robinhood-genesis.json` + `robinhood-game.json` committed / archived
- [ ] Ownership transferred to multisig
- [ ] Relayer / gasless Mainnet design decided (default: gasless **off**)
- [ ] New Mainnet vault key generated offline (never reuse Testnet)
- [ ] This branch with startup guards is on `main` and green CI

### B. Vercel environment changes (manual)

1. Open Vercel Production env for the game project.
2. Set public chain/RPC/explorer to Mainnet values (§2).
3. Set all four contract addresses from Mainnet deploy JSON.
4. Set GDS timings (or remove fast Testnet timing vars).
5. Set `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=0` unless Mainnet gasless is approved.
6. Add `GAME_MAINNET_*` secrets only if gasless Mainnet is approved; otherwise leave unset.
7. Confirm `KV_REST_API_*` still present for Production.
8. Remove / blank Testnet-only public addresses and tHANSOME.
9. **Do not** delete `GAME_TESTNET_*` until after rollback window if you may roll back quickly — but ensure they are not read when chain is `4663` (code uses Mainnet names only on 4663).

### C. Redeploy requirement

- Changing `NEXT_PUBLIC_*` requires a **new Production deployment** (Redeploy) so Next inlines public env into the client bundle.
- Server-only secret changes also need a redeploy to pick up at runtime.
- Prefer: save env → Redeploy → watch deployment logs for `[hansome]` startup errors.

### D. Post-deploy verification endpoints / checks

| Check | How |
|-------|-----|
| App boots | Deployment logs: no `[hansome] Mainnet mode must not…` / missing address throws |
| Chain | Browser: game UI targets `4663`; wallet prompts Robinhood Mainnet |
| Addresses | Compare UI/debug with `robinhood-game.json` |
| Explorer links | Open NFT/tx links → `robinhoodchain.blockscout.com` |
| RPC | No calls to `rpc.testnet.chain.robinhood.com` in network tab for game reads |
| Gasless | `/api/game/testnet-resolve` should refuse / disabled on Mainnet mode |
| Claim / day cycle | Smoke commit→reveal→settle on a throwaway wallet after funding |

Optional local assert (no deploy):

```bash
# Fail closed if you accidentally point Mainnet chain at Testnet suite
NEXT_PUBLIC_GAME_CHAIN_ID=4663 \
NEXT_PUBLIC_HANSOME_GAME_ADDRESS=0x92C8e9CCF67e533438bCCE258D4bEEc6E0559FC5 \
npx vitest run lib/game/__tests__/mainnetLaunchGuards.test.ts
```

### E. Rollback procedure

1. In Vercel Production env, restore Testnet public vars (§1): chain `46630`, Testnet RPC/explorer, canonical Testnet suite addresses, fast timings if used.
2. Restore `NEXT_PUBLIC_TESTNET_GASLESS_RESOLVE=1` if gasless was on.
3. Ensure `GAME_TESTNET_RELAYER_PRIVATE_KEY` + `GAME_TESTNET_COMMIT_VAULT_KEY` + KV still present.
4. **Redeploy** Production immediately.
5. Verify site hits Testnet explorer/RPC again.
6. Leave Mainnet contracts paused/owned as ops policy; do not delete Mainnet deploy JSON.
7. Investigate before a second cutover attempt.

---

## 8. Naming note

| Docs / ops name | Code name |
|-----------------|-----------|
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | Alias → `resolveGameExplorerUrl()`; prefer `NEXT_PUBLIC_GAME_EXPLORER` |
| `GAME_MAINNET_RELAYER_PRIVATE_KEY` | Read when `NEXT_PUBLIC_GAME_CHAIN_ID=4663` |
| `GAME_MAINNET_COMMIT_VAULT_KEY` | Read when Mainnet mode (never falls back to Testnet key) |
