/**
 * Day-cycle timings for HansomeGame deployments.
 *
 * Production / Mainnet GDS: Commit 20h + Reveal 4h = Day 24h (no Battle pad).
 * Robinhood Testnet (default):
 *   Commit 120s (Choose Location) + Reveal 120s (Battle Result viewing) = Day 240s.
 *   Settle is allowed as soon as Reveal opens — viewing timer never delays
 *   settlement. Mainnet keeps GDS commit–reveal security (settle after Reveal).
 *
 * Overrides (seconds):
 *   GAME_DAY_LENGTH_SEC
 *   GAME_COMMIT_DURATION_SEC
 *   GAME_REVEAL_DURATION_SEC  — optional; default day - commit when day/commit set
 *   GAME_FAST_TIMING=0  — force production timings even on robinhoodTestnet
 *   GAME_FAST_TIMING=1  — force fast timings on any network
 */

export const PROD_COMMIT_DURATION_SEC = 20 * 3600;
export const PROD_REVEAL_DURATION_SEC = 4 * 3600;
export const PROD_DAY_LENGTH_SEC = PROD_COMMIT_DURATION_SEC + PROD_REVEAL_DURATION_SEC;

/** Testnet QA: 120s Choose Location + 120s Battle presentation (instant resolve). */
export const TESTNET_COMMIT_DURATION_SEC = 120;
export const TESTNET_REVEAL_DURATION_SEC = 120;
/** Extra pad after reveal; 0 — Battle presentation IS the reveal window. */
export const TESTNET_BATTLE_DURATION_SEC = 0;
export const TESTNET_DAY_LENGTH_SEC =
  TESTNET_COMMIT_DURATION_SEC +
  TESTNET_REVEAL_DURATION_SEC +
  TESTNET_BATTLE_DURATION_SEC;

export type GameTiming = {
  dayLengthSec: number;
  commitDurationSec: number;
  revealDurationSec: number;
  battleDurationSec: number;
  fast: boolean;
};

function isMainnetNetworkName(networkName: string): boolean {
  return (
    networkName === "robinhood" || networkName.toLowerCase().includes("mainnet")
  );
}

export function resolveGameTiming(networkName: string): GameTiming {
  const envDay = process.env.GAME_DAY_LENGTH_SEC?.trim();
  const envCommit = process.env.GAME_COMMIT_DURATION_SEC?.trim();
  const envReveal = process.env.GAME_REVEAL_DURATION_SEC?.trim();
  const mainnet = isMainnetNetworkName(networkName);

  // Mainnet must never inherit Testnet .env fast timings (common local bleed).
  // Non-GDS Mainnet overrides require an explicit ceremony flag.
  if (mainnet) {
    if (process.env.GAME_FAST_TIMING?.trim() === "1") {
      throw new Error(
        "REFUSED: GAME_FAST_TIMING=1 is forbidden on Mainnet (mainnet|robinhood).",
      );
    }
    const allowNonGds =
      process.env.GAME_ALLOW_NON_GDS_TIMING?.trim() === "1";
    if (!allowNonGds) {
      if (envDay || envCommit || envReveal) {
        console.warn(
          "WARNING: Ignoring GAME_DAY/COMMIT/REVEAL_DURATION_SEC on Mainnet " +
            "(Testnet .env bleed). Set GAME_ALLOW_NON_GDS_TIMING=1 to override intentionally.",
        );
      }
      return {
        dayLengthSec: PROD_DAY_LENGTH_SEC,
        commitDurationSec: PROD_COMMIT_DURATION_SEC,
        revealDurationSec: PROD_REVEAL_DURATION_SEC,
        battleDurationSec: 0,
        fast: false,
      };
    }
  }

  if (envDay && envCommit) {
    const dayLengthSec = Number(envDay);
    const commitDurationSec = Number(envCommit);
    const revealDurationSec = envReveal
      ? Number(envReveal)
      : dayLengthSec - commitDurationSec;
    if (
      !Number.isFinite(dayLengthSec) ||
      !Number.isFinite(commitDurationSec) ||
      !Number.isFinite(revealDurationSec) ||
      commitDurationSec <= 0 ||
      revealDurationSec <= 0 ||
      commitDurationSec + revealDurationSec > dayLengthSec
    ) {
      throw new Error(
        "Invalid GAME_* timing (need commit > 0, reveal > 0, commit + reveal <= day)",
      );
    }
    return {
      dayLengthSec,
      commitDurationSec,
      revealDurationSec,
      battleDurationSec: dayLengthSec - commitDurationSec - revealDurationSec,
      fast: dayLengthSec < PROD_DAY_LENGTH_SEC,
    };
  }

  const forceFast = process.env.GAME_FAST_TIMING?.trim() === "1";
  const forceProd = process.env.GAME_FAST_TIMING?.trim() === "0";
  const useFast =
    !mainnet &&
    (forceFast || (networkName === "robinhoodTestnet" && !forceProd));

  if (useFast) {
    return {
      dayLengthSec: TESTNET_DAY_LENGTH_SEC,
      commitDurationSec: TESTNET_COMMIT_DURATION_SEC,
      revealDurationSec: TESTNET_REVEAL_DURATION_SEC,
      battleDurationSec: TESTNET_BATTLE_DURATION_SEC,
      fast: true,
    };
  }

  return {
    dayLengthSec: PROD_DAY_LENGTH_SEC,
    commitDurationSec: PROD_COMMIT_DURATION_SEC,
    revealDurationSec: PROD_REVEAL_DURATION_SEC,
    battleDurationSec: 0,
    fast: false,
  };
}
