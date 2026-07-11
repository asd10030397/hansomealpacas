/**
 * UGLY DEER mascot layer IDs — use for Framer Motion / Lottie animation.
 *
 * Blink:     scaleY on #ugly-deer-eye-left, #ugly-deer-eye-right
 * Breathe:   scale on #ugly-deer-head
 * Tilt:      rotate on #ugly-deer (root group)
 * Eye move:  translateX/Y on #ugly-deer-eyes
 */
export const UGLY_DEER_LAYERS = {
  root: "ugly-deer",
  antlers: "ugly-deer-antlers",
  antlerLeft: "ugly-deer-antler-left",
  antlerRight: "ugly-deer-antler-right",
  head: "ugly-deer-head",
  earLeft: "ugly-deer-ear-left",
  earRight: "ugly-deer-ear-right",
  face: "ugly-deer-face",
  snout: "ugly-deer-snout",
  eyes: "ugly-deer-eyes",
  eyeLeft: "ugly-deer-eye-left",
  eyeRight: "ugly-deer-eye-right",
  nose: "ugly-deer-nose",
  mouth: "ugly-deer-mouth",
  tongue: "ugly-deer-tongue",
} as const;

export const UGLY_DEER_COLORS = {
  furPrimary: "#8B7355",
  furSecondary: "#6B5344",
  eyes: "#1A1A1A",
  nose: "#4A3728",
  tongue: "#C46B6B",
  wart: "#7A8B5A",
} as const;
