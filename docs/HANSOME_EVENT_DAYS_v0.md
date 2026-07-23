# HANSOME — Event Days v0 (Design Draft)

> **DEFERRED — Future backlog. Do not implement before Mainnet mint + Season 1 Classic is stable. Not in current launch scope.**
>
> 延後 — 未來待辦。Mainnet mint 完成且 Season 1 Classic 穩定前**禁止實作**；**不在**現階段上線範圍內。

| Field | Value |
|---|---|
| Document type | Season 2+ gameplay design sketch (**NOT** GDS v1.1 amendment) |
| Status | **Design draft / DEFERRED — future backlog only** |
| Scope | Bilingual event catalog + rules sketch + implementation tiers |
| Does **not** define | Season 1 settlement, 80/10/10 pools, Classic location weights, locked trait numbers |
| Companion docs | [`docs/SEASON2_MODULE_MINIMAL_INTERFACE.md`](SEASON2_MODULE_MINIMAL_INTERFACE.md), [`docs/HANSOME_GDS_v1.1_en.md`](HANSOME_GDS_v1.1_en.md), [`docs/HANSOME_GDS_v1.1_zh-TW.md`](HANSOME_GDS_v1.1_zh-TW.md), [`docs/CURSOR_AGENT_HANDOFF.md`](CURSOR_AGENT_HANDOFF.md) |

> **Explicit:** Event Days require a **GDS version upgrade** (e.g. v1.2+ or a dedicated Season 2 addendum) and **Event-mode contracts** before production. They must **not** silently alter the current five-location Classic settlement used in Season 1. **Park ideas here; do not ship contracts, frontend, or settlement code until owner explicitly re-opens scope after S1 is live and stable.**

---

## 1. Status and authority

| Topic | Policy |
|---|---|
| Season 1 | **Locked.** Every day uses Classic mode: five locations, weights `1 / 2 / 3 / 5 / 8`, Cougars barred from Home, GDS v1.1 settlement. |
| Event Days | **Future opt-in layer.** Only active on days explicitly flagged `mode = Event`. |
| Classic truth | [`docs/HANSOME_GDS_v1.1_en.md`](HANSOME_GDS_v1.1_en.md) / [`docs/HANSOME_GDS_v1.1_zh-TW.md`](HANSOME_GDS_v1.1_zh-TW.md) — locations, pools, traits, hunt order, Farmer normalization. |
| Season 2 boundary | [`docs/SEASON2_MODULE_MINIMAL_INTERFACE.md`](SEASON2_MODULE_MINIMAL_INTERFACE.md) — Genesis read-only gate; Event settlement lives in a **separate module**, not inside locked `HansomeGame`. |

**Do not implement Event Days in Season 1 contracts, scoring v0.1.1, or live settlement without an approved spec upgrade and explicit owner request.**

---

## 2. Architecture — one day, one settlement mode

**Core principle:** For a given `dayId`, there is exactly **one** settlement truth — Classic **or** Event, never both.

```
dayId ──► mode ∈ { Classic, Event }   (mutually exclusive)
              │
              ├─ Classic ──► HansomeGame (5 locations, GDS v1.1)
              │
              └─ Event   ──► Event settlement module (event-specific rules below)
```

This follows the prior conflict-resolution discussion and aligns with [`docs/SEASON2_MODULE_MINIMAL_INTERFACE.md`](SEASON2_MODULE_MINIMAL_INTERFACE.md) §2: Season 2 / Event modules sit **beside** Season 1; they do not rewrite Classic storage or formulas.

| Anti-pattern | Why forbidden |
|---|---|
| Dual Commit (Classic + Event same day) | Two location states; double-pay or dispute risk |
| Frontend-only “fake” events while Classic settles | UI lies; trust collapse |
| Merging Classic + Event settlement outputs | Accounting nightmare; conservation breaks |
| Patching `HansomeGame` in place for events | Violates Season 1 feature freeze |

**Recommended integration (when built):**

