# Season Scoring Integration Review — v0.1.1

| Field | Value |
|------|------|
| Date | 2026-07-19 |
| scoringVersion | `v0.1.1` (pinned) |
| Module | `lib/game/scoring/` |
| Tests | `npm run test:scoring` → **27/27 passed** |
| Production boards | **Not enabled** |
| Cutover recommendation | **NO-GO** (see §9) |

---

## 1. Settlement input integrity

| Check | Result | Notes |
|------|------|------|
| Scoring is a pure function of `SettlementDayInput` | **PASS** | No RPC / wallet / client reads inside the module |
| Inputs must be finalized settlement data | **PASS (contract documented)** | Types + `recompute` docs require post–I-SINGLE-SETTLE snapshots; Reveal-close owner |
| Client-supplied values rejected by design | **PASS (boundary)** | Module has no client path; indexer must not accept UI payloads as settlement truth |
| Duplicate tokenId same day | **PASS** | Throws in `scoreSettlementDay` |
| Duplicate protocol day in season batch | **PASS** | Throws via `assertUniqueProtocolDays` |

**Residual risk (ops, not module):** Live cutover still needs an indexer that builds snapshots only from finalized on-chain settlement outputs. That pipeline is **not present** in-repo yet.

---

## 2. Determinism

| Check | Result |
|------|------|
| Same day input → same NFT/wallet scores | **PASS** |
| Input order independence (day list reversed) | **PASS** |
| Full-season **L = 90** replay test | **PASS** (`integration.test.ts`) |
| Canonical JSON stable for audit hashing | **PASS** |
| Metric rounding (8 dp) before rank | **PASS** |

---

## 3. Wallet normalization

| Check | Result |
|------|------|
| `K = 3` exact | **PASS** (`SCORING_CONSTANTS.K`) |
| Over-cap → lowest `tokenId`s | **PASS** |
| No sum / best-K | **PASS** |
| Same NFT → two wallets same day | **PASS** (duplicate `tokenId` throws) |
| Transfer mid-season | **PASS** | Day‑N owner from that day’s snapshot only; prior owner gets 0 that day |

---

## 4. Season handling

| Check | Result |
|------|------|
| Denominator `L = 90` | **PASS** |
| Inactive / missing days = 0 | **PASS** (pinned `seasonStartDay` window) |
| Timezone | **PASS (documented)** | Protocol day integer; UTC bounds per GDS §6.2; module never parses local clocks |
| Season rollover | **PASS** | Separate `seasonId` + `seasonStartDay`; hard reset |

**Production requirement:** Always pass `seasonStartDay` when aggregating (added in this review). Do not infer the window solely from the first observed participation day.

---

## 5. Tie handling

| Check | Result |
|------|------|
| Identical metrics → identical scores | **PASS** |
| No score break via wallet / tokenId / tx order / RNG | **PASS** |
| UI may order tied rows for display | **Allowed** | Display sort only; must not change stored `SeasonScore` |

---

## 6. Special boards

| Board | Result |
|------|------|
| Hunter | Cougar-only, K-capped daily means of within-role NFT scores |
| Survivor | Alpaca under-hunt only; Home excluded (`survivorDayScore = null`) |
| Earnings | `rankEarningsWithinRole` — Alpaca and Cougar never merged |
| Wallet HANSOME balance | Forbidden (`BOARDS_META`) |

---

## 7. Failure / edge-case tests

| Case | Covered |
|------|------|
| No participants | ✅ |
| One participant at a location (`n < n_min` → 50) | ✅ |
| All participants tied | ✅ |
| More than K NFTs | ✅ |
| NFT transferred mid-season | ✅ |
| Missing settlement day | ✅ |
| Duplicate settlement record | ✅ |
| Season rollover | ✅ |
| Scoring-version mismatch | ✅ |
| Full L=90 replay | ✅ |

---

## 8. Live cutover checklist (do not execute yet)

### A. Historical backfill
- [ ] Indexer emits one `SettlementDayInput` per finalized protocol day
- [ ] Pin `seasonStartDay` + `seasonId` for the target season
- [ ] Store canonical JSON (or hash) per day for audit
- [ ] Run `recomputeSeasonFromSettlements` over full L days (including empty days)
- [ ] Persist NFT daily scores, wallet daily scores, season aggregates with `scoringVersion`

### B. Verification
- [ ] Replay backfill twice → bit-identical season tables
- [ ] Spot-check ≥3 days against on-chain settlement outputs (netReward, hunt fields, Reveal-close owner)
- [ ] Compare board shapes against Demo UI (roles, four boards) — **not** Demo point values
- [ ] Confirm no wallet token-balance field enters any board query
- [ ] Confirm Earnings stays role-split

### C. Version pinning
- [ ] Deploy/config pin `scoringVersion = "v0.1.1"`
- [ ] Reject snapshots with any other version
- [ ] Spec + module version strings match in release notes

### D. Frontend cutover (only after A–C)
- [ ] Replace Demo rank data source with scored aggregates API
- [ ] Remove “Demo / Under Review” / “NOT FINAL” copy from leaderboard
- [ ] Keep four boards: Season, Hunter, Survivor, Earnings
- [ ] Document UI tie display order (does not alter scores)
- [ ] **Current active season only** — no season picker, archive pages, or past-season APIs

### E. Rollback
- [ ] Feature flag: `leaderboardSource = demo | v0.1.1`
- [ ] Keep Demo fixtures loadable for instant rollback
- [ ] On anomaly: flip flag to `demo`, freeze indexer writes, preserve scored tables for forensics
- [ ] Do not mutate historical snapshots; recompute only with explicit version bump approval

---

## 9. GO / NO-GO — leaderboard cutover

### Module freeze: **GO**

The v0.1.1 scoring library is approved for production use **as the scoring engine**, with 27/27 tests green and integration checks above satisfied inside the module boundary.

### Live leaderboard cutover: **NO-GO**

Do **not** enable production boards yet. Blocking items:

1. No finalized-settlement indexer / snapshot pipeline in place  
2. No historical backfill + dual-replay verification executed  
3. Frontend still correctly marked Demo / Under Review  
4. Cutover checklist §8 items A–E incomplete  

**Next approval gate:** Complete §8 A–C, then request explicit enablement for §8 D (frontend cutover). Until then, keep Demo ranks.
