/**
 * Settlement / battle-result presentation timing (UX only).
 * Scale ~1.5× so reward reveals feel readable without feeling laggy.
 */

/** Multiplier applied to Season-1 baseline cue lengths (~1.2–1.4s → ~1.8–2.1s). */
export const PRESENTATION_DURATION_SCALE = 1.5;

/** Gap after one NFT cue finishes before the next starts (ms). */
export const PRESENTATION_INTER_CUE_GAP_MS = 225;

/** Card list entrance stagger between adjacent cards (ms). */
export const SETTLEMENT_CARD_STAGGER_MS = 105;

/** Card fade/slide-in duration (ms) — keep in sync with CSS `hg-settle-in`. */
export const SETTLEMENT_CARD_ENTER_MS = 680;

/** Reward count-up share of the active result cue window. */
export const REWARD_COUNT_UP_RATIO = 0.85;

export function scalePresentationMs(baselineMs: number): number {
  return Math.round(baselineMs * PRESENTATION_DURATION_SCALE);
}
