# HANSOME Release Freeze — RC v1.0

| Field | Value |
|-------|-------|
| **Freeze tag suggestion** | `RC v1.0` |
| **Freeze date** | 2026-07-22 (Asia/Taipei) |
| **Agent session** | RC freeze automation |
| **Prior RC prep** | [MAINNET_RELEASE_CANDIDATE.md](./MAINNET_RELEASE_CANDIDATE.md) (generated, not committed) |

---

## 1. Final status

### **FROZEN** (with documented deploy-SHA caveats)

Production-ready frontend and settlement-worker code is committed, pushed to `main`, and redeployed to Vercel + both Railway workers. Local and GitHub HEAD match. Mainnet settlement remains **DRY_RUN**; no Mainnet txs, env mutations, or contract changes were made in this freeze.

---

## 2. Canonical commit

| Item | Value |
|------|-------|
| **Full SHA** | `e21b5e8d364168d2900a87a5a76a929808417c9a` |
| **Short SHA** | `e21b5e8` |
| **Commit time** | 2026-07-22 18:01:07 +0800 |
| **Message** | Freeze HANSOME Release Candidate v1.0 with production gameplay UX, settlement worker, and Mainnet launch ops. |
| **GitHub URL** | https://github.com/asd10030397/hansomealpacas/commit/e21b5e8d364168d2900a87a5a76a929808417c9a |
| **Branch** | `main` |
| **Files changed** | 146 (+13,543 / −504) |

**Base commit before freeze:** `89b43d2512f7cbbc5be32039d6540d90cb90331c`

---

## 3. Five-SHA verification table

| Target | SHA / evidence | Match `e21b5e8…`? | Notes |
|--------|----------------|-------------------|-------|
| **Local Git HEAD** | `e21b5e8d364168d2900a87a5a76a929808417c9a` | **YES** | `git rev-parse HEAD` |
| **GitHub `main` HEAD** | `e21b5e8d364168d2900a87a5a76a929808417c9a` | **YES** | `git ls-remote origin refs/heads/main` |
| **Vercel Production** | `dpl_Ch3asfWeeru15j1VHXNgvPJ8gRB8` | **Content-aligned; SHA not in API** | `npx vercel --prod` from committed tree immediately after push. GitHub hook also built `dpl_2NzGaYKq9amoqtmdiqTo4WZEb11h` at 18:01:25. Aliased to `game.hansomealpacas.xyz`. Vercel CLI `inspect --json` does not return `gitCommitSha` for these deployments. |
| **Railway Testnet** | Deploy `ce740e3f-fdd3-4317-a880-94762ad6942e` | **Source-aligned; SHA not exposed** | `railway redeploy --from-source -s settlement-worker-testnet`. Image: `sha256:25cdd93b71da11e6e0631b7bbc6d1129c020705e9799687f0801ec78688d91a0`. Deployed 2026-07-22T10:02:39Z (~90s after push). |
| **Railway Mainnet** | Deploy `0abf3117-681d-427c-bccd-7dd23f1dec76` | **Source-aligned; SHA not exposed** | `railway redeploy --from-source -s settlement-worker-mainnet`. Image: `sha256:829fb017d4a643f3ed18884f6d16af99f5ed3f18aeacec3d2ee7906ad18cd86b`. Deployed 2026-07-22T10:10:27Z. |

**Summary:** 2/5 targets expose an identical git SHA via CLI/API. 3/5 (Vercel + both Railway services) are **best-effort aligned** via `--from-source` / post-commit deploy timing; Railway metadata exposes `imageDigest` only, not `commitSha`.

---

## 4. Deploy verification

### Vercel (frontend)

| Check | Result |
|-------|--------|
| Production URL | https://game.hansomealpacas.xyz |
| Deployment ID | `dpl_Ch3asfWeeru15j1VHXNgvPJ8gRB8` |
| Inspector | https://vercel.com/the-67/hansomealpacas/Ch3asfWeeru15j1VHXNgvPJ8gRB8 |
| Build | **PASS** (Next.js 15.5.20, ~3m) |
| Aliases | `game.hansomealpacas.xyz`, `www.hansomealpacas.xyz`, `hansomealpacas.xyz` |

### Railway Testnet worker

| Check | Result |
|-------|--------|
| URL | https://settlement-worker-testnet-production.up.railway.app |
| `/healthz` | `ok:true`, `profile:testnet`, `chainId:46630`, **`dryRun:false`**, `currentDay:852` |
| `/readyz` | Ready (tick active) |
| Settler | `0xcE152894dF356741e7cfdFdD9d0B4D1fDf4a069A` |
| Worker boot | `startedAt: 2026-07-22T10:02:59.379Z` (post-redeploy) |

### Railway Mainnet worker

