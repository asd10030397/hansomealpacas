/**
 * King Alpaca promo trailer scene timeline.
 * Keep in sync with scripts/record-king-promo.mjs + build-king-promo-audio.mjs.
 */

/** Transparent cutouts — built by scripts/build-king-promo-cutouts.mjs */
export const KING_PROMO_ASSETS = {
  king: "/assets/promo/king/king.png",
  cougar: "/assets/promo/king/cougar.png",
  preyA: "/assets/promo/king/prey-a.png",
  preyB: "/assets/promo/king/prey-b.png",
  kingBg: "/pixel/traits/backgrounds/king.png",
  pastureBg: "/pixel/pasture-hero-bg.png",
  logo: "/logo/logo-512.png",
} as const;

export type KingPromoSceneId =
  | "intro"
  | "hunt"
  | "reveal"
  | "immunity"
  | "ending";

export type KingPromoScene = {
  id: KingPromoSceneId;
  durationMs: number;
  bg: string;
  bgTone: "royal" | "hunt";
  goldWash: boolean;
  showKing: boolean;
  showCougar: boolean;
  showPrey: boolean;
  kingClass: string;
  cougarClass: string;
  playKingFx: boolean;
  /** Marketing copy — never frames King as a random skill. */
  lines: string[];
  lineGold?: boolean;
};

/** Total ~24.5s (+ brief lead-in). */
export const KING_PROMO_SCENES: KingPromoScene[] = [
  {
    id: "intro",
    durationMs: 4500,
    bg: KING_PROMO_ASSETS.kingBg,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: false,
    showPrey: false,
    kingClass: "king-promo__char--king-proud",
    cougarClass: "",
    playKingFx: true,
    lines: ["Not every Alpaca is born equal."],
  },
  {
    id: "hunt",
    durationMs: 4500,
    bg: KING_PROMO_ASSETS.pastureBg,
    bgTone: "hunt",
    goldWash: false,
    showKing: false,
    showCougar: true,
    showPrey: true,
    kingClass: "",
    cougarClass: "king-promo__char--cougar-stalk",
    playKingFx: false,
    lines: ["Others become the hunted..."],
  },
  {
    id: "reveal",
    durationMs: 4000,
    bg: KING_PROMO_ASSETS.kingBg,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: true,
    showPrey: false,
    kingClass: "king-promo__char--king-stand",
    cougarClass: "",
    playKingFx: false,
    lines: ["But you..."],
    lineGold: true,
  },
  {
    id: "immunity",
    durationMs: 5500,
    bg: KING_PROMO_ASSETS.kingBg,
    bgTone: "royal",
    goldWash: true,
    showKing: true,
    showCougar: false,
    showPrey: false,
    kingClass: "king-promo__char--king-stand",
    cougarClass: "",
    playKingFx: true,
    lines: [
      "Because you are HANSOME.",
      "You are the King.",
      "You cannot be hunted.",
    ],
    lineGold: true,
  },
  {
    id: "ending",
    durationMs: 5000,
    bg: KING_PROMO_ASSETS.kingBg,
    bgTone: "royal",
    goldWash: true,
    showKing: false,
    showCougar: false,
    showPrey: false,
    kingClass: "",
    cougarClass: "",
    playKingFx: false,
    lines: [],
  },
];
