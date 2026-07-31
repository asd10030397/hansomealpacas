import type { ActivityLevel, ActivityResult } from "@/lib/hansome-score/types";

export type ActivityInput = {
  volume24hUsd: number | null;
  transactions24h: number | null;
  transfersCount: number | null;
  /** e.g. geckoterminal | blockscout-counters */
  volumeSource: string | null;
};

/**
 * Activity is informational only — never feeds structural Score.
 */
export function computeActivity(input: ActivityInput): ActivityResult {
  const vol = input.volume24hUsd;
  const txs = input.transactions24h;
  const transfers = input.transfersCount;

  let level: ActivityLevel = "Low";
  let source = input.volumeSource ?? "blockscout-counters";
  let note = "Activity is separate from HANSOME Score.";

  const hasVolume = vol != null && Number.isFinite(vol);
  const hasTxs = txs != null && Number.isFinite(txs);

  if (hasVolume && hasTxs && vol! >= 50_000 && txs! >= 100) {
    level = "High";
    note = "High labeled trading activity (volume + txs). Not a safety rating.";
  } else if (
    (hasVolume && vol! >= 1_000) ||
    (hasTxs && txs! >= 20) ||
    // Fallback only when no 24h volume/tx source exists (all-time transfers are weak).
    (!hasVolume && !hasTxs && transfers != null && transfers >= 200)
  ) {
    level = "Medium";
    note = "Medium activity from available labeled sources. Not a safety rating.";
  } else {
    level = "Low";
    if (!hasVolume) {
      source = transfers != null ? "blockscout-counters" : "unavailable";
      note =
        "Low or unavailable volume — ordinary low volume does not penalize Score.";
    } else {
      note = "Low activity. Ordinary low volume does not penalize Score.";
    }
  }

  return {
    level,
    source,
    volume24hUsd: vol,
    transactions24h: txs,
    transfersCount: transfers,
    note,
  };
}
