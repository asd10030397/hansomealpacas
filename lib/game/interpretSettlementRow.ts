/**
 * Pure settlement row interpretation (UI). Used by live settlement view + tests.
 * Does not call contracts or change gameplay math.
 */

import {
  e9ZeroReward,
  isCommitWithoutReveal,
  isRevealPhaseClosed,
  MISSED_REVEAL_OUTCOME,
} from "@/lib/game/missedReveal";
import type { GamePhase } from "@/types/game";

export type LiveSettlementInterpretation = {
  missedReveal: boolean;
  /** Stable key or human placeholder before i18n in the card. */
  outcomeKey: string;
  /** Display reward units for mock; live still prefers claimable wei. */
  rewardHansome: number;
  /** When true, do not run ability / survival activation FX. */
  suppressActivation: boolean;
};

/**
 * Live-chain UI interpretation for one token’s settlement line.
 * Mirrors GDS E9: commit without reveal → 0 rewards after Reveal closes.
 */
export function interpretLiveSettlementRow(input: {
  phase: GamePhase | string;
  dayState?: number | null;
  settled: boolean;
  /** Non-zero commit hash on-chain or local commit secret present. */
  committed: boolean;
  /** On-chain Revealed event / local secret status === revealed. */
  revealed: boolean;
}): LiveSettlementInterpretation {
  const revealPhaseClosed = isRevealPhaseClosed({
    phase: input.phase,
    dayState: input.dayState,
    settled: input.settled,
  });

  if (
    isCommitWithoutReveal({
      revealPhaseClosed,
      committed: input.committed,
      revealed: input.revealed,
    })
  ) {
    return {
      missedReveal: true,
      outcomeKey: MISSED_REVEAL_OUTCOME,
      rewardHansome: e9ZeroReward(),
      suppressActivation: true,
    };
  }

  if (!input.settled) {
    if (input.revealed) {
      return {
        missedReveal: false,
        outcomeKey: "awaiting_settlement",
        rewardHansome: 0,
        suppressActivation: true,
      };
    }
    if (input.committed) {
      return {
        missedReveal: false,
        outcomeKey: "awaiting_reveal",
        rewardHansome: 0,
        suppressActivation: true,
      };
    }
  }

  return {
    missedReveal: false,
    outcomeKey: "settled",
    rewardHansome: 0,
    suppressActivation: false,
  };
}
