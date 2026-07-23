/**
 * Bilingual Player Guide content (same source as the A4 PDF generator).
 * Rules/numbers must stay consistent with docs/HANSOME_GDS_v1.1_en.md.
 */

export type BiText = { en: string; zh: string };

export type GuideClass = {
  key: string;
  emoji: string;
  name: BiText;
  tag: BiText;
  supply: number;
  tier: string;
  ability: BiText;
  playstyle: BiText;
  image: string;
};

export type GuideLocation = {
  emoji: string;
  name: BiText;
  weight: number;
  risk: number;
  desc: BiText;
};

export type GuidePhase = {
  n: string;
  emoji: string;
  title: BiText;
  body: BiText;
  /** Optional bullet lines under the body (bilingual). */
  bullets?: BiText[];
  /** Real in-game UI screenshot path (public/). */
  image?: string;
  imageAlt?: BiText;
};

export const PLAYER_GUIDE_IMAGES = {
  logo: "/logo.png",
  king: "/pixel/genesis/special/001.png",
  guardian: "/pixel/genesis/special/011.png",
  farmer: "/pixel/genesis/special/016.png",
  lucky: "/pixel/genesis/special/021.png",
  runner: "/pixel/genesis/special/026.png",
  common: "/pixel/traits/base/normalized/curly.png",
  special21: "/pixel/genesis/special/_SPECIAL-REVIEW.png",
  cougar: "/pixel/cougar/cougar-official-base.png",
  chooseLocation: "/docs/guide/choose-location.png",
  battleResult: "/docs/guide/battle-result.png",
  claimRewards: "/docs/guide/claim-rewards.png",
} as const;

/** Simple daily loop shown under Core Gameplay cards. */
export const GUIDE_CORE_FLOW: BiText[] = [
  { en: "Choose Location", zh: "选择地点" },
  { en: "Battle Begins", zh: "战斗开始" },
  { en: "Battle Result", zh: "战斗结果" },
  { en: "Claim Anytime", zh: "随时领取" },
];

export const GUIDE_CLASSES: GuideClass[] = [
  {
    key: "king",
    emoji: "👑",
    name: { en: "King Alpaca", zh: "王者羊驼" },
    tag: { en: "The Ultimate Survivor", zh: "终极生存者" },
    supply: 1,
    tier: "Legendary · 1 of 500",
    ability: {
      en: "Permanent immunity to hunting penalty.",
      zh: "永久免疫狩猎伤害。",
    },
    playstyle: {
      en: "The legendary King of the herd — can safely challenge the most dangerous locations.",
      zh: "羊驼族群中的传说王者 — 可以安全挑战最高风险地点。",
    },
    image: PLAYER_GUIDE_IMAGES.king,
  },
  {
    key: "guardian",
    emoji: "🛡️",
    name: { en: "Guardian Alpaca", zh: "守护者羊驼" },
    tag: { en: "The Protector", zh: "守护者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "Hunting penalty rate reduced by 50%.",
      zh: "狩猎伤害降低 50%。",
    },
    playstyle: {
      en: "Defensive strategy — better survival under pressure.",
      zh: "防御型策略 — 承受风险能力更高。",
    },
    image: PLAYER_GUIDE_IMAGES.guardian,
  },
  {
    key: "farmer",
    emoji: "🌾",
    name: { en: "Farmer Alpaca", zh: "农夫羊驼" },
    tag: { en: "The Producer", zh: "生产者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "Effective location reward weight ×1.20 (+20%, normalized).",
      zh: "所在地点收益权重 ×1.20（+20%，需归一化）。",
    },
    playstyle: {
      en: "Long-term accumulation — rewards consistent, patient play.",
      zh: "长期累积型 — 适合稳定、耐心的玩家。",
    },
    image: PLAYER_GUIDE_IMAGES.farmer,
  },
  {
    key: "lucky",
    emoji: "🍀",
    name: { en: "Lucky Alpaca", zh: "幸运羊驼" },
    tag: { en: "The Fortune Seeker", zh: "寻运者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "20% chance to fully avoid the day's hunting penalty.",
      zh: "20% 机率完全避免当日狩猎伤害。",
    },
    playstyle: {
      en: "High risk, high reward — depends on fortune.",
      zh: "高风险高报酬 — 依靠幸运翻盘。",
    },
    image: PLAYER_GUIDE_IMAGES.lucky,
  },
  {
    key: "runner",
    emoji: "🏃",
    name: { en: "Runner Alpaca", zh: "奔跑者羊驼" },
    tag: { en: "The Escape Artist", zh: "逃脱大师" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "30% chance to escape hunting (penalty = 0).",
      zh: "30% 机率逃离狩猎（伤害归零）。",
    },
    playstyle: {
      en: "Fast, aggressive strategy — uses escape ability against hunters.",
      zh: "速度与反制型策略 — 利用逃脱能力反制狩猎。",
    },
    image: PLAYER_GUIDE_IMAGES.runner,
  },
  {
    key: "common",
    emoji: "🦙",
    name: { en: "Common Alpaca", zh: "普通羊驼" },
    tag: { en: "The Strategist", zh: "策略家" },
    supply: 479,
    tier: "Common · 479 of 500",
    ability: {
      en: "A standard Alpaca without special abilities — skill and strategy still matter.",
      zh: "没有特殊能力的基础羊驼角色 — 策略与判断仍然决定结果。",
    },
    playstyle: {
      en: "Wins through smart decisions and reading the herd.",
      zh: "靠聪明的决策与判断取胜。",
    },
    image: PLAYER_GUIDE_IMAGES.common,
  },
];

