# Litepaper HANSOME 2.0 Rewrite Summary

| Field | Value |
|-------|-------|
| Date | 2026-07-27 |
| Version | Litepaper **v2.0** |
| Scope | Content sources + renderer sync (no PDF regen, no deploy, no commit) |
| Touched | `content/litepaper.ts`, `content/i18n/types.ts`, `content/i18n/en.ts`, `content/i18n/zh.ts`, `components/litepaper/LitepaperDoc.tsx` (required for section render), this report |

---

## New section structure (`LITEOPBER_SECTION_ORDER`)

1. Founder Letter (`founder-letter`)
2. Introduction / What is HANSOME? (`introduction`)
3. Meme Identity (`meme-identity`) — **NEW**
4. Brand Hierarchy (`brand-hierarchy`) — **NEW**
5. HANSOME Scan & Score (`scan-score`) — **NEW**
6. Activity · Trending · Category · Confidence (`axes-confidence`) — **NEW**
7. Explore (`explore`) — **NEW**
8. $HANSOME Utility (`hansome-utility`) — **NEW**
9. Tokenomics (`tokenomics`)
10. Treasury (`treasury`)
11. Liquidity (`liquidity`)
12. Revenue (`revenue`)
13. Roadmap HANSOME 2.0 (`roadmap`)
14. Legacy: Genesis + GameFi (`legacy`) — gameplay + economic model + mint flywheel
15. Community (`community`)
16. Long-term vision (`long-term-vision`)
17. FAQ (`faq`)
18. Documents (`documents`)
19. Changelog (`changelog`)
20. Language & Translations (`language`)
21. Closing disclaimer (footer; not a nav section)

**Removed as top-level sections:** Vision, Core Philosophy (folded into meme identity / intro / utility).

---

## Main rewrite summary

- Repositioned narrative from “meme coin hoping to become a brand” → **HANSOME 2.0: meme + transparency + discovery + on-chain tools**, with alpaca meme culture preserved.
- Slogan / tagline locked in: **“Too Hansome to Be Useful.”** / **“Too Hansome to Be Useful. So we built something useful anyway.”**
- Added honest **product status labels**; Scan/Score never described as production-live.
- Documented **Score ≠ Activity ≠ Trending ≠ Category**; **Confidence = data completeness**.
- Roadmap rewritten as phased 2.0 stages; Week/Month = soft internal sequencing, not hard SLAs; Launch = CONDITIONAL.
- Genesis gameplay, GameFi economic model, and mint flywheel **moved under Legacy**.
- Revenue reframed around LP fees + tool ecosystem (not “no products planned”).
- FAQ rewritten with Score disclaimers; stale “single LP position” language fixed.
- Documents library relabels GameFi economic model files as **Legacy**.
- Changelog preserves v1.0–v1.7.1 history and adds **v2.0 (July 2026)**.
- Closing disclaimer strengthened (Score/Scan informational; status labels override marketing shorthand).

### Addition: Uniswap v4 Liquidity & Lock Intelligence (IN DEVELOPMENT)

Nested under **Scan & Score** (`scanScore.v4LockIntelligence`) in EN + ZH + types + `LitepaperDoc` render:

- **Problem:** mainstream scanners may give limited/incomplete Uniswap v4 + third-party locker visibility on Robinhood Chain (visibility gap — careful wording; no “first in world”).
- **Planned capabilities:** pool, position NFT/id, owner, locker name, lock status, unlock date, lock tx evidence, in/out of range, position liquidity, size vs withdrawal risk.
- **Explicit statuses:** LOCKED—VERIFIED ON-CHAIN · UNLOCKED/EOA-CONTROLLED · LOCK DETECTED—EXPIRY UNKNOWN · UNSUPPORTED LOCKER · UNABLE TO DETERMINE.
- **Interpretation:** unknown ≠ unlocked; detected lock ≠ safe without verified conditions; show evidence; “Liquidity visible does not necessarily mean liquidity understood.”
- **Score relationship:** Size ≠ Lock Status ≠ Ownership/Withdrawal Risk ≠ Range Status; small≠unsafe, large≠safe; lock/ownership may feed structural Score; size = slippage/context.
- **Maturity:** IN DEVELOPMENT; prototype detected HANSOME Titan **#47299**; generic multi-token/locker registry still being built — not production-ready.
- **Roadmap Phase 1** bullet + FAQ entry added as differentiator.

---

## Status labels (LIVE / IN DEVELOPMENT / PLANNED / CONDITIONAL / LEGACY)