1. **Mutually exclusive flag** — `seasonId` / `dayMode(dayId)` set before Commit opens; immutable for that day.
2. **Optional router** — single player entry (`GameplayRouter.commit(...)`) forwards to Classic or Event module based on the flag.
3. **One finalize path** — one module runs `finalizeDay` / `creditBatch` for that day; the other module is idle.

Event Days that change **location set**, **weights**, **hunt eligibility**, or **pool splits** require **Tier B** (on-chain). Info-hiding events may start as **Tier A** (UX-only) only if Classic still settles and hiding is honest (see §6).

---

## 3. Event catalog (author copy)

### 🌫️ 迷霧日｜Fog Day

隱藏各地的人數與熱力資訊。今天，你只能相信自己的判斷。

Location population and heatmap information will be hidden. Today, you'll have to trust your own judgment.

---

### 🔥 家園失火｜House on Fire

Home 當日無法進入，所有羊駝都必須前往其他地點。

Home becomes unavailable for the day, forcing every Alpaca to venture outside.

但如果某個地點有 👑 KING，該地將獲得王之庇護。

But if the 👑 KING is present at a location, that location receives Royal Protection.

🛡️ 該地所有羊駝免疫 Cougar 狩獵。

🛡️ All Alpacas there become immune to Cougar hunts.

🐆 在該地狩獵的 Cougar 將無法獲得狩獵報酬。

🐆 Cougars hunting there receive no hunting rewards.

---

### ⛈️ 風暴日｜Storm Day

隨機封鎖一個外勤地點，迫使所有玩家重新規劃路線。

One outdoor location is randomly closed, forcing everyone to rethink their strategy.

---

### 🦙 牧群日｜Herd Day

當太多羊駝聚集在同一地點，該地的有效權重將逐漸下降。

When too many Alpacas gather in one location, its effective reward weight gradually decreases.

人多不一定代表更安全，也不一定代表賺得更多。

More Alpacas doesn't always mean more safety—or more rewards.

---

### 🐆 饑荒日｜Famine Day

Cougar 的狩獵收益將受到限制。

Cougar hunting rewards will be reduced.

---

### 👑 王之危機｜King Under Siege

如果 KING 遭遇 10 隻以上的 Cougar，KING 將失去當天所有代幣收益。

If the KING encounters more than 10 Cougars, the KING will lose all token rewards for that day.

🐆 勝利的 Cougar 將獲得雙倍狩獵獎勵。

🐆 The victorious Cougars will receive double hunting rewards.

---

### 👃 嗅覺失靈｜Lost Scent

Cougar 將失去場地資訊，無法看到各地的相關數據。

Cougars lose access to location information and can no longer see data about each area.

---

### 🌙 夜行日｜Night Run

Home 不再是最安全的選擇，原本危險的外勤地點可能反而成為今天的生路，獵豹甚至可以選擇前往羊駝的家。

Home is no longer the safest choice. The dangerous outside world may become your best chance of survival, and Cougars can even choose to enter the Alpacas' home.

---

### ✨ 神秘之地｜Mysterious Land

一張平常不存在的特殊地圖突然出現。

A mysterious temporary location appears on the map.

⚡ Reward Weight：10

巨大的潛在收益，也意味著所有人都知道羊駝可能往那裡跑。

Massive potential rewards—but everyone knows the Alpacas may be heading there.

---

## 4. Rules sketch (per event)

Classic baseline (for comparison): five locations `Home(1) / Mountain(2) / Grassland(3) / Forest(5) / River(8)`; Cougars ∈ `{Mountain, Grassland, Forest, River}`; King immune to **penalty** (not gross share); hunt success = Cougar at same location as Alpaca; 80/10/10 pools per GDS v1.1.

### 🌫️ Fog Day

| Dimension | Sketch |
|---|---|
| **Who affected** | All players (UI / intel); settlement math unchanged if Tier A |
| **vs Classic** | Hide per-location population and heatmap during Commit → Reveal window |
| **Open questions** | Does hiding extend through Reveal for non-revealers? On-chain aggregates still visible via explorer — disclosure copy needed. Tier A sufficient? |