export const GUIDE_LOCATIONS: GuideLocation[] = [
  {
    emoji: "🏠",
    name: { en: "Home", zh: "家园" },
    weight: 1,
    risk: 0,
    desc: {
      en: "The safest location — Cougars cannot enter. Lowest reward.",
      zh: "最安全的地点 — 美洲狮无法进入。最低收益。",
    },
  },
  {
    emoji: "⛰️",
    name: { en: "Mountain", zh: "山区" },
    weight: 2,
    risk: 1,
    desc: {
      en: "Low risk (Hunted Alpacas: -15% Rewards), modest reward.",
      zh: "低风险（被猎羊驼：奖励 -15%），收益偏低。",
    },
  },
  {
    emoji: "🌾",
    name: { en: "Grassland", zh: "草原" },
    weight: 3,
    risk: 2,
    desc: {
      en: "Balanced medium risk (Hunted Alpacas: -25% Rewards) and reward.",
      zh: "中等风险（被猎羊驼：奖励 -25%）与收益。",
    },
  },
  {
    emoji: "🌲",
    name: { en: "Forest", zh: "森林" },
    weight: 5,
    risk: 3,
    desc: {
      en: "Higher reward with increased hunting risk (Hunted Alpacas: -35% Rewards).",
      zh: "较高收益，狩猎风险提高（被猎羊驼：奖励 -35%）。",
    },
  },
  {
    emoji: "🌊",
    name: { en: "River", zh: "河流" },
    weight: 8,
    risk: 4,
    desc: {
      en: "Highest reward. Highest hunting risk (Hunted Alpacas: -45% Rewards).",
      zh: "最高收益。最高狩猎风险（被猎羊驼：奖励 -45%）。",
    },
  },
];

