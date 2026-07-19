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
} as const;

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
    desc: { en: "Low risk, modest reward.", zh: "低風險，收益偏低。" },
  },
  {
    emoji: "🌿",
    name: { en: "Grassland", zh: "草原" },
    weight: 3,
    risk: 2,
    desc: { en: "Balanced medium risk and reward.", zh: "中等風險與收益。" },
  },
  {
    emoji: "🌲",
    name: { en: "Forest", zh: "森林" },
    weight: 5,
    risk: 3,
    desc: {
      en: "Higher reward with increased hunting risk.",
      zh: "較高收益，同時提高狩獵風險。",
    },
  },
  {
    emoji: "🌊",
    name: { en: "River", zh: "河流" },
    weight: 8,
    risk: 4,
    desc: {
      en: "Highest reward. Highest hunting risk.",
      zh: "最高收益。最高狩獵風險。",
    },
  },
];

export const GUIDE_CORE_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "🔒",
    title: { en: "Commit Move Phase", zh: "提交行動階段" },
    body: {
      en: "Players secretly choose a location. After commitment, the choice cannot be changed.",
      zh: "玩家秘密選擇地點。提交後無法修改。",
    },
  },
  {
    n: "02",
    emoji: "🔎",
    title: { en: "Reveal Move Phase", zh: "揭露行動階段" },
    body: {
      en: "All committed moves are revealed and hunting results are calculated. (This is not NFT Reveal.)",
      zh: "所有已提交的行動被揭露，系統計算狩獵結果。（這不是 NFT 揭示。）",
    },
  },
  {
    n: "03",
    emoji: "🎁",
    title: { en: "Claim Rewards Phase", zh: "領取獎勵階段" },
    body: {
      en: "Players receive rewards based on location, strategy, and gameplay class.",
      zh: "玩家根據地點選擇、策略以及角色能力獲得獎勵。",
    },
  },
];

export const GUIDE_COUGAR_PHASES: GuidePhase[] = [
  {
    n: "01",
    emoji: "🎯",
    title: { en: "Choose a Hunt", zh: "選擇狩獵地點" },
    body: {
      en: "Commit to a huntable location — Mountain, Grassland, Forest, or River. Cougars can never enter Home.",
      zh: "提交一個可狩獵地點 — 山區、草原、森林或河流。美洲獅永遠無法進入家園。",
    },
  },
  {
    n: "02",
    emoji: "🔎",
    title: { en: "Reveal Move", zh: "揭露行動" },
    body: {
      en: "Locations are revealed together with everyone else's during Reveal Move.",
      zh: "在揭露行動時段，與所有玩家一同公開地點。",
    },
  },
  {
    n: "03",
    emoji: "🩸",
    title: { en: "Hunt", zh: "狩獵結算" },
    body: {
      en: "If at least one Alpaca is at your location, your hunt succeeds.",
      zh: "只要你的地點至少有一隻羊駝，狩獵即成功。",
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
