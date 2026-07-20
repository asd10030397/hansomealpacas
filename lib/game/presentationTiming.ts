/**
 * Settlement / battle-result presentation timing (UX only).
 * Does not affect polling, relayer retries, API timeouts, Redis TTL,
 * commit/reveal windows, or any on-chain day timing.
 */

/**
 * Multiplier applied to Battle Result visual presentation durations.
 * 2 = half speed (every user-visible settlement animation takes 2× as long).
 */
export const BATTLE_PRESENTATION_DURATION_MULTIPLIER = 2;

/**
 * Season-1 baseline cue scale applied before the battle presentation multiplier.
 * Catalogs pass Season-1 baseline ms into `scalePresentationMs`.
 */
export const PRESENTATION_BASELINE_SCALE = 1.5;

/**
 * Effective scale vs Season-1 baseline cue lengths
 * (`PRESENTATION_BASELINE_SCALE * BATTLE_PRESENTATION_DURATION_MULTIPLIER`).
 */
export const PRESENTATION_DURATION_SCALE =
  PRESENTATION_BASELINE_SCALE * BATTLE_PRESENTATION_DURATION_MULTIPLIER;

/** Scale a current visual delay (ms) by the battle presentation multiplier. */
export function battlePresentationMs(baseMs: number): number {
  return Math.round(baseMs * BATTLE_PRESENTATION_DURATION_MULTIPLIER);
}

/** Scale a CSS / Framer duration expressed in seconds. */
export function battlePresentationSeconds(baseSeconds: number): number {
  return baseSeconds * BATTLE_PRESENTATION_DURATION_MULTIPLIER;
}

/**
 * Scale a Season-1 baseline cue length for Battle Result presentation.
 * Example: scalePresentationMs(1200) → 3600 when multiplier is 2.
 */
export function scalePresentationMs(baselineMs: number): number {
  return battlePresentationMs(
    Math.round(baselineMs * PRESENTATION_BASELINE_SCALE),
  );
}

/** Gap after one NFT cue finishes before the next starts (ms). */
export const PRESENTATION_INTER_CUE_GAP_MS = battlePresentationMs(225);

/** Card list entrance stagger between adjacent cards (ms). */
export const SETTLEMENT_CARD_STAGGER_MS = battlePresentationMs(105);

/** Card fade/slide-in duration (ms) — keep in sync with CSS `hg-settle-in`. */
export const SETTLEMENT_CARD_ENTER_MS = battlePresentationMs(680);

/** Reward count-up share of the active result cue window. */
export const REWARD_COUNT_UP_RATIO = 0.85;

/** Minimum count-up window when a cue duration is very short (ms). */
export const REWARD_COUNT_UP_MIN_MS = battlePresentationMs(400);

/** Fallback reward reveal window when cue duration is unavailable. */
export const REWARD_REVEAL_FALLBACK_MS = scalePresentationMs(1200);

/**
 * Reduced-motion overlay hold (ms). Intentionally NOT multiplied —
 * prefers-reduced-motion keeps the existing short/instant path.
 */
export const PRESENTATION_REDUCED_MOTION_MS = 900;

/**
 * Auto-nav failsafe notice delay (ms). Presentation-only recovery UX;
 * scaled so long doubled queues are not interrupted by the old timeout.
 */
export const PRESENTATION_FAILSAFE_MS = battlePresentationMs(90_000);