| Product / stream | Status |
|------------------|--------|
| HANSOME Scan | **IN DEVELOPMENT** |
| HANSOME Score | **IN DEVELOPMENT** |
| Uniswap v4 Liquidity & Lock Intelligence (Scan capability) | **IN DEVELOPMENT** (not production-ready generic support) |
| HANSOME Explore | **PLANNED** |
| HANSOME Launch | **CONDITIONAL** |
| Genesis NFT / Alpacas vs Cougars | **LEGACY** |
| Gameplay overview / GameFi economic model / mint flywheel | **LEGACY** |
| Uniswap v4 LP fees (revenue) | **Active / LIVE** (only real revenue line today) |
| Scan & Score ecosystem (revenue) | **IN DEVELOPMENT** (not a live revenue line) |
| Explore discovery (revenue) | **PLANNED** |
| Merch / partnerships | **EXPLORATORY** |
| Roadmap Phase 0 Foundation | **Completed** |
| Roadmap Phase 1 Scan & Score | **IN DEVELOPMENT** |
| Roadmap Phase 2 Explore & taxonomy | **PLANNED** |
| Roadmap Phase 3 Launch path | **CONDITIONAL** |
| Roadmap Legacy GameFi | **LEGACY** |

Banned for Scan/Score as affirmative claims: “available now”, “live scanner”, “users can currently…” (only appear in negation / FAQ disclaimers).

---

## What moved to Legacy

- Gameplay Overview (Alpacas vs Cougars illustration + CTA)
- GameFi Economic Model (highlights + PDF/MD links)
- Mint-revenue “sustainable ecosystem” flywheel
- Documents labels for economic-model PDFs/Markdown → “Legacy — …”

---

## Tokenomics / Treasury / Liquidity facts

**Preserved (facts untouched; wording only where noted):**

| Fact | Status |
|------|--------|
| 1,000,000,000 HANSOME total supply | Untouched |
| 0% tax | Untouched |
| Non-mintable / immutable contract | Untouched |
| Robinhood Chain | Untouched |
| Initial distribution 90% Treasury / 5% Liquidity / 5% Founder | Untouched |
| Wallet roles (Deployment, Liquidity, Treasury, Founder) + initial allocations | Untouched |
| Uniswap v4 concentrated liquidity | Untouched |
| Titan lock position **#47299**, unlock **~2027-07-15**, Blockscout links | Untouched |
| July 2026 liquidity optimization (locked #47299 untouched + two Treasury positions) | Untouched |
| Live balances → **/transparency** | Untouched |
| No new Genesis NFT holder benefits invented | Confirmed |

**Wording-only changes around those sections:**

- Treasury **Development** line: removed “no product roadmap”; now points at HANSOME 2.0 tooling as intended future budget direction (still Planned — TODO).
- FAQ one-sided liquidity answer: updated from stale “single position” to **multiple positions / barbell** (matches Liquidity Policy facts).

---

## Preview — key EN paragraphs

**Slogan / tagline**

> Too Hansome to Be Useful.  
> Too Hansome to Be Useful. So we built something useful anyway.

**Scan status**

> HANSOME Scan is the inspection surface. HANSOME Score is the structural 0–100 output shown inside Scan. Both are IN DEVELOPMENT. This litepaper does not claim a production-live scanner…

**Score axes**

> Score ≠ Activity ≠ Trending ≠ Category.  
> Confidence = data completeness / maturity — not a second popularity meter.  
> Trending ≠ safer. Category does not affect Score. Promoted ≠ organic Trending. $HANSOME never buys Score.

**Roadmap phases**

> Phase 0 Foundation — Completed  
> Phase 1 Scan & Score — IN DEVELOPMENT  
> Phase 2 Explore & taxonomy — PLANNED  
> Phase 3 Launch path — CONDITIONAL  
> Legacy Genesis NFT / GameFi — LEGACY  
> (“Week” / “Month” = soft internal sequencing, not hard public delivery promises.)

---

## Preview — key ZH paragraphs

**口号**

> Too Hansome to Be Useful.  
> Too Hansome to Be Useful. So we built something useful anyway.

**Scan 状态**

> HANSOME Scan 是检视界面。HANSOME Score 是 Scan 内呈现的结构性 0–100 输出。两者皆为「开发中」。本白皮书不宣称生产环境已上线的扫描器…

**Score 坐标**

> Score ≠ Activity ≠ Trending ≠ Category。  
> Confidence = 数据完整度／成熟度——不是第二个热度计。  
> Trending ≠ 更安全。Category 不影响 Score。Promoted ≠ 有机 Trending。$HANSOME 永远买不到 Score。

**路线图阶段**

> 阶段 0 基础 — 已完成  
> 阶段 1 Scan & Score — 开发中  
> 阶段 2 Explore 与分类 — 规划中  
> 阶段 3 Launch 路径 — 有条件  
> Legacy Genesis NFT／GameFi — Legacy

---

## Render / typecheck

- `LitepaperDoc.tsx` updated to render new sections; Legacy nests gameplay + economic model + flywheel.
- `LITEOPBER_SECTION_ORDER`, nav keys, `LitepaperMessages` type, EN + ZH kept in sync.
- `npm run typecheck`: no errors in touched litepaper/i18n paths. Remaining project error is unrelated (`lib/game/server/testnetRevealRecovery.ts`).

**Not done (per instructions):** PDF regeneration, deploy, commit/push, `launch/WHITEPAPER.md`, game economic model doc content edits.
