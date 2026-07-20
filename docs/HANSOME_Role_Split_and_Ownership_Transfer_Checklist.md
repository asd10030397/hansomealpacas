# HANSOME — Role Split & Ownership Transfer Checklist

| Field | Value |
|------|------|
| Document | `docs/HANSOME_Role_Split_and_Ownership_Transfer_Checklist.md` |
| Status | Operational checklist (not gameplay rules) |
| Scope | Wallet roles, env vars, Testnet migration, Mainnet launch gate |
| Does not | Generate keys, rotate secrets, transfer ownership, or deploy |

**Hard rule:** The current combined Testnet EOA `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` must **not** be reused for Mainnet funds or Mainnet operations.

Gasless resolve reads **only** `GAME_TESTNET_RELAYER_PRIVATE_KEY` (no deployer/treasury/legacy fallback).

---

## 1. Current state (as of security audit)

| Fact | Detail |
|------|--------|
| Combined EOA | `0xcE15…069A` |
| Roles today | Deployer + HansomeGame owner + GameRandomness owner + Genesis owner + labeled `TREASURY_PRIVATE_KEY` + gasless relayer |
| Env duplication | Same key material in `.env.local` (`GAME_TESTNET_RELAYER_PRIVATE_KEY`) and `contracts/.env` (`TREASURY_PRIVATE_KEY`) |
| Goal | Split to least-privilege wallets before Mainnet |

---

## 2. Testnet roles

### 2.1 Dedicated gasless relayer

| Field | Spec |
|------|------|
| Permissions | Call Testnet `revealBatch` / seed fulfill / `finalizeDay` / `creditBatch` as allowed by contract (owner or operator path as deployed) |
| Controls | Next.js `/api/game/testnet-resolve` signer only |
| Hot / cold | **Hot** (server-only) |
| Funding | Minimal Testnet ETH for peak daily settle gas + buffer (days of OpEx, not idle wealth) |
| May hold player/project funds? | **No** |
| Env var | `GAME_TESTNET_RELAYER_PRIVATE_KEY` (`.env.local` / Vercel **server** env) |
| Never share with | Deployer, any owner, treasury, founder, Mainnet relayer, VRF operator |
| Rotation | Generate new EOA → fund Testnet ETH → update local + Vercel → restart/redeploy → revoke old key funds → smoke-test resolve |
| Failure recovery | Mark service unavailable (safe status message); fund or replace relayer; do not fall back to owner/treasury keys |

### 2.2 Deployer

| Field | Spec |
|------|------|
| Permissions | Deploy contracts; one-time setup txs |
| Controls | Deployment scripts under `contracts/scripts` |
| Hot / cold | Warm for Testnet; **cold / offline** preferred for Mainnet deploy ceremony |
| Funding | Enough gas for deploy suite only |
| May hold player/project funds? | **No** (transfer ownership out ASAP) |
| Env var | `DEPLOYER_PRIVATE_KEY` (`contracts/.env`) |
| Never share with | Relayer, treasury hot wallet, founder spending key |
| Rotation | New deployer only for future deploys; old deployer should not retain ownership |
| Failure recovery | Redeploy only if contracts allow; otherwise ownership recovery via current owner |

### 2.3 HansomeGame owner

| Field | Spec |
|------|------|
| Permissions | Ownable admin on `HansomeGame` (params / privileged ops per ABI) |
| Controls | `HansomeGame` |
| Hot / cold | Testnet: warm OK; Mainnet: **timelock or multisig (cold)** |
| Funding | Gas only |
| May hold player/project funds? | **No** |
| Env var | Not the relayer. Track address in runbook; Mainnet: multisig (no single `PRIVATE_KEY` in Vercel) |
| Never share with | Relayer, treasury hot key, bot |
| Rotation / recovery | `transferOwnership` to new owner/timelock; verify `owner()`; keep prior owner until confirmed |

### 2.4 GameRandomness owner / operator

