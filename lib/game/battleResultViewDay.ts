/**
 * Which day Battle Result should display.
 * During Commit, prefer the previous day so late settlement remains visible.
 */

export function battleResultViewDay(input: {
  currentDay: number;
  phase: "COMMIT" | "REVEAL" | "SETTLEMENT" | "CLAIM";
}): number {
  if (input.phase === "COMMIT" && input.currentDay > 0) {
    return input.currentDay - 1;
  }
  return input.currentDay;
}