export const GUIDE_CORE_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "📍",
    title: { en: "Choose Location", zh: "选择地点" },
    body: {
      en: "Players choose one location for each NFT before the round begins. Different locations have different risks and reward potential. After confirming, the move is locked for that round.",
      zh: "回合开始前，玩家为每只 NFT 选择一个地点。各地点的风险与收益潜力不同。确认后，该回合的行动即锁定。",
    },
    bullets: [
      { en: "🏠 Home", zh: "🏠 家园" },
      { en: "⛰ Mountain", zh: "⛰ 山区" },
      { en: "🌾 Grassland", zh: "🌾 草原" },
      { en: "🌲 Forest", zh: "🌲 森林" },
      { en: "🌊 River", zh: "🌊 河流" },
    ],
    image: PLAYER_GUIDE_IMAGES.chooseLocation,
    imageAlt: {
      en: "Choose Location page in HANSOME Game",
      zh: "HANSOME 游戏的选择地点页面",
    },
  },
  {
    n: "02",
    emoji: "⚔️",
    title: { en: "Battle Result", zh: "战斗结果" },
    body: {
      en: "When the Battle phase starts, the result is calculated automatically. The battle is resolved automatically when the Battle phase begins — no manual reveal is required. Players simply watch the battle results.",
      zh: "战斗阶段开始时，结果会自动计算。战斗阶段一开始就会自动结算 — 玩家不需手动揭露行动。只需观看战斗结果。",
    },
    bullets: [
      { en: "Which Alpacas survived", zh: "哪些羊驼存活" },
      { en: "Which Cougars successfully hunted", zh: "哪些美洲狮狩猎成功" },
      {
        en: "Trait abilities (King, Guardian, Runner, Lucky, Farmer)",
        zh: "特质能力（王者、守护者、奔跑者、幸运、农夫）",
      },
      { en: "Final HANSOME rewards", zh: "最终 HANSOME 奖励" },
    ],
    image: PLAYER_GUIDE_IMAGES.battleResult,
    imageAlt: {
      en: "Battle Result page in HANSOME Game",
      zh: "HANSOME 游戏的战斗结果页面",
    },
  },
  {
    n: "03",
    emoji: "💰",
    title: { en: "Claim Rewards", zh: "领取奖励" },
    body: {
      en: "Rewards never expire. Players can claim accumulated HANSOME at any time from the dedicated Claim page. Battle viewing and claiming are separate. Even if you don't claim today, your rewards continue accumulating on-chain.",
      zh: "奖励永不过期。玩家可随时在专属的领取页领取累积的 HANSOME。观看战斗与领取奖励是分开的。即使今天不领，奖励仍会持续在链上累积。",
    },
    image: PLAYER_GUIDE_IMAGES.claimRewards,
    imageAlt: {
      en: "Claim page in HANSOME Game",
      zh: "HANSOME 游戏的领取奖励页面",
    },
  },
];

export const GUIDE_COUGAR_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "🎯",
    title: { en: "Choose a Hunt", zh: "选择狩猎地点" },
    body: {
      en: "Choose a huntable location — Mountain, Grassland, Forest, or River. Cougars can never enter Home. After confirming, the hunt location is locked for that round.",
      zh: "选择一个可狩猎地点 — 山区、草原、森林或河流。美洲狮永远无法进入家园。确认后，该回合的狩猎地点即锁定。",
    },
  },
  {
    n: "02",
    emoji: "⚔️",
    title: { en: "Battle Result", zh: "战斗结果" },
    body: {
      en: "The battle is resolved automatically when the Battle phase begins. You watch the hunt outcome — no manual reveal is required.",
      zh: "战斗阶段一开始就会自动结算。你只需观看狩猎结果 — 不需手动揭露行动。",
    },
  },
  {
    n: "03",
    emoji: "🩸",
    title: { en: "Hunt", zh: "狩猎结算" },
    body: {
      en: "If at least one Alpaca is at your location, your hunt succeeds. Claim your share of HANSOME anytime on the Claim page.",
      zh: "只要你的地点至少有一只羊驼，狩猎即成功。可随时在领取页领取你的 HANSOME 份额。",
    },
  },
];

export const GUIDE_PAGE_COUNT = 8;

export const GUIDE_COVER_HERO = [
  { key: "king", label: "👑 King", image: PLAYER_GUIDE_IMAGES.king },
  { key: "guardian", label: "🛡️ Guardian", image: PLAYER_GUIDE_IMAGES.guardian },
  { key: "farmer", label: "🌾 Farmer", image: PLAYER_GUIDE_IMAGES.farmer },
  { key: "lucky", label: "🍀 Lucky", image: PLAYER_GUIDE_IMAGES.lucky },
  { key: "runner", label: "🏃 Runner", image: PLAYER_GUIDE_IMAGES.runner },
] as const;