| Field | Spec |
|------|------|
| Permissions | Own/configure randomness; fulfill day seed per design |
| Controls | `GameRandomness` (+ adapter if used) |
| Hot / cold | Operator fulfill may be hot; **owner** should be cold/multisig on Mainnet |
| Funding | Gas for fulfill path |
| May hold player/project funds? | **No** |
| Env var | Separate from relayer; Mainnet: `VRF_OPERATOR` / provider key as designed — not `GAME_TESTNET_RELAYER_PRIVATE_KEY` |
| Never share with | Relayer (unless deliberately dual-roled on Testnet only — **not** for Mainnet), treasury |
| Rotation | New operator → update provider binding → transfer ownership if needed |
| Failure recovery | Pause/disable gasless if seed path broken; manual ops with owner only as last resort on Testnet |

### 2.5 Genesis NFT owner

| Field | Spec |
|------|------|
| Permissions | Admin URI / sale / reveal controls per Genesis ABI |
| Controls | `HansomeGenesisNFT` (+ randomness provider binding) |
| Hot / cold | Testnet warm OK; Mainnet **timelock/multisig** |
| Funding | Gas only |
| May hold player/project funds? | **No** (sale proceeds go to configured receivers) |
| Env var | Deployer/owner ops via `DEPLOYER_PRIVATE_KEY` until transferred |
| Never share with | Relayer, bot, external buyer |
| Rotation / recovery | Ownership transfer + verify `owner()` + URI/commitment invariants |

### 2.6 Treasury / operator

| Field | Spec |
|------|------|
| Permissions | Hold project tokens/ETH; LP and treasury scripts |
| Controls | Token balances, Uniswap v4 position scripts (`TREASURY_PRIVATE_KEY`) |
| Hot / cold | LP ops: warm dedicated; large reserves: cold/multisig |
| Funding | Project treasury assets as designed |
| May hold player/project funds? | **Yes — project funds only** (not player custody wallets) |
| Env var | `TREASURY_PRIVATE_KEY` (`contracts/.env`) — **never** copied into Next.js relayer |
| Never share with | Relayer, game owner hot key, QA player wallets |
| Rotation | Sweep to new treasury → update scripts/env → retire old key |
| Failure recovery | Multisig recovery / cold backup per org policy |

---

## 3. Mainnet roles

### 3.1 Dedicated Mainnet relayer

| Field | Spec |
|------|------|
| Permissions | Settlement/reveal path allowed on Mainnet game (when implemented) |
| Controls | Future Mainnet settle service (not Testnet API) |
| Hot / cold | **Hot**, server-only |
| Funding | Minimal Mainnet gas budget; automated top-up from cold |
| May hold player/project funds? | **No** |
| Env var | e.g. `GAME_MAINNET_RELAYER_PRIVATE_KEY` (name TBD) — **never** reuse Testnet relayer or `0xcE15…069A` |
| Never share with | Any owner, treasury, founder, Testnet relayer |
| Rotation / recovery | Same pattern as Testnet; dual-key cutover window |

### 3.2 Deployer

| Field | Spec |
|------|------|
| Permissions | One-time Mainnet deploy |
| Hot / cold | **Cold / ceremony** |
| Funding | Deploy gas only |
| May hold funds? | **No** |
| Env var | `DEPLOYER_PRIVATE_KEY` (offline / CI secret for ceremony only) |
| Never share with | Relayer, treasury hot, bot |

### 3.3 Timelock or multisig owner

| Field | Spec |
|------|------|
| Permissions | Admin of Game, Genesis, critical params |
| Controls | Ownable contracts post-deploy |
| Hot / cold | **Cold** (multisig / timelock) |
| Funding | Gas for admin txs |
| May hold funds? | Prefer separate treasury multisig |
| Env var | None in Vercel for signing; Safe/hardware |
| Never share with | Relayer, bots |

### 3.4 Randomness provider / operator

| Field | Spec |
|------|------|
| Permissions | Fulfill VRF/beacon into adapters |
| Controls | `VRFRevealAdapter` / GameRandomness provider |
| Hot / cold | Provider integration key as required; owner cold |
| Funding | Provider fees + gas |
| May hold funds? | **No** |
| Env var | `VRF_OPERATOR` / provider credentials — not relayer |
| Never share with | Relayer, treasury |

