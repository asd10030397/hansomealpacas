"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GUIDE_CLASSES,
  GUIDE_CORE_FLOW,
  GUIDE_CORE_PHASES,
  GUIDE_COUGAR_PHASES,
  GUIDE_COVER_HERO,
  GUIDE_LOCATIONS,
  GUIDE_PAGE_COUNT,
  PLAYER_GUIDE_IMAGES,
  type BiText,
  type GuidePhase,
} from "@/content/game/playerGuide";
import { useGameHref } from "@/hooks/game/useGameHref";
import { PLAYER_GUIDE_PDF_HREF } from "@/lib/game/playerGuidePdf";
import "@/styles/player-guide.css";

function Bi({ text }: { text: BiText }) {
  return (
    <div className="pg-bi">
      <p className="en">{text.en}</p>
      <p className="zh">{text.zh}</p>
    </div>
  );
}

function SecHead({ n, en, zh }: { n: string | number; en: string; zh: string }) {
  return (
    <div className="pg-sec-head">
      <span className="pg-sec-num">{n}</span>
      <div>
        <h2>{en}</h2>
        <h2 className="zh">{zh}</h2>
      </div>
    </div>
  );
}

function RiskMeter({ n }: { n: number }) {
  return (
    <span className="pg-meter" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i <= n ? "on" : ""} />
      ))}
    </span>
  );
}

