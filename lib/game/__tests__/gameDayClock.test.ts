import { describe, expect, it } from "vitest";
import {
  computeDayIndex,
  derivePhaseFromWindows,
} from "@/hooks/game/useGameState";

describe("game day clock", () => {
  const dayZero = 1_000_000;
  const dayLen = 240;
  const commit = 120;
  const reveal = 120;

  it("matches on-chain currentDay division", () => {
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 0) * 1000)).toBe(0);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 239) * 1000)).toBe(0);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 240) * 1000)).toBe(1);
    expect(computeDayIndex(dayZero, dayLen, (dayZero + 480) * 1000)).toBe(2);
  });

  it("settles to CLAIM immediately — viewing timer does not delay claim", () => {
    const start = dayZero;
    const commitEndsAt = (start + commit) * 1000;
    const revealEndsAt = (start + commit + reveal) * 1000;
    const dayEndsAt = (start + dayLen) * 1000;

    expect(
      derivePhaseFromWindows({
        nowMs: commitEndsAt - 1,
        commitEndsAt,
        revealEndsAt,
        dayEndsAt,
        settled: false,
      }),
    ).toBe("COMMIT");

    expect(
      derivePhaseFromWindows({
        nowMs: commitEndsAt,
        commitEndsAt,
        revealEndsAt,
        dayEndsAt,
        settled: false,
      }),
    ).toBe("REVEAL");

    // Once settled, claim is available immediately (not held for viewing timer).
    expect(
      derivePhaseFromWindows({
        nowMs: commitEndsAt + 5_000,
        commitEndsAt,
        revealEndsAt,
        dayEndsAt,
        settled: true,
      }),
    ).toBe("CLAIM");
  });

  it("does not keep Battle after the calendar day rolls (next day index)", () => {
    const day1Start = dayZero + dayLen;
    expect(computeDayIndex(dayZero, dayLen, day1Start * 1000)).toBe(1);

    const commitEndsAt = (day1Start + commit) * 1000;
    const revealEndsAt = (day1Start + commit + reveal) * 1000;
    expect(
      derivePhaseFromWindows({
        nowMs: day1Start * 1000,
        commitEndsAt,
        revealEndsAt,
        dayEndsAt: (day1Start + dayLen) * 1000,
        settled: false,
      }),
    ).toBe("COMMIT");
  });
});