### 3.5 Treasury

| Field | Spec |
|------|------|
| Permissions | Project token/ETH/LP |
| Hot / cold | Cold multisig for reserves; optional hot ops wallet with limits |
| May hold funds? | **Yes (project)** |
| Env var | `TREASURY_PRIVATE_KEY` only for limited hot ops — prefer multisig |
| Never share with | Relayer, owner EOA, founder personal spending |

### 3.6 Founder wallet

| Field | Spec |
|------|------|
| Permissions | Personal/founder allocation only |
| Controls | None of production game admin |
| Hot / cold | Cold |
| May hold funds? | Founder allocation only |
| Env var | Prefer address-only (`TOKEN_RECIPIENT`); **no** founder key in Vercel |
| Never share with | Relayer, treasury ops, deployer |

### 3.7 Bot / API service accounts

| Field | Spec |
|------|------|
| Permissions | Telegram bot token; optional read RPCs |
| Controls | `bot/` Railway (or host); website APIs without chain admin |
| Hot / cold | Hot credentials |
| May hold funds? | **No** chain keys |
| Env var | `BOT_TOKEN`, `CHAT_ID`; `PINATA_JWT` for pin scripts |
| Never share with | Any chain private key role |
| Rotation | BotFather revoke; Pinata JWT rotate |

---

## 4. Roles that must never share a key

| Pair | Rule |
|------|------|
| Relayer ↔ Owner (Game / Genesis / Randomness) | Never |
| Relayer ↔ Treasury | Never |
| Relayer ↔ Founder | Never |
| Relayer ↔ Mainnet relayer | Never (separate keys even if same codepath) |
| Treasury ↔ Deployer (Mainnet) | Avoid; Testnet convenience fallback in Hardhat is not an excuse for Next.js |
| Bot/Pinata ↔ any chain key | Never |
| `0xcE15…069A` ↔ Mainnet anything | **Forbidden** |

---

## 5. Exact Testnet migration order

Do **not** skip verification steps.

1. **Inventory** — Confirm current `owner()` on Game, Randomness, Genesis; confirm relayer address used by Vercel/local.
2. **Generate offline** (outside chat) a **new dedicated Testnet relayer** EOA. Store in password manager.
3. **Fund** new relayer with minimal Testnet ETH only.
4. **Local env** — Set `GAME_TESTNET_RELAYER_PRIVATE_KEY` in `.env.local` to the **new** key. Do **not** change `TREASURY_PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` in the same edit unless intentional.
5. **Vercel** — Set the same var as **server-only** (Production + Preview as needed). Ensure it is **not** `NEXT_PUBLIC_*`.
6. **Redeploy** Next.js. Confirm GET `/api/game/testnet-resolve` → `relayerConfigured: true`, no `PRIVATE_KEY` strings in JSON.
7. **Smoke-test** gasless resolve (commit → resolve → claim) with a cheap Testnet day.
8. **Drain** old relayer hot wallet Testnet ETH (optional) once new path works — only if old address is no longer required for owner txs.
9. **Generate** dedicated Testnet deployer (if still using combined key for deploys) and dedicated owner/multisig candidates.
10. **Ownership transfers** (section 6) — only after relayer cutover is stable.
11. **Update** `contracts/.env` so `TREASURY_PRIVATE_KEY` / `DEPLOYER_PRIVATE_KEY` are not the relayer key.
12. **Document** final address map in a private ops note (not in git with keys).

---

## 6. Ownership-transfer order (Testnet)

Transfer **one contract at a time**. Prefer: non-critical → critical.

Suggested order:

1. `HansomeGenesisNFT` → new owner (or keep until sale ops done)
2. `GameRandomness` → new owner / provider admin
3. `HansomeGame` → new owner (last among game suite)

After each `transferOwnership` / accept-ownership (if two-step):

### Required on-chain verification

- [ ] `owner()` equals intended new owner
- [ ] Old owner can no longer call onlyOwner functions (expect revert)
- [ ] Relayer still settles (gasless path unchanged)
- [ ] Players can still commit / claim
- [ ] Record tx hash + block in private ops log

