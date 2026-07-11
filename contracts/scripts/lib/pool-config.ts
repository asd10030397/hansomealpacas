/**
 * Shared HANSOME ALPACAS Uniswap v4 pool defaults.
 * Single source of truth so every pool script (create/remove/verify/diagnose)
 * agrees on the token address and fee tier without re-hardcoding them.
 */

export const HANSOME_ALPACAS_ADDRESS_DEFAULT = "0x2C38Df5F59b04C3F3BB8c9E6C445E211eB1b0875";

/** 0.05% fee tier. */
export const DEFAULT_LP_FEE = 500;

/** Tick spacing paired with the 0.05% fee tier. */
export const DEFAULT_TICK_SPACING = 10;

export function resolveHansomeAddress(): string {
  const fromEnv = process.env.HANSOME_ALPACAS_ADDRESS?.trim();
  return fromEnv || HANSOME_ALPACAS_ADDRESS_DEFAULT;
}

export function resolveLpFee(): number {
  return process.env.POOL_FEE ? Number(process.env.POOL_FEE) : DEFAULT_LP_FEE;
}

export function resolveTickSpacing(): number {
  return process.env.POOL_TICK_SPACING ? Number(process.env.POOL_TICK_SPACING) : DEFAULT_TICK_SPACING;
}
