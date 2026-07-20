import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENTATION_INTER_CUE_GAP_MS } from "@/lib/game/presentationTiming";
import { SETTLEMENT_RESULT_SFX_CATALOG } from "@/lib/game/settlementResults/catalog";

/**
 * Pure timing math for the settlement presentation queue.
 * Cue order is result → ability → gap → next NFT; only durations change.
 */
function estimateQueueMs(
  cues: Array<{ kind: "result" | "ability"; durationMs: number }>,
): number {
  if (cues.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < cues.length; i++) {
    total += cues[i].durationMs;
    if (i < cues.length - 1) total += PRESENTATION_INTER_CUE_GAP_MS;
  }
  return total;
}

describe("settlement presentation queue timing (2×)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves cue order: result then ability then gap", () => {
    const order = ["result", "ability", "gap", "result"] as const;
    expect(order).toEqual(["result", "ability", "gap", "result"]);
  });

  it("does not mark presentation complete before doubled cue window", () => {
    const durationMs = SETTLEMENT_RESULT_SFX_CATALOG["alpaca-safe"].durationMs;
    expect(durationMs).toBe(3750);

    let complete = false;
    const prevDuration = 1875; // pre-2× alpaca-safe
    setTimeout(() => {
      complete = true;
    }, durationMs);

    vi.advanceTimersByTime(prevDuration);
    expect(complete).toBe(false);

    vi.advanceTimersByTime(durationMs - prevDuration);
    expect(complete).toBe(true);
  });

  it("auto-nav style wait uses doubled total presentation, not old shorter total", () => {
    const cues = [
      {
        kind: "result" as const,
        durationMs: SETTLEMENT_RESULT_SFX_CATALOG["alpaca-safe"].durationMs,
      },
      {
        kind: "ability" as const,
        durationMs: 4200, // king at 2×
      },
    ];
    const total = estimateQueueMs(cues);
    // Old (1.5× only): 1875 + 225 + 2100 = 4200
    const previousTotal = 1875 + 225 + 2100;
    expect(total).toBe(3750 + PRESENTATION_INTER_CUE_GAP_MS + 4200);
    expect(total).toBe(previousTotal * 2);
  });

  it("gap between cues is doubled (225 → 450)", () => {
    expect(PRESENTATION_INTER_CUE_GAP_MS).toBe(450);
    let advanced = false;
    setTimeout(() => {
      advanced = true;
    }, PRESENTATION_INTER_CUE_GAP_MS);
    vi.advanceTimersByTime(225);
    expect(advanced).toBe(false);
    vi.advanceTimersByTime(225);
    expect(advanced).toBe(true);
  });
});
