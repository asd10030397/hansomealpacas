/**
 * Single breakpoint for game chrome (header + dock).
 * Mobile: width ≤ GAME_MOBILE_MAX_PX
 * Desktop: width ≥ GAME_DESKTOP_MIN_PX
 */
export const GAME_MOBILE_MAX_PX = 1023;
export const GAME_DESKTOP_MIN_PX = GAME_MOBILE_MAX_PX + 1;

/** CSS / matchMedia query for the mobile chrome surface. */
export const GAME_MOBILE_MEDIA = `(max-width: ${GAME_MOBILE_MAX_PX}px)`;