function PhaseCard({ phase }: { phase: GuidePhase }) {
  return (
    <div className={`pg-phase${phase.image ? " pg-phase--shot" : ""}`}>
      <div className="pg-phase__top">
        <span className="pg-phase__emoji">{phase.emoji}</span>
        <span className="pg-phase__n">{phase.n}</span>
      </div>
      <h3>{phase.title.en}</h3>
      <h3 className="zh">{phase.title.zh}</h3>
      <Bi text={phase.body} />
      {phase.bullets && phase.bullets.length > 0 ? (
        <ul className="pg-phase__bullets">
          {phase.bullets.map((b) => (
            <li key={b.en}>
              <span className="en">{b.en}</span>
              <span className="zh"> · {b.zh}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {phase.image ? (
        <figure className="pg-phase__shot">
          <Image
            src={phase.image}
            alt={phase.imageAlt?.en ?? phase.title.en}
            width={1280}
            height={900}
            unoptimized
          />
          <figcaption>
            {phase.imageAlt?.en ?? phase.title.en}
            {phase.imageAlt?.zh ? (
              <>
                <br />
                <span className="zh">{phase.imageAlt.zh}</span>
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function CoreFlow() {
  return (
    <ol className="pg-flow" aria-label="Daily gameplay flow">
      {GUIDE_CORE_FLOW.map((step, i) => (
        <li key={step.en} className="pg-flow__step">
          <div className="pg-flow__label">
            <b>{step.en}</b>
            <span className="zh">{step.zh}</span>
          </div>
          {i < GUIDE_CORE_FLOW.length - 1 ? (
            <span className="pg-flow__arrow" aria-hidden>
              ↓
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function useIsDesktopPaged() {
  const [paged, setPaged] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setPaged(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return paged;
}

export function PlayerGuide() {
  const gameHref = useGameHref();
  const paged = useIsDesktopPaged();
  const [page, setPage] = useState(0);
  const [mobileSection, setMobileSection] = useState(0);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(GUIDE_PAGE_COUNT - 1, index));
      setPage(next);
      if (!paged) {
        pageRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [paged],
  );

  useEffect(() => {
    if (!paged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPage((p) => Math.min(GUIDE_PAGE_COUNT - 1, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
      } else if (e.key === "Home") {
        setPage(0);
      } else if (e.key === "End") {
        setPage(GUIDE_PAGE_COUNT - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged]);

  useEffect(() => {
    if (paged) return;
    const nodes = pageRefs.current.filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target) return;
        const idx = Number((visible.target as HTMLElement).dataset.pageIndex);
        if (!Number.isNaN(idx)) setMobileSection(idx);
      },
      { root: null, threshold: [0.35, 0.55, 0.75] },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [paged]);

  const statusIndex = paged ? page : mobileSection;

  const setRef = (i: number) => (el: HTMLElement | null) => {
    pageRefs.current[i] = el;
  };

  return (
    <article
      className={`player-guide${paged ? " player-guide--paged" : ""}`}
      aria-label="HANSOME Player Guide"
    >
      <div className="player-guide__toolbar">
        <Link href={gameHref.docs}>← Docs</Link>
        <span className="player-guide__toolbar-title">Player Guide · 玩家指南</span>
        <a href={PLAYER_GUIDE_PDF_HREF} download>
          PDF
        </a>
      </div>

      <div className="player-guide__deck">
        {/* 0 Cover */}
        <section
          ref={setRef(0)}
          data-page-index={0}
          className={`player-guide__page${page === 0 ? " is-active" : ""}`}
          aria-label="Cover"
        >
          <div className="pg-cover">
            <div className="pg-brandline">
              <Image src={PLAYER_GUIDE_IMAGES.logo} alt="" width={64} height={64} unoptimized />
              <span>HANSOME ALPACAS</span>
            </div>
            <h1>HANSOME Alpacas</h1>
            <div className="pg-cover__vs">Alpacas vs Cougars · 羊驼 对 美洲狮</div>
            <div className="pg-cover__guide">
              <b>Player Guide</b> / 玩家指南
            </div>
            <div className="pg-tagband">
              <span>Blockchain Strategy Survival</span>
              <span>区块链策略生存</span>
              <span>500 Genesis Alpacas</span>
              <span>Robinhood Chain</span>
            </div>
            <div className="pg-hero">
              {GUIDE_COVER_HERO.map((h) => (
                <figure key={h.key}>
                  <Image src={h.image} alt={h.label} width={256} height={256} unoptimized />
                  <figcaption>{h.label}</figcaption>
                </figure>
              ))}
            </div>
            <div className="pg-cover__foot">
              <span>NFT Collector & Player Guide · 收藏者与玩家指南</span>
              <span>Consistent with HANSOME GDS v1.1</span>
            </div>
          </div>
        </section>

        {/* 1 Intro + Core */}
        <section
          ref={setRef(1)}
          data-page-index={1}
          className={`player-guide__page${page === 1 ? " is-active" : ""}`}
          aria-label="Game Introduction"
        >
          <SecHead n={1} en="Game Introduction" zh="游戏介绍" />
          <div className="pg-panel">
            <Bi
              text={{
                en: "HANSOME Alpacas is a blockchain strategy survival game where NFT Alpacas compete against Cougars through daily strategic decisions.",
                zh: "HANSOME Alpacas 是一款区块链策略生存游戏，玩家使用 NFT 羊驼角色，通过每日策略选择与美洲狮对抗。",
              }}
            />
            <ul className="pg-bullets">
              <li>
                <b>NFT Alpacas are playable characters.</b> · NFT 羊驼是可游玩的角色。
              </li>
              <li>
                <b>Each Alpaca has a unique identity and gameplay possibilities.</b> ·
                每只羊驼都有独特的身分与策略可能性。
              </li>
              <li>
                <b>Strategy and risk management determine rewards.</b> ·
                策略与风险管理决定你的收益。
              </li>
            </ul>
          </div>
          <SecHead n={2} en="Core Gameplay" zh="核心玩法" />
          <div className="pg-panel">
            <Bi
              text={{
                en: "Every day is one round. Players choose a location, then watch the battle resolve automatically, and claim HANSOME anytime.",
                zh: "每天为一个回合。玩家选择地点，接着观看自动结算的战斗结果，并可随时领取 HANSOME。",
              }}
            />
            <div className="pg-phases pg-phases--core">
              {GUIDE_CORE_PHASES.map((p) => (
                <PhaseCard key={p.n} phase={p} />
              ))}
            </div>
            <CoreFlow />
          </div>
        </section>

        {/* 2 Locations */}
        <section
          ref={setRef(2)}
          data-page-index={2}
          className={`player-guide__page${page === 2 ? " is-active" : ""}`}
          aria-label="Locations"
        >
          <SecHead n={3} en="Locations" zh="游戏地点" />
          <div className="pg-panel">
            <Bi
              text={{
                en: "Five locations, each balancing reward against hunting risk. Higher reward means higher danger from Cougars.",
                zh: "五个地点，各自在收益与狩猎风险之间取得平衡。收益越高，遭遇美洲狮的危险也越高。",
              }}
            />
            <div style={{ marginTop: "0.65rem" }}>
              {GUIDE_LOCATIONS.map((l) => (
                <div key={l.name.en} className="pg-loc">
                  <div className="pg-loc__name">
                    <span className="emoji">{l.emoji}</span>
                    <div>
                      <b>{l.name.en}</b> <span className="zh">{l.name.zh}</span>
                    </div>
                  </div>
                  <div>
                    <div className="pg-mrow">
                      <span className="pg-mlab">
                        Reward / 收益 <b>×{l.weight}</b>
                      </span>
                      <RiskMeter
                        n={l.risk === 0 ? 0 : Math.max(1, Math.round((l.weight / 8) * 4))}
                      />
                    </div>
                    <div className="pg-mrow">
                      <span className="pg-mlab">Risk / 风险</span>
                      <RiskMeter n={l.risk} />
                    </div>
                  </div>
                  <Bi text={l.desc} />
                </div>
              ))}
            </div>
            <p className="pg-note">
              Location names, reward weights and risk order follow HANSOME GDS v1.1 §5. ·
              地点名称、收益权重与风险顺序依据 HANSOME GDS v1.1 第 5 章。
            </p>
          </div>
        </section>

        {/* 3 Classes */}
        <section
          ref={setRef(3)}
          data-page-index={3}
          className={`player-guide__page${page === 3 ? " is-active" : ""}`}
          aria-label="Alpaca Classes"
        >
          <SecHead n={4} en="Alpaca Gameplay Classes" zh="羊驼角色分类" />
          <div className="pg-class-grid">
            {GUIDE_CLASSES.map((c) => (
              <div key={c.key} className="pg-card">
                <div
                  className={`pg-card__art${c.key === "common" ? " pg-card__art--common" : ""}`}
                >
                  <Image src={c.image} alt={c.name.en} width={160} height={160} unoptimized />
                </div>
                <div className="pg-card__body">
                  <div className="pg-card__title">
                    <span className="emoji">{c.emoji}</span>
                    <div>
                      <h3>{c.name.en}</h3>
                      <h3 className="zh">{c.name.zh}</h3>
                    </div>
                  </div>
                  <div className="pg-card__tag">
                    &quot;{c.tag.en}&quot; · 「{c.tag.zh}」
                  </div>
                  <div className="pg-badges">
                    <span className="pg-badge pg-badge--supply">
                      Supply / 供应量 · {c.supply}
                    </span>
                    <span className="pg-badge pg-badge--tier">{c.tier}</span>
                  </div>
                  <div className="pg-kv">
                    <span className="k">Ability / 能力</span>
                    <Bi text={c.ability} />
                  </div>
                  <div className="pg-kv">
                    <span className="k">Playstyle / 玩法</span>
                    <Bi text={c.playstyle} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4 Strategy + Philosophy */}
        <section
          ref={setRef(4)}
          data-page-index={4}
          className={`player-guide__page${page === 4 ? " is-active" : ""}`}
          aria-label="Strategy"
        >
          <SecHead n={5} en="Strategy Examples" zh="策略示例" />
          <div className="pg-panel">
            <div className="pg-value">
              {[
                { vi: "👑", en: "King", zh: "王者", t: { en: "Can safely challenge dangerous locations.", zh: "可以安全挑战高风险地点。" } },
                { vi: "🛡️", en: "Guardian", zh: "守护者", t: { en: "Better survival under pressure.", zh: "承受风险能力更高。" } },
                { vi: "🌾", en: "Farmer", zh: "农夫", t: { en: "Rewards long-term consistency.", zh: "适合长期累积。" } },
                { vi: "🍀", en: "Lucky", zh: "幸运", t: { en: "Depends on fortune.", zh: "依靠幸运翻盘。" } },
                { vi: "🏃", en: "Runner", zh: "奔跑者", t: { en: "Uses escape ability against hunters.", zh: "利用逃脱能力反制狩猎。" } },
                { vi: "🦙", en: "Common", zh: "普通", t: { en: "Wins through smart decisions.", zh: "靠策略取胜。" } },
              ].map((v) => (
                <div key={v.en} className="pg-value__item">
                  <div className="vi">{v.vi}</div>
                  <h4>
                    {v.en} <span className="zh">{v.zh}</span>
                  </h4>
                  <Bi text={v.t} />
                </div>
              ))}
            </div>
          </div>
          <SecHead n={6} en="NFT Philosophy" zh="NFT 设计理念" />
          <div className="pg-panel">
            <Bi
              text={{
                en: "HANSOME Alpacas are not only collectible images. Each NFT represents a playable character.",
                zh: "HANSOME Alpacas 不只是收藏图片。每个 NFT 都代表一个可游玩的角色。",
              }}
            />
            <div className="pg-value pg-value--3" style={{ marginTop: "0.65rem" }}>
              <div className="pg-value__item">
                <div className="vi">🎨</div>
                <h4>
                  Visual Identity <span className="zh">独特外观</span>
                </h4>
                <Bi
                  text={{
                    en: "A handcrafted pixel-art alpaca with its own look.",
                    zh: "手绘像素风羊驼，拥有专属的外型。",
                  }}
                />
              </div>
              <div className="pg-value__item">
                <div className="vi">⚔️</div>
                <h4>
                  Gameplay Class <span className="zh">游戏定位</span>
                </h4>
                <Bi
                  text={{
                    en: "A role that shapes how you survive and earn.",
                    zh: "决定你如何生存与获利的角色定位。",
                  }}
                />
              </div>
              <div className="pg-value__item">
                <div className="vi">🧠</div>
                <h4>
                  Strategic Possibilities <span className="zh">策略可能性</span>
                </h4>
                <Bi
                  text={{
                    en: "Different classes open different strategies.",
                    zh: "不同定位带来不同的策略可能性。",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 5 Special 21 */}
        <section
          ref={setRef(5)}
          data-page-index={5}
          className={`player-guide__page${page === 5 ? " is-active" : ""}`}
          aria-label="Special 21"
        >
          <SecHead n="★" en="The Special 21" zh="尊爵 21" />
          <div className="pg-s21">
            <Image
              src={PLAYER_GUIDE_IMAGES.special21}
              alt="Special 21"
              width={1024}
              height={640}
              unoptimized
            />
            <div className="pg-s21__cap">
              1 King + 5 Guardian + 5 Farmer + 5 Lucky + 5 Runner — the 21 rarest Alpacas of
              the Genesis collection.
              <br />1 位王者 + 5 位守护者 + 5 位农夫 + 5 位幸运 + 5 位奔跑者 — Genesis
              系列中最稀有的 21 只羊驼。
            </div>
          </div>
        </section>

        {/* 6 Cougars */}
        <section
          ref={setRef(6)}
          data-page-index={6}
          className={`player-guide__page${page === 6 ? " is-active" : ""}`}
          aria-label="Cougars"
        >
          <SecHead n={7} en="The Cougars — The Hunters" zh="美洲狮 — 狩猎者" />
          <div className="pg-panel">
            <div className="pg-cintro">
              <Image
                className="pg-cimg"
                src={PLAYER_GUIDE_IMAGES.cougar}
                alt="Cougar"
                width={220}
                height={220}
                unoptimized
              />
              <div>
                <Bi
                  text={{
                    en: "HANSOME isn't only Alpacas. Cougars are the predators — a separate collection of 50 hunters. Each day they stalk the map, hunt Alpacas, and claim a share of the daily rewards.",
                    zh: "HANSOME 不只有羊驼。美洲狮是掠食者 — 一个独立的 50 只猎手系列。牠们每天在地图上追踪、狩猎羊驼，并瓜分每日奖励。",
                  }}
                />
                <div className="pg-badges" style={{ marginTop: "0.5rem" }}>
                  <span className="pg-badge pg-badge--supply">Supply / 供应量 · 50</span>
                  <span className="pg-badge pg-badge--tier">All identical / 全部相同</span>
                  <span className="pg-badge pg-badge--tier">No special abilities / 无特殊能力</span>
                </div>
              </div>
            </div>
          </div>
          <div className="pg-panel">
            <div className="pg-kv">
              <span className="k">One design, fifty hunters / 一种设计，五十只猎手</span>
            </div>
            <Bi
              text={{
                en: "Every Cougar is the same. There are no Cougar rarity tiers and no special abilities — all 50 share this exact artwork and hunt on equal footing. Your edge comes purely from where you choose to hunt each day.",
                zh: "每一只美洲狮都一样。美洲狮没有稀有度分级，也没有任何特殊能力 — 全部 50 只共用这张美术，并在完全相同的条件下狩猎。你的优势完全取决于每天选择在哪里狩猎。",
              }}
            />
          </div>
          <div className="pg-panel">
            <div className="pg-kv">
              <span className="k">How Cougars Play / 美洲狮怎么玩</span>
            </div>
            <div className="pg-phases">
              {GUIDE_COUGAR_PHASES.map((p) => (
                <PhaseCard key={p.n + p.title.en} phase={p} />
              ))}
            </div>
            <div className="pg-value" style={{ marginTop: "0.75rem" }}>
              <div className="pg-value__item">
                <div className="vi">🍖</div>
                <h4>
                  Base Pool <span className="zh">基础奖池</span>
                </h4>
                <Bi
                  text={{
                    en: "Every valid Cougar shares this equally — even without a catch.",
                    zh: "每只有效参与的美洲狮平均瓜分 — 即使没抓到也有。",
                  }}
                />
              </div>
              <div className="pg-value__item">
                <div className="vi">🏆</div>
                <h4>
                  Hunting Pool <span className="zh">狩猎奖池</span>
                </h4>
                <Bi
                  text={{
                    en: "Only successful hunters share this. Your cut scales with the number of Alpacas caught.",
                    zh: "只有成功狩猎者能瓜分。分得多寡取决于抓到的羊驼数量。",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 7 Earn */}
        <section
          ref={setRef(7)}
          data-page-index={7}
          className={`player-guide__page${page === 7 ? " is-active" : ""}`}
          aria-label="Earn HANSOME"
        >
          <SecHead n={8} en="How to Earn HANSOME" zh="如何获得 HANSOME 代币" />
          <div className="pg-panel">
            <Bi
              text={{
                en: "Every day, a fixed reward pool of HANSOME is paid from the Game Treasury and split three ways:",
                zh: "每天由「游戏金库」拨出一份固定的 HANSOME 奖励池，并分成三部分：",
              }}
            />
            <div className="pg-split">
              <div className="pg-pie" aria-hidden>
                <div className="pg-pie__center">
                  <div>
                    <b>Daily Pool</b>
                    <span>每日奖池</span>
                  </div>
                </div>
              </div>
              <div className="pg-legend">
                <div className="pg-legend__row">
                  <span className="pg-legend__sw" style={{ background: "var(--pg-green)" }} />
                  <div>
                    <b>
                      80% · Alpaca Pool <span className="zh">羊驼奖池</span>
                    </b>
                    <p>Shared by all Alpacas by location weight. · 由所有羊驼依地点权重瓜分。</p>
                  </div>
                </div>
                <div className="pg-legend__row">
                  <span className="pg-legend__sw" style={{ background: "var(--pg-violet)" }} />
                  <div>
                    <b>
                      10% · Cougar Base Pool <span className="zh">美洲狮基础奖池</span>
                    </b>
                    <p>Split equally among all Cougars. · 由所有美洲狮平均分配。</p>
                  </div>
                </div>
                <div className="pg-legend__row">
                  <span className="pg-legend__sw" style={{ background: "#e76f51" }} />
                  <div>
                    <b>
                      10% · Hunting Pool <span className="zh">狩猎奖池</span>
                    </b>
                    <p>For Cougars whose hunt succeeds. · 分给狩猎成功的美洲狮。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pg-value pg-value--3">
            <div className="pg-value__item">
              <div className="vi">🦙</div>
              <h4>
                If you hold an Alpaca <span className="zh">持有羊驼</span>
              </h4>
              <Bi
                text={{
                  en: "Your share of the 80% pool grows with your location's reward weight — minus any hunting penalty. Your gameplay class (King, Guardian, Lucky, Runner…) reduces or removes that penalty.",
                  zh: "你在 80% 奖池中的分配，随所选地点的收益权重提高 — 再扣除狩猎惩罚。你的角色定位（王者、守护者、幸运、奔跑者…）能降低或免除该惩罚。",
                }}
              />
            </div>
            <div className="pg-value__item">
              <Image
                className="pg-cthumb"
                src={PLAYER_GUIDE_IMAGES.cougar}
                alt=""
                width={40}
                height={40}
                unoptimized
              />
              <h4>
                If you hold a Cougar <span className="zh">持有美洲狮</span>
              </h4>
              <Bi
                text={{
                  en: "Every Cougar is equal: earn an equal share of the 10% Base Pool, plus the 10% Hunting Pool whenever your hunt succeeds.",
                  zh: "每只美洲狮一律平等：平均分得 10% 基础奖池；狩猎成功时再分得 10% 狩猎奖池。",
                }}
              />
            </div>
            <div className="pg-value__item">
              <div className="vi">💰</div>
              <h4>
                Claiming <span className="zh">领取奖励</span>
              </h4>
              <Bi
                text={{
                  en: "After each day is settled, rewards become claimable — pull them to your wallet anytime. Unclaimed rewards stay with the NFT.",
                  zh: "每日结算后，奖励即可领取 — 随时提领到钱包。未领取的奖励会跟着 NFT 一起保留。",
                }}
              />
            </div>
          </div>

          <div className="pg-box">
            <div className="pg-box__t">Honest by design / 诚实设计</div>
            <Bi
              text={{
                en: "Fixed supply of 1,000,000,000 HANSOME — no minting. All rewards come from the Game Treasury, never from inflation.",
                zh: "固定供应 10 亿 HANSOME — 不增发。所有奖励皆来自游戏金库，绝不通过通膨产生。",
              }}
            />
            <Bi
              text={{
                en: "There is no guaranteed USD return. Rewards depend on your strategy, participation, and each day's results.",
                zh: "不保证任何美元回报。奖励取决于你的策略、参与度以及每日的结果。",
              }}
            />
          </div>

          <div className="pg-footer">
            <span>HANSOME Alpacas · Player Guide / 玩家指南</span>
            <span>Rules consistent with HANSOME GDS v1.1 · 规则依据 HANSOME GDS v1.1</span>
          </div>
        </section>
      </div>

      <nav className="player-guide__pager" aria-label="Guide pages">
        <button
          type="button"
          className="player-guide__pager-btn"
          aria-label="Previous section"
          disabled={statusIndex <= 0}
          onClick={() => goTo(statusIndex - 1)}
        >
          ‹
        </button>
        <span className="player-guide__pager-status" aria-live="polite">
          {statusIndex + 1}/{GUIDE_PAGE_COUNT}
        </span>
        <button
          type="button"
          className="player-guide__pager-btn"
          aria-label="Next section"
          disabled={statusIndex >= GUIDE_PAGE_COUNT - 1}
          onClick={() => goTo(statusIndex + 1)}
        >
          ›
        </button>
      </nav>
    </article>
  );
}
