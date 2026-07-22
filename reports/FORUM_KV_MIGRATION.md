# Forum JSON → Vercel KV Migration

| Field | Value |
|-------|-------|
| Date | 2026-07-23 |
| Scope | NFT Forum persistence only |
| Launch path | **Untouched** (no Genesis/mint/contracts/workers changes) |

## Summary

Forum data previously lived in `data/forum/store.json` and was lost on Vercel redeploys. Persistence now uses **Vercel KV** (`@vercel/kv`) when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set. Local dev / CI without KV env vars continues to use the JSON file fallback. API request/response shapes are unchanged; no UI changes.

## Files changed

| File | Change |
|------|--------|
| `lib/game/forum/store.ts` | Thin facade — delegates to KV or JSON backend |
| `lib/game/forum/kvStore.ts` | **New** — Vercel KV implementation + one-time JSON import |
| `lib/game/forum/jsonStore.ts` | **New** — extracted JSON file backend (previous `store.ts` logic) |
| `lib/game/forum/storageConfig.ts` | **New** — KV detection, key helpers, JSON path |
| `lib/game/forum/forumStoreHelpers.ts` | **New** — shared like/nonce/thread helpers |
| `package.json` / `package-lock.json` | Added `@vercel/kv` |
| `.env.example` | Added forum KV comment block only (no Genesis/CID changes) |

**Not modified:** `app/api/game/forum/**` (routes unchanged), frontend components/hooks, `contracts/**`, mint path, game logic, workers.

## Architecture

```
app/api/game/forum/*  →  lib/game/forum/store.ts (facade)
                              ├─ isForumKvConfigured()?  →  kvStore.ts  →  @vercel/kv
                              └─ else                    →  jsonStore.ts →  data/forum/store.json
```

- **Production (Vercel):** KV env auto-injected when KV/Upstash Redis is linked. First request runs migration if KV is empty and `store.json` exists on the deployment filesystem (typically only relevant on first deploy after cutover).
- **Local / CI:** Without KV vars, behavior is identical to pre-migration JSON file storage.

### KV key schema

All keys use the `forum:` prefix (separate from commit vault `hansome:cv:v1:*`).

| Key | Type | Content |
|-----|------|---------|
| `forum:meta` | object | `{ version: 1, migratedFromJson?, migratedAt?, initializedAt? }` |
| `forum:threads:{board}` | string[] | Thread IDs for board (`tactics` \| `bugs`), newest first |
| `forum:thread:{id}` | object | Full `ForumThread` |
| `forum:replies:{threadId}` | string[] | Reply IDs in creation order |
| `forum:reply:{id}` | object | Full `ForumReply` |
| `forum:likes:{targetType}:{targetId}` | array | `ForumLike[]` for thread or reply |
| `forum:nonce:{address}` | object | `{ address, nonce, expiresAt }` with Redis TTL |
| `forum:cooldown:{address}` | number | Last post timestamp (unix ms) |

### Concurrency / race limits (MVP)

- A module-level **write chain** serializes mutations within a single server instance (same pattern as the old JSON store).
- Multiple Vercel instances can still race on concurrent writes to the same key. Acceptable for MVP forum volume; a future upgrade could use Redis `WATCH`/`MULTI` or Redlock if needed.
- Nonces use per-address keys with TTL to reduce stale nonce buildup.

## Migration process

Triggered automatically on first KV operation (`ensureForumKvMigrated()`):

1. Read `forum:meta`. If `migratedFromJson === true` → skip.
2. If any board already has thread IDs in KV → set `initializedAt` only (do not overwrite live data).
3. Else if `data/forum/store.json` exists → import threads, replies, likes, cooldowns, nonces into KV keys.
4. Set `forum:meta.migratedFromJson = true` and `migratedAt`.
5. After migration, **KV backend never reads `store.json` again** when KV is configured.

### Production cutover checklist

1. Link Vercel KV / Upstash Redis to the project (Production env).
2. Confirm `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Vercel Production.
3. Deploy this commit.
4. Hit any forum API (e.g. `GET /api/game/forum/threads?board=tactics`) once to run migration.
5. Verify posts survive a redeploy.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `KV_REST_API_URL` | Production | Auto-injected by Vercel KV integration |
| `KV_REST_API_TOKEN` | Production | Auto-injected by Vercel KV integration |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional | Accepted as aliases (same as commit vault) |
| `FORUM_STORE_PATH` | Optional | Override JSON fallback path (local only) |

Forum shares the same Redis/KV instance as the commit vault but uses isolated `forum:*` keys.

## Verification results

| Check | Result |
|-------|--------|
| `npm install @vercel/kv` | OK |
| `npm run typecheck` (`tsc --noEmit`) | **Pass** (exit 0) |
| `npm run lint` | **Pass** (exit 0; pre-existing warnings elsewhere, none new in forum KV files after unused-import fix) |
| KV persistence on redeploy | **Not run locally** — requires Vercel KV provisioning; code path verified via typecheck + review |

### Local smoke test (JSON fallback)

Without `KV_REST_API_*` set, forum APIs continue to read/write `data/forum/store.json` as before.

## Rollback plan

1. **Quick:** Redeploy previous commit (forum reverts to JSON-only). Existing KV data remains but is unused until KV code is deployed again.
2. **Export from KV:** Use Vercel/Upstash dashboard or `redis-cli` REST to dump `forum:*` keys if manual backup needed.
3. **Disable KV temporarily:** Unset `KV_REST_API_*` in Vercel → app falls back to JSON (empty on serverless unless file is bundled). **Not recommended for Production** once migrated; prefer re-linking KV.

## Preserved behavior

- Create thread / reply, soft-delete (hide), list, read, like toggle
- Boards `tactics` \| `bugs`, sorting, timestamps, rate limits/cooldowns
- Wallet signature auth, NFT ownership checks, text sanitization
- No edit-post API (unchanged — not implemented before)

## Launch path confirmation

**Genesis NFT launch path untouched:** no changes to contracts, mint components, `scripts-nft`, genesis identity/reveal, commit/reveal gameplay, workers, wallet logic, or blind-box env sections.
