/**
 * KAIRU mascot layer IDs — use for Framer Motion / Lottie animation.
 *
 * Blink:     scaleY on #kairu-eye-left, #kairu-eye-right
 * Breathe:   scale on #kairu-head
 * Tilt:      rotate on #kairu (root group)
 * Eye move:  translateX/Y on #kairu-eyes
 */
export const KAIRU_LAYERS = {
  root: "kairu",
  antlers: "kairu-antlers",
  antlerLeft: "kairu-antler-left",
  antlerRight: "kairu-antler-right",
  head: "kairu-head",
  earLeft: "kairu-ear-left",
  earRight: "kairu-ear-right",
  face: "kairu-face",
  snout: "kairu-snout",
  eyes: "kairu-eyes",
  eyeLeft: "kairu-eye-left",
  eyeRight: "kairu-eye-right",
  nose: "kairu-nose",
  mouth: "kairu-mouth",
} as const;

export const KAIRU_COLORS = {
  furPrimary: "#A98C74",
  furSecondary: "#8A6D56",
  eyes: "#222222",
  nose: "#3B2F2F",
} as const;
