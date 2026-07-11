/**
 * HANSOME ALPACAS mascot layer IDs — use for Framer Motion / Lottie animation.
 *
 * Blink:     scaleY on #hansome-alpaca-eye-left, #hansome-alpaca-eye-right
 * Breathe:   scale on #hansome-alpaca-head
 * Tilt:      rotate on #hansome-alpaca (root group)
 * Eye move:  translateX/Y on #hansome-alpaca-eyes
 *
 * Not yet wired to a Lottie/SVG asset — placeholder IDs until the final
 * alpaca mascot artwork is delivered and layered.
 */
export const ALPACA_LAYERS = {
  root: "hansome-alpaca",
  ears: "hansome-alpaca-ears",
  earLeft: "hansome-alpaca-ear-left",
  earRight: "hansome-alpaca-ear-right",
  head: "hansome-alpaca-head",
  face: "hansome-alpaca-face",
  snout: "hansome-alpaca-snout",
  eyes: "hansome-alpaca-eyes",
  eyeLeft: "hansome-alpaca-eye-left",
  eyeRight: "hansome-alpaca-eye-right",
  nose: "hansome-alpaca-nose",
  mouth: "hansome-alpaca-mouth",
  neck: "hansome-alpaca-neck",
} as const;

export const ALPACA_COLORS = {
  furPrimary: "#E8D9BE",
  furSecondary: "#C9B590",
  eyes: "#1A1A1A",
  nose: "#4A3728",
  blush: "#D89A9A",
  accent: "#D4AF37",
} as const;
