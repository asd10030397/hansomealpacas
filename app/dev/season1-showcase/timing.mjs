/**
 * Shared timing for showcase page + ffmpeg audio mux.
 * Keep in sync with page.tsx constants (mirrored there for client bundling).
 */
export const AUTOSTART_MS = 500;
/** NFT fade/scale in */
export const NFT_ENTER_MS = 450;
/** Hold NFT readable before FX/SFX */
export const NFT_HOLD_MS = 500;
/** Delay from scene mount → FX start */
export const FX_DELAY_MS = NFT_ENTER_MS + NFT_HOLD_MS; // 950
export const GAP_MS = 320;
export const ENDING_MS = 3400;
export const PAD_END_MS = 400;

export const SCENES = [
  { label: "guardian", durationMs: 1200, sfx: "public/audio/game/abilities/guardian/effect.mp3" },
  { label: "runner", durationMs: 1200, sfx: "public/audio/game/abilities/runner/effect.mp3" },
  { label: "lucky", durationMs: 1300, sfx: "public/audio/game/abilities/lucky/effect.mp3" },
  { label: "farmer", durationMs: 1400, sfx: "public/audio/game/abilities/farmer/effect.mp3" },
  { label: "alpaca-hunted", durationMs: 1200, sfx: "public/audio/game/settlement-results/alpaca-hunted/effect.mp3" },
  { label: "alpaca-safe", durationMs: 1250, sfx: "public/audio/game/settlement-results/alpaca-safe/effect.mp3" },
  { label: "cougar-hunt-success", durationMs: 1300, sfx: "public/audio/game/settlement-results/cougar-hunt-success/effect.mp3" },
  { label: "cougar-hunt-failed", durationMs: 1350, sfx: "public/audio/game/settlement-results/cougar-hunt-failed/effect.mp3" },
];
