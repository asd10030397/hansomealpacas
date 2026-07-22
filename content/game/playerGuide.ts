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
  { en: "Choose Location", zh: "選擇地點" },
  { en: "Battle Begins", zh: "戰鬥開始" },
  { en: "Battle Result", zh: "戰鬥結果" },
  { en: "Claim Anytime", zh: "隨時領取" },
];

export const GUIDE_CLASSES: GuideClass[] = [
  {
    key: "king",
    emoji: "👑",
    name: { en: "King Alpaca", zh: "王者羊駝" },
    tag: { en: "The Ultimate Survivor", zh: "終極生存者" },
    supply: 1,
    tier: "Legendary · 1 of 500",
    ability: {
      en: "Permanent immunity to hunting penalty.",
      zh: "永久免疫狩獵傷害。",
    },
    playstyle: {
      en: "The legendary King of the herd — can safely challenge the most dangerous locations.",
      zh: "羊駝族群中的傳說王者 — 可以安全挑戰最高風險地點。",
    },
    image: PLAYER_GUIDE_IMAGES.king,
  },
  {
    key: "guardian",
    emoji: "🛡️",
    name: { en: "Guardian Alpaca", zh: "守護者羊駝" },
    tag: { en: "The Protector", zh: "守護者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "Hunting penalty rate reduced by 50%.",
      zh: "狩獵傷害降低 50%。",
    },
    playstyle: {
      en: "Defensive strategy — better survival under pressure.",
      zh: "防禦型策略 — 承受風險能力更高。",
    },
    image: PLAYER_GUIDE_IMAGES.guardian,
  },
  {
    key: "farmer",
    emoji: "🌾",
    name: { en: "Farmer Alpaca", zh: "農夫羊駝" },
    tag: { en: "The Producer", zh: "生產者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "Effective location reward weight ×1.20 (+20%, normalized).",
      zh: "所在地點收益權重 ×1.20（+20%，需歸一化）。",
    },
    playstyle: {
      en: "Long-term accumulation — rewards consistent, patient play.",
      zh: "長期累積型 — 適合穩定、耐心的玩家。",
    },
    image: PLAYER_GUIDE_IMAGES.farmer,
  },
  {
    key: "lucky",
    emoji: "🍀",
    name: { en: "Lucky Alpaca", zh: "幸運羊駝" },
    tag: { en: "The Fortune Seeker", zh: "尋運者" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "20% chance to fully avoid the day's hunting penalty.",
      zh: "20% 機率完全避免當日狩獵傷害。",
    },
    playstyle: {
      en: "High risk, high reward — depends on fortune.",
      zh: "高風險高報酬 — 依靠幸運翻盤。",
    },
    image: PLAYER_GUIDE_IMAGES.lucky,
  },
  {
    key: "runner",
    emoji: "🏃",
    name: { en: "Runner Alpaca", zh: "奔跑者羊駝" },
    tag: { en: "The Escape Artist", zh: "逃脫大師" },
    supply: 5,
    tier: "Legendary · 5 of 500",
    ability: {
      en: "30% chance to escape hunting (penalty = 0).",
      zh: "30% 機率逃離狩獵（傷害歸零）。",
    },
    playstyle: {
      en: "Fast, aggressive strategy — uses escape ability against hunters.",
      zh: "速度與反制型策略 — 利用逃脫能力反制狩獵。",
    },
    image: PLAYER_GUIDE_IMAGES.runner,
  },
  {
    key: "common",
    emoji: "🦙",
    name: { en: "Common Alpaca", zh: "普通羊駝" },
    tag: { en: "The Strategist", zh: "策略家" },
    supply: 479,
    tier: "Common · 479 of 500",
    ability: {
      en: "A standard Alpaca without special abilities — skill and strategy still matter.",
      zh: "沒有特殊能力的基礎羊駝角色 — 策略與判斷仍然決定結果。",
    },
    playstyle: {
      en: "Wins through smart decisions and reading the herd.",
      zh: "靠聰明的決策與判斷取勝。",
    },
    image: PLAYER_GUIDE_IMAGES.common,
  },
];

export const GUIDE_LOCATIONS: GuideLocation[] = [
  {
    emoji: "🏠",
    name: { en: "Home", zh: "家園" },
    weight: 1,
    risk: 0,
    desc: {
      en: "The safest location — Cougars cannot enter. Lowest reward.",
      zh: "最安全的地點 — 美洲獅無法進入。最低收益。",
    },
  },
  {
    emoji: "⛰️",
    name: { en: "Mountain", zh: "山區" },
    weight: 2,
    risk: 1,
    desc: {
      en: "Low risk (Hunted Alpacas: -15% Rewards), modest reward.",
      zh: "低風險（被獵羊駝：獎勵 -15%），收益偏低。",
    },
  },
  {
    emoji: "🌾",
    name: { en: "Grassland", zh: "草原" },
    weight: 3,
    risk: 2,
    desc: {
      en: "Balanced medium risk (Hunted Alpacas: -25% Rewards) and reward.",
      zh: "中等風險（被獵羊駝：獎勵 -25%）與收益。",
    },
  },
  {
    emoji: "🌲",
    name: { en: "Forest", zh: "森林" },
    weight: 5,
    risk: 3,
    desc: {
      en: "Higher reward with increased hunting risk (Hunted Alpacas: -35% Rewards).",
      zh: "較高收益，狩獵風險提高（被獵羊駝：獎勵 -35%）。",
    },
  },
  {
    emoji: "🌊",
    name: { en: "River", zh: "河流" },
    weight: 8,
    risk: 4,
    desc: {
      en: "Highest reward. Highest hunting risk (Hunted Alpacas: -45% Rewards).",
      zh: "最高收益。最高狩獵風險（被獵羊駝：獎勵 -45%）。",
    },
  },
];