---

## 7. Rollback plan

| Stage | Rollback |
|------|----------|
| Relayer key updated but settle fails | Point `GAME_TESTNET_RELAYER_PRIVATE_KEY` back to previous **dedicated** relayer value (password manager); redeploy. Do **not** re-enable deployer/treasury fallback in code. |
| Ownership transferred wrongly | If Ownable is single-step and new owner is controlled: transfer back. If lost: treat as incident (no code fallback). |
| Vercel env wrong | Revert env to last known good; redeploy previous deployment if needed |
| sync-game-env ran | Safe: it does not overwrite a preserved relayer key; public addresses only |

---

## 8. Vercel environment update steps

1. Vercel → Project → Settings → Environment Variables  
2. Add/update `GAME_TESTNET_RELAYER_PRIVATE_KEY` (Production; Preview if Preview uses Testnet)  
3. **Encrypt / sensitive**; never expose to client  
4. Confirm **absent**: `DEPLOYER_PRIVATE_KEY`, `TREASURY_PRIVATE_KEY` on Vercel unless you explicitly need server-side contract admin (prefer **not**)  
5. Redeploy Production  
6. Hit GET `/api/game/testnet-resolve` and confirm `relayerConfigured` / generic errors only  

---

## 9. Local `.env` update steps

1. `.env.local`: set `GAME_TESTNET_RELAYER_PRIVATE_KEY=<dedicated>` only  
2. `contracts/.env`: keep `DEPLOYER_PRIVATE_KEY` / `TREASURY_PRIVATE_KEY` for scripts — **different** keys after split  
3. Never paste keys into chat, issues, or commits  
4. Run `npx hardhat run scripts/sync-game-env.ts --network robinhoodTestnet` — expect `[preserved]` or `[unset]` for relayer, never a copied key  
5. Restart `next dev` / `next start` after env changes  

---

## 10. Smoke-test checklist

- [ ] `npm run build` succeeds  
- [ ] GET `/api/game/testnet-resolve` → `enabled`, `relayerConfigured`, `canResolve` as expected  
- [ ] Response JSON has no `PRIVATE_KEY` / key material  
- [ ] Commit with vault upload (gasless path)  
- [ ] Auto/manual resolve: reveal → seed → finalize/credit  
- [ ] Claim rewards  
- [ ] With relayer env cleared: service unavailable + safe message; settle does not use treasury key  
- [ ] Client bundle grep: no `GAME_TESTNET_RELAYER_PRIVATE_KEY` in client chunks (see section 12)  

---

## 11. Mainnet launch gate

Ship Mainnet game admin **only if**:

- [ ] No combined owner / treasury / relayer key  
- [ ] `0xcE15…069A` not funded on Mainnet and not used as any Mainnet role  
- [ ] Dedicated Mainnet relayer env set server-side  
- [ ] Owners are timelock or multisig  
- [ ] Randomness provider is non-grindable (not owner EOA fulfill)  
- [ ] Treasury is separate from relayer  
- [ ] Founder key not in hosting env  
- [ ] Incident runbook: rotate relayer without touching ownership  

**Gate statement:** Mainnet launch is blocked while any single EOA is simultaneously owner + treasury signer + relayer.

---

## 12. Client-bundle verification (operators)

After `npm run build`:

```bash
# From repo root — expect no matches in client chunks
rg -n "GAME_TESTNET_RELAYER_PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|TREASURY_PRIVATE_KEY" .next/static || true
```

Server chunks under `.next/server` may reference the **name** `GAME_TESTNET_RELAYER_PRIVATE_KEY` (env read). That is expected. Client/static must not.

---

## 13. Confirmation — combined key quarantine

| Address | Rule |
|---------|------|
| `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` | Testnet historical combined key. May remain Testnet owner until transfers complete. **Must not** receive Mainnet funds or perform Mainnet operations. |

---

## Change log

| Date | Note |
|------|------|
| 2026-07-20 | Initial checklist; code removes relayer fallbacks; sync-game-env no longer copies private keys |
