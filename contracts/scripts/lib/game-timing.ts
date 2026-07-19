/**
 * Day-cycle timings for HansomeGame deployments.
 *
 * Production / Mainnet GDS: Commit 20h + Reveal 4h = Day 24h.
 * Robinhood Testnet (default): Commit 2m + Reveal 2m = Day 4m for fast loop QA.
 *
 * Overrides (seconds):
 *   GAME_DAY_LENGTH_SEC
 *   GAME_COMMIT_DURATION_SEC
 *   GAME_FAST_TIMING=0  — force production timings even on robinhoodTestnet
 *   GAME_FAST_TIMING=1  — force fast timings on any network
 */

export const PROD_COMMIT_DURATION_SEC = 20 * 3600;
export const PROD_REVEAL_DURATION_SEC = 4 * 3600;
export const PROD_DAY_LENGTH_SEC = PROD_COMMIT_DURATION_SEC + PROD_REVEAL_DURATION_SEC;

/** Testnet QA: 2 min commit + 2 min reveal; settlement eligible immediately after reveal. */
export const TESTNET_COMMIT_DURATION_SEC = 2 * 60;
export const TESTNET_REVEAL_DURATION_SEC = 2 * 60;
export const TESTNET_DAY_LENGTH_SEC =
  TESTNET_COMMIT_DURATION_SEC + TESTNET_REVEAL_DURATION_SEC;

export type GameTiming = {
  dayLengthSec: number;
  commitDurationSec: number;
  revealDurationSec: number;
  fast: boolean;
};

export function resolveGameTiming(networkName: string): GameTiming {
  const envDay = process.env.GAME_DAY_LENGTH_SEC?.trim();
  const envCommit = process.env.GAME_COMMIT_DURATION_SEC?.trim();
  if (envDay && envCommit) {
    const dayLengthSec = Number(envDay);
    const commitDurationSec = Number(envCommit);
    if (
      !Number.isFinite(dayLengthSec) ||
      !Number.isFinite(commitDurationSec) ||
      commitDurationSec <= 0 ||
      commitDurationSec >= dayLengthSec
    ) {
      throw new Error(
        "Invalid GAME_DAY_LENGTH_SEC / GAME_COMMIT_DURATION_SEC (need 0 < commit < day)",
      );
    }
    return {
      dayLengthSec,
      commitDurationSec,
      revealDurationSec: dayLengthSec - commitDurationSec,
      fast: dayLengthSec < PROD_DAY_LENGTH_SEC,
    };
  }

  const forceFast = process.env.GAME_FAST_TIMING?.trim() === "1";
  const forceProd = process.env.GAME_FAST_TIMING?.trim() === "0";
  const useFast =
    forceFast || (networkName === "robinhoodTestnet" && !forceProd);

  if (useFast) {
    return {
      dayLengthSec: TESTNET_DAY_LENGTH_SEC,
      commitDurationSec: TESTNET_COMMIT_DURATION_SEC,
      revealDurationSec: TESTNET_REVEAL_DURATION_SEC,
      fast: true,
    };
  }

  return {
    dayLengthSec: PROD_DAY_LENGTH_SEC,
    commitDurationSec: PROD_COMMIT_DURATION_SEC,
    revealDurationSec: PROD_REVEAL_DURATION_SEC,
    fast: false,
  };
}