export const GUIDE_CORE_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "📍",
    title: { en: "Choose Location", zh: "選擇地點" },
    body: {
      en: "Players choose one location for each NFT before the round begins. Different locations have different risks and reward potential. After confirming, the move is locked for that round.",
      zh: "回合開始前，玩家為每隻 NFT 選擇一個地點。各地點的風險與收益潛力不同。確認後，該回合的行動即鎖定。",
    },
    bullets: [
      { en: "🏠 Home", zh: "🏠 家園" },
      { en: "⛰ Mountain", zh: "⛰ 山區" },
      { en: "🌾 Grassland", zh: "🌾 草原" },
      { en: "🌲 Forest", zh: "🌲 森林" },
      { en: "🌊 River", zh: "🌊 河流" },
    ],
    image: PLAYER_GUIDE_IMAGES.chooseLocation,
    imageAlt: {
      en: "Choose Location page in HANSOME Game",
      zh: "HANSOME 遊戲的選擇地點頁面",
    },
  },
  {
    n: "02",
    emoji: "⚔️",
    title: { en: "Battle Result", zh: "戰鬥結果" },
    body: {
      en: "When the Battle phase starts, the result is calculated automatically. The battle is resolved automatically when the Battle phase begins — no manual reveal is required. Players simply watch the battle results.",
      zh: "戰鬥階段開始時，結果會自動計算。戰鬥階段一開始就會自動結算 — 玩家不需手動揭露行動。只需觀看戰鬥結果。",
    },
    bullets: [
      { en: "Which Alpacas survived", zh: "哪些羊駝存活" },
      { en: "Which Cougars successfully hunted", zh: "哪些美洲獅狩獵成功" },
      {
        en: "Trait abilities (King, Guardian, Runner, Lucky, Farmer)",
        zh: "特質能力（王者、守護者、奔跑者、幸運、農夫）",
      },
      { en: "Final HANSOME rewards", zh: "最終 HANSOME 獎勵" },
    ],
    image: PLAYER_GUIDE_IMAGES.battleResult,
    imageAlt: {
      en: "Battle Result page in HANSOME Game",
      zh: "HANSOME 遊戲的戰鬥結果頁面",
    },
  },
  {
    n: "03",
    emoji: "💰",
    title: { en: "Claim Rewards", zh: "領取獎勵" },
    body: {
      en: "Rewards never expire. Players can claim accumulated HANSOME at any time from the dedicated Claim page. Battle viewing and claiming are separate. Even if you don't claim today, your rewards continue accumulating on-chain.",
      zh: "獎勵永不過期。玩家可隨時在專屬的領取頁領取累積的 HANSOME。觀看戰鬥與領取獎勵是分開的。即使今天不領，獎勵仍會持續在鏈上累積。",
    },
    image: PLAYER_GUIDE_IMAGES.claimRewards,
    imageAlt: {
      en: "Claim page in HANSOME Game",
      zh: "HANSOME 遊戲的領取獎勵頁面",
    },
  },
];

export const GUIDE_COUGAR_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "🎯",
    title: { en: "Choose a Hunt", zh: "選擇狩獵地點" },
    body: {
      en: "Choose a huntable location — Mountain, Grassland, Forest, or River. Cougars can never enter Home. After confirming, the hunt location is locked for that round.",
      zh: "選擇一個可狩獵地點 — 山區、草原、森林或河流。美洲獅永遠無法進入家園。確認後，該回合的狩獵地點即鎖定。",
    },
  },
  {
    n: "02",
    emoji: "⚔️",
    title: { en: "Battle Result", zh: "戰鬥結果" },
    body: {
      en: "The battle is resolved automatically when the Battle phase begins. You watch the hunt outcome — no manual reveal is required.",
      zh: "戰鬥階段一開始就會自動結算。你只需觀看狩獵結果 — 不需手動揭露行動。",
    },
  },
  {
    n: "03",
    emoji: "🩸",
    title: { en: "Hunt", zh: "狩獵結算" },
    body: {
      en: "If at least one Alpaca is at your location, your hunt succeeds. Claim your share of HANSOME anytime on the Claim page.",
      zh: "只要你的地點至少有一隻羊駝，狩獵即成功。可隨時在領取頁領取你的 HANSOME 份額。",
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