| Check | Result |
|-------|--------|
| URL | https://settlement-worker-mainnet-production.up.railway.app |
| `/healthz` | `ok:true`, `profile:mainnet`, `chainId:4663`, **`dryRun:true`**, `currentDay:0` |
| `/readyz` | Ready (tick active) |
| Settler | `0x4D68639a5e3ad8fD268f801862D464259656Fd6c` |
| Worker boot | `startedAt: 2026-07-22T10:10:57.378Z` (post-redeploy) |

### Production parity checks

| Check | Result |
|-------|--------|
| Gasless resolve on Mainnet prod | **403** on `POST https://game.hansomealpacas.xyz/api/game/testnet-resolve` |
| Mainnet worker live settlement | **OFF** (`dryRun: true`) |
| Testnet worker live settlement | **ON** (`dryRun: false`) — unchanged |
| Shared gameplay code paths | Same repo commit; env-driven Testnet/Mainnet split preserved |
| Railway env vars | **Not modified** in this freeze |

---

## 5. What was committed (146 files)

### Production gameplay & UX

- Day-cycle pages: commit / result / claim polish, previous-day battle results, hunt-penalty badge
- Wallet auto-settle/reveal: `lib/game/walletAutoSettle.ts`, hooks (`useAutoReveal`, `useSettlementView`, `useClaimRewards`, etc.)
- WalletConnect mobile feedback, Hunt vignette VFX, i18n + player guide updates
- Gated capture tooling: `lib/game/tutorialCapture.ts`, `TutorialCaptureInit` (`?capture=1` only)
- Launch-end card route (trailer/marketing capture)

### Settlement worker (new in git)

- Full `settlement-worker/` tree: Dockerfile, Railway config, worker loop, guards, health endpoints, tests, runbooks

### Contracts & ops (no on-chain changes)

- Deploy artifacts: `contracts/deployments/robinhood-*.json`
- Mainnet ops scripts, guard tests, whitelist address source (`data/mainnet/`)
- `.env.example` templates (no secrets)

### Docs

- Mainnet launch runbooks, checklists, wallet mobile connect, GDS/economic model sync

---

## 6. What was excluded (not committed)

| Category | Paths |
|----------|-------|
| **Trailer / generated media** | `reports/cinematic-ad-trailer/`, `reports/cinematic-trailer/`, `reports/day-cycle-tutorial/` (mp4/audio), `reports/epic-gameplay-trailer/`, `reports/gameplay-trailer/`, `reports/opensea-genesis-banner/` |
| **Generated reports** | `reports/MAINNET_RELEASE_CANDIDATE.md`, `reports/TESTNET_MAINNET_PARITY_AUDIT.md` |
| **Rehearsal / smoke artifacts** | `reports/mainnet-rehearsal-*.txt`, `reports/testnet/smoke-prod-gasless.json` |
| **Temporary promo scripts** | `scripts/record-*.mjs`, `scripts/build-day-cycle-tutorial-audio.mjs`, `scripts/compose-opensea-genesis-banner.mjs` |
| **Dev trailer stage** | `app/dev/cinematic-ad-stage/` |
| **Build artifacts** | `.next/**` (gitignored) |
| **Secrets** | `.env`, `.env.local`, `.env.development.local`, credentials |

---

## 7. Safety confirmation

| Rule | Status |
|------|--------|
| Mainnet settlement enabled | **NO** — `dryRun: true` on Mainnet worker healthz |
| `DRY_RUN` / `MAINNET_LIVE_ACK` changed on Mainnet | **NO** — Railway env not touched |
| Mainnet transactions sent | **NO** |
| Deployed contracts modified | **NO** |
| Wallets / keys rotated | **NO** |
| Force push | **NO** |
| Git hooks skipped | **NO** |
| Secrets in this report | **NO** |

---

## 8. Remaining pre-launch ops (non-freeze)

These are **outside** the RC v1.0 code freeze and require explicit ops approval:

1. **Whitelist Merkle** — generate real root from `data/mainnet/whitelist-addresses.txt` (`npm run genesis:merkle:mainnet`); replace placeholder proofs
2. **Treasury funding** — fund Mainnet GameTreasury per economics docs
3. **Settlement GO** — only after approval: fund settler, set `DRY_RUN=0` + `MAINNET_LIVE_ACK=I_UNDERSTAND_MAINNET_SETTLEMENT` on Mainnet worker
4. **Genesis mint timelock** — execute scheduled sale
5. **First Mainnet dry rehearsal** — commit → wallet reveal → settle → claim (post mint)
6. **Deploy JSON housekeeping** — update `randomnessProvider` in `robinhood-game.json` artifact to match on-chain `0x4D68639a…`

---

## 9. Suggested git tag

```bash
git tag -a rc-v1.0 e21b5e8d364168d2900a87a5a76a929808417c9a -m "HANSOME Release Candidate v1.0"
git push origin rc-v1.0
```

*(Tag not created automatically in this session — run manually if desired.)*

---

*End of Release Freeze RC v1.0 report.*