### 🔥 House on Fire

| Dimension | Sketch |
|---|---|
| **Who affected** | All Alpacas (Home banned); Cougars (hunt payout rules); Kings (trigger Royal Protection) |
| **vs Classic** | `Home` invalid for Alpaca Commit/Reveal; if ≥1 King at location L, all Alpacas at L immune to hunts; Cougars at L get **zero** hunting reward |
| **Open questions** | Royal Protection vs GDS King penalty immunity — stack or replace? Multiple Kings same location? Invalid Home commit = missed day or forced remap? **Requires Tier B.** |

### ⛈️ Storm Day

| Dimension | Sketch |
|---|---|
| **Who affected** | All participants |
| **vs Classic** | One random outdoor location ∈ `{Mountain, Grassland, Forest, River}` closed for the day; Commits/Reveals to closed id invalid |
| **Open questions** | VRF draw timing (day open vs day boundary); announce closed location when? Retry if closed location has zero commits? **Requires Tier B.** |

### 🦙 Herd Day

| Dimension | Sketch |
|---|---|
| **Who affected** | Alpacas (effective weight); indirectly Cougars (follow-the-herd meta) |
| **vs Classic** | Per-location effective weight \(w'(L)\) decreases as Alpaca count at L rises (anti-stampede) |
| **Open questions** | Curve shape (linear / step / cap)? Farmer normalization still applies to \(w'\)? Cougar base pool unchanged? **Requires Tier B.** |

### 🐆 Famine Day

| Dimension | Sketch |
|---|---|
| **Who affected** | Cougars (hunting pool share) |
| **vs Classic** | Reduce hunting rewards — e.g. scale \(R_d^H\) or per-success payout; base pool unchanged unless spec says otherwise |
| **Open questions** | Fixed % cut vs zero hunting pool? Dust still to Treasury? **Requires Tier B** for enforceable payout cap. |

### 👑 King Under Siege

| Dimension | Sketch |
|---|---|
| **Who affected** | King token (if >10 Cougars at King's location); Cougars at that location |
| **vs Classic** | If Cougar count at King's location > 10: King **gross + net = 0** for the day; successful Cougars there **2×** hunting reward |
| **Open questions** | “Encounter” = co-located at Reveal or successful hunt only? King still earns if Cougars hunt elsewhere? Cap double payout conservation — funded from Treasury or hunting pool? **Requires Tier B.** |

### 👃 Lost Scent

| Dimension | Sketch |
|---|---|
| **Who affected** | Cougar-side UI / intel |
| **vs Classic** | Cougars cannot see location-level stats (counts, heat, maybe Alpaca hints) |
| **Open questions** | Symmetric fog with Fog Day? Alpaca intel unchanged? Tier A viable if Classic settles and only Cougar dashboard is masked. |

### 🌙 Night Run

| Dimension | Sketch |
|---|---|
| **Who affected** | Alpacas (Home risk profile); Cougars (Home allowed) |
| **vs Classic** | Home loses “safest” status (penalty / hunt rules TBD); Cougars **may** Commit/Reveal to Home |
| **Open questions** | Exact Home penalty rate; hunt success at Home; interaction with King immunity. **Requires Tier B** — violates GDS Cougar-Home ban. |

### ✨ Mysterious Land

| Dimension | Sketch |
|---|---|
| **Who affected** | All participants |
| **vs Classic** | Temporary sixth location, weight **10**; Alpacas and Cougars may select it if rules mirror outdoor locations |
| **Open questions** | Location id / commit hash domain; Cougar huntable? Congestion cap; single-day only; conservation when weight 10 enters denominator. **Requires Tier B + new location enum.** |

---

## 5. Suggested rarity and cadence

Target for a **90-day season** (aligned with scoring `L = 90` in `lib/game/scoring/`):

| Parameter | Suggested range | Notes |
|---|---|---|
| Event days per season | **3–6** | Rare enough to feel special; not so many that Classic meta disappears |
| Classic days | **84–87** | Majority of season remains GDS v1.1 five-location play |
| Scheduling | Pseudo-random with seed + public calendar | Avoid predictable “River day every Tuesday” |
| Same event twice in a row | Discouraged | Cooldown or weighted without-replacement draw |

**Per-event weight (illustrative, not locked):**

| Event | Relative weight | Rationale |
|---|---|---|
| Fog Day | Medium | Tier A candidate; low settlement risk |
| House on Fire | Medium | Strong meta shift; needs King on-chain |
| Storm Day | Medium | Simple geometry change |
| Herd Day | Medium–high | Ongoing balance tuning |
| Famine Day | Medium | Cougar-only nerf |
| King Under Siege | Low | Requires King + Cougar pile-up; high drama |
| Lost Scent | Medium | Tier A candidate |
| Night Run | Low | Rule inversion; Cougar Home is a major break |
| Mysterious Land | **Lowest** | Weight 10 + new location; marquee event |

Example draw: build a bag of ~9–12 weighted slots per season, pick 3–6 without replacement, assign to non-adjacent day indices where possible.

---

## 6. Implementation tiers

| Tier | Name | What ships | Honest constraint |
|---|---|---|---|
| **A** | Frontend-info-only | Hide heatmaps / counts for Fog Day, Lost Scent; copy and art | Classic **still** settles on-chain. Players with chain literacy see aggregates — product must disclose. **Not** sufficient for House on Fire, Storm, Herd, Famine, King Under Siege, Night Run, Mysterious Land. |
| **B** | On-chain Event settlement | Event module enforces location bans, extra location, weight curves, hunt immunity, payout multipliers | Required for any rule that changes valid commits, weights, hunt success, or pool splits. Pairs with `dayMode = Event` XOR Classic. |

**Suggested phasing:**

1. **Design approval** — promote this doc + GDS addendum; freeze event ids and conservation rules.
2. **Tier B module sketch** — `IEventDaySettlement` beside `HansomeGame`; router or day flag (see §2).
3. **Tier A polish** — optional UX preview on Testnet with clear “display only” banner until Tier B live.
4. **Frontend** — `/game/season-2/*` or event banner on Classic days only when `dayMode` is authoritative from chain.

---

## 7. Cross-links and next steps

| Doc | Relevance |
|---|---|
| [`docs/HANSOME_GDS_v1.1_en.md`](HANSOME_GDS_v1.1_en.md) | Classic locations, weights, traits, settlement order, 80/10/10 |
| [`docs/HANSOME_GDS_v1.1_zh-TW.md`](HANSOME_GDS_v1.1_zh-TW.md) | 同上（繁中） |
| [`docs/SEASON2_MODULE_MINIMAL_INTERFACE.md`](SEASON2_MODULE_MINIMAL_INTERFACE.md) | Season 2 opt-in boundary; Genesis `ownerOf` gate; no Season 1 writes |
| [`docs/CURSOR_AGENT_HANDOFF.md`](CURSOR_AGENT_HANDOFF.md) | Season 1 freeze; do not silently expand scope |

**Before coding:**

1. Owner approves Event Day set and cadence (§5).
2. Publish GDS addendum with exact formulas for open questions in §4.
3. Prove daily conservation for each Tier B event (extend GDS §21-style invariants).
4. Add `dayMode` + event id to day state machine spec — not to live Season 1 deploy.

---

## Change log

| Date | Version | Notes |
|---|---|---|
| 2026-07-23 | 0.0.0 | Initial design draft from owner bilingual event catalog |
| 2026-07-23 | 0.0.1 | Top banner: **DEFERRED / future backlog** — no implementation before Mainnet mint + S1 Classic stable |

---

**End — design only; Classic five-location settlement remains Season 1 authority.**
